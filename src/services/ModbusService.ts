/**
 * ModbusService - Core Modbus TCP/IP communication with SunSpec protocol support
 * Handles connection management, register reading, and data parsing for solar inverters
 */

import ModbusRTU from 'modbus-serial';
import { EventEmitter } from 'events';
import {
  ModbusTcpConfig,
  SunSpecConfig,
  ModbusDeviceConfig,
  ModbusConnectionState,
  ModbusConnectionStatus,
  ModbusReadResult,
  SunSpecDeviceInfo,
  RegisterConfig,
  ModbusConfigValidator
} from '@interfaces/ModbusConfig';
import {
  SUNSPEC_BASE_REGISTER,
  SUNSPEC_COMMON_MODEL,
  SUNSPEC_INVERTER_MODELS,
  SUNSPEC_COMMON_REGISTERS,
  createInverterRegisterMap,
  SunSpecDataType,
  SUNSPEC_NAN_VALUES,
  SUNSPEC_OPERATING_STATES,
  SUNSPEC_EVENT_FLAGS
} from '@constants/SunSpecConstants';

export class ModbusService extends EventEmitter {
  private client: ModbusRTU;
  private config: ModbusDeviceConfig;
  private connectionStatus: ModbusConnectionStatus;
  private connectionTimer?: NodeJS.Timeout;
  private reconnectTimer?: NodeJS.Timeout;
  private cache: Map<string, { data: any; timestamp: Date }>;
  private logger: any; // You can replace with your logging service

  constructor(config: Partial<ModbusDeviceConfig>) {
    super();
    
    // Validate and merge configuration
    const validationErrors = this.validateConfiguration(config);
    if (validationErrors.length > 0) {
      throw new Error(`Invalid Modbus configuration: ${validationErrors.join(', ')}`);
    }
    
    this.config = ModbusConfigValidator.createConfig(config);
    
    // Initialize Modbus client
    this.client = new ModbusRTU();
    
    // Initialize connection status
    this.connectionStatus = {
      state: ModbusConnectionState.DISCONNECTED,
      retryCount: 0,
      successfulReads: 0,
      failedReads: 0,
      averageResponseTime: 0
    };
    
    // Initialize cache
    this.cache = new Map();
    
    // Setup logger (replace with your logging service)
    this.logger = {
      debug: (msg: string, ...args: any[]) => console.log(`[DEBUG] ${msg}`, ...args),
      info: (msg: string, ...args: any[]) => console.log(`[INFO] ${msg}`, ...args),
      warn: (msg: string, ...args: any[]) => console.warn(`[WARN] ${msg}`, ...args),
      error: (msg: string, ...args: any[]) => console.error(`[ERROR] ${msg}`, ...args)
    };
    
    // Setup client event handlers
    this.setupEventHandlers();
  }

  /**
   * Validate configuration
   */
  private validateConfiguration(config: Partial<ModbusDeviceConfig>): string[] {
    const errors: string[] = [];
    
    if (config.connection) {
      errors.push(...ModbusConfigValidator.validateTcpConfig(config.connection));
    }
    
    if (config.sunspec) {
      errors.push(...ModbusConfigValidator.validateSunSpecConfig(config.sunspec));
    }
    
    return errors;
  }

  /**
   * Setup client event handlers
   */
  private setupEventHandlers(): void {
    this.client.on('error', (error) => {
      this.logger.error('Modbus client error:', error);
      this.updateConnectionStatus(ModbusConnectionState.ERROR, error.message);
      this.emit('error', error);
    });

    this.client.on('close', () => {
      this.logger.info('Modbus connection closed');
      this.updateConnectionStatus(ModbusConnectionState.DISCONNECTED);
      this.emit('disconnect');
    });
  }

  /**
   * Connect to Modbus device
   */
  async connect(): Promise<void> {
    if (this.connectionStatus.state === ModbusConnectionState.CONNECTED) {
      this.logger.info('Already connected to Modbus device');
      return;
    }

    this.updateConnectionStatus(ModbusConnectionState.CONNECTING);
    this.logger.info(`Connecting to Modbus device at ${this.config.connection.host}:${this.config.connection.port}`);

    try {
      await this.client.connectTCP(this.config.connection.host, {
        port: this.config.connection.port
      });

      // Set unit ID
      this.client.setID(this.config.connection.unitId);
      
      // Set timeout
      this.client.setTimeout(this.config.connection.timeout);

      this.updateConnectionStatus(ModbusConnectionState.CONNECTED);
      this.connectionStatus.lastConnected = new Date();
      this.connectionStatus.retryCount = 0;
      
      this.logger.info('Successfully connected to Modbus device');
      this.emit('connect');

      // Start keep-alive if enabled
      if (this.config.connection.keepAlive) {
        this.startKeepAlive();
      }

    } catch (error) {
      this.logger.error('Failed to connect to Modbus device:', error);
      this.updateConnectionStatus(ModbusConnectionState.ERROR, (error as Error).message);
      
      // Schedule reconnection
      this.scheduleReconnect();
      throw error;
    }
  }

  /**
   * Disconnect from Modbus device
   */
  async disconnect(): Promise<void> {
    this.stopKeepAlive();
    this.clearReconnectTimer();
    
    if (this.client.isOpen) {
      this.client.close(() => {
        this.logger.info('Modbus connection closed');
      });
    }
    
    this.updateConnectionStatus(ModbusConnectionState.DISCONNECTED);
    this.emit('disconnect');
  }

  /**
   * Update connection status
   */
  private updateConnectionStatus(state: ModbusConnectionState, error?: string): void {
    this.connectionStatus.state = state;
    if (error) {
      this.connectionStatus.lastError = error;
    }
    this.emit('statusChange', this.connectionStatus);
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.connectionStatus.retryCount >= this.config.connection.retryAttempts) {
      this.logger.error('Maximum reconnection attempts reached');
      return;
    }

    this.connectionStatus.retryCount++;
    this.updateConnectionStatus(ModbusConnectionState.RECONNECTING);
    
    this.logger.info(`Scheduling reconnection attempt ${this.connectionStatus.retryCount}/${this.config.connection.retryAttempts} in ${this.config.connection.retryDelay}ms`);
    
    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        // Connection will be retried automatically
      }
    }, this.config.connection.retryDelay);
  }

  /**
   * Clear reconnect timer
   */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  /**
   * Start keep-alive mechanism
   */
  private startKeepAlive(): void {
    this.connectionTimer = setInterval(async () => {
      try {
        // Read a single register to test connection
        await this.readHoldingRegisters(this.config.sunspec.baseRegister, 1);
      } catch (error) {
        this.logger.warn('Keep-alive failed, attempting reconnection');
        await this.reconnect();
      }
    }, 30000); // 30 second keep-alive
  }

  /**
   * Stop keep-alive mechanism
   */
  private stopKeepAlive(): void {
    if (this.connectionTimer) {
      clearInterval(this.connectionTimer);
      this.connectionTimer = undefined;
    }
  }

  /**
   * Reconnect to device
   */
  private async reconnect(): Promise<void> {
    await this.disconnect();
    await new Promise(resolve => setTimeout(resolve, 1000));
    await this.connect();
  }

  /**
   * Read holding registers with error handling and retries
   */
  private async readHoldingRegisters(address: number, count: number): Promise<number[]> {
    const startTime = Date.now();
    
    try {
      if (!this.client.isOpen) {
        throw new Error('Modbus connection is not open');
      }

      const result = await this.client.readHoldingRegisters(address, count);
      
      const responseTime = Date.now() - startTime;
      this.updatePerformanceMetrics(true, responseTime);
      
      return result.data;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updatePerformanceMetrics(false, responseTime);
      
      this.logger.error(`Failed to read registers ${address}-${address + count - 1}:`, error);
      throw error;
    }
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(success: boolean, responseTime: number): void {
    if (success) {
      this.connectionStatus.successfulReads++;
    } else {
      this.connectionStatus.failedReads++;
    }
    
    // Update average response time (simple moving average)
    const totalReads = this.connectionStatus.successfulReads + this.connectionStatus.failedReads;
    this.connectionStatus.averageResponseTime = 
      ((this.connectionStatus.averageResponseTime * (totalReads - 1)) + responseTime) / totalReads;
  }

  /**
   * Discover SunSpec device information
   */
  async discoverDevice(): Promise<SunSpecDeviceInfo | null> {
    this.logger.info('Starting SunSpec device discovery');
    
    try {
      // Read SunSpec identifier
      const identifierRegisters = await this.readHoldingRegisters(
        this.config.sunspec.baseRegister,
        4
      );
      
      // Check SunSpec magic number
      const sunspecId = this.parseString(identifierRegisters.slice(0, 2));
      if (sunspecId !== 'SunS') {
        this.logger.warn(`Invalid SunSpec identifier: ${sunspecId}`);
        return null;
      }
      
      const deviceId = identifierRegisters[2];
      const modelLength = identifierRegisters[3];
      
      this.logger.info(`Found SunSpec device: ID=${deviceId}, Length=${modelLength}`);
      
      // Read common model data
      const commonModelRegisters = await this.readHoldingRegisters(
        this.config.sunspec.baseRegister + 4,
        SUNSPEC_COMMON_MODEL.LENGTH
      );
      
      const deviceInfo: SunSpecDeviceInfo = {
        sunspecId,
        deviceId,
        manufacturer: this.parseString(commonModelRegisters.slice(0, 16)).trim(),
        model: this.parseString(commonModelRegisters.slice(16, 32)).trim(),
        options: this.parseString(commonModelRegisters.slice(32, 40)).trim(),
        firmwareVersion: this.parseString(commonModelRegisters.slice(40, 48)).trim(),
        serialNumber: this.parseString(commonModelRegisters.slice(48, 64)).trim(),
        supportedModels: [1] // Will be updated with model discovery
      };
      
      // Discover additional models if auto-discovery is enabled
      if (this.config.sunspec.autoDiscovery) {
        deviceInfo.supportedModels = await this.discoverModels();
      }
      
      this.logger.info('Device discovery completed:', deviceInfo);
      return deviceInfo;
      
    } catch (error) {
      this.logger.error('Device discovery failed:', error);
      throw error;
    }
  }

  /**
   * Discover supported SunSpec models
   */
  private async discoverModels(): Promise<number[]> {
    const supportedModels = [1]; // Always include common model
    let currentAddress = this.config.sunspec.baseRegister + SUNSPEC_COMMON_MODEL.LENGTH + 4;
    
    try {
      // Try to read potential model headers
      for (let i = 0; i < 10; i++) { // Limit to 10 models for safety
        const modelHeader = await this.readHoldingRegisters(currentAddress, 2);
        const modelId = modelHeader[0];
        const modelLength = modelHeader[1];
        
        if (modelId === 0xFFFF) {
          // End of model list
          break;
        }
        
        if (Object.values(SUNSPEC_INVERTER_MODELS).includes(modelId)) {
          supportedModels.push(modelId);
          this.logger.debug(`Found inverter model: ${modelId}, length: ${modelLength}`);
        }
        
        currentAddress += modelLength + 2;
      }
    } catch (error) {
      this.logger.warn('Model discovery incomplete:', error);
    }
    
    return supportedModels;
  }

  /**
   * Read all device data using SunSpec protocol
   */
  async readDeviceData(deviceId: string): Promise<ModbusReadResult> {
    const startTime = Date.now();
    
    try {
      // Check cache first
      if (this.config.sunspec.enableCaching) {
        const cached = this.getFromCache(deviceId);
        if (cached) {
          return cached;
        }
      }
      
      const rawValues: number[] = [];
      const parsedData: { [key: string]: any } = {};
      
      // Read common model
      const commonData = await this.readCommonModel();
      rawValues.push(...commonData.rawValues);
      Object.assign(parsedData, commonData.parsedData);
      
      // Read inverter models
      for (const modelId of this.config.sunspec.supportedModels) {
        if (Object.values(SUNSPEC_INVERTER_MODELS).includes(modelId)) {
          const inverterData = await this.readInverterModel(modelId);
          rawValues.push(...inverterData.rawValues);
          Object.assign(parsedData, inverterData.parsedData);
        }
      }
      
      const result: ModbusReadResult = {
        deviceId,
        timestamp: new Date(),
        rawValues,
        parsedData,
        success: true,
        responseTime: Date.now() - startTime
      };
      
      // Cache the result
      if (this.config.sunspec.enableCaching) {
        this.setCache(deviceId, result);
      }
      
      this.emit('dataRead', result);
      return result;
      
    } catch (error) {
      const result: ModbusReadResult = {
        deviceId,
        timestamp: new Date(),
        rawValues: [],
        parsedData: {},
        success: false,
        error: (error as Error).message,
        responseTime: Date.now() - startTime
      };
      
      this.emit('readError', result);
      throw error;
    }
  }

  /**
   * Read SunSpec common model
   */
  private async readCommonModel(): Promise<{ rawValues: number[]; parsedData: any }> {
    const registers = await this.readHoldingRegisters(
      this.config.sunspec.baseRegister,
      SUNSPEC_COMMON_MODEL.LENGTH + 4
    );
    
    const parsedData = {
      sunspecId: this.parseString(registers.slice(0, 2)),
      deviceId: registers[2],
      modelLength: registers[3],
      manufacturer: this.parseString(registers.slice(4, 20)).trim(),
      model: this.parseString(registers.slice(20, 36)).trim(),
      options: this.parseString(registers.slice(36, 44)).trim(),
      firmwareVersion: this.parseString(registers.slice(44, 52)).trim(),
      serialNumber: this.parseString(registers.slice(52, 68)).trim(),
      deviceAddress: registers[68]
    };
    
    return { rawValues: registers, parsedData };
  }

  /**
   * Read SunSpec inverter model
   */
  private async readInverterModel(modelId: number): Promise<{ rawValues: number[]; parsedData: any }> {
    // For now, implement basic single-phase inverter (Model 101)
    // You can extend this for other models
    
    const modelAddress = this.findModelAddress(modelId);
    if (!modelAddress) {
      throw new Error(`Model ${modelId} not found`);
    }
    
    const registers = await this.readHoldingRegisters(modelAddress, 50);
    const registerMap = createInverterRegisterMap(modelAddress);
    
    const parsedData: any = {};
    
    for (const regConfig of registerMap) {
      const relativeAddress = regConfig.address - modelAddress;
      let value = this.parseRegisterValue(registers, relativeAddress, regConfig);
      
      // Apply scale factor if needed
      if (regConfig.scaleRegister) {
        const scaleAddress = regConfig.scaleRegister - modelAddress;
        const scaleFactor = this.parseScaleFactor(registers[scaleAddress]);
        value = value * Math.pow(10, scaleFactor);
      }
      
      // Validate data
      if (this.config.validateData && this.isValidValue(value, regConfig.type)) {
        parsedData[regConfig.name] = value;
      }
    }
    
    return { rawValues: registers, parsedData };
  }

  /**
   * Find the address of a specific model
   */
  private findModelAddress(modelId: number): number | null {
    // This is a simplified implementation
    // In a full implementation, you would scan the device for model locations
    switch (modelId) {
      case 101:
      case 102:
      case 103:
        return this.config.sunspec.baseRegister + 70; // Typical inverter model location
      default:
        return null;
    }
  }

  /**
   * Parse register value based on data type
   */
  private parseRegisterValue(registers: number[], address: number, config: RegisterConfig): any {
    switch (config.type) {
      case SunSpecDataType.INT16:
        return this.parseInt16(registers[address]);
      case SunSpecDataType.UINT16:
        return registers[address];
      case SunSpecDataType.INT32:
        return this.parseInt32(registers[address], registers[address + 1]);
      case SunSpecDataType.UINT32:
        return this.parseUint32(registers[address], registers[address + 1]);
      case SunSpecDataType.STRING:
        return this.parseString(registers.slice(address, address + config.length));
      case SunSpecDataType.ENUM16:
        return registers[address];
      case SunSpecDataType.BITFIELD16:
        return registers[address];
      case SunSpecDataType.BITFIELD32:
        return this.parseUint32(registers[address], registers[address + 1]);
      default:
        return registers[address];
    }
  }

  /**
   * Parse 16-bit signed integer
   */
  private parseInt16(value: number): number {
    return value > 32767 ? value - 65536 : value;
  }

  /**
   * Parse 32-bit signed integer
   */
  private parseInt32(high: number, low: number): number {
    const value = (high << 16) | low;
    return value > 2147483647 ? value - 4294967296 : value;
  }

  /**
   * Parse 32-bit unsigned integer
   */
  private parseUint32(high: number, low: number): number {
    return (high << 16) | low;
  }

  /**
   * Parse string from register array
   */
  private parseString(registers: number[]): string {
    let result = '';
    for (const reg of registers) {
      result += String.fromCharCode((reg >> 8) & 0xFF);
      result += String.fromCharCode(reg & 0xFF);
    }
    return result.replace(/\0/g, ''); // Remove null characters
  }

  /**
   * Parse scale factor
   */
  private parseScaleFactor(value: number): number {
    return this.parseInt16(value);
  }

  /**
   * Validate if value is valid (not NaN)
   */
  private isValidValue(value: any, type: SunSpecDataType): boolean {
    switch (type) {
      case SunSpecDataType.INT16:
        return value !== SUNSPEC_NAN_VALUES.INT16;
      case SunSpecDataType.UINT16:
        return value !== SUNSPEC_NAN_VALUES.UINT16;
      case SunSpecDataType.INT32:
        return value !== SUNSPEC_NAN_VALUES.INT32;
      case SunSpecDataType.UINT32:
        return value !== SUNSPEC_NAN_VALUES.UINT32;
      default:
        return value != null && value !== '';
    }
  }

  /**
   * Cache management
   */
  private getFromCache(key: string): ModbusReadResult | null {
    const cached = this.cache.get(key);
    if (cached && (Date.now() - cached.timestamp.getTime()) < this.config.sunspec.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  private setCache(key: string, data: ModbusReadResult): void {
    this.cache.set(key, { data, timestamp: new Date() });
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): ModbusConnectionStatus {
    return { ...this.connectionStatus };
  }

  /**
   * Get configuration
   */
  getConfiguration(): ModbusDeviceConfig {
    return { ...this.config };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.logger.info('Cleaning up Modbus service');
    
    this.stopKeepAlive();
    this.clearReconnectTimer();
    
    if (this.client.isOpen) {
      await this.disconnect();
    }
    
    this.cache.clear();
    this.removeAllListeners();
  }
}