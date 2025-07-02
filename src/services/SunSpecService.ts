/**
 * SunSpecService - SunSpec protocol decoder and model handler
 * Provides high-level SunSpec data processing for solar inverters
 */

import { modbusService } from './ModbusService';
import {
  SunSpecDeviceData,
  SunSpecCommonModel,
  SunSpecInverterModel,
  SunSpecMeterModel,
  SunSpecConfiguration,
  SunSpecModelType,
  SunSpecModelDiscovery,
  SunSpecProcessingResult,
  ModbusReadResult,
  InverterOperatingState,
  SunSpecError
} from '@models/SunSpecModels';
import {
  SUNSPEC_REGISTER_MAP,
  SUNSPEC_STANDARD_ADDRESSES,
  getRegisterMapping,
  validateSunSpecIdentifier
} from '@utils/SunSpecRegisterMap';

export class SunSpecService {
  private deviceConfigurations: Map<string, SunSpecConfiguration> = new Map();
  private discoveredModels: Map<string, SunSpecModelDiscovery> = new Map();
  private pollingTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    // Setup cleanup on process exit
    process.on('SIGINT', this.cleanup.bind(this));
    process.on('SIGTERM', this.cleanup.bind(this));
  }

  /**
   * Configure a SunSpec device
   */
  async configureDevice(deviceId: string, configuration: SunSpecConfiguration): Promise<boolean> {
    try {
      console.log(`⚙️ Configuring SunSpec device ${deviceId}`);

      // Store configuration
      this.deviceConfigurations.set(deviceId, configuration);

      // Connect to Modbus device
      const connected = await modbusService.connectDevice(deviceId, configuration.modbusConnection);
      
      if (!connected) {
        throw new SunSpecError('Failed to connect to Modbus device', 'CONNECTION_FAILED', deviceId);
      }

      // Perform SunSpec discovery if enabled
      if (configuration.autoDiscovery) {
        const discovery = await this.discoverSunSpecModels(deviceId);
        if (!discovery) {
          throw new SunSpecError('SunSpec device discovery failed', 'DISCOVERY_FAILED', deviceId);
        }
      }

      // Start polling if configured
      if (configuration.pollingInterval > 0) {
        this.startPolling(deviceId);
      }

      console.log(`✅ Successfully configured SunSpec device ${deviceId}`);
      return true;

    } catch (error) {
      console.error(`❌ Failed to configure SunSpec device ${deviceId}:`, error);
      return false;
    }
  }

  /**
   * Discover SunSpec models on a device
   */
  async discoverSunSpecModels(deviceId: string): Promise<SunSpecModelDiscovery | null> {
    try {
      console.log(`🔍 Discovering SunSpec models on device ${deviceId}`);

      // Read SunSpec identifier
      const identifierResult = await modbusService.readHoldingRegisters(
        deviceId, 
        SUNSPEC_STANDARD_ADDRESSES.SUNSPEC_IDENTIFIER, 
        2
      );

      if (!identifierResult.success || !validateSunSpecIdentifier(identifierResult.rawData)) {
        throw new SunSpecError('Invalid SunSpec identifier', 'INVALID_SUNSPEC_ID', deviceId);
      }

      // Start model discovery from common model
      const availableModels: {
        modelType: SunSpecModelType;
        startRegister: number;
        length: number;
      }[] = [];

      let currentRegister = SUNSPEC_STANDARD_ADDRESSES.COMMON_MODEL_START + 2; // Skip identifier
      let totalRegistersScan = 0;
      const maxScanRegisters = SUNSPEC_STANDARD_ADDRESSES.DEFAULT_REGISTER_COUNT;

      // Always add common model
      availableModels.push({
        modelType: SunSpecModelType.COMMON,
        startRegister: SUNSPEC_STANDARD_ADDRESSES.COMMON_MODEL_START,
        length: getRegisterMapping(SunSpecModelType.COMMON)?.length || 69
      });

      currentRegister += 69; // Skip common model

      // Scan for additional models
      while (totalRegistersScan < maxScanRegisters) {
        try {
          // Read model ID and length
          const modelHeader = await modbusService.readHoldingRegisters(deviceId, currentRegister, 2);
          
          if (!modelHeader.success || modelHeader.registers.length < 2) {
            break;
          }

          const modelId = modelHeader.registers[0];
          const modelLength = modelHeader.registers[1];

          // Check for end marker
          if (modelId === SUNSPEC_STANDARD_ADDRESSES.MODEL_END_MARKER) {
            break;
          }

          // Validate model type
          const modelType = this.getModelTypeFromId(modelId);
          if (modelType) {
            availableModels.push({
              modelType,
              startRegister: currentRegister,
              length: modelLength
            });

            console.log(`📋 Found SunSpec model ${modelId} (${SunSpecModelType[modelType]}) at register ${currentRegister}`);
          }

          // Move to next model
          currentRegister += modelLength + 2; // +2 for model ID and length
          totalRegistersScan += modelLength + 2;

        } catch (error) {
          console.warn(`⚠️ Error during model discovery at register ${currentRegister}:`, error);
          break;
        }
      }

      const discovery: SunSpecModelDiscovery = {
        deviceId,
        sunspecId: SUNSPEC_STANDARD_ADDRESSES.SUNSPEC_ID,
        availableModels,
        totalRegisters: totalRegistersScan
      };

      this.discoveredModels.set(deviceId, discovery);

      console.log(`✅ Discovered ${availableModels.length} SunSpec models on device ${deviceId}`);
      return discovery;

    } catch (error) {
      console.error(`❌ SunSpec model discovery failed for device ${deviceId}:`, error);
      return null;
    }
  }

  /**
   * Read all SunSpec data from a device
   */
  async readDeviceData(deviceId: string): Promise<SunSpecDeviceData | null> {
    try {
      const configuration = this.deviceConfigurations.get(deviceId);
      const discovery = this.discoveredModels.get(deviceId);

      if (!configuration) {
        throw new SunSpecError('Device not configured', 'NOT_CONFIGURED', deviceId);
      }

      const deviceData: SunSpecDeviceData = {
        deviceId,
        timestamp: new Date(),
        common: {} as SunSpecCommonModel,
        connectionInfo: configuration.modbusConnection
      };

      // Read common model (required)
      const commonData = await this.readCommonModel(deviceId);
      if (commonData) {
        deviceData.common = commonData;
      }

      // Read other models based on discovery or configuration
      const modelsToRead = discovery?.availableModels || [];

      for (const model of modelsToRead) {
        if (model.modelType === SunSpecModelType.COMMON) {
          continue; // Already read
        }

        try {
          if (this.isInverterModel(model.modelType)) {
            const inverterData = await this.readInverterModel(deviceId, model.modelType, model.startRegister);
            if (inverterData) {
              deviceData.inverter = inverterData;
            }
          } else if (this.isMeterModel(model.modelType)) {
            const meterData = await this.readMeterModel(deviceId, model.modelType, model.startRegister);
            if (meterData) {
              deviceData.meter = meterData;
            }
          }
        } catch (error) {
          console.warn(`⚠️ Failed to read model ${SunSpecModelType[model.modelType]} from device ${deviceId}:`, error);
        }
      }

      console.log(`✅ Successfully read SunSpec data from device ${deviceId}`);
      return deviceData;

    } catch (error) {
      console.error(`❌ Failed to read SunSpec data from device ${deviceId}:`, error);
      return null;
    }
  }

  /**
   * Read SunSpec Common Model
   */
  private async readCommonModel(deviceId: string): Promise<SunSpecCommonModel | null> {
    try {
      const mapping = getRegisterMapping(SunSpecModelType.COMMON);
      if (!mapping) return null;

      const result = await modbusService.readHoldingRegisters(
        deviceId,
        mapping.startRegister,
        mapping.length,
        SunSpecModelType.COMMON
      );

      if (!result.success) return null;

      return {
        deviceId,
        manufacturer: this.extractString(result.registers, 2, 16),
        model: this.extractString(result.registers, 18, 16),
        options: this.extractString(result.registers, 34, 8),
        version: this.extractString(result.registers, 42, 8),
        serialNumber: this.extractString(result.registers, 50, 16),
        deviceAddress: result.registers[66] || 1
      };

    } catch (error) {
      console.error(`❌ Failed to read common model from device ${deviceId}:`, error);
      return null;
    }
  }

  /**
   * Read SunSpec Inverter Model
   */
  private async readInverterModel(deviceId: string, modelType: SunSpecModelType, startRegister: number): Promise<SunSpecInverterModel | null> {
    try {
      const mapping = getRegisterMapping(modelType);
      if (!mapping) return null;

      const result = await modbusService.readHoldingRegisters(
        deviceId,
        startRegister + 2, // Skip model ID and length
        mapping.length - 2,
        modelType
      );

      if (!result.success) return null;

      // Parse data based on model type
      if (modelType === SunSpecModelType.INVERTER_THREE_PHASE) {
        return this.parseThreePhaseInverterData(result.registers);
      } else if (modelType === SunSpecModelType.INVERTER_SINGLE_PHASE) {
        return this.parseSinglePhaseInverterData(result.registers);
      }

      return null;

    } catch (error) {
      console.error(`❌ Failed to read inverter model from device ${deviceId}:`, error);
      return null;
    }
  }

  /**
   * Read SunSpec Meter Model
   */
  private async readMeterModel(deviceId: string, modelType: SunSpecModelType, startRegister: number): Promise<SunSpecMeterModel | null> {
    try {
      const mapping = getRegisterMapping(modelType);
      if (!mapping) return null;

      const result = await modbusService.readHoldingRegisters(
        deviceId,
        startRegister + 2, // Skip model ID and length
        mapping.length - 2,
        modelType
      );

      if (!result.success) return null;

      // Parse meter data
      return this.parseThreePhaseMeterData(result.registers);

    } catch (error) {
      console.error(`❌ Failed to read meter model from device ${deviceId}:`, error);
      return null;
    }
  }

  /**
   * Parse three-phase inverter data
   */
  private parseThreePhaseInverterData(registers: number[]): SunSpecInverterModel {
    // Extract scale factors
    const acCurrentSF = this.getSunSSF(registers[4]);
    const acVoltageSF = this.getSunSSF(registers[11]);
    const acPowerSF = this.getSunSSF(registers[13]);
    const acFrequencySF = this.getSunSSF(registers[15]);
    const acVASF = this.getSunSSF(registers[17]);
    const acVARSF = this.getSunSSF(registers[19]);
    const acPowerFactorSF = this.getSunSSF(registers[21]);
    const acEnergyWhSF = this.getSunSSF(registers[24]);
    const dcCurrentSF = this.getSunSSF(registers[26]);
    const dcVoltageSF = this.getSunSSF(registers[28]);
    const dcPowerSF = this.getSunSSF(registers[30]);
    const temperatureSF = this.getSunSSF(registers[35]);

    return {
      acCurrent: this.applyScaleFactor(registers[0], acCurrentSF),
      acCurrentA: this.applyScaleFactor(registers[1], acCurrentSF),
      acCurrentB: this.applyScaleFactor(registers[2], acCurrentSF),
      acCurrentC: this.applyScaleFactor(registers[3], acCurrentSF),
      acVoltageAB: this.applyScaleFactor(registers[5], acVoltageSF),
      acVoltageBC: this.applyScaleFactor(registers[6], acVoltageSF),
      acVoltageCA: this.applyScaleFactor(registers[7], acVoltageSF),
      acVoltageAN: this.applyScaleFactor(registers[8], acVoltageSF),
      acVoltageBN: this.applyScaleFactor(registers[9], acVoltageSF),
      acVoltageCN: this.applyScaleFactor(registers[10], acVoltageSF),
      acPower: this.applyScaleFactor(this.getInt16(registers[12]), acPowerSF),
      acFrequency: this.applyScaleFactor(registers[14], acFrequencySF),
      acVA: this.applyScaleFactor(this.getInt16(registers[16]), acVASF),
      acVAR: this.applyScaleFactor(this.getInt16(registers[18]), acVARSF),
      acPowerFactor: this.applyScaleFactor(this.getInt16(registers[20]), acPowerFactorSF),
      acEnergyWh: this.applyScaleFactor(this.getUint32(registers, 22), acEnergyWhSF),
      dcCurrent: this.applyScaleFactor(registers[25], dcCurrentSF),
      dcVoltage: this.applyScaleFactor(registers[27], dcVoltageSF),
      dcPower: this.applyScaleFactor(this.getInt16(registers[29]), dcPowerSF),
      cabinetTemperature: this.applyScaleFactor(this.getInt16(registers[31]), temperatureSF),
      heatsinkTemperature: this.applyScaleFactor(this.getInt16(registers[32]), temperatureSF),
      transformerTemperature: this.applyScaleFactor(this.getInt16(registers[33]), temperatureSF),
      otherTemperature: this.applyScaleFactor(this.getInt16(registers[34]), temperatureSF),
      operatingState: registers[36] as InverterOperatingState,
      vendorOperatingState: registers[37],
      efficiency: this.calculateEfficiency(
        this.applyScaleFactor(this.getInt16(registers[12]), acPowerSF),
        this.applyScaleFactor(this.getInt16(registers[29]), dcPowerSF)
      )
    };
  }

  /**
   * Parse single-phase inverter data
   */
  private parseSinglePhaseInverterData(registers: number[]): SunSpecInverterModel {
    // Extract scale factors
    const acCurrentSF = this.getSunSSF(registers[1]);
    const acVoltageSF = this.getSunSSF(registers[3]);
    const acPowerSF = this.getSunSSF(registers[5]);
    const acFrequencySF = this.getSunSSF(registers[7]);
    const acVASF = this.getSunSSF(registers[9]);
    const acVARSF = this.getSunSSF(registers[11]);
    const acPowerFactorSF = this.getSunSSF(registers[13]);
    const acEnergyWhSF = this.getSunSSF(registers[16]);
    const dcCurrentSF = this.getSunSSF(registers[18]);
    const dcVoltageSF = this.getSunSSF(registers[20]);
    const dcPowerSF = this.getSunSSF(registers[22]);
    const temperatureSF = this.getSunSSF(registers[25]);

    return {
      acCurrent: this.applyScaleFactor(registers[0], acCurrentSF),
      acVoltageAN: this.applyScaleFactor(registers[2], acVoltageSF),
      acPower: this.applyScaleFactor(this.getInt16(registers[4]), acPowerSF),
      acFrequency: this.applyScaleFactor(registers[6], acFrequencySF),
      acVA: this.applyScaleFactor(this.getInt16(registers[8]), acVASF),
      acVAR: this.applyScaleFactor(this.getInt16(registers[10]), acVARSF),
      acPowerFactor: this.applyScaleFactor(this.getInt16(registers[12]), acPowerFactorSF),
      acEnergyWh: this.applyScaleFactor(this.getUint32(registers, 14), acEnergyWhSF),
      dcCurrent: this.applyScaleFactor(registers[17], dcCurrentSF),
      dcVoltage: this.applyScaleFactor(registers[19], dcVoltageSF),
      dcPower: this.applyScaleFactor(this.getInt16(registers[21]), dcPowerSF),
      cabinetTemperature: this.applyScaleFactor(this.getInt16(registers[23]), temperatureSF),
      heatsinkTemperature: this.applyScaleFactor(this.getInt16(registers[24]), temperatureSF),
      operatingState: registers[26] as InverterOperatingState,
      vendorOperatingState: registers[27],
      efficiency: this.calculateEfficiency(
        this.applyScaleFactor(this.getInt16(registers[4]), acPowerSF),
        this.applyScaleFactor(this.getInt16(registers[21]), dcPowerSF)
      )
    };
  }

  /**
   * Parse three-phase meter data
   */
  private parseThreePhaseMeterData(registers: number[]): SunSpecMeterModel {
    // Extract scale factors
    const acCurrentSF = this.getSunSSF(registers[4]);
    const acVoltageSF = this.getSunSSF(registers[11]);
    const acFrequencySF = this.getSunSSF(registers[13]);
    const acPowerSF = this.getSunSSF(registers[18]);
    const acVASF = this.getSunSSF(registers[20]);
    const acVARSF = this.getSunSSF(registers[22]);
    const acPowerFactorSF = this.getSunSSF(registers[24]);
    const acEnergyWhSF = this.getSunSSF(registers[27]);
    const acEnergyVAhSF = this.getSunSSF(registers[32]);

    return {
      acCurrent: this.applyScaleFactor(this.getInt16(registers[0]), acCurrentSF),
      acCurrentA: this.applyScaleFactor(this.getInt16(registers[1]), acCurrentSF),
      acCurrentB: this.applyScaleFactor(this.getInt16(registers[2]), acCurrentSF),
      acCurrentC: this.applyScaleFactor(this.getInt16(registers[3]), acCurrentSF),
      acVoltageAN: this.applyScaleFactor(this.getInt16(registers[5]), acVoltageSF),
      acVoltageBN: this.applyScaleFactor(this.getInt16(registers[6]), acVoltageSF),
      acVoltageCN: this.applyScaleFactor(this.getInt16(registers[7]), acVoltageSF),
      acVoltageAB: this.applyScaleFactor(this.getInt16(registers[8]), acVoltageSF),
      acVoltageBC: this.applyScaleFactor(this.getInt16(registers[9]), acVoltageSF),
      acVoltageCA: this.applyScaleFactor(this.getInt16(registers[10]), acVoltageSF),
      acFrequency: this.applyScaleFactor(this.getInt16(registers[12]), acFrequencySF),
      acPower: this.applyScaleFactor(this.getInt16(registers[14]), acPowerSF),
      acPowerA: this.applyScaleFactor(this.getInt16(registers[15]), acPowerSF),
      acPowerB: this.applyScaleFactor(this.getInt16(registers[16]), acPowerSF),
      acPowerC: this.applyScaleFactor(this.getInt16(registers[17]), acPowerSF),
      acVA: this.applyScaleFactor(this.getInt16(registers[19]), acVASF),
      acVAR: this.applyScaleFactor(this.getInt16(registers[21]), acVARSF),
      acPowerFactor: this.applyScaleFactor(this.getInt16(registers[23]), acPowerFactorSF),
      acEnergyWh: this.applyScaleFactor(this.getUint32(registers, 25), acEnergyWhSF),
      acEnergyWhImported: this.applyScaleFactor(this.getUint32(registers, 28), acEnergyWhSF),
      acEnergyVAh: this.applyScaleFactor(this.getUint32(registers, 30), acEnergyVAhSF),
      acEnergyVAhImported: this.applyScaleFactor(this.getUint32(registers, 33), acEnergyVAhSF),
      events: this.getUint32(registers, 35)
    };
  }

  /**
   * Start polling for a device
   */
  private startPolling(deviceId: string): void {
    const configuration = this.deviceConfigurations.get(deviceId);
    if (!configuration) return;

    // Clear existing timer
    const existingTimer = this.pollingTimers.get(deviceId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setInterval(async () => {
      try {
        const deviceData = await this.readDeviceData(deviceId);
        if (deviceData) {
          // Emit event or process data
          this.processDeviceData(deviceData);
        }
      } catch (error) {
        console.error(`❌ Polling error for device ${deviceId}:`, error);
      }
    }, configuration.pollingInterval * 1000);

    this.pollingTimers.set(deviceId, timer);
    console.log(`⏰ Started polling for device ${deviceId} every ${configuration.pollingInterval}s`);
  }

  /**
   * Stop polling for a device
   */
  stopPolling(deviceId: string): void {
    const timer = this.pollingTimers.get(deviceId);
    if (timer) {
      clearInterval(timer);
      this.pollingTimers.delete(deviceId);
      console.log(`⏹️ Stopped polling for device ${deviceId}`);
    }
  }

  /**
   * Process device data (to be extended for integration)
   */
  private processDeviceData(data: SunSpecDeviceData): void {
    // This will be extended to integrate with DataCollectionService
    console.log(`📊 Processed SunSpec data for device ${data.deviceId}:`, {
      power: data.inverter?.acPower || data.meter?.acPower || 0,
      voltage: data.inverter?.acVoltageAN || data.meter?.acVoltageAN || 0,
      current: data.inverter?.acCurrent || data.meter?.acCurrent || 0,
      temperature: data.inverter?.cabinetTemperature || 0,
      energy: data.inverter?.acEnergyWh || data.meter?.acEnergyWh || 0
    });
  }

  /**
   * Utility functions
   */
  private getModelTypeFromId(modelId: number): SunSpecModelType | null {
    const mapping: { [key: number]: SunSpecModelType } = {
      1: SunSpecModelType.COMMON,
      101: SunSpecModelType.INVERTER_SINGLE_PHASE,
      102: SunSpecModelType.INVERTER_SPLIT_PHASE,
      103: SunSpecModelType.INVERTER_THREE_PHASE,
      111: SunSpecModelType.INVERTER_THREE_PHASE_DELTA,
      201: SunSpecModelType.METER_SINGLE_PHASE,
      202: SunSpecModelType.METER_SPLIT_PHASE,
      203: SunSpecModelType.METER_THREE_PHASE_WYE,
      204: SunSpecModelType.METER_THREE_PHASE_DELTA
    };
    
    return mapping[modelId] || null;
  }

  private isInverterModel(modelType: SunSpecModelType): boolean {
    return [
      SunSpecModelType.INVERTER_SINGLE_PHASE,
      SunSpecModelType.INVERTER_SPLIT_PHASE,
      SunSpecModelType.INVERTER_THREE_PHASE,
      SunSpecModelType.INVERTER_THREE_PHASE_DELTA
    ].includes(modelType);
  }

  private isMeterModel(modelType: SunSpecModelType): boolean {
    return [
      SunSpecModelType.METER_SINGLE_PHASE,
      SunSpecModelType.METER_SPLIT_PHASE,
      SunSpecModelType.METER_THREE_PHASE_WYE,
      SunSpecModelType.METER_THREE_PHASE_DELTA
    ].includes(modelType);
  }

  private extractString(registers: number[], offset: number, length: number): string {
    const stringBytes: number[] = [];
    for (let i = 0; i < length; i++) {
      const register = registers[offset + Math.floor(i / 2)];
      if (i % 2 === 0) {
        stringBytes.push((register >> 8) & 0xFF);
      } else {
        stringBytes.push(register & 0xFF);
      }
    }
    return Buffer.from(stringBytes).toString('ascii').replace(/\0/g, '').trim();
  }

  private getSunSSF(value: number): number {
    // SunSpec Scale Factor is signed 16-bit
    return value > 32767 ? value - 65536 : value;
  }

  private getInt16(value: number): number {
    return value > 32767 ? value - 65536 : value;
  }

  private getUint32(registers: number[], offset: number): number {
    return (registers[offset] << 16) | registers[offset + 1];
  }

  private applyScaleFactor(value: number, scaleFactor: number): number {
    if (scaleFactor === 0) return value;
    return value * Math.pow(10, scaleFactor);
  }

  private calculateEfficiency(acPower: number, dcPower: number): number {
    if (dcPower === 0) return 0;
    return Math.round((acPower / dcPower) * 100 * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Get device configuration
   */
  getDeviceConfiguration(deviceId: string): SunSpecConfiguration | undefined {
    return this.deviceConfigurations.get(deviceId);
  }

  /**
   * Get discovered models for a device
   */
  getDiscoveredModels(deviceId: string): SunSpecModelDiscovery | undefined {
    return this.discoveredModels.get(deviceId);
  }

  /**
   * Remove device configuration
   */
  async removeDevice(deviceId: string): Promise<void> {
    this.stopPolling(deviceId);
    await modbusService.disconnectDevice(deviceId);
    this.deviceConfigurations.delete(deviceId);
    this.discoveredModels.delete(deviceId);
  }

  /**
   * Cleanup all resources
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up SunSpec service...');

    // Stop all polling
    for (const timer of this.pollingTimers.values()) {
      clearInterval(timer);
    }
    this.pollingTimers.clear();

    // Clear configurations
    this.deviceConfigurations.clear();
    this.discoveredModels.clear();

    console.log('✅ SunSpec cleanup completed');
  }
}

// Export singleton instance
export const sunspecService = new SunSpecService();