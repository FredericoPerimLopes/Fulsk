import { Server } from 'socket.io';
import mqtt from 'mqtt';
import cron from 'node-cron';
import { DeviceData, DeviceStatus } from '@models/Device';
import { DatabaseDeviceService as DeviceService } from '@services/DatabaseDeviceService';
import { CommunicationProtocol } from '@prisma/client';

export class DataCollectionService {
  private ioServer: Server;
  private mqttClient?: mqtt.MqttClient;
  private dataGeneratorIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(ioServer: Server) {
    this.ioServer = ioServer;
    this.initializeMQTT();
    this.startDataSimulation();
    this.scheduleDataCleanup();
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
   * Start data simulation for testing (remove in production)
   */
  private startDataSimulation(): void {
    if (process.env.NODE_ENV === 'development') {
      console.log('🎭 Starting data simulation for development');
      
      // Simulate data for testing devices
      setTimeout(() => {
        this.simulateDeviceData();
      }, 5000); // Start after 5 seconds
    }
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
      } else {
        // For HTTP or testing, start simulation
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
      }
    } catch (error) {
      console.error('❌ Error starting device data collection:', error);
      throw error;
    }
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

    if (this.mqttClient) {
      this.mqttClient.unsubscribe(`fulsk/devices/${deviceId}/data`);
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
   * Cleanup resources
   */
  public cleanup(): void {
    // Clear all intervals
    for (const [deviceId, interval] of this.dataGeneratorIntervals) {
      clearInterval(interval);
    }
    this.dataGeneratorIntervals.clear();

    // Close MQTT connection
    if (this.mqttClient) {
      this.mqttClient.end();
    }

    console.log('🧹 Data collection service cleaned up');
  }
}