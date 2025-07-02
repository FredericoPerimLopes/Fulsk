/**
 * SunSpec Constants and Register Mappings
 * SunSpec Alliance specification for solar inverter communication
 * 
 * Reference: https://sunspec.org/sunspec-modbus-specifications/
 */

// SunSpec Magic Numbers
export const SUNSPEC_ID = 'SunS';
export const SUNSPEC_MAGIC_NUMBER = 0x53756e53; // 'SunS' as uint32

// Base Register Addresses
export const SUNSPEC_BASE_REGISTER = 40000;
export const SUNSPEC_COMMON_BLOCK_START = 40000;

// Common Model (Model 1) - Device Identification
export const SUNSPEC_COMMON_MODEL = {
  ID: 1,
  LENGTH: 65,
  REGISTERS: {
    SUNSPEC_ID: 0,           // 'SunS' identifier (2 registers)
    SUNSPEC_DID: 2,          // Device ID (1 register)
    SUNSPEC_LENGTH: 3,       // Model length (1 register)
    MANUFACTURER: 4,         // Manufacturer (16 registers, 32 chars)
    MODEL: 20,               // Model (16 registers, 32 chars)
    OPTIONS: 36,             // Options (8 registers, 16 chars)
    VERSION: 44,             // Version (8 registers, 16 chars)
    SERIAL_NUMBER: 52,       // Serial Number (16 registers, 32 chars)
    DEVICE_ADDRESS: 68       // Device Address (1 register)
  }
} as const;

// Inverter Models
export const SUNSPEC_INVERTER_MODELS = {
  SINGLE_PHASE_INT: 101,
  SPLIT_PHASE_INT: 102,
  THREE_PHASE_INT: 103,
  SINGLE_PHASE_FLOAT: 111,
  SPLIT_PHASE_FLOAT: 112,
  THREE_PHASE_FLOAT: 113
} as const;

// Single Phase Inverter Model (Model 101) - Integer Values
export const SUNSPEC_INVERTER_INT_MODEL = {
  ID: 101,
  LENGTH: 50,
  REGISTERS: {
    // AC Measurements
    AC_CURRENT: 0,           // AC Current (A) - uint16
    AC_CURRENT_A: 1,         // AC Current Phase A (A) - uint16
    AC_CURRENT_B: 2,         // AC Current Phase B (A) - uint16
    AC_CURRENT_C: 3,         // AC Current Phase C (A) - uint16
    AC_CURRENT_SF: 4,        // AC Current Scale Factor - int16
    
    AC_VOLTAGE_AB: 5,        // AC Voltage Phase AB (V) - uint16
    AC_VOLTAGE_BC: 6,        // AC Voltage Phase BC (V) - uint16
    AC_VOLTAGE_CA: 7,        // AC Voltage Phase CA (V) - uint16
    AC_VOLTAGE_AN: 8,        // AC Voltage Phase A-N (V) - uint16
    AC_VOLTAGE_BN: 9,        // AC Voltage Phase B-N (V) - uint16
    AC_VOLTAGE_CN: 10,       // AC Voltage Phase C-N (V) - uint16
    AC_VOLTAGE_SF: 11,       // AC Voltage Scale Factor - int16
    
    AC_POWER: 12,            // AC Power (W) - int16
    AC_POWER_SF: 13,         // AC Power Scale Factor - int16
    
    AC_FREQUENCY: 14,        // AC Frequency (Hz) - uint16
    AC_FREQUENCY_SF: 15,     // AC Frequency Scale Factor - int16
    
    AC_VA: 16,               // AC Apparent Power (VA) - int16
    AC_VA_SF: 17,            // AC Apparent Power Scale Factor - int16
    
    AC_VAR: 18,              // AC Reactive Power (VAr) - int16
    AC_VAR_SF: 19,           // AC Reactive Power Scale Factor - int16
    
    AC_PF: 20,               // AC Power Factor (%) - int16
    AC_PF_SF: 21,            // AC Power Factor Scale Factor - int16
    
    AC_ENERGY_WH: 22,        // AC Energy (Wh) - uint32 (2 registers)
    AC_ENERGY_WH_SF: 24,     // AC Energy Scale Factor - uint16
    
    // DC Measurements
    DC_CURRENT: 25,          // DC Current (A) - uint16
    DC_CURRENT_SF: 26,       // DC Current Scale Factor - int16
    
    DC_VOLTAGE: 27,          // DC Voltage (V) - uint16
    DC_VOLTAGE_SF: 28,       // DC Voltage Scale Factor - int16
    
    DC_POWER: 29,            // DC Power (W) - int16
    DC_POWER_SF: 30,         // DC Power Scale Factor - int16
    
    // Temperature
    CABINET_TEMPERATURE: 31, // Cabinet Temperature (°C) - int16
    HEAT_SINK_TEMPERATURE: 32, // Heat Sink Temperature (°C) - int16
    TRANSFORMER_TEMPERATURE: 33, // Transformer Temperature (°C) - int16
    OTHER_TEMPERATURE: 34,   // Other Temperature (°C) - int16
    TEMPERATURE_SF: 35,      // Temperature Scale Factor - int16
    
    // Status
    OPERATING_STATE: 36,     // Operating State - uint16
    VENDOR_STATE: 37,        // Vendor Operating State - uint16
    
    // Events
    EVENT1: 38,              // Event Flags 1 - uint32 (2 registers)
    EVENT2: 40,              // Event Flags 2 - uint32 (2 registers)
    VENDOR_EVENT1: 42,       // Vendor Event Flags 1 - uint32 (2 registers)
    VENDOR_EVENT2: 44,       // Vendor Event Flags 2 - uint32 (2 registers)
    VENDOR_EVENT3: 46,       // Vendor Event Flags 3 - uint32 (2 registers)
    VENDOR_EVENT4: 48        // Vendor Event Flags 4 - uint32 (2 registers)
  }
} as const;

// Operating States
export const SUNSPEC_OPERATING_STATES = {
  OFF: 1,
  SLEEPING: 2,
  STARTING: 3,
  MPPT: 4,
  THROTTLED: 5,
  SHUTTING_DOWN: 6,
  FAULT: 7,
  STANDBY: 8
} as const;

// Event Flags (Bit Masks)
export const SUNSPEC_EVENT_FLAGS = {
  GROUND_FAULT: 0x00000001,
  DC_OVER_VOLTAGE: 0x00000002,
  AC_DISCONNECT: 0x00000004,
  DC_DISCONNECT: 0x00000008,
  GRID_DISCONNECT: 0x00000010,
  CABINET_OPEN: 0x00000020,
  MANUAL_SHUTDOWN: 0x00000040,
  OVER_TEMP: 0x00000080,
  OVER_FREQUENCY: 0x00000100,
  UNDER_FREQUENCY: 0x00000200,
  AC_OVER_VOLTAGE: 0x00000400,
  AC_UNDER_VOLTAGE: 0x00000800,
  BLOWN_STRING_FUSE: 0x00001000,
  UNDER_TEMP: 0x00002000,
  MEMORY_LOSS: 0x00004000,
  HW_TEST_FAILURE: 0x00008000
} as const;

// Data Types for Register Parsing
export enum SunSpecDataType {
  INT16 = 'int16',
  UINT16 = 'uint16',
  INT32 = 'int32',
  UINT32 = 'uint32',
  FLOAT32 = 'float32',
  STRING = 'string',
  SUNSSF = 'sunssf',    // SunSpec Scale Factor
  BITFIELD16 = 'bitfield16',
  BITFIELD32 = 'bitfield32',
  ENUM16 = 'enum16',
  ENUM32 = 'enum32'
}

// Register Definitions with Data Types
export interface SunSpecRegister {
  address: number;
  name: string;
  type: SunSpecDataType;
  length: number;       // Number of registers
  units?: string;
  description: string;
  scaleFactor?: number; // Static scale factor if known
  scaleRegister?: number; // Address of scale factor register
}

// SunSpec Common Model Register Map
export const SUNSPEC_COMMON_REGISTERS: SunSpecRegister[] = [
  {
    address: SUNSPEC_COMMON_BLOCK_START + 0,
    name: 'SUNSPEC_ID',
    type: SunSpecDataType.STRING,
    length: 2,
    description: 'SunSpec identifier "SunS"'
  },
  {
    address: SUNSPEC_COMMON_BLOCK_START + 2,
    name: 'SUNSPEC_DID',
    type: SunSpecDataType.UINT16,
    length: 1,
    description: 'SunSpec Device ID'
  },
  {
    address: SUNSPEC_COMMON_BLOCK_START + 3,
    name: 'SUNSPEC_LENGTH',
    type: SunSpecDataType.UINT16,
    length: 1,
    description: 'Model length'
  },
  {
    address: SUNSPEC_COMMON_BLOCK_START + 4,
    name: 'MANUFACTURER',
    type: SunSpecDataType.STRING,
    length: 16,
    description: 'Manufacturer name (32 characters)'
  },
  {
    address: SUNSPEC_COMMON_BLOCK_START + 20,
    name: 'MODEL',
    type: SunSpecDataType.STRING,
    length: 16,
    description: 'Model name (32 characters)'
  },
  {
    address: SUNSPEC_COMMON_BLOCK_START + 36,
    name: 'OPTIONS',
    type: SunSpecDataType.STRING,
    length: 8,
    description: 'Options (16 characters)'
  },
  {
    address: SUNSPEC_COMMON_BLOCK_START + 44,
    name: 'VERSION',
    type: SunSpecDataType.STRING,
    length: 8,
    description: 'Firmware version (16 characters)'
  },
  {
    address: SUNSPEC_COMMON_BLOCK_START + 52,
    name: 'SERIAL_NUMBER',
    type: SunSpecDataType.STRING,
    length: 16,
    description: 'Serial number (32 characters)'
  },
  {
    address: SUNSPEC_COMMON_BLOCK_START + 68,
    name: 'DEVICE_ADDRESS',
    type: SunSpecDataType.UINT16,
    length: 1,
    description: 'Modbus device address'
  }
];

// Helper function to create inverter register map
export function createInverterRegisterMap(baseAddress: number): SunSpecRegister[] {
  return [
    // AC Current
    {
      address: baseAddress + 0,
      name: 'AC_CURRENT',
      type: SunSpecDataType.UINT16,
      length: 1,
      units: 'A',
      description: 'AC Current',
      scaleRegister: baseAddress + 4
    },
    // AC Voltage
    {
      address: baseAddress + 8,
      name: 'AC_VOLTAGE_AN',
      type: SunSpecDataType.UINT16,
      length: 1,
      units: 'V',
      description: 'AC Voltage Phase A-N',
      scaleRegister: baseAddress + 11
    },
    // AC Power
    {
      address: baseAddress + 12,
      name: 'AC_POWER',
      type: SunSpecDataType.INT16,
      length: 1,
      units: 'W',
      description: 'AC Power',
      scaleRegister: baseAddress + 13
    },
    // AC Frequency
    {
      address: baseAddress + 14,
      name: 'AC_FREQUENCY',
      type: SunSpecDataType.UINT16,
      length: 1,
      units: 'Hz',
      description: 'AC Frequency',
      scaleRegister: baseAddress + 15
    },
    // AC Energy
    {
      address: baseAddress + 22,
      name: 'AC_ENERGY_WH',
      type: SunSpecDataType.UINT32,
      length: 2,
      units: 'Wh',
      description: 'AC Energy Total',
      scaleRegister: baseAddress + 24
    },
    // DC Current
    {
      address: baseAddress + 25,
      name: 'DC_CURRENT',
      type: SunSpecDataType.UINT16,
      length: 1,
      units: 'A',
      description: 'DC Current',
      scaleRegister: baseAddress + 26
    },
    // DC Voltage
    {
      address: baseAddress + 27,
      name: 'DC_VOLTAGE',
      type: SunSpecDataType.UINT16,
      length: 1,
      units: 'V',
      description: 'DC Voltage',
      scaleRegister: baseAddress + 28
    },
    // DC Power
    {
      address: baseAddress + 29,
      name: 'DC_POWER',
      type: SunSpecDataType.INT16,
      length: 1,
      units: 'W',
      description: 'DC Power',
      scaleRegister: baseAddress + 30
    },
    // Temperature
    {
      address: baseAddress + 31,
      name: 'CABINET_TEMPERATURE',
      type: SunSpecDataType.INT16,
      length: 1,
      units: '°C',
      description: 'Cabinet Temperature',
      scaleRegister: baseAddress + 35
    },
    // Operating State
    {
      address: baseAddress + 36,
      name: 'OPERATING_STATE',
      type: SunSpecDataType.ENUM16,
      length: 1,
      description: 'Operating State'
    },
    // Event Flags
    {
      address: baseAddress + 38,
      name: 'EVENT_FLAGS',
      type: SunSpecDataType.BITFIELD32,
      length: 2,
      description: 'Event Flags'
    }
  ];
}

// Default connection parameters
export const DEFAULT_MODBUS_CONFIG = {
  PORT: 502,
  TIMEOUT: 5000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
  UNIT_ID: 1
} as const;

// Not-A-Number values (SunSpec uses these for invalid/unavailable data)
export const SUNSPEC_NAN_VALUES = {
  INT16: -32768,    // 0x8000
  UINT16: 65535,    // 0xFFFF
  INT32: -2147483648, // 0x80000000
  UINT32: 4294967295, // 0xFFFFFFFF
  FLOAT32: NaN
} as const;