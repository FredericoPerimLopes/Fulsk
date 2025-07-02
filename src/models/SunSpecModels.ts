/**
 * SunSpec Data Models
 * Based on SunSpec Alliance specifications for solar inverter monitoring
 */

// SunSpec Common Model (Model 1) - Basic device identification
export interface SunSpecCommonModel {
  deviceId: string;
  manufacturer: string;
  model: string;
  options?: string;
  version?: string;
  serialNumber: string;
  deviceAddress?: number;
}

// SunSpec Inverter Model (Models 101-111) - Core inverter data
export interface SunSpecInverterModel {
  // AC Measurements
  acCurrent: number;           // AC Total Current (A)
  acCurrentA?: number;         // AC Phase A Current (A)
  acCurrentB?: number;         // AC Phase B Current (A)
  acCurrentC?: number;         // AC Phase C Current (A)
  acVoltageAB?: number;        // AC Voltage Phase AB (V)
  acVoltageBC?: number;        // AC Voltage Phase BC (V)
  acVoltageCA?: number;        // AC Voltage Phase CA (V)
  acVoltageAN?: number;        // AC Voltage Phase A to N (V)
  acVoltageBN?: number;        // AC Voltage Phase B to N (V)
  acVoltageCN?: number;        // AC Voltage Phase C to N (V)
  acPower: number;             // AC Power (W)
  acFrequency: number;         // AC Frequency (Hz)
  acVA?: number;               // AC Apparent Power (VA)
  acVAR?: number;              // AC Reactive Power (VAR)
  acPowerFactor?: number;      // AC Power Factor (%)
  acEnergyWh: number;          // AC Energy (Wh)
  
  // DC Measurements
  dcCurrent: number;           // DC Current (A)
  dcVoltage: number;           // DC Voltage (V)
  dcPower: number;             // DC Power (W)
  
  // Temperature
  cabinetTemperature?: number; // Cabinet Temperature (°C)
  heatsinkTemperature?: number; // Heatsink Temperature (°C)
  transformerTemperature?: number; // Transformer Temperature (°C)
  otherTemperature?: number;   // Other Temperature (°C)
  
  // Status
  operatingState: InverterOperatingState;
  vendorOperatingState?: number;
  
  // Efficiency
  efficiency?: number;         // Efficiency (%)
}

// SunSpec Meter Model (Models 201-204) - Energy meter data
export interface SunSpecMeterModel {
  // AC Measurements
  acCurrent: number;           // AC Total Current (A)
  acCurrentA?: number;         // AC Phase A Current (A)
  acCurrentB?: number;         // AC Phase B Current (A)
  acCurrentC?: number;         // AC Phase C Current (A)
  acVoltageAN?: number;        // AC Voltage Phase A to N (V)
  acVoltageBN?: number;        // AC Voltage Phase B to N (V)
  acVoltageCN?: number;        // AC Voltage Phase C to N (V)
  acVoltageAB?: number;        // AC Voltage Phase AB (V)
  acVoltageBC?: number;        // AC Voltage Phase BC (V)
  acVoltageCA?: number;        // AC Voltage Phase CA (V)
  acFrequency: number;         // AC Frequency (Hz)
  
  // Power Measurements
  acPower: number;             // AC Real Power (W)
  acPowerA?: number;           // AC Real Power Phase A (W)
  acPowerB?: number;           // AC Real Power Phase B (W)
  acPowerC?: number;           // AC Real Power Phase C (W)
  acVA?: number;               // AC Apparent Power (VA)
  acVAR?: number;              // AC Reactive Power (VAR)
  acPowerFactor?: number;      // Power Factor (%)
  
  // Energy Measurements
  acEnergyWh: number;          // AC Real Energy Exported (Wh)
  acEnergyWhImported?: number; // AC Real Energy Imported (Wh)
  acEnergyVAh?: number;        // AC Apparent Energy Exported (VAh)
  acEnergyVAhImported?: number; // AC Apparent Energy Imported (VAh)
  
  // Events
  events?: number;             // Meter Events
}

// Combined SunSpec Device Data
export interface SunSpecDeviceData {
  deviceId: string;
  timestamp: Date;
  common: SunSpecCommonModel;
  inverter?: SunSpecInverterModel;
  meter?: SunSpecMeterModel;
  connectionInfo: ModbusConnectionInfo;
}

// Modbus Connection Information
export interface ModbusConnectionInfo {
  host: string;
  port: number;
  unitId: number;
  timeout: number;
  retryCount: number;
  connectionType: 'TCP' | 'RTU';
  serialOptions?: {
    port: string;
    baudRate: number;
    dataBits: number;
    stopBits: number;
    parity: 'none' | 'even' | 'odd';
  };
}

// SunSpec Configuration
export interface SunSpecConfiguration {
  modbusConnection: ModbusConnectionInfo;
  supportedModels: SunSpecModelType[];
  pollingInterval: number;      // Polling interval in seconds
  autoDiscovery: boolean;       // Auto-discover available models
  registerMap?: SunSpecRegisterMap;
}

// SunSpec Model Types
export enum SunSpecModelType {
  COMMON = 1,                   // Common model (required)
  INVERTER_SINGLE_PHASE = 101,  // Single Phase Inverter
  INVERTER_SPLIT_PHASE = 102,   // Split Phase Inverter
  INVERTER_THREE_PHASE = 103,   // Three Phase Inverter
  INVERTER_THREE_PHASE_DELTA = 111, // Three Phase Delta Inverter
  METER_SINGLE_PHASE = 201,     // Single Phase Meter
  METER_SPLIT_PHASE = 202,      // Split Phase Meter
  METER_THREE_PHASE_WYE = 203,  // Three Phase Wye Meter
  METER_THREE_PHASE_DELTA = 204 // Three Phase Delta Meter
}

// Inverter Operating States
export enum InverterOperatingState {
  OFF = 1,                      // Off
  SLEEPING = 2,                 // Sleeping (auto-shutdown)
  STARTING = 3,                 // Starting
  MPPT = 4,                     // MPPT (normal operation)
  THROTTLED = 5,                // Throttled
  SHUTTING_DOWN = 6,            // Shutting down
  FAULT = 7,                    // Fault
  STANDBY = 8                   // Standby
}

// SunSpec Register Mapping
export interface SunSpecRegisterMap {
  [modelType: number]: {
    startRegister: number;
    length: number;
    registers: {
      [fieldName: string]: {
        offset: number;
        length: number;
        type: 'uint16' | 'int16' | 'uint32' | 'int32' | 'string' | 'float32' | 'sunssf';
        scaleFactor?: string; // Field name for scale factor
        description: string;
      };
    };
  };
}

// SunSpec Model Discovery Result
export interface SunSpecModelDiscovery {
  deviceId: string;
  sunspecId: number;           // Should be 0x53756E53 ("SunS")
  availableModels: {
    modelType: SunSpecModelType;
    startRegister: number;
    length: number;
  }[];
  totalRegisters: number;
}

// Modbus Read Result
export interface ModbusReadResult {
  deviceId: string;
  modelType: SunSpecModelType;
  registers: number[];
  rawData: Buffer;
  timestamp: Date;
  success: boolean;
  error?: string;
}

// SunSpec Data Processing Result
export interface SunSpecProcessingResult {
  deviceId: string;
  modelType: SunSpecModelType;
  parsedData: any;
  scaledData: any;
  timestamp: Date;
  success: boolean;
  error?: string;
}

// Error Types
export class SunSpecError extends Error {
  constructor(
    message: string,
    public code: string,
    public deviceId?: string,
    public modelType?: SunSpecModelType
  ) {
    super(message);
    this.name = 'SunSpecError';
  }
}

export class ModbusConnectionError extends Error {
  constructor(
    message: string,
    public host: string,
    public port: number,
    public unitId: number
  ) {
    super(message);
    this.name = 'ModbusConnectionError';
  }
}