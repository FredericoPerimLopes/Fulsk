import { Server } from 'socket.io';
import mqtt from 'mqtt';
import cron from 'node-cron';
import { DeviceData, DeviceStatus, DeviceType } from '@models/Device';
import { DatabaseDeviceService as DeviceService } from '@services/DatabaseDeviceService';
import { InverterService, InverterData } from '@services/InverterService';
import { ModbusService } from '@services/ModbusService';
import { ModbusDeviceConfig, ModbusConnectionStatus } from '@interfaces/ModbusConfig';
import { CommunicationProtocol } from '@prisma/client';

export class DataCollectionService {
  private ioServer: Server;
  private mqttClient?: mqtt.MqttClient;
  private dataGeneratorIntervals: Map<string, NodeJS.Timeout> = new Map();
  private modbusPollingIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(ioServer: Server) {
    this.ioServer = ioServer;
    this.initializeMQTT();
    this.initializeSunSpec();
    
    // Only start simulation in development mode
    if (process.env.NODE_ENV === 'development') {
      this.startDataSimulation();
    }
    
    this.scheduleDataCleanup();
  }

  /**
   * Initialize SunSpec service for Modbus communication
   */
  private initializeSunSpec(): void {
    console.log('⚙️ Initializing SunSpec service for Modbus communication');
    // SunSpec service is initialized as singleton
    // Additional setup can be done here if needed
  }

  /**
   * Initialize MQTT client for IoT device communication
   */
  private initializeMQTT(): void {
    const mqttUrl = process.env.MQTT_BROKER_URL;
    
    if (mqttUrl) {
      try {
        this.mqttClient = mqtt.connect(mqttUrl, {
          username: process.env.MQTT_USERNAME,
          password: process.env.MQTT_PASSWORD,
          keepalive: 60,
          reconnectPeriod: 5000
        });

        this.mqttClient.on('connect', () => {
          console.log('📡 Connected to MQTT broker');
          
          // Subscribe to device data topics
          this.mqttClient!.subscribe('fulsk/devices/+/data', (err) => {
            if (err) {
              console.error('❌ MQTT subscription error:', err);
            } else {
              console.log('✅ Subscribed to device data topics');
            }
          });
        });

        this.mqttClient.on('message', this.handleMqttMessage.bind(this));

        this.mqttClient.on('error', (error) => {
          console.error('❌ MQTT connection error:', error);
        });

        this.mqttClient.on('close', () => {
          console.log('🔌 MQTT connection closed');
        });
      } catch (error) {
        console.error('❌ Failed to initialize MQTT client:', error);
      }
    } else {
      console.log('ℹ️ MQTT broker URL not configured, running without MQTT');
    }
  }

  /**
   * Handle incoming MQTT messages from IoT devices
   */
  private async handleMqttMessage(topic: string, message: Buffer): Promise<void> {
    try {
      const topicParts = topic.split('/');
      if (topicParts.length >= 4 && topicParts[3] === 'data') {
        const deviceId = topicParts[2];
        const rawData = JSON.parse(message.toString());

        const deviceData: DeviceData = {
          deviceId,
          timestamp: new Date(rawData.timestamp || Date.now()),
          power: rawData.power || 0,
          voltage: rawData.voltage || 0,
          current: rawData.current || 0,
          temperature: rawData.temperature || 0,
          irradiance: rawData.irradiance,
          efficiency: rawData.efficiency,
          energyToday: rawData.energyToday || 0,
          energyTotal: rawData.energyTotal || 0,
          status: rawData.status || DeviceStatus.ONLINE
        };

        await this.processDeviceData(deviceData);
      }
    } catch (error) {
      console.error('❌ Error processing MQTT message:', error);
    }
  }

  /**
   * Process incoming device data
   */
  private async processDeviceData(data: DeviceData): Promise<void> {
    try {
      // Store data in service
      await DeviceService.storeDeviceData(data);

      // Emit real-time data via WebSocket
      this.ioServer.to(`device-${data.deviceId}`).emit('device-data', {
        deviceId: data.deviceId,
        timestamp: data.timestamp,
        power: data.power,
        voltage: data.voltage,
        current: data.current,
        temperature: data.temperature,
        irradiance: data.irradiance,
        efficiency: data.efficiency,
        energyToday: data.energyToday,
        energyTotal: data.energyTotal,
        status: data.status
      });

      // Check for alerts
      await this.checkDeviceAlerts(data);

      console.log(`📊 Processed data for device ${data.deviceId}: ${data.power}W, ${data.temperature}°C`);
    } catch (error) {
      console.error('❌ Error processing device data:', error);
    }
  }

  /**
   * Check device data for alert conditions
   */
  private async checkDeviceAlerts(data: DeviceData): Promise<void> {
    try {
      // Get device configuration for alert thresholds
      const devices = await DeviceService.getAllDevices();
      const device = devices.find(d => d.id === data.deviceId);
      
      if (!device) return;

      const alerts: string[] = [];
      const thresholds = device.configuration.alertThresholds;

      // Check power threshold
      if (data.power < thresholds.minPower) {
        alerts.push(`Low power output: ${data.power}W (minimum: ${thresholds.minPower}W)`);
      }

      // Check temperature threshold
      if (data.temperature > thresholds.maxTemperature) {
        alerts.push(`High temperature: ${data.temperature}°C (maximum: ${thresholds.maxTemperature}°C)`);
      }

      // Check voltage thresholds
      if (data.voltage < thresholds.minVoltage || data.voltage > thresholds.maxVoltage) {
        alerts.push(`Voltage out of range: ${data.voltage}V (range: ${thresholds.minVoltage}-${thresholds.maxVoltage}V)`);
      }

      // Check device status
      if (data.status === DeviceStatus.ERROR) {
        alerts.push('Device reported error status');
      }

      // Emit alerts if any
      if (alerts.length > 0) {
        this.ioServer.to(`device-${data.deviceId}`).emit('device-alerts', {
          deviceId: data.deviceId,
          timestamp: data.timestamp,
          alerts,
          severity: data.status === DeviceStatus.ERROR ? 'critical' : 'warning'
        });

        console.log(`⚠️ Alerts for device ${data.deviceId}:`, alerts);
      }
    } catch (error) {
      console.error('❌ Error checking device alerts:', error);
    }
  }

  /**
   * Start data simulation for development only
   */
  private startDataSimulation(): void {
    console.log('🎭 Starting data simulation for development');
    
    // Simulate data for testing devices
    setTimeout(() => {
      this.simulateDeviceData();
    }, 5000); // Start after 5 seconds
  }

  /**
   * Simulate device data for testing
   */
  private async simulateDeviceData(): Promise<void> {
    try {
      const devices = await DeviceService.getAllDevices();
      
      for (const device of devices) {
        if (device.isActive) {
          const interval = setInterval(async () => {
            const simulatedData: DeviceData = {
              deviceId: device.id,
              timestamp: new Date(),
              power: Math.round((Math.random() * 4000 + 1000) * 100) / 100, // 1000-5000W
              voltage: Math.round((Math.random() * 40 + 220) * 100) / 100, // 220-260V
              current: Math.round((Math.random() * 20 + 5) * 100) / 100, // 5-25A
              temperature: Math.round((Math.random() * 25 + 20) * 100) / 100, // 20-45°C
              irradiance: Math.round((Math.random() * 800 + 200) * 100) / 100, // 200-1000 W/m²
              efficiency: Math.round((Math.random() * 5 + 85) * 100) / 100, // 85-90%
              energyToday: Math.round((Math.random() * 20 + 10) * 100) / 100, // 10-30 kWh
              energyTotal: Math.round((Math.random() * 1000 + 5000) * 100) / 100, // 5000-6000 kWh
              status: Math.random() > 0.95 ? DeviceStatus.ERROR : DeviceStatus.ONLINE
            };

            await this.processDeviceData(simulatedData);
          }, device.configuration.dataCollectionInterval * 1000);

          this.dataGeneratorIntervals.set(device.id, interval);
        }
      }
    } catch (error) {
      console.error('❌ Error starting data simulation:', error);
    }
  }

  /**
   * Start data collection for a specific device
   */
  public async startDeviceDataCollection(deviceId: string): Promise<void> {
    try {
      const devices = await DeviceService.getAllDevices();
      const device = devices.find(d => d.id === deviceId);
      
      if (!device) {
        throw new Error('Device not found');
      }

      // Stop existing interval if any
      const existingInterval = this.dataGeneratorIntervals.get(deviceId);
      if (existingInterval) {
        clearInterval(existingInterval);
      }

      // Start new data collection
      if (device.configuration.communicationProtocol === CommunicationProtocol.MQTT && this.mqttClient) {
        // For MQTT devices, just ensure we're subscribed
        this.mqttClient.subscribe(`fulsk/devices/${deviceId}/data`);
        console.log(`📡 Started MQTT data collection for device ${deviceId}`);
      } else if (device.configuration.communicationProtocol === CommunicationProtocol.MODBUS) {
        // For Modbus devices, start inverter data collection
        await this.startModbusDataCollection(deviceId, device);
      } else if (process.env.NODE_ENV === 'development') {
        // For HTTP or testing, start simulation only in development
        const interval = setInterval(async () => {
          const simulatedData: DeviceData = {
            deviceId,
            timestamp: new Date(),
            power: Math.round((Math.random() * 4000 + 1000) * 100) / 100,
            voltage: Math.round((Math.random() * 40 + 220) * 100) / 100,
            current: Math.round((Math.random() * 20 + 5) * 100) / 100,
            temperature: Math.round((Math.random() * 25 + 20) * 100) / 100,
            irradiance: Math.round((Math.random() * 800 + 200) * 100) / 100,
            efficiency: Math.round((Math.random() * 5 + 85) * 100) / 100,
            energyToday: Math.round((Math.random() * 20 + 10) * 100) / 100,
            energyTotal: Math.round((Math.random() * 1000 + 5000) * 100) / 100,
            status: Math.random() > 0.95 ? DeviceStatus.ERROR : DeviceStatus.ONLINE
          };

          await this.processDeviceData(simulatedData);
        }, device.configuration.dataCollectionInterval * 1000);

        this.dataGeneratorIntervals.set(deviceId, interval);
        console.log(`🎭 Started simulated data collection for device ${deviceId}`);
      } else {
        console.log(`⚠️ Production mode: Device ${deviceId} requires MQTT or HTTP configuration for data collection`);
      }
    } catch (error) {
      console.error('❌ Error starting device data collection:', error);
      throw error;
    }
  }

  /**
   * Start Modbus data collection for devices
   */
  private async startModbusDataCollection(deviceId: string, device: any): Promise<void> {
    try {
      console.log(`🔌 Starting Modbus data collection for device ${deviceId}`);

      // Extract Modbus configuration from device configuration
      const modbusConfig = this.extractModbusConfiguration(device);
      if (!modbusConfig) {
        throw new Error('Invalid Modbus configuration for device');
      }

      // Initialize inverter if it's an inverter device
      if (device.type === DeviceType.INVERTER) {
        await InverterService.initializeModbusConnection(deviceId, modbusConfig);
        
        // Discover device information
        try {
          const deviceInfo = await InverterService.discoverInverter(deviceId);
          if (deviceInfo) {
            console.log(`📋 Discovered inverter: ${deviceInfo.manufacturer} ${deviceInfo.model}`);
          }
        } catch (error) {
          console.warn(`⚠️ Could not discover device info for ${deviceId}, continuing with manual configuration`);
        }

        // Start automatic data collection
        await InverterService.startInverterDataCollection(deviceId);
        
        // Setup periodic data reading
        this.setupModbusDataPolling(deviceId, device);
        
        console.log(`✅ Started Modbus data collection for inverter ${deviceId}`);
      } else {
        console.warn(`⚠️ Modbus protocol not yet supported for device type: ${device.type}`);
      }

    } catch (error) {
      console.error(`❌ Failed to start Modbus data collection for device ${deviceId}:`, error);
      throw error;
    }
  }

  /**
   * Extract Modbus configuration from device configuration
   */
  private extractModbusConfiguration(device: any): Partial<ModbusDeviceConfig> | null {
    try {
      const config = device.configuration;
      
      // Look for Modbus-specific configuration
      const modbusConfig = config.modbus || {};
      
      // Default configuration if not fully specified
      const defaultConfig: Partial<ModbusDeviceConfig> = {
        connection: {
          host: modbusConfig.host || device.location?.address || 'localhost',
          port: modbusConfig.port || 502,
          unitId: modbusConfig.unitId || 1,
          timeout: modbusConfig.timeout || 5000,
          retryAttempts: modbusConfig.retryAttempts || 3,
          retryDelay: modbusConfig.retryDelay || 1000,
          keepAlive: modbusConfig.keepAlive !== false,
          maxConnections: 1
        },
        sunspec: {
          baseRegister: modbusConfig.baseRegister || 40000,
          supportedModels: modbusConfig.supportedModels || [1, 101, 102, 103],
          autoDiscovery: modbusConfig.autoDiscovery !== false,
          maxRegistersPerRead: modbusConfig.maxRegistersPerRead || 125,
          enableCaching: modbusConfig.enableCaching !== false,
          cacheTimeout: modbusConfig.cacheTimeout || 30000
        },
        pollingInterval: device.configuration.dataCollectionInterval || 30,
        validateData: modbusConfig.validateData !== false,
        logLevel: modbusConfig.logLevel || 'info'
      };

      // Validate that we have at least a host
      if (!defaultConfig.connection?.host) {
        console.error('Missing required Modbus configuration: host');
        return null;
      }

      return defaultConfig;
    } catch (error) {
      console.error('Error extracting Modbus configuration:', error);
      return null;
    }
  }

  /**
   * Setup Modbus data polling
   */
  private setupModbusDataPolling(deviceId: string, device: any): void {
    // Stop existing polling if any
    const existingInterval = this.modbusPollingIntervals.get(deviceId);
    if (existingInterval) {
      clearInterval(existingInterval);
    }

    // Create polling interval to read and process Modbus data
    const pollingInterval = (device.configuration.dataCollectionInterval || 30) * 1000;
    
    const interval = setInterval(async () => {
      try {
        if (device.type === DeviceType.INVERTER) {
          const inverterData = await InverterService.readInverterData(deviceId);
          if (inverterData) {
            await this.processDeviceData(inverterData);
          }
        }
      } catch (error) {
        console.error(`❌ Error polling Modbus data for device ${deviceId}:`, error);
      }
    }, config.pollingInterval * 1000);

    this.dataGeneratorIntervals.set(deviceId, interval);
  }

  /**
   * Convert SunSpec data to standard DeviceData format
   */
  private convertSunSpecToDeviceData(sunspecData: SunSpecDeviceData): DeviceData {
    const inverter = sunspecData.inverter;
    const meter = sunspecData.meter;

    return {
      deviceId: sunspecData.deviceId,
      timestamp: sunspecData.timestamp,
      power: inverter?.acPower || meter?.acPower || 0,
      voltage: inverter?.acVoltageAN || inverter?.acVoltageAB || meter?.acVoltageAN || 0,
      current: inverter?.acCurrent || meter?.acCurrent || 0,
      temperature: inverter?.cabinetTemperature || 0,
      irradiance: undefined, // Not available in SunSpec standard models
      efficiency: inverter?.efficiency,
      energyToday: this.calculateDailyEnergy(inverter?.acEnergyWh || meter?.acEnergyWh || 0),
      energyTotal: inverter?.acEnergyWh || meter?.acEnergyWh || 0,
      status: this.convertSunSpecStatusToDeviceStatus(inverter?.operatingState)
    };
  }

  /**
   * Convert SunSpec operating state to DeviceStatus
   */
  private convertSunSpecStatusToDeviceStatus(operatingState?: number): DeviceStatus {
    if (!operatingState) return DeviceStatus.OFFLINE;

    switch (operatingState) {
      case 4: // MPPT (normal operation)
        return DeviceStatus.ONLINE;
      case 1: // Off
      case 2: // Sleeping
      case 8: // Standby
        return DeviceStatus.OFFLINE;
      case 7: // Fault
        return DeviceStatus.ERROR;
      case 3: // Starting
      case 6: // Shutting down
        return DeviceStatus.ONLINE; // Transitional states
      case 5: // Throttled
        return DeviceStatus.ONLINE; // Still producing power
      default:
        return DeviceStatus.OFFLINE;
    }
  }

  /**
   * Calculate daily energy from total energy
   * This is a simplified calculation - in production, you'd store daily reset values
   */
  private calculateDailyEnergy(totalEnergy: number): number {
    // For now, return a percentage of total energy as daily energy
    // In production, this would be calculated based on stored daily reset values
    return Math.min(totalEnergy * 0.1, 50); // Assume max 50 kWh per day
  }

  /**
   * Stop data collection for a specific device
   */
  public stopDeviceDataCollection(deviceId: string): void {
    const interval = this.dataGeneratorIntervals.get(deviceId);
    if (interval) {
      clearInterval(interval);
      this.dataGeneratorIntervals.delete(deviceId);
      console.log(`⏹️ Stopped data collection for device ${deviceId}`);
    }

    // Stop MQTT subscription
    if (this.mqttClient) {
      this.mqttClient.unsubscribe(`fulsk/devices/${deviceId}/data`);
    }

    // Stop SunSpec data collection
    if (this.sunspecDevices.has(deviceId)) {
      sunspecService.stopPolling(deviceId);
      this.sunspecDevices.delete(deviceId);
      console.log(`🔌 Stopped SunSpec data collection for device ${deviceId}`);
    }
  }

  /**
   * Schedule periodic data cleanup
   */
  private scheduleDataCleanup(): void {
    // Run cleanup every day at 2 AM
    cron.schedule('0 2 * * *', async () => {
      console.log('🧹 Running scheduled data cleanup...');
      
      try {
        // This would typically clean old data from database
        // For now, it's just a placeholder since we're using in-memory storage
        console.log('✅ Data cleanup completed');
      } catch (error) {
        console.error('❌ Error during data cleanup:', error);
      }
    });
  }

  /**
   * Get real-time metrics for dashboard
   */
  public async getRealTimeMetrics(): Promise<any> {
    try {
      const devices = await DeviceService.getAllDevices();
      const activeDevices = devices.filter(d => d.isActive);
      
      let totalPower = 0;
      let totalEnergyToday = 0;
      let onlineDevices = 0;
      let errorDevices = 0;

      for (const device of activeDevices) {
        const recentData = await DeviceService.getDeviceData(device.id, device.owner, 1);
        
        if (recentData.length > 0) {
          const data = recentData[0];
          totalPower += data.power;
          totalEnergyToday += data.energyToday;
          
          if (data.status === DeviceStatus.ONLINE) {
            onlineDevices++;
          } else if (data.status === DeviceStatus.ERROR) {
            errorDevices++;
          }
        }
      }

      return {
        totalDevices: activeDevices.length,
        onlineDevices,
        errorDevices,
        totalPower: Math.round(totalPower * 100) / 100,
        totalEnergyToday: Math.round(totalEnergyToday * 100) / 100,
        averageEfficiency: onlineDevices > 0 ? Math.round((onlineDevices / activeDevices.length) * 100) : 0,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('❌ Error getting real-time metrics:', error);
      return null;
    }
  }

  /**
   * Get SunSpec device information
   */
  public getSunSpecDevices(): { [deviceId: string]: any } {
    const result: { [deviceId: string]: any } = {};
    
    for (const [deviceId, config] of this.sunspecDevices) {
      result[deviceId] = {
        configuration: config,
        connectionState: modbusService.getConnectionState(deviceId),
        discoveredModels: sunspecService.getDiscoveredModels(deviceId)
      };
    }
    
    return result;
  }

  /**
   * Get health status of all Modbus connections
   */
  public async getModbusHealthStatus(): Promise<{ [deviceId: string]: boolean }> {
    return await modbusService.healthCheck();
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up data collection service...');

    // Clear all intervals
    for (const [deviceId, interval] of this.dataGeneratorIntervals) {
      clearInterval(interval);
    }
    this.dataGeneratorIntervals.clear();

    // Close MQTT connection
    if (this.mqttClient) {
      this.mqttClient.end();
    }

    // Cleanup SunSpec devices
    for (const deviceId of this.sunspecDevices.keys()) {
      await sunspecService.removeDevice(deviceId);
    }
    this.sunspecDevices.clear();

    // Cleanup SunSpec and Modbus services
    await sunspecService.cleanup();
    await modbusService.cleanup();

    console.log('✅ Data collection service cleaned up');
  }
}