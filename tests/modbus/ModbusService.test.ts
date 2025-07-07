/**
 * Comprehensive tests for ModbusService
 * Tests Modbus TCP/IP communication, SunSpec protocol, and error handling
 */

import { ModbusService, ModbusServiceManager } from '../../src/services/ModbusService';
import { 
  ModbusDeviceConfig, 
  ModbusConnectionState, 
  SunSpecDeviceInfo,
  DEFAULT_MODBUS_TCP_CONFIG,
  DEFAULT_SUNSPEC_CONFIG,
  ModbusConfigValidator
} from '../../src/interfaces/ModbusConfig';

// Mock modbus-serial
jest.mock('modbus-serial', () => {
  return jest.fn().mockImplementation(() => ({
    connectTCP: jest.fn(),
    setID: jest.fn(),
    setTimeout: jest.fn(),
    readHoldingRegisters: jest.fn(),
    close: jest.fn(),
    on: jest.fn(),
    isOpen: false,
  }));
});

describe('ModbusService', () => {
  let modbusService: ModbusService;
  let mockClient: any;
  
  const testConfig: Partial<ModbusDeviceConfig> = {
    connection: {
      host: '192.168.1.100',
      port: 502,
      unitId: 1,
      timeout: 5000,
      retryAttempts: 3,
      retryDelay: 1000,
      keepAlive: true,
      maxConnections: 1
    },
    sunspec: {
      baseRegister: 40000,
      supportedModels: [1, 101, 103],
      autoDiscovery: true,
      maxRegistersPerRead: 125,
      enableCaching: true,
      cacheTimeout: 30000
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    modbusService = new ModbusService(testConfig);
    mockClient = (modbusService as any).client;
  });

  afterEach(async () => {
    await modbusService.cleanup();
  });

  describe('Configuration Validation', () => {
    test('should validate correct TCP configuration', () => {
      const errors = ModbusConfigValidator.validateTcpConfig(testConfig.connection!);
      expect(errors).toHaveLength(0);
    });

    test('should detect invalid host', () => {
      const invalidConfig = { ...testConfig.connection!, host: '' };
      const errors = ModbusConfigValidator.validateTcpConfig(invalidConfig);
      expect(errors).toContain('Host is required');
    });

    test('should detect invalid port', () => {
      const invalidConfig = { ...testConfig.connection!, port: 70000 };
      const errors = ModbusConfigValidator.validateTcpConfig(invalidConfig);
      expect(errors).toContain('Port must be between 1 and 65535');
    });

    test('should detect invalid unit ID', () => {
      const invalidConfig = { ...testConfig.connection!, unitId: 300 };
      const errors = ModbusConfigValidator.validateTcpConfig(invalidConfig);
      expect(errors).toContain('Unit ID must be between 1 and 247');
    });

    test('should validate SunSpec configuration', () => {
      const errors = ModbusConfigValidator.validateSunSpecConfig(testConfig.sunspec!);
      expect(errors).toHaveLength(0);
    });

    test('should throw error for invalid configuration', () => {
      expect(() => {
        new ModbusService({ connection: { host: '', port: 502 } } as any);
      }).toThrow('Invalid Modbus configuration');
    });
  });

  describe('Connection Management', () => {
    test('should connect successfully', async () => {
      mockClient.connectTCP.mockResolvedValue(undefined);
      mockClient.isOpen = true;

      await modbusService.connect();

      expect(mockClient.connectTCP).toHaveBeenCalledWith('192.168.1.100', { port: 502 });
      expect(mockClient.setID).toHaveBeenCalledWith(1);
      expect(mockClient.setTimeout).toHaveBeenCalledWith(5000);
      
      const status = modbusService.getConnectionStatus();
      expect(status.state).toBe(ModbusConnectionState.CONNECTED);
    });

    test('should handle connection failure', async () => {
      const connectionError = new Error('Connection failed');
      mockClient.connectTCP.mockRejectedValue(connectionError);

      await expect(modbusService.connect()).rejects.toThrow('Connection failed');
      
      const status = modbusService.getConnectionStatus();
      expect(status.state).toBe(ModbusConnectionState.ERROR);
      expect(status.lastError).toBe('Connection failed');
    });

    test('should not connect if already connected', async () => {
      mockClient.connectTCP.mockResolvedValue(undefined);
      mockClient.isOpen = true;
      
      // Set connection status to connected
      (modbusService as any).connectionStatus.state = ModbusConnectionState.CONNECTED;

      await modbusService.connect();

      expect(mockClient.connectTCP).not.toHaveBeenCalled();
    });

    test('should disconnect gracefully', async () => {
      mockClient.isOpen = true;
      mockClient.close.mockImplementation((callback: Function) => callback());

      await modbusService.disconnect();

      expect(mockClient.close).toHaveBeenCalled();
      
      const status = modbusService.getConnectionStatus();
      expect(status.state).toBe(ModbusConnectionState.DISCONNECTED);
    });

    test('should retry connection on failure', async () => {
      jest.useFakeTimers();
      
      const connectionError = new Error('Connection failed');
      mockClient.connectTCP
        .mockRejectedValueOnce(connectionError)
        .mockResolvedValueOnce(undefined);
      
      mockClient.isOpen = false;

      // First connection attempt should fail
      await expect(modbusService.connect()).rejects.toThrow('Connection failed');
      
      const status = modbusService.getConnectionStatus();
      expect(status.state).toBe(ModbusConnectionState.RECONNECTING);
      expect(status.retryCount).toBe(1);

      // Fast forward time to trigger retry
      jest.advanceTimersByTime(1000);
      await new Promise(resolve => setImmediate(resolve));

      jest.useRealTimers();
    });
  });

  describe('SunSpec Device Discovery', () => {
    test('should discover SunSpec device successfully', async () => {
      mockClient.isOpen = true;
      
      // Mock SunSpec identifier response
      const sunspecIdentifier = [0x5375, 0x6e53, 1, 65]; // 'SunS', device ID, length
      mockClient.readHoldingRegisters.mockResolvedValueOnce({ data: sunspecIdentifier });
      
      // Mock common model response
      const commonModelData = new Array(65).fill(0);
      // Set manufacturer (registers 4-19 = 'Test Manufacturer')
      commonModelData[4] = 0x5465; // 'Te'
      commonModelData[5] = 0x7374; // 'st'
      commonModelData[6] = 0x204D; // ' M'
      commonModelData[7] = 0x616e; // 'an'
      commonModelData[8] = 0x7566; // 'uf'
      commonModelData[9] = 0x6163; // 'ac'
      commonModelData[10] = 0x7475; // 'tu'
      commonModelData[11] = 0x7265; // 're'
      commonModelData[12] = 0x7200; // 'r\0'
      
      mockClient.readHoldingRegisters.mockResolvedValueOnce({ data: commonModelData });

      const deviceInfo = await modbusService.discoverDevice();

      expect(deviceInfo).toBeTruthy();
      expect(deviceInfo!.sunspecId).toBe('SunS');
      expect(deviceInfo!.deviceId).toBe(1);
      expect(deviceInfo!.manufacturer).toBe('Test Manufacturer');
    });

    test('should return null for invalid SunSpec identifier', async () => {
      mockClient.isOpen = true;
      
      // Mock invalid identifier
      const invalidIdentifier = [0x1234, 0x5678, 1, 65];
      mockClient.readHoldingRegisters.mockResolvedValueOnce({ data: invalidIdentifier });

      const deviceInfo = await modbusService.discoverDevice();

      expect(deviceInfo).toBeNull();
    });

    test('should handle discovery errors', async () => {
      mockClient.isOpen = true;
      mockClient.readHoldingRegisters.mockRejectedValue(new Error('Read failed'));

      await expect(modbusService.discoverDevice()).rejects.toThrow('Read failed');
    });
  });

  describe('Data Reading', () => {
    beforeEach(() => {
      mockClient.isOpen = true;
    });

    test('should read device data successfully', async () => {
      // Mock SunSpec identifier
      const sunspecData = [0x5375, 0x6e53, 1, 65];
      // Mock common model data
      const commonData = new Array(69).fill(0);
      // Mock inverter model data
      const inverterData = new Array(50).fill(0);
      inverterData[0] = 100; // AC Current
      inverterData[2] = 240; // AC Voltage
      inverterData[4] = 2000; // AC Power

      mockClient.readHoldingRegisters
        .mockResolvedValueOnce({ data: sunspecData })
        .mockResolvedValueOnce({ data: commonData })
        .mockResolvedValueOnce({ data: inverterData });

      const result = await modbusService.readDeviceData('test-device');

      expect(result.success).toBe(true);
      expect(result.deviceId).toBe('test-device');
      expect(result.rawValues).toEqual(expect.arrayContaining(sunspecData));
      expect(result.parsedData).toBeDefined();
    });

    test('should handle read errors gracefully', async () => {
      mockClient.readHoldingRegisters.mockRejectedValue(new Error('Read timeout'));

      await expect(modbusService.readDeviceData('test-device')).rejects.toThrow('Read timeout');
    });

    test('should use cache when enabled', async () => {
      const testResult = {
        deviceId: 'test-device',
        timestamp: new Date(),
        rawValues: [1, 2, 3],
        parsedData: { test: 'data' },
        success: true,
        responseTime: 100
      };

      // Set cache
      (modbusService as any).setCache('test-device', testResult);

      // Should return cached result
      const result = await modbusService.readDeviceData('test-device');
      expect(result).toEqual(testResult);
      expect(mockClient.readHoldingRegisters).not.toHaveBeenCalled();
    });

    test('should validate data types correctly', async () => {
      const service = modbusService as any;
      
      // Test different SunSpec data types
      expect(service.parseInt16(32768)).toBe(-32768);
      expect(service.parseInt16(32767)).toBe(32767);
      expect(service.parseInt32(0, 65536)).toBe(65536);
      expect(service.parseUint32(1, 0)).toBe(65536);
      expect(service.parseString([0x4865, 0x6c6c, 0x6f00])).toBe('Hello');
    });
  });

  describe('Performance Metrics', () => {
    test('should track successful reads', async () => {
      mockClient.isOpen = true;
      mockClient.readHoldingRegisters.mockResolvedValue({ data: [1, 2, 3] });

      await (modbusService as any).readHoldingRegisters(40001, 3);

      const status = modbusService.getConnectionStatus();
      expect(status.successfulReads).toBe(1);
      expect(status.failedReads).toBe(0);
      expect(status.averageResponseTime).toBeGreaterThan(0);
    });

    test('should track failed reads', async () => {
      mockClient.isOpen = true;
      mockClient.readHoldingRegisters.mockRejectedValue(new Error('Read failed'));

      try {
        await (modbusService as any).readHoldingRegisters(40001, 3);
      } catch (error) {
        // Expected error
      }

      const status = modbusService.getConnectionStatus();
      expect(status.failedReads).toBe(1);
      expect(status.successfulReads).toBe(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle Modbus client errors', () => {
      const errorHandler = jest.fn();
      modbusService.on('error', errorHandler);

      // Simulate client error
      const clientErrorHandler = mockClient.on.mock.calls.find(call => call[0] === 'error')[1];
      const testError = new Error('Modbus error');
      clientErrorHandler(testError);

      expect(errorHandler).toHaveBeenCalledWith(testError);
      
      const status = modbusService.getConnectionStatus();
      expect(status.state).toBe(ModbusConnectionState.ERROR);
      expect(status.lastError).toBe('Modbus error');
    });

    test('should handle connection close events', () => {
      const disconnectHandler = jest.fn();
      modbusService.on('disconnect', disconnectHandler);

      // Simulate connection close
      const clientCloseHandler = mockClient.on.mock.calls.find(call => call[0] === 'close')[1];
      clientCloseHandler();

      expect(disconnectHandler).toHaveBeenCalled();
      
      const status = modbusService.getConnectionStatus();
      expect(status.state).toBe(ModbusConnectionState.DISCONNECTED);
    });

    test('should throw error when reading from closed connection', async () => {
      mockClient.isOpen = false;

      await expect((modbusService as any).readHoldingRegisters(40001, 3))
        .rejects.toThrow('Modbus connection is not open');
    });
  });

  describe('Cleanup', () => {
    test('should cleanup resources properly', async () => {
      mockClient.isOpen = true;
      mockClient.close.mockImplementation((callback: Function) => callback());

      // Set up some timers and cache
      (modbusService as any).connectionTimer = setInterval(() => {}, 1000);
      (modbusService as any).cache.set('test', { data: 'test', timestamp: new Date() });

      await modbusService.cleanup();

      expect(mockClient.close).toHaveBeenCalled();
      expect((modbusService as any).cache.size).toBe(0);
    });
  });
});

describe('ModbusServiceManager', () => {
  afterEach(async () => {
    await ModbusServiceManager.cleanup();
  });

  test('should manage multiple device connections', async () => {
    const config1: Partial<ModbusDeviceConfig> = {
      connection: {
        host: '192.168.1.100',
        port: 502,
        unitId: 1,
        timeout: 5000,
        retryAttempts: 3,
        retryDelay: 1000,
        keepAlive: true,
        maxConnections: 1
      },
      sunspec: DEFAULT_SUNSPEC_CONFIG as any
    };

    const config2: Partial<ModbusDeviceConfig> = {
      connection: {
        host: '192.168.1.101',
        port: 502,
        unitId: 1,
        timeout: 5000,
        retryAttempts: 3,
        retryDelay: 1000,
        keepAlive: true,
        maxConnections: 1
      },
      sunspec: DEFAULT_SUNSPEC_CONFIG as any
    };

    const connected1 = await ModbusServiceManager.connectDevice('device1', config1);
    const connected2 = await ModbusServiceManager.connectDevice('device2', config2);

    expect(connected1).toBe(true);
    expect(connected2).toBe(true);

    const states = ModbusServiceManager.getAllConnectionStates();
    expect(states).toHaveLength(2);
    expect(states.map(s => s.deviceId)).toContain('device1');
    expect(states.map(s => s.deviceId)).toContain('device2');
  });

  test('should perform health checks', async () => {
    const config: Partial<ModbusDeviceConfig> = {
      connection: {
        host: '192.168.1.100',
        port: 502,
        unitId: 1,
        timeout: 5000,
        retryAttempts: 3,
        retryDelay: 1000,
        keepAlive: true,
        maxConnections: 1
      },
      sunspec: DEFAULT_SUNSPEC_CONFIG as any
    };

    await ModbusServiceManager.connectDevice('test-device', config);

    const health = await ModbusServiceManager.healthCheck();
    expect(health).toHaveProperty('test-device');
  });

  test('should read holding registers from specific device', async () => {
    const config: Partial<ModbusDeviceConfig> = {
      connection: {
        host: '192.168.1.100',
        port: 502,
        unitId: 1,
        timeout: 5000,
        retryAttempts: 3,
        retryDelay: 1000,
        keepAlive: true,
        maxConnections: 1
      },
      sunspec: DEFAULT_SUNSPEC_CONFIG as any
    };

    await ModbusServiceManager.connectDevice('test-device', config);

    const result = await ModbusServiceManager.readHoldingRegisters('test-device', 40001, 5);
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('registers');
  });

  test('should handle disconnection', async () => {
    const config: Partial<ModbusDeviceConfig> = {
      connection: {
        host: '192.168.1.100',
        port: 502,
        unitId: 1,
        timeout: 5000,
        retryAttempts: 3,
        retryDelay: 1000,
        keepAlive: true,
        maxConnections: 1
      },
      sunspec: DEFAULT_SUNSPEC_CONFIG as any
    };

    await ModbusServiceManager.connectDevice('test-device', config);
    await ModbusServiceManager.disconnectDevice('test-device');

    const state = ModbusServiceManager.getConnectionState('test-device');
    expect(state).toBeNull();
  });
});