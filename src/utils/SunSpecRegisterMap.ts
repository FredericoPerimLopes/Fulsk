/**
 * SunSpec Register Mappings
 * Based on SunSpec Alliance specifications
 */

import { SunSpecRegisterMap, SunSpecModelType } from '@models/SunSpecModels';

// Standard SunSpec register mappings for common models
export const SUNSPEC_REGISTER_MAP: SunSpecRegisterMap = {
  // Model 1 - Common Model (required for all SunSpec devices)
  [SunSpecModelType.COMMON]: {
    startRegister: 40001,
    length: 69,
    registers: {
      'sunspecId': {
        offset: 0,
        length: 2,
        type: 'string',
        description: 'SunSpec ID - should be "SunS"'
      },
      'manufacturer': {
        offset: 2,
        length: 16,
        type: 'string',
        description: 'Manufacturer name'
      },
      'model': {
        offset: 18,
        length: 16,
        type: 'string',
        description: 'Model identifier'
      },
      'options': {
        offset: 34,
        length: 8,
        type: 'string',
        description: 'Options or additional model info'
      },
      'version': {
        offset: 42,
        length: 8,
        type: 'string',
        description: 'Version identifier'
      },
      'serialNumber': {
        offset: 50,
        length: 16,
        type: 'string',
        description: 'Serial number'
      },
      'deviceAddress': {
        offset: 66,
        length: 1,
        type: 'uint16',
        description: 'Modbus device address'
      }
    }
  },

  // Model 103 - Three Phase Inverter (most common)
  [SunSpecModelType.INVERTER_THREE_PHASE]: {
    startRegister: 40070,
    length: 50,
    registers: {
      'acCurrent': {
        offset: 0,
        length: 1,
        type: 'uint16',
        scaleFactor: 'acCurrentSF',
        description: 'AC Total Current (A)'
      },
      'acCurrentA': {
        offset: 1,
        length: 1,
        type: 'uint16',
        scaleFactor: 'acCurrentSF',
        description: 'AC Phase A Current (A)'
      },
      'acCurrentB': {
        offset: 2,
        length: 1,
        type: 'uint16',
        scaleFactor: 'acCurrentSF',
        description: 'AC Phase B Current (A)'
      },
      'acCurrentC': {
        offset: 3,
        length: 1,
        type: 'uint16',
        scaleFactor: 'acCurrentSF',
        description: 'AC Phase C Current (A)'
      },
      'acCurrentSF': {
        offset: 4,
        length: 1,
        type: 'sunssf',
        description: 'AC Current Scale Factor'
      },
      'acVoltageAB': {
        offset: 5,
        length: 1,
        type: 'uint16',
        scaleFactor: 'acVoltageSF',
        description: 'AC Voltage Phase AB (V)'
      },
      'acVoltageBC': {
        offset: 6,
        length: 1,
        type: 'uint16',
        scaleFactor: 'acVoltageSF',
        description: 'AC Voltage Phase BC (V)'
      },
      'acVoltageCA': {
        offset: 7,
        length: 1,
        type: 'uint16',
        scaleFactor: 'acVoltageSF',
        description: 'AC Voltage Phase CA (V)'
      },
      'acVoltageAN': {
        offset: 8,
        length: 1,
        type: 'uint16',
        scaleFactor: 'acVoltageSF',
        description: 'AC Voltage Phase A to N (V)'
      },
      'acVoltageBN': {
        offset: 9,
        length: 1,
        type: 'uint16',
        scaleFactor: 'acVoltageSF',
        description: 'AC Voltage Phase B to N (V)'
      },
      'acVoltageCN': {
        offset: 10,
        length: 1,
        type: 'uint16',
        scaleFactor: 'acVoltageSF',
        description: 'AC Voltage Phase C to N (V)'
      },
      'acVoltageSF': {
        offset: 11,
        length: 1,
        type: 'sunssf',
        description: 'AC Voltage Scale Factor'
      },
      'acPower': {
        offset: 12,
        length: 1,
        type: 'int16',
        scaleFactor: 'acPowerSF',
        description: 'AC Power (W)'
      },
      'acPowerSF': {
        offset: 13,
        length: 1,
        type: 'sunssf',
        description: 'AC Power Scale Factor'
      },
      'acFrequency': {
        offset: 14,
        length: 1,
        type: 'uint16',
        scaleFactor: 'acFrequencySF',
        description: 'AC Frequency (Hz)'
      },
      'acFrequencySF': {
        offset: 15,
        length: 1,
        type: 'sunssf',
        description: 'AC Frequency Scale Factor'
      },
      'acVA': {
        offset: 16,
        length: 1,
        type: 'int16',
        scaleFactor: 'acVASF',
        description: 'AC Apparent Power (VA)'
      },
      'acVASF': {
        offset: 17,
        length: 1,
        type: 'sunssf',
        description: 'AC Apparent Power Scale Factor'
      },
      'acVAR': {
        offset: 18,
        length: 1,
        type: 'int16',
        scaleFactor: 'acVARSF',
        description: 'AC Reactive Power (VAR)'
      },
      'acVARSF': {
        offset: 19,
        length: 1,
        type: 'sunssf',
        description: 'AC Reactive Power Scale Factor'
      },
      'acPowerFactor': {
        offset: 20,
        length: 1,
        type: 'int16',
        scaleFactor: 'acPowerFactorSF',
        description: 'AC Power Factor (%)'
      },
      'acPowerFactorSF': {
        offset: 21,
        length: 1,
        type: 'sunssf',
        description: 'AC Power Factor Scale Factor'
      },
      'acEnergyWh': {
        offset: 22,
        length: 2,
        type: 'uint32',
        scaleFactor: 'acEnergyWhSF',
        description: 'AC Energy (Wh)'
      },
      'acEnergyWhSF': {
        offset: 24,
        length: 1,
        type: 'sunssf',
        description: 'AC Energy Scale Factor'
      },
      'dcCurrent': {
        offset: 25,
        length: 1,
        type: 'uint16',
        scaleFactor: 'dcCurrentSF',
        description: 'DC Current (A)'
      },
      'dcCurrentSF': {
        offset: 26,
        length: 1,
        type: 'sunssf',
        description: 'DC Current Scale Factor'
      },
      'dcVoltage': {
        offset: 27,
        length: 1,
        type: 'uint16',
        scaleFactor: 'dcVoltageSF',
        description: 'DC Voltage (V)'
      },
      'dcVoltageSF': {
        offset: 28,
        length: 1,
        type: 'sunssf',
        description: 'DC Voltage Scale Factor'
      },
      'dcPower': {
        offset: 29,
        length: 1,
        type: 'int16',
        scaleFactor: 'dcPowerSF',
        description: 'DC Power (W)'
      },
      'dcPowerSF': {
        offset: 30,
        length: 1,
        type: 'sunssf',
        description: 'DC Power Scale Factor'
      },
      'cabinetTemperature': {
        offset: 31,
        length: 1,
        type: 'int16',
        scaleFactor: 'temperatureSF',
        description: 'Cabinet Temperature (°C)'
      },
      'heatsinkTemperature': {
        offset: 32,
        length: 1,
        type: 'int16',
        scaleFactor: 'temperatureSF',
        description: 'Heatsink Temperature (°C)'
      },
      'transformerTemperature': {
        offset: 33,
        length: 1,
        type: 'int16',
        scaleFactor: 'temperatureSF',
        description: 'Transformer Temperature (°C)'
      },
      'otherTemperature': {
        offset: 34,
        length: 1,
        type: 'int16',
        scaleFactor: 'temperatureSF',
        description: 'Other Temperature (°C)'
      },
      'temperatureSF': {
        offset: 35,
        length: 1,
        type: 'sunssf',
        description: 'Temperature Scale Factor'
      },
      'operatingState': {
        offset: 36,
        length: 1,
        type: 'uint16',
        description: 'Operating State'
      },
      'vendorOperatingState': {
        offset: 37,
        length: 1,
        type: 'uint16',
        description: 'Vendor Operating State'
      }
    }
  },

  // Model 101 - Single Phase Inverter
  [SunSpecModelType.INVERTER_SINGLE_PHASE]: {
    startRegister: 40070,
    length: 50,
    registers: {
      'acCurrent': {
        offset: 0,
        length: 1,
        type: 'uint16',
        scaleFactor: 'acCurrentSF',
        description: 'AC Current (A)'
      },
      'acCurrentSF': {
        offset: 1,
        length: 1,
        type: 'sunssf',
        description: 'AC Current Scale Factor'
      },
      'acVoltageAN': {
        offset: 2,
        length: 1,
        type: 'uint16',
        scaleFactor: 'acVoltageSF',
        description: 'AC Voltage (V)'
      },
      'acVoltageSF': {
        offset: 3,
        length: 1,
        type: 'sunssf',
        description: 'AC Voltage Scale Factor'
      },
      'acPower': {
        offset: 4,
        length: 1,
        type: 'int16',
        scaleFactor: 'acPowerSF',
        description: 'AC Power (W)'
      },
      'acPowerSF': {
        offset: 5,
        length: 1,
        type: 'sunssf',
        description: 'AC Power Scale Factor'
      },
      'acFrequency': {
        offset: 6,
        length: 1,
        type: 'uint16',
        scaleFactor: 'acFrequencySF',
        description: 'AC Frequency (Hz)'
      },
      'acFrequencySF': {
        offset: 7,
        length: 1,
        type: 'sunssf',
        description: 'AC Frequency Scale Factor'
      },
      'acVA': {
        offset: 8,
        length: 1,
        type: 'int16',
        scaleFactor: 'acVASF',
        description: 'AC Apparent Power (VA)'
      },
      'acVASF': {
        offset: 9,
        length: 1,
        type: 'sunssf',
        description: 'AC Apparent Power Scale Factor'
      },
      'acVAR': {
        offset: 10,
        length: 1,
        type: 'int16',
        scaleFactor: 'acVARSF',
        description: 'AC Reactive Power (VAR)'
      },
      'acVARSF': {
        offset: 11,
        length: 1,
        type: 'sunssf',
        description: 'AC Reactive Power Scale Factor'
      },
      'acPowerFactor': {
        offset: 12,
        length: 1,
        type: 'int16',
        scaleFactor: 'acPowerFactorSF',
        description: 'AC Power Factor (%)'
      },
      'acPowerFactorSF': {
        offset: 13,
        length: 1,
        type: 'sunssf',
        description: 'AC Power Factor Scale Factor'
      },
      'acEnergyWh': {
        offset: 14,
        length: 2,
        type: 'uint32',
        scaleFactor: 'acEnergyWhSF',
        description: 'AC Energy (Wh)'
      },
      'acEnergyWhSF': {
        offset: 16,
        length: 1,
        type: 'sunssf',
        description: 'AC Energy Scale Factor'
      },
      'dcCurrent': {
        offset: 17,
        length: 1,
        type: 'uint16',
        scaleFactor: 'dcCurrentSF',
        description: 'DC Current (A)'
      },
      'dcCurrentSF': {
        offset: 18,
        length: 1,
        type: 'sunssf',
        description: 'DC Current Scale Factor'
      },
      'dcVoltage': {
        offset: 19,
        length: 1,
        type: 'uint16',
        scaleFactor: 'dcVoltageSF',
        description: 'DC Voltage (V)'
      },
      'dcVoltageSF': {
        offset: 20,
        length: 1,
        type: 'sunssf',
        description: 'DC Voltage Scale Factor'
      },
      'dcPower': {
        offset: 21,
        length: 1,
        type: 'int16',
        scaleFactor: 'dcPowerSF',
        description: 'DC Power (W)'
      },
      'dcPowerSF': {
        offset: 22,
        length: 1,
        type: 'sunssf',
        description: 'DC Power Scale Factor'
      },
      'cabinetTemperature': {
        offset: 23,
        length: 1,
        type: 'int16',
        scaleFactor: 'temperatureSF',
        description: 'Cabinet Temperature (°C)'
      },
      'heatsinkTemperature': {
        offset: 24,
        length: 1,
        type: 'int16',
        scaleFactor: 'temperatureSF',
        description: 'Heatsink Temperature (°C)'
      },
      'temperatureSF': {
        offset: 25,
        length: 1,
        type: 'sunssf',
        description: 'Temperature Scale Factor'
      },
      'operatingState': {
        offset: 26,
        length: 1,
        type: 'uint16',
        description: 'Operating State'
      },
      'vendorOperatingState': {
        offset: 27,
        length: 1,
        type: 'uint16',
        description: 'Vendor Operating State'
      }
    }
  },

  // Model 203 - Three Phase Wye Meter
  [SunSpecModelType.METER_THREE_PHASE_WYE]: {
    startRegister: 40120,
    length: 105,
    registers: {
      'acCurrent': {
        offset: 0,
        length: 1,
        type: 'int16',
        scaleFactor: 'acCurrentSF',
        description: 'AC Total Current (A)'
      },
      'acCurrentA': {
        offset: 1,
        length: 1,
        type: 'int16',
        scaleFactor: 'acCurrentSF',
        description: 'AC Phase A Current (A)'
      },
      'acCurrentB': {
        offset: 2,
        length: 1,
        type: 'int16',
        scaleFactor: 'acCurrentSF',
        description: 'AC Phase B Current (A)'
      },
      'acCurrentC': {
        offset: 3,
        length: 1,
        type: 'int16',
        scaleFactor: 'acCurrentSF',
        description: 'AC Phase C Current (A)'
      },
      'acCurrentSF': {
        offset: 4,
        length: 1,
        type: 'sunssf',
        description: 'AC Current Scale Factor'
      },
      'acVoltageAN': {
        offset: 5,
        length: 1,
        type: 'int16',
        scaleFactor: 'acVoltageSF',
        description: 'AC Voltage Phase A to N (V)'
      },
      'acVoltageBN': {
        offset: 6,
        length: 1,
        type: 'int16',
        scaleFactor: 'acVoltageSF',
        description: 'AC Voltage Phase B to N (V)'
      },
      'acVoltageCN': {
        offset: 7,
        length: 1,
        type: 'int16',
        scaleFactor: 'acVoltageSF',
        description: 'AC Voltage Phase C to N (V)'
      },
      'acVoltageAB': {
        offset: 8,
        length: 1,
        type: 'int16',
        scaleFactor: 'acVoltageSF',
        description: 'AC Voltage Phase AB (V)'
      },
      'acVoltageBC': {
        offset: 9,
        length: 1,
        type: 'int16',
        scaleFactor: 'acVoltageSF',
        description: 'AC Voltage Phase BC (V)'
      },
      'acVoltageCA': {
        offset: 10,
        length: 1,
        type: 'int16',
        scaleFactor: 'acVoltageSF',
        description: 'AC Voltage Phase CA (V)'
      },
      'acVoltageSF': {
        offset: 11,
        length: 1,
        type: 'sunssf',
        description: 'AC Voltage Scale Factor'
      },
      'acFrequency': {
        offset: 12,
        length: 1,
        type: 'int16',
        scaleFactor: 'acFrequencySF',
        description: 'AC Frequency (Hz)'
      },
      'acFrequencySF': {
        offset: 13,
        length: 1,
        type: 'sunssf',
        description: 'AC Frequency Scale Factor'
      },
      'acPower': {
        offset: 14,
        length: 1,
        type: 'int16',
        scaleFactor: 'acPowerSF',
        description: 'AC Real Power (W)'
      },
      'acPowerA': {
        offset: 15,
        length: 1,
        type: 'int16',
        scaleFactor: 'acPowerSF',
        description: 'AC Real Power Phase A (W)'
      },
      'acPowerB': {
        offset: 16,
        length: 1,
        type: 'int16',
        scaleFactor: 'acPowerSF',
        description: 'AC Real Power Phase B (W)'
      },
      'acPowerC': {
        offset: 17,
        length: 1,
        type: 'int16',
        scaleFactor: 'acPowerSF',
        description: 'AC Real Power Phase C (W)'
      },
      'acPowerSF': {
        offset: 18,
        length: 1,
        type: 'sunssf',
        description: 'AC Real Power Scale Factor'
      },
      'acVA': {
        offset: 19,
        length: 1,
        type: 'int16',
        scaleFactor: 'acVASF',
        description: 'AC Apparent Power (VA)'
      },
      'acVASF': {
        offset: 20,
        length: 1,
        type: 'sunssf',
        description: 'AC Apparent Power Scale Factor'
      },
      'acVAR': {
        offset: 21,
        length: 1,
        type: 'int16',
        scaleFactor: 'acVARSF',
        description: 'AC Reactive Power (VAR)'
      },
      'acVARSF': {
        offset: 22,
        length: 1,
        type: 'sunssf',
        description: 'AC Reactive Power Scale Factor'
      },
      'acPowerFactor': {
        offset: 23,
        length: 1,
        type: 'int16',
        scaleFactor: 'acPowerFactorSF',
        description: 'Power Factor (%)'
      },
      'acPowerFactorSF': {
        offset: 24,
        length: 1,
        type: 'sunssf',
        description: 'Power Factor Scale Factor'
      },
      'acEnergyWh': {
        offset: 25,
        length: 2,
        type: 'uint32',
        scaleFactor: 'acEnergyWhSF',
        description: 'AC Real Energy Exported (Wh)'
      },
      'acEnergyWhSF': {
        offset: 27,
        length: 1,
        type: 'sunssf',
        description: 'AC Real Energy Scale Factor'
      },
      'acEnergyWhImported': {
        offset: 28,
        length: 2,
        type: 'uint32',
        scaleFactor: 'acEnergyWhSF',
        description: 'AC Real Energy Imported (Wh)'
      },
      'acEnergyVAh': {
        offset: 30,
        length: 2,
        type: 'uint32',
        scaleFactor: 'acEnergyVAhSF',
        description: 'AC Apparent Energy Exported (VAh)'
      },
      'acEnergyVAhSF': {
        offset: 32,
        length: 1,
        type: 'sunssf',
        description: 'AC Apparent Energy Scale Factor'
      },
      'acEnergyVAhImported': {
        offset: 33,
        length: 2,
        type: 'uint32',
        scaleFactor: 'acEnergyVAhSF',
        description: 'AC Apparent Energy Imported (VAh)'
      },
      'events': {
        offset: 35,
        length: 2,
        type: 'uint32',
        description: 'Meter Events'
      }
    }
  }
};

// SunSpec standard addresses
export const SUNSPEC_STANDARD_ADDRESSES = {
  // Standard Modbus register addresses for SunSpec
  SUNSPEC_IDENTIFIER: 40001,  // "SunS" identifier
  COMMON_MODEL_START: 40001,  // Common model start
  DEVICE_MODEL_START: 40070,  // Device models start (after common)
  
  // SunSpec Magic Numbers
  SUNSPEC_ID: 0x53756E53,     // "SunS" in hex
  MODEL_END_MARKER: 0xFFFF,   // End of model marker
  
  // Common model type IDs
  COMMON_MODEL_ID: 1,
  
  // Default addresses (if not auto-discovered)
  DEFAULT_REGISTER_COUNT: 125  // Maximum registers to scan
};

// Helper function to get register mapping for a specific model
export function getRegisterMapping(modelType: SunSpecModelType): any {
  return SUNSPEC_REGISTER_MAP[modelType];
}

// Helper function to calculate actual register address
export function calculateRegisterAddress(baseAddress: number, offset: number): number {
  return baseAddress + offset;
}

// Helper function to validate SunSpec identifier
export function validateSunSpecIdentifier(data: Buffer): boolean {
  if (data.length < 4) return false;
  
  // Check for "SunS" identifier
  const identifier = data.readUInt32BE(0);
  return identifier === SUNSPEC_STANDARD_ADDRESSES.SUNSPEC_ID;
}