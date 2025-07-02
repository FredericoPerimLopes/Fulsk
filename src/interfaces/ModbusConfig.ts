/**
 * Modbus Configuration Interfaces
 * Configuration types for Modbus TCP/IP communication with SunSpec devices
 */

import { SunSpecDataType } from '@constants/SunSpecConstants';

/**
 * Basic Modbus TCP connection configuration
 */
export interface ModbusTcpConfig {
  /** IP address or hostname of the Modbus device */
  host: string;
  
  /** TCP port (default: 502) */
  port: number;
  
  /** Modbus unit ID/slave address (default: 1) */
  unitId: number;
  
  /** Connection timeout in milliseconds (default: 5000) */
  timeout: number;
  
  /** Number of retry attempts on connection failure (default: 3) */
  retryAttempts: number;
  
  /** Delay between retry attempts in milliseconds (default: 1000) */
  retryDelay: number;
  
  /** Keep connection alive (default: true) */
  keepAlive: boolean;
  
  /** Maximum number of concurrent connections (default: 1) */
  maxConnections: number;
}

/**
 * SunSpec specific configuration
 */
export interface SunSpecConfig {
  /** SunSpec base register address (default: 40000) */
  baseRegister: number;
  
  /** Expected SunSpec device models (e.g., [1, 101]) */
  supportedModels: number[];
  
  /** Enable automatic model discovery */
  autoDiscovery: boolean;
  
  /** Maximum number of registers to read in single request */
  maxRegistersPerRead: number;
  
  /** Enable register caching */
  enableCaching: boolean;
  
  /** Cache timeout in milliseconds */
  cacheTimeout: number;
}

/**
 * Register mapping configuration for custom devices
 */
export interface RegisterConfig {
  /** Register address */
  address: number;
  
  /** Register name/identifier */
  name: string;
  
  /** Data type */
  type: SunSpecDataType;
  
  /** Number of registers to read */
  length: number;
  
  /** Scale factor (if static) */
  scaleFactor?: number;
  
  /** Address of scale factor register */
  scaleRegister?: number;
  
  /** Units (e.g., 'W', 'V', 'A', '°C') */
  units?: string;
  
  /** Human-readable description */
  description: string;
  
  /** Minimum valid value */
  minValue?: number;
  
  /** Maximum valid value */
  maxValue?: number;
  
  /** Whether this register is writable */
  writable?: boolean;
}

/**
 * Complete Modbus device configuration
 */
export interface ModbusDeviceConfig {
  /** TCP connection settings */
  connection: ModbusTcpConfig;
  
  /** SunSpec protocol settings */
  sunspec: SunSpecConfig;
  
  /** Custom register mappings (optional - for non-standard devices) */
  customRegisters?: RegisterConfig[];
  
  /** Data collection interval in seconds */
  pollingInterval: number;
  
  /** Enable data validation */
  validateData: boolean;
  
  /** Log level for Modbus operations */
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Extended device configuration for Modbus devices
 * Extends the base DeviceConfiguration from Device model
 */
export interface ModbusDeviceConfiguration {
  /** Base device configuration fields */
  communicationProtocol: 'MODBUS';
  dataCollectionInterval: number;
  alertThresholds: {
    minPower: number;
    maxTemperature: number;
    minVoltage: number;
    maxVoltage: number;
  };
  notifications: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
  
  /** Modbus-specific configuration */
  modbus: ModbusDeviceConfig;
}

/**
 * Modbus connection state
 */
export enum ModbusConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  RECONNECTING = 'RECONNECTING',
  ERROR = 'ERROR'
}

/**
 * Modbus connection status
 */
export interface ModbusConnectionStatus {
  /** Current connection state */
  state: ModbusConnectionState;
  
  /** Last successful connection timestamp */
  lastConnected?: Date;
  
  /** Last connection error */
  lastError?: string;
  
  /** Connection retry count */
  retryCount: number;
  
  /** Total successful reads */
  successfulReads: number;
  
  /** Total failed reads */
  failedReads: number;
  
  /** Average response time in milliseconds */
  averageResponseTime: number;
}

/**
 * Modbus read result
 */
export interface ModbusReadResult {
  /** Device ID */
  deviceId: string;
  
  /** Timestamp of the read operation */
  timestamp: Date;
  
  /** Raw register values */
  rawValues: number[];
  
  /** Parsed data values */
  parsedData: { [key: string]: any };
  
  /** Read success status */
  success: boolean;
  
  /** Error message if read failed */
  error?: string;
  
  /** Response time in milliseconds */
  responseTime: number;
}

/**
 * SunSpec device information
 */
export interface SunSpecDeviceInfo {
  /** SunSpec identifier (should be 'SunS') */
  sunspecId: string;
  
  /** Device model ID */
  deviceId: number;
  
  /** Manufacturer name */
  manufacturer: string;
  
  /** Model name */
  model: string;
  
  /** Serial number */
  serialNumber: string;
  
  /** Firmware version */
  firmwareVersion: string;
  
  /** Supported SunSpec models */
  supportedModels: number[];
  
  /** Device options */
  options?: string;
}

/**
 * Default Modbus configuration
 */
export const DEFAULT_MODBUS_TCP_CONFIG: Partial<ModbusTcpConfig> = {
  port: 502,
  unitId: 1,
  timeout: 5000,
  retryAttempts: 3,
  retryDelay: 1000,
  keepAlive: true,
  maxConnections: 1
};

export const DEFAULT_SUNSPEC_CONFIG: Partial<SunSpecConfig> = {
  baseRegister: 40000,
  supportedModels: [1, 101, 102, 103], // Common + Single/Split/Three phase
  autoDiscovery: true,
  maxRegistersPerRead: 125, // Modbus limit
  enableCaching: true,
  cacheTimeout: 30000 // 30 seconds
};

export const DEFAULT_MODBUS_DEVICE_CONFIG: Partial<ModbusDeviceConfig> = {
  pollingInterval: 30, // 30 seconds
  validateData: true,
  logLevel: 'info'
};

/**
 * Utility functions for configuration validation
 */
export class ModbusConfigValidator {
  /**
   * Validate Modbus TCP configuration
   */
  static validateTcpConfig(config: Partial<ModbusTcpConfig>): string[] {
    const errors: string[] = [];
    
    if (!config.host) {
      errors.push('Host is required');
    }
    
    if (config.port && (config.port < 1 || config.port > 65535)) {
      errors.push('Port must be between 1 and 65535');
    }
    
    if (config.unitId && (config.unitId < 1 || config.unitId > 247)) {
      errors.push('Unit ID must be between 1 and 247');
    }
    
    if (config.timeout && config.timeout < 1000) {
      errors.push('Timeout should be at least 1000ms');
    }
    
    return errors;
  }
  
  /**
   * Validate SunSpec configuration
   */
  static validateSunSpecConfig(config: Partial<SunSpecConfig>): string[] {
    const errors: string[] = [];
    
    if (config.baseRegister && config.baseRegister < 1) {
      errors.push('Base register must be positive');
    }
    
    if (config.maxRegistersPerRead && (config.maxRegistersPerRead < 1 || config.maxRegistersPerRead > 125)) {
      errors.push('Max registers per read must be between 1 and 125');
    }
    
    if (config.supportedModels && config.supportedModels.length === 0) {
      errors.push('At least one supported model must be specified');
    }
    
    return errors;
  }
  
  /**
   * Create complete configuration with defaults
   */
  static createConfig(partial: Partial<ModbusDeviceConfig>): ModbusDeviceConfig {
    return {
      connection: {
        ...DEFAULT_MODBUS_TCP_CONFIG,
        ...partial.connection
      } as ModbusTcpConfig,
      sunspec: {
        ...DEFAULT_SUNSPEC_CONFIG,
        ...partial.sunspec
      } as SunSpecConfig,
      customRegisters: partial.customRegisters || [],
      pollingInterval: partial.pollingInterval || DEFAULT_MODBUS_DEVICE_CONFIG.pollingInterval!,
      validateData: partial.validateData ?? DEFAULT_MODBUS_DEVICE_CONFIG.validateData!,
      logLevel: partial.logLevel || DEFAULT_MODBUS_DEVICE_CONFIG.logLevel!
    };
  }
}