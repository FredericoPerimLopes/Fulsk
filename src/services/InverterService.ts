/**
 * InverterService - Extends DeviceService with inverter-specific operations
 * Provides specialized functionality for solar inverters using Modbus/SunSpec protocol
 */

import { DatabaseDeviceService } from '@services/DatabaseDeviceService';
import { ModbusService } from '@services/ModbusService';
import { Device, DeviceData, DeviceStatus, DeviceType } from '@models/Device';
import { 
  ModbusDeviceConfig, 
  ModbusConnectionStatus, 
  SunSpecDeviceInfo,
  ModbusDeviceConfiguration
} from '@interfaces/ModbusConfig';
import { 
  SUNSPEC_OPERATING_STATES, 
  SUNSPEC_EVENT_FLAGS 
} from '@constants/SunSpecConstants';
import { CommunicationProtocol } from '@prisma/client';

export interface InverterData extends DeviceData {
  // Additional inverter-specific fields
  dcVoltage?: number;
  dcCurrent?: number;
  dcPower?: number;
  acFrequency?: number;
  powerFactor?: number;
  operatingState?: number;
  eventFlags?: number;
  cabinetTemperature?: number;
  heatSinkTemperature?: number;
}

export interface InverterStats {
  deviceId: string;
  totalEnergyProduced: number;
  peakPowerToday: number;
  averageEfficiency: number;
  operatingHours: number;
  performanceRatio: number;
  co2Saved: number; // kg CO2 equivalent
  economicValue: number; // monetary value of energy produced
}

export interface InverterDiagnostics {
  deviceId: string;
  timestamp: Date;
  connectionStatus: ModbusConnectionStatus;
  communicationHealth: 'excellent' | 'good' | 'poor' | 'critical';
  dataQuality: number; // Percentage of successful reads
  lastSuccessfulRead: Date;
  errorCount24h: number;
  warningFlags: string[];
  recommendations: string[];
}

export class InverterService extends DatabaseDeviceService {
  private static modbusClients: Map<string, ModbusService> = new Map();
  private static readonly CO2_PER_KWH = 0.5; // kg CO2 per kWh (varies by location)
  private static readonly ENERGY_PRICE_PER_KWH = 0.12; // USD per kWh (varies by location)

  /**
   * Create a new inverter device with Modbus configuration
   */
  static async createInverter(
    deviceData: any,
    ownerId: string,
    modbusConfig: Partial<ModbusDeviceConfig>,
    installerId?: string
  ): Promise<Device> {
    // Ensure device type is INVERTER
    const inverterData = {
      ...deviceData,
      type: DeviceType.INVERTER,
      configuration: {
        ...deviceData.configuration,
        communicationProtocol: CommunicationProtocol.MODBUS,
        modbus: modbusConfig
      }
    };

    const device = await this.createDevice(inverterData, ownerId, installerId);
    
    // Initialize Modbus connection
    await this.initializeModbusConnection(device.id, modbusConfig);
    
    return device;
  }

  /**
   * Initialize Modbus connection for an inverter
   */
  static async initializeModbusConnection(
    deviceId: string,
    config: Partial<ModbusDeviceConfig>
  ): Promise<void> {
    try {
      const modbusService = new ModbusService(config);
      
      // Setup event handlers
      modbusService.on('connect', () => {
        console.log(`📡 Inverter ${deviceId} connected via Modbus`);
        this.updateDeviceStatus(deviceId, DeviceStatus.ONLINE);
      });

      modbusService.on('disconnect', () => {
        console.log(`📡 Inverter ${deviceId} disconnected`);
        this.updateDeviceStatus(deviceId, DeviceStatus.OFFLINE);
      });

      modbusService.on('error', (error) => {
        console.error(`❌ Inverter ${deviceId} Modbus error:`, error);
        this.updateDeviceStatus(deviceId, DeviceStatus.ERROR);
      });

      modbusService.on('dataRead', async (result) => {
        if (result.success) {
          await this.processInverterData(deviceId, result.parsedData);
        }
      });

      // Store the client
      this.modbusClients.set(deviceId, modbusService);
      
      // Attempt initial connection
      await modbusService.connect();
      
    } catch (error) {
      console.error(`❌ Failed to initialize Modbus connection for inverter ${deviceId}:`, error);
      throw error;
    }
  }

  /**
   * Discover inverter information using SunSpec protocol
   */
  static async discoverInverter(deviceId: string): Promise<SunSpecDeviceInfo | null> {
    const modbusClient = this.modbusClients.get(deviceId);
    if (!modbusClient) {
      throw new Error(`No Modbus connection found for device ${deviceId}`);
    }

    try {
      const deviceInfo = await modbusClient.discoverDevice();
      
      if (deviceInfo) {
        // Update device information in database
        await this.updateDeviceFromSunSpec(deviceId, deviceInfo);
      }
      
      return deviceInfo;
    } catch (error) {
      console.error(`❌ Failed to discover inverter ${deviceId}:`, error);
      throw error;
    }
  }

  /**
   * Update device information from SunSpec discovery
   */
  private static async updateDeviceFromSunSpec(
    deviceId: string,
    sunspecInfo: SunSpecDeviceInfo
  ): Promise<void> {
    try {
      const device = await this.getDeviceById(deviceId, 'system'); // System context for updates
      if (!device) return;

      // Update device with SunSpec information
      await this.updateDevice(deviceId, {
        // Update manufacturer if different
        // Update model if different
        // Update firmware version
        // Note: These fields are not directly updatable in the current schema
        // You might need to add these to the updateDevice method
      }, device.owner);

    } catch (error) {
      console.error(`❌ Failed to update device from SunSpec info:`, error);
    }
  }

  /**
   * Read real-time data from inverter
   */
  static async readInverterData(deviceId: string): Promise<InverterData | null> {
    const modbusClient = this.modbusClients.get(deviceId);
    if (!modbusClient) {
      throw new Error(`No Modbus connection found for device ${deviceId}`);
    }

    try {
      const result = await modbusClient.readDeviceData(deviceId);
      
      if (result.success) {
        return this.parseInverterData(deviceId, result.parsedData);
      } else {
        throw new Error(result.error || 'Failed to read inverter data');
      }
    } catch (error) {
      console.error(`❌ Failed to read inverter data for ${deviceId}:`, error);
      throw error;
    }
  }

  /**
   * Parse SunSpec data into InverterData format
   */
  private static parseInverterData(deviceId: string, sunspecData: any): InverterData {
    const inverterData: InverterData = {
      deviceId,
      timestamp: new Date(),
      power: sunspecData.AC_POWER || 0,
      voltage: sunspecData.AC_VOLTAGE_AN || 0,
      current: sunspecData.AC_CURRENT || 0,
      temperature: sunspecData.CABINET_TEMPERATURE || 0,
      energyToday: sunspecData.AC_ENERGY_WH ? sunspecData.AC_ENERGY_WH / 1000 : 0, // Convert Wh to kWh
      energyTotal: sunspecData.AC_ENERGY_WH ? sunspecData.AC_ENERGY_WH / 1000 : 0,
      status: this.mapOperatingStateToDeviceStatus(sunspecData.OPERATING_STATE),
      
      // Inverter-specific fields
      dcVoltage: sunspecData.DC_VOLTAGE,
      dcCurrent: sunspecData.DC_CURRENT,
      dcPower: sunspecData.DC_POWER,
      acFrequency: sunspecData.AC_FREQUENCY,
      powerFactor: sunspecData.AC_PF,
      operatingState: sunspecData.OPERATING_STATE,
      eventFlags: sunspecData.EVENT_FLAGS,
      cabinetTemperature: sunspecData.CABINET_TEMPERATURE,
      heatSinkTemperature: sunspecData.HEAT_SINK_TEMPERATURE,
      
      // Calculate efficiency if both AC and DC power are available
      efficiency: (sunspecData.AC_POWER && sunspecData.DC_POWER && sunspecData.DC_POWER > 0) 
        ? (sunspecData.AC_POWER / sunspecData.DC_POWER) * 100 
        : undefined
    };

    return inverterData;
  }

  /**
   * Process and store inverter data
   */
  private static async processInverterData(deviceId: string, sunspecData: any): Promise<void> {
    try {
      const inverterData = this.parseInverterData(deviceId, sunspecData);
      
      // Store in database
      await this.storeDeviceData(inverterData);
      
      // Check for alerts
      await this.checkInverterAlerts(inverterData);
      
    } catch (error) {
      console.error(`❌ Failed to process inverter data for ${deviceId}:`, error);
    }
  }

  /**
   * Check for inverter-specific alerts
   */
  private static async checkInverterAlerts(data: InverterData): Promise<void> {
    const alerts: string[] = [];

    // Check operating state
    if (data.operatingState === SUNSPEC_OPERATING_STATES.FAULT) {
      alerts.push('Inverter is in fault state');
    }

    // Check event flags for specific issues
    if (data.eventFlags) {
      if (data.eventFlags & SUNSPEC_EVENT_FLAGS.GROUND_FAULT) {
        alerts.push('Ground fault detected');
      }
      if (data.eventFlags & SUNSPEC_EVENT_FLAGS.DC_OVER_VOLTAGE) {
        alerts.push('DC over-voltage detected');
      }
      if (data.eventFlags & SUNSPEC_EVENT_FLAGS.AC_OVER_VOLTAGE) {
        alerts.push('AC over-voltage detected');
      }
      if (data.eventFlags & SUNSPEC_EVENT_FLAGS.OVER_TEMP) {
        alerts.push('Over-temperature condition');
      }
    }

    // Check efficiency
    if (data.efficiency && data.efficiency < 85) {
      alerts.push(`Low efficiency: ${data.efficiency.toFixed(1)}%`);
    }

    // Check DC to AC power ratio
    if (data.dcPower && data.power && data.dcPower > 0) {
      const efficiency = (data.power / data.dcPower) * 100;
      if (efficiency < 90) {
        alerts.push(`Low conversion efficiency: ${efficiency.toFixed(1)}%`);
      }
    }

    if (alerts.length > 0) {
      console.log(`⚠️ Inverter alerts for ${data.deviceId}:`, alerts);
      // Here you would emit alerts to the notification system
    }
  }

  /**
   * Map SunSpec operating state to DeviceStatus
   */
  private static mapOperatingStateToDeviceStatus(operatingState?: number): DeviceStatus {
    if (!operatingState) return DeviceStatus.OFFLINE;

    switch (operatingState) {
      case SUNSPEC_OPERATING_STATES.MPPT:
        return DeviceStatus.ONLINE;
      case SUNSPEC_OPERATING_STATES.THROTTLED:
        return DeviceStatus.ONLINE;
      case SUNSPEC_OPERATING_STATES.FAULT:
        return DeviceStatus.ERROR;
      case SUNSPEC_OPERATING_STATES.OFF:
      case SUNSPEC_OPERATING_STATES.SLEEPING:
        return DeviceStatus.OFFLINE;
      case SUNSPEC_OPERATING_STATES.STANDBY:
        return DeviceStatus.MAINTENANCE;
      default:
        return DeviceStatus.OFFLINE;
    }
  }

  /**
   * Get inverter statistics
   */
  static async getInverterStats(deviceId: string, userId: string): Promise<InverterStats> {
    const device = await this.getDeviceById(deviceId, userId);
    if (!device || device.type !== DeviceType.INVERTER) {
      throw new Error('Device not found or not an inverter');
    }

    const recentData = await this.getDeviceData(deviceId, userId, 1000); // Get more data for statistics
    
    if (recentData.length === 0) {
      throw new Error('No data available for statistics');
    }

    const totalEnergyProduced = Math.max(...recentData.map(d => d.energyTotal));
    const peakPowerToday = Math.max(...recentData.map(d => d.power));
    const averageEfficiency = recentData.reduce((sum, d) => sum + (d.efficiency || 0), 0) / recentData.length;
    
    // Calculate operating hours (simplified - actual implementation would be more complex)
    const operatingHours = recentData.filter(d => d.status === DeviceStatus.ONLINE).length * 
                          (device.configuration.dataCollectionInterval / 3600);

    // Performance ratio (actual vs expected performance)
    const performanceRatio = averageEfficiency / 100; // Simplified calculation

    const co2Saved = totalEnergyProduced * this.CO2_PER_KWH;
    const economicValue = totalEnergyProduced * this.ENERGY_PRICE_PER_KWH;

    return {
      deviceId,
      totalEnergyProduced,
      peakPowerToday,
      averageEfficiency,
      operatingHours,
      performanceRatio,
      co2Saved,
      economicValue
    };
  }

  /**
   * Get inverter diagnostics
   */
  static async getInverterDiagnostics(deviceId: string): Promise<InverterDiagnostics> {
    const modbusClient = this.modbusClients.get(deviceId);
    if (!modbusClient) {
      throw new Error(`No Modbus connection found for device ${deviceId}`);
    }

    const connectionStatus = modbusClient.getConnectionStatus();
    const totalReads = connectionStatus.successfulReads + connectionStatus.failedReads;
    const dataQuality = totalReads > 0 ? (connectionStatus.successfulReads / totalReads) * 100 : 0;

    // Determine communication health
    let communicationHealth: 'excellent' | 'good' | 'poor' | 'critical';
    if (dataQuality >= 95) communicationHealth = 'excellent';
    else if (dataQuality >= 85) communicationHealth = 'good';
    else if (dataQuality >= 70) communicationHealth = 'poor';
    else communicationHealth = 'critical';

    const warningFlags: string[] = [];
    const recommendations: string[] = [];

    // Check for issues and generate recommendations
    if (connectionStatus.averageResponseTime > 2000) {
      warningFlags.push('High response time');
      recommendations.push('Check network connectivity');
    }

    if (connectionStatus.failedReads > 10) {
      warningFlags.push('Multiple read failures');
      recommendations.push('Verify Modbus configuration');
    }

    if (communicationHealth === 'poor' || communicationHealth === 'critical') {
      recommendations.push('Consider restarting Modbus connection');
    }

    return {
      deviceId,
      timestamp: new Date(),
      connectionStatus,
      communicationHealth,
      dataQuality,
      lastSuccessfulRead: connectionStatus.lastConnected || new Date(0),
      errorCount24h: connectionStatus.failedReads, // Simplified - would need time-based filtering
      warningFlags,
      recommendations
    };
  }

  /**
   * Start data collection for an inverter
   */
  static async startInverterDataCollection(deviceId: string): Promise<void> {
    const modbusClient = this.modbusClients.get(deviceId);
    if (!modbusClient) {
      throw new Error(`No Modbus connection found for device ${deviceId}`);
    }

    // The ModbusService handles automatic data collection
    // This method can be used to ensure the connection is active
    const status = modbusClient.getConnectionStatus();
    if (status.state !== 'CONNECTED') {
      await modbusClient.connect();
    }

    console.log(`📊 Started data collection for inverter ${deviceId}`);
  }

  /**
   * Stop data collection for an inverter
   */
  static async stopInverterDataCollection(deviceId: string): Promise<void> {
    const modbusClient = this.modbusClients.get(deviceId);
    if (modbusClient) {
      await modbusClient.disconnect();
      console.log(`⏹️ Stopped data collection for inverter ${deviceId}`);
    }
  }

  /**
   * Get Modbus connection status for an inverter
   */
  static getInverterConnectionStatus(deviceId: string): ModbusConnectionStatus | null {
    const modbusClient = this.modbusClients.get(deviceId);
    return modbusClient ? modbusClient.getConnectionStatus() : null;
  }

  /**
   * Reconnect inverter Modbus connection
   */
  static async reconnectInverter(deviceId: string): Promise<void> {
    const modbusClient = this.modbusClients.get(deviceId);
    if (!modbusClient) {
      throw new Error(`No Modbus connection found for device ${deviceId}`);
    }

    await modbusClient.disconnect();
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    await modbusClient.connect();
  }

  /**
   * Cleanup inverter connections
   */
  static async cleanupInverterConnections(): Promise<void> {
    console.log('🧹 Cleaning up inverter Modbus connections');
    
    for (const [deviceId, modbusClient] of this.modbusClients) {
      try {
        await modbusClient.cleanup();
        console.log(`✅ Cleaned up connection for inverter ${deviceId}`);
      } catch (error) {
        console.error(`❌ Failed to cleanup connection for inverter ${deviceId}:`, error);
      }
    }
    
    this.modbusClients.clear();
  }

  /**
   * Get all connected inverters
   */
  static getConnectedInverters(): string[] {
    return Array.from(this.modbusClients.keys());
  }

  /**
   * Export inverter data for analysis
   */
  static async exportInverterData(
    deviceId: string,
    userId: string,
    startDate: Date,
    endDate: Date,
    format: 'csv' | 'json' = 'json'
  ): Promise<string> {
    const device = await this.getDeviceById(deviceId, userId);
    if (!device || device.type !== DeviceType.INVERTER) {
      throw new Error('Device not found or not an inverter');
    }

    // This would need to be implemented with proper date filtering
    const data = await this.getDeviceData(deviceId, userId, 10000);
    
    if (format === 'csv') {
      // Convert to CSV format
      const csvHeaders = 'timestamp,power,voltage,current,temperature,efficiency,energyToday,energyTotal,status\n';
      const csvData = data.map(d => 
        `${d.timestamp.toISOString()},${d.power},${d.voltage},${d.current},${d.temperature},${d.efficiency || ''},${d.energyToday},${d.energyTotal},${d.status}`
      ).join('\n');
      
      return csvHeaders + csvData;
    } else {
      return JSON.stringify(data, null, 2);
    }
  }
}