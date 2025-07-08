import { Server } from 'socket.io';
import mqtt from 'mqtt';
import cron from 'node-cron';
import { DeviceData, DeviceStatus, DeviceType } from '@models/Device';
import { DatabaseDeviceService as DeviceService } from '@services/DatabaseDeviceService';
import { InverterService, InverterData } from '@services/InverterService';
import { ModbusService, modbusService } from '@services/ModbusService';
import { sunspecService } from '@services/SunSpecService';
import { ModbusDeviceConfig, ModbusConnectionStatus } from '@interfaces/ModbusConfig';
import { CommunicationProtocol } from '@prisma/client';
import { logError, logInfo, logWarn, logDebug } from '@utils/logger';
import { AppError } from '@middleware/errorHandler';

// Type definitions
interface SunSpecDeviceData {
  deviceId: string;
  timestamp: Date;
  inverter?: any;
  meter?: any;
}

interface DataCollectionConfig {
  mqttReconnectInterval: number;
  mqttKeepAlive: number;
  dataRetentionDays: number;
  pollingIntervalMs: number;
  cacheExpiryMs: number;
}

export class DataCollectionService {
  private ioServer: Server;
  private mqttClient?: mqtt.MqttClient;
  private dataGeneratorIntervals: Map<string, NodeJS.Timeout> = new Map();
  private modbusPollingIntervals: Map<string, NodeJS.Timeout> = new Map();
  private sunspecDevices: Map<string, any> = new Map();
  private dataCache: Map<string, { data: any; timestamp: number }> = new Map();
  private cleanupJob?: cron.ScheduledTask;
  private config: DataCollectionConfig;
  private isShuttingDown = false;

  constructor(ioServer: Server, config?: Partial<DataCollectionConfig>) {
    this.ioServer = ioServer;
    this.config = {
      mqttReconnectInterval: 5000,
      mqttKeepAlive: 60,
      dataRetentionDays: 30,
      pollingIntervalMs: 5000,
      cacheExpiryMs: 60000,
      ...config
    };
    
    this.initialize();
  }

  /**
   * Initialize all services with proper error handling
   */
  private async initialize(): Promise<void> {
    try {
      await this.initializeMQTT();
      await this.initializeSunSpec();
      
      // Only start simulation in development mode
      if (process.env.NODE_ENV === 'development') {
        this.startDataSimulation();
      }
      
      this.scheduleDataCleanup();
      this.startCacheCleanup();
      
      logInfo('DataCollectionService initialized successfully');
    } catch (error) {
      logError(error as Error, { context: 'DataCollectionService initialization failed' });
      throw error;
    }
  }

  /**
   * Initialize SunSpec service for Modbus communication
   */
  private async initializeSunSpec(): Promise<void> {
    try {
      logInfo('Initializing SunSpec service for Modbus communication');
      
      // Get all devices with Modbus protocol
      const devices = await DeviceService.getDevicesByProtocol(CommunicationProtocol.MODBUS);
      
      for (const device of devices) {
        if (device.modbusConfig) {
          try {
            await this.initializeModbusDevice(device.id, device.modbusConfig as ModbusDeviceConfig);
          } catch (error) {
            logError(error as Error, { 
              context: 'Failed to initialize Modbus device', 
              deviceId: device.id 
            });
          }
        }
      }
    } catch (error) {
      logError(error as Error, { context: 'SunSpec initialization failed' });
      throw error;
    }
  }

  /**
   * Initialize MQTT client with proper error handling and reconnection
   */
  private async initializeMQTT(): Promise<void> {
    const mqttUrl = process.env.MQTT_BROKER_URL;
    
    if (!mqttUrl) {
      logInfo('MQTT broker URL not configured, running without MQTT');
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        this.mqttClient = mqtt.connect(mqttUrl, {
          username: process.env.MQTT_USERNAME,
          password: process.env.MQTT_PASSWORD,
          keepalive: this.config.mqttKeepAlive,
          reconnectPeriod: this.config.mqttReconnectInterval,
          clean: true,
          clientId: `fulsk-backend-${process.env.NODE_ENV}-${Date.now()}`
        });

        const connectionTimeout = setTimeout(() => {
          reject(new Error('MQTT connection timeout'));
        }, 30000);

        this.mqttClient.on('connect', () => {
          clearTimeout(connectionTimeout);
          logInfo('Connected to MQTT broker');
          
          // Subscribe to device data topics
          this.mqttClient!.subscribe('fulsk/devices/+/data', { qos: 1 }, (err) => {
            if (err) {
              logError(err, { context: 'MQTT subscription error' });
              reject(err);
            } else {
              logInfo('Subscribed to device data topics');
              resolve();
            }
          });
        });

        this.mqttClient.on('message', this.handleMqttMessage.bind(this));

        this.mqttClient.on('error', (error) => {
          logError(error, { context: 'MQTT connection error' });
          if (!this.mqttClient?.connected) {
            clearTimeout(connectionTimeout);
            reject(error);
          }
        });

        this.mqttClient.on('close', () => {
          logWarn('MQTT connection closed');
        });

        this.mqttClient.on('offline', () => {
          logWarn('MQTT client offline');
        });

        this.mqttClient.on('reconnect', () => {
          logInfo('MQTT client reconnecting');
        });

      } catch (error) {
        logError(error as Error, { context: 'Failed to initialize MQTT client' });
        reject(error);
      }
    });
  }

  /**
   * Handle incoming MQTT messages with validation
   */
  private async handleMqttMessage(topic: string, message: Buffer): Promise<void> {
    try {
      const topicParts = topic.split('/');
      if (topicParts.length < 4 || topicParts[3] !== 'data') {
        logWarn('Invalid MQTT topic format', { topic });
        return;
      }

      const deviceId = topicParts[2];
      const data = JSON.parse(message.toString());

      // Validate data structure
      if (!this.validateDeviceData(data)) {
        logWarn('Invalid device data received', { deviceId, topic });
        return;
      }

      // Process and store the data
      await this.processDeviceData(deviceId, data);
      
      // Emit to WebSocket clients
      this.ioServer.to(`device-${deviceId}`).emit('device-data', {
        deviceId,
        data,
        timestamp: new Date()
      });

      logDebug('Processed MQTT message', { deviceId, topic });
    } catch (error) {
      logError(error as Error, { 
        context: 'Failed to handle MQTT message', 
        topic 
      });
    }
  }

  /**
   * Validate device data structure
   */
  private validateDeviceData(data: any): boolean {
    return (
      data &&
      typeof data === 'object' &&
      (data.power !== undefined || data.voltage !== undefined || data.current !== undefined)
    );
  }

  /**
   * Initialize Modbus device with error handling
   */
  private async initializeModbusDevice(deviceId: string, config: ModbusDeviceConfig): Promise<void> {
    try {
      const extractedConfig = await DeviceService.extractModbusConfig(deviceId);
      if (!extractedConfig) {
        throw new Error('Failed to extract Modbus configuration');
      }

      // Start polling for this device
      await this.startModbusPolling(deviceId, extractedConfig);
      
      logInfo('Initialized Modbus device', { deviceId });
    } catch (error) {
      logError(error as Error, { 
        context: 'Failed to initialize Modbus device', 
        deviceId 
      });
      throw error;
    }
  }

  /**
   * Start Modbus polling with proper interval management
   */
  private async startModbusPolling(deviceId: string, config: ModbusDeviceConfig): Promise<void> {
    // Clear existing interval if any
    this.stopModbusPolling(deviceId);

    const pollDevice = async () => {
      if (this.isShuttingDown) return;

      try {
        const data = await modbusService.readDeviceData(deviceId);
        if (data) {
          await this.processDeviceData(deviceId, data);
          
          // Update cache
          this.dataCache.set(deviceId, {
            data,
            timestamp: Date.now()
          });

          // Emit to WebSocket clients
          this.ioServer.to(`device-${deviceId}`).emit('device-data', {
            deviceId,
            data,
            timestamp: new Date()
          });
        }
      } catch (error) {
        logError(error as Error, { 
          context: 'Modbus polling error', 
          deviceId 
        });
        
        // Implement exponential backoff for errors
        const currentInterval = this.modbusPollingIntervals.get(deviceId);
        if (currentInterval) {
          clearInterval(currentInterval);
          const backoffDelay = Math.min(this.config.pollingIntervalMs * 2, 60000);
          setTimeout(() => {
            if (!this.isShuttingDown) {
              this.startModbusPolling(deviceId, config);
            }
          }, backoffDelay);
        }
      }
    };

    // Initial poll
    await pollDevice();

    // Set up interval
    const interval = setInterval(pollDevice, this.config.pollingIntervalMs);
    this.modbusPollingIntervals.set(deviceId, interval);
  }

  /**
   * Stop Modbus polling for a device
   */
  private stopModbusPolling(deviceId: string): void {
    const interval = this.modbusPollingIntervals.get(deviceId);
    if (interval) {
      clearInterval(interval);
      this.modbusPollingIntervals.delete(deviceId);
    }
  }

  /**
   * Process and store device data with transaction
   */
  private async processDeviceData(deviceId: string, data: any): Promise<void> {
    try {
      await DeviceService.storeDeviceData(deviceId, data);
      await DeviceService.updateDeviceStatus(deviceId, DeviceStatus.ONLINE);
    } catch (error) {
      logError(error as Error, { 
        context: 'Failed to process device data', 
        deviceId 
      });
      throw error;
    }
  }

  /**
   * Start data simulation for development
   */
  private startDataSimulation(): void {
    logInfo('Starting data simulation for development environment');
    
    // Simulate data for test devices
    const testDeviceIds = ['test-inverter-1', 'test-inverter-2'];
    
    testDeviceIds.forEach(deviceId => {
      const interval = setInterval(() => {
        if (this.isShuttingDown) return;
        
        const simulatedData = this.generateSimulatedData();
        
        this.ioServer.to(`device-${deviceId}`).emit('device-data', {
          deviceId,
          data: simulatedData,
          timestamp: new Date()
        });

        // Store in cache
        this.dataCache.set(deviceId, {
          data: simulatedData,
          timestamp: Date.now()
        });

      }, 5000);

      this.dataGeneratorIntervals.set(deviceId, interval);
    });
  }

  /**
   * Generate simulated inverter data
   */
  private generateSimulatedData(): InverterData {
    const baseLoad = 3000;
    const variation = Math.sin(Date.now() / 10000) * 1000;
    const noise = (Math.random() - 0.5) * 200;
    const power = Math.max(0, baseLoad + variation + noise);

    return {
      power: Math.round(power),
      voltage: 230 + (Math.random() - 0.5) * 10,
      current: power / 230,
      frequency: 50 + (Math.random() - 0.5) * 0.2,
      powerFactor: 0.95 + (Math.random() - 0.5) * 0.1,
      energy: Math.round(Math.random() * 100000),
      temperature: 25 + Math.random() * 20,
      status: power > 0 ? 'normal' : 'standby',
      timestamp: new Date()
    };
  }

  /**
   * Schedule periodic data cleanup
   */
  private scheduleDataCleanup(): void {
    // Run cleanup daily at 2 AM
    this.cleanupJob = cron.schedule('0 2 * * *', async () => {
      if (this.isShuttingDown) return;
      
      try {
        logInfo('Starting scheduled data cleanup');
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.config.dataRetentionDays);
        
        const deletedCount = await DeviceService.cleanupOldData(cutoffDate);
        logInfo(`Cleaned up ${deletedCount} old data records`);
      } catch (error) {
        logError(error as Error, { context: 'Data cleanup failed' });
      }
    });
  }

  /**
   * Start cache cleanup interval
   */
  private startCacheCleanup(): void {
    setInterval(() => {
      if (this.isShuttingDown) return;
      
      const now = Date.now();
      const expiredKeys: string[] = [];

      this.dataCache.forEach((value, key) => {
        if (now - value.timestamp > this.config.cacheExpiryMs) {
          expiredKeys.push(key);
        }
      });

      expiredKeys.forEach(key => this.dataCache.delete(key));
      
      if (expiredKeys.length > 0) {
        logDebug(`Cleaned ${expiredKeys.length} expired cache entries`);
      }
    }, 60000); // Run every minute
  }

  /**
   * Get real-time metrics for all devices
   */
  public async getRealTimeMetrics(): Promise<any> {
    try {
      const devices = await DeviceService.getAllDevices();
      const metrics = await Promise.all(
        devices.map(async (device) => {
          const cachedData = this.dataCache.get(device.id);
          const latestData = cachedData?.data || await DeviceService.getLatestDeviceData(device.id);
          
          return {
            deviceId: device.id,
            name: device.name,
            type: device.type,
            status: device.status,
            data: latestData
          };
        })
      );

      return {
        timestamp: new Date(),
        deviceCount: devices.length,
        devices: metrics
      };
    } catch (error) {
      logError(error as Error, { context: 'Failed to get real-time metrics' });
      throw error;
    }
  }

  /**
   * Cleanup resources gracefully
   */
  public async cleanup(): Promise<void> {
    logInfo('Cleaning up DataCollectionService resources');
    this.isShuttingDown = true;

    // Clear all intervals
    this.dataGeneratorIntervals.forEach(interval => clearInterval(interval));
    this.dataGeneratorIntervals.clear();

    this.modbusPollingIntervals.forEach(interval => clearInterval(interval));
    this.modbusPollingIntervals.clear();

    // Stop cron job
    if (this.cleanupJob) {
      this.cleanupJob.stop();
    }

    // Disconnect MQTT
    if (this.mqttClient && this.mqttClient.connected) {
      await new Promise<void>((resolve) => {
        this.mqttClient!.end(false, {}, () => {
          logInfo('MQTT client disconnected');
          resolve();
        });
      });
    }

    // Clear cache
    this.dataCache.clear();

    // Close Modbus connections
    for (const [deviceId, _] of this.sunspecDevices) {
      try {
        await modbusService.disconnect(deviceId);
      } catch (error) {
        logError(error as Error, { 
          context: 'Error disconnecting Modbus device', 
          deviceId 
        });
      }
    }

    logInfo('DataCollectionService cleanup completed');
  }
}

// Export singleton instance
let dataCollectionService: DataCollectionService | null = null;

export const getDataCollectionService = (ioServer?: Server): DataCollectionService => {
  if (!dataCollectionService && ioServer) {
    dataCollectionService = new DataCollectionService(ioServer);
  }
  if (!dataCollectionService) {
    throw new Error('DataCollectionService not initialized');
  }
  return dataCollectionService;
};