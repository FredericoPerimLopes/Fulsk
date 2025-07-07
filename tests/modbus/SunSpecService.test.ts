/**
 * Comprehensive tests for SunSpecService
 * Tests SunSpec protocol implementation, device discovery, and data parsing
 */

import { sunspecService, SunSpecService } from '../../src/services/SunSpecService';
import { modbusService } from '../../src/services/ModbusService';
import {
  SunSpecConfiguration,
  SunSpecModelType,
  SunSpecDeviceData,
  ModbusConnectionInfo,
  InverterOperatingState
} from '../../src/models/SunSpecModels';
import { 
  SUNSPEC_STANDARD_ADDRESSES,
  getRegisterMapping 
} from '../../src/utils/SunSpecRegisterMap';

// Mock ModbusService
jest.mock('../../src/services/ModbusService', () => ({
  modbusService: {
    connectDevice: jest.fn(),
    disconnectDevice: jest.fn(),
    readHoldingRegisters: jest.fn(),
    getAllConnectionStates: jest.fn(),
    getConnectionState: jest.fn(),
    healthCheck: jest.fn(),
  }
}));

describe('SunSpecService', () => {
  let service: SunSpecService;
  const mockModbusService = modbusService as jest.Mocked<typeof modbusService>;

  const testConfiguration: SunSpecConfiguration = {
    modbusConnection: {
      host: '192.168.1.100',
      port: 502,
      unitId: 1,
      timeout: 10000,
      retryCount: 3,
      connectionType: 'TCP'
    },
    supportedModels: [
      SunSpecModelType.COMMON,
      SunSpecModelType.INVERTER_THREE_PHASE,
      SunSpecModelType.METER_THREE_PHASE_WYE
    ],
    pollingInterval: 30,
    autoDiscovery: true
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SunSpecService();
    mockModbusService.connectDevice.mockResolvedValue(true);
  });

  afterEach(async () => {
    await service.cleanup();
  });

  describe('Device Configuration', () => {
    test('should configure device successfully', async () => {
      mockModbusService.readHoldingRegisters.mockResolvedValueOnce({
        success: true,
        registers: [0x5375, 0x6e53], // 'SunS'
        rawData: [0x53, 0x75, 0x6e, 0x53]
      });

      const configured = await service.configureDevice('test-device', testConfiguration);

      expect(configured).toBe(true);
      expect(mockModbusService.connectDevice).toHaveBeenCalledWith('test-device', expect.any(Object));
    });

    test('should fail configuration if Modbus connection fails', async () => {
      mockModbusService.connectDevice.mockResolvedValue(false);

      const configured = await service.configureDevice('test-device', testConfiguration);

      expect(configured).toBe(false);
    });

    test('should fail configuration if SunSpec discovery fails', async () => {
      mockModbusService.readHoldingRegisters.mockResolvedValueOnce({
        success: true,
        registers: [0x1234, 0x5678], // Invalid SunSpec ID
        rawData: [0x12, 0x34, 0x56, 0x78]
      });

      const configured = await service.configureDevice('test-device', testConfiguration);

      expect(configured).toBe(false);
    });

    test('should get device configuration', async () => {
      await service.configureDevice('test-device', testConfiguration);

      const config = service.getDeviceConfiguration('test-device');
      expect(config).toEqual(testConfiguration);
    });

    test('should remove device', async () => {
      await service.configureDevice('test-device', testConfiguration);
      await service.removeDevice('test-device');

      const config = service.getDeviceConfiguration('test-device');
      expect(config).toBeUndefined();
      expect(mockModbusService.disconnectDevice).toHaveBeenCalledWith('test-device');
    });
  });

  describe('SunSpec Model Discovery', () => {
    test('should discover SunSpec models successfully', async () => {
      // Mock SunSpec identifier
      mockModbusService.readHoldingRegisters
        .mockResolvedValueOnce({
          success: true,
          registers: [0x5375, 0x6e53], // 'SunS'
          rawData: [0x53, 0x75, 0x6e, 0x53]
        })
        // Mock common model header
        .mockResolvedValueOnce({
          success: true,
          registers: [101, 50], // Model 101, length 50
          rawData: []
        })
        // Mock model end marker
        .mockResolvedValueOnce({
          success: true,
          registers: [0xFFFF, 0], // End marker
          rawData: []
        });

      await service.configureDevice('test-device', testConfiguration);
      const discovery = await service.discoverSunSpecModels('test-device');

      expect(discovery).toBeTruthy();
      expect(discovery!.deviceId).toBe('test-device');
      expect(discovery!.sunspecId).toBe(SUNSPEC_STANDARD_ADDRESSES.SUNSPEC_ID);
      expect(discovery!.availableModels).toContainEqual(
        expect.objectContaining({
          modelType: SunSpecModelType.COMMON
        })
      );
    });

    test('should handle invalid SunSpec identifier', async () => {
      mockModbusService.readHoldingRegisters.mockResolvedValueOnce({
        success: true,
        registers: [0x1234, 0x5678], // Invalid identifier
        rawData: [0x12, 0x34, 0x56, 0x78]
      });

      const discovery = await service.discoverSunSpecModels('test-device');

      expect(discovery).toBeNull();
    });

    test('should handle discovery errors gracefully', async () => {
      mockModbusService.readHoldingRegisters.mockRejectedValue(new Error('Read failed'));

      const discovery = await service.discoverSunSpecModels('test-device');

      expect(discovery).toBeNull();
    });

    test('should discover multiple models', async () => {
      // Mock SunSpec identifier
      mockModbusService.readHoldingRegisters
        .mockResolvedValueOnce({
          success: true,
          registers: [0x5375, 0x6e53],
          rawData: [0x53, 0x75, 0x6e, 0x53]
        })
        // Mock inverter model
        .mockResolvedValueOnce({
          success: true,
          registers: [103, 50], // Three-phase inverter, length 50
          rawData: []
        })
        // Mock meter model
        .mockResolvedValueOnce({
          success: true,
          registers: [203, 105], // Three-phase meter, length 105
          rawData: []
        })
        // Mock end marker
        .mockResolvedValueOnce({
          success: true,
          registers: [0xFFFF, 0],
          rawData: []
        });

      await service.configureDevice('test-device', testConfiguration);
      const discovery = await service.discoverSunSpecModels('test-device');

      expect(discovery).toBeTruthy();
      expect(discovery!.availableModels).toHaveLength(3); // Common + Inverter + Meter
      
      const modelTypes = discovery!.availableModels.map(m => m.modelType);
      expect(modelTypes).toContain(SunSpecModelType.COMMON);
      expect(modelTypes).toContain(SunSpecModelType.INVERTER_THREE_PHASE);
      expect(modelTypes).toContain(SunSpecModelType.METER_THREE_PHASE_WYE);
    });
  });

  describe('Device Data Reading', () => {
    beforeEach(async () => {
      await service.configureDevice('test-device', testConfiguration);
    });

    test('should read complete device data', async () => {
      // Mock common model data
      const commonModelData = new Array(67).fill(0);
      // Set manufacturer
      commonModelData[2] = 0x5465; // 'Te'
      commonModelData[3] = 0x7374; // 'st'
      commonModelData[4] = 0x204D; // ' M'
      commonModelData[5] = 0x616e; // 'an'
      commonModelData[6] = 0x7566; // 'uf'
      commonModelData[7] = 0x6163; // 'ac'
      commonModelData[8] = 0x7475; // 'tu'
      commonModelData[9] = 0x7265; // 're'
      commonModelData[10] = 0x7200; // 'r\0'
      
      // Set model name
      commonModelData[18] = 0x5465; // 'Te'
      commonModelData[19] = 0x7374; // 'st'
      commonModelData[20] = 0x204D; // ' M'
      commonModelData[21] = 0x6f64; // 'od'
      commonModelData[22] = 0x656c; // 'el'
      
      mockModbusService.readHoldingRegisters.mockResolvedValueOnce({
        success: true,
        registers: commonModelData,
        rawData: []
      });

      const deviceData = await service.readDeviceData('test-device');

      expect(deviceData).toBeTruthy();
      expect(deviceData!.deviceId).toBe('test-device');
      expect(deviceData!.common).toBeDefined();
      expect(deviceData!.common.manufacturer).toBe('Test Manufacturer');
      expect(deviceData!.common.model).toBe('Test Model');
    });

    test('should read three-phase inverter data', async () => {
      // Set up discovery with inverter model
      const discovery = {
        deviceId: 'test-device',
        sunspecId: 'SunS',
        availableModels: [
          {
            modelType: SunSpecModelType.COMMON,
            startRegister: 40000,
            length: 69
          },
          {
            modelType: SunSpecModelType.INVERTER_THREE_PHASE,
            startRegister: 40071,
            length: 50
          }
        ],
        totalRegisters: 121
      };
      
      (service as any).discoveredModels.set('test-device', discovery);

      // Mock common model data
      const commonData = new Array(67).fill(0);
      commonData[2] = 0x5465; // Manufacturer

      // Mock inverter data
      const inverterData = new Array(48).fill(0);
      inverterData[0] = 100; // AC Current (1.0A with SF = -2)
      inverterData[1] = 150; // AC Current A
      inverterData[2] = 200; // AC Current B
      inverterData[3] = 250; // AC Current C
      inverterData[4] = -2;  // AC Current Scale Factor
      inverterData[5] = 2400; // AC Voltage AB (240.0V with SF = -1)
      inverterData[11] = -1;  // AC Voltage Scale Factor
      inverterData[12] = 2000; // AC Power (2000W with SF = 0)
      inverterData[13] = 0;   // AC Power Scale Factor
      inverterData[36] = InverterOperatingState.MPPT; // Operating state

      mockModbusService.readHoldingRegisters
        .mockResolvedValueOnce({
          success: true,
          registers: commonData,
          rawData: []
        })
        .mockResolvedValueOnce({
          success: true,
          registers: inverterData,
          rawData: []
        });

      const deviceData = await service.readDeviceData('test-device');

      expect(deviceData).toBeTruthy();
      expect(deviceData!.inverter).toBeDefined();
      expect(deviceData!.inverter!.acCurrent).toBe(1.0); // 100 * 10^(-2)
      expect(deviceData!.inverter!.acVoltageAB).toBe(240.0); // 2400 * 10^(-1)
      expect(deviceData!.inverter!.acPower).toBe(2000); // 2000 * 10^0
      expect(deviceData!.inverter!.operatingState).toBe(InverterOperatingState.MPPT);
    });

    test('should read single-phase inverter data', async () => {
      // Set up discovery with single-phase inverter model
      const discovery = {
        deviceId: 'test-device',
        sunspecId: 'SunS',
        availableModels: [
          {
            modelType: SunSpecModelType.COMMON,
            startRegister: 40000,
            length: 69
          },
          {
            modelType: SunSpecModelType.INVERTER_SINGLE_PHASE,
            startRegister: 40071,
            length: 30
          }
        ],
        totalRegisters: 101
      };
      
      (service as any).discoveredModels.set('test-device', discovery);

      // Mock common model data
      const commonData = new Array(67).fill(0);
      
      // Mock single-phase inverter data
      const inverterData = new Array(28).fill(0);
      inverterData[0] = 100;  // AC Current
      inverterData[1] = -2;   // AC Current Scale Factor
      inverterData[2] = 2400; // AC Voltage
      inverterData[3] = -1;   // AC Voltage Scale Factor
      inverterData[4] = 2000; // AC Power
      inverterData[5] = 0;    // AC Power Scale Factor
      inverterData[26] = InverterOperatingState.MPPT; // Operating state

      mockModbusService.readHoldingRegisters
        .mockResolvedValueOnce({
          success: true,
          registers: commonData,
          rawData: []
        })
        .mockResolvedValueOnce({
          success: true,
          registers: inverterData,
          rawData: []
        });

      const deviceData = await service.readDeviceData('test-device');

      expect(deviceData).toBeTruthy();
      expect(deviceData!.inverter).toBeDefined();
      expect(deviceData!.inverter!.acCurrent).toBe(1.0);
      expect(deviceData!.inverter!.acVoltageAN).toBe(240.0);
      expect(deviceData!.inverter!.acPower).toBe(2000);
      expect(deviceData!.inverter!.operatingState).toBe(InverterOperatingState.MPPT);
    });

    test('should read meter data', async () => {
      // Set up discovery with meter model
      const discovery = {
        deviceId: 'test-device',
        sunspecId: 'SunS',
        availableModels: [
          {
            modelType: SunSpecModelType.COMMON,
            startRegister: 40000,
            length: 69
          },
          {
            modelType: SunSpecModelType.METER_THREE_PHASE_WYE,
            startRegister: 40071,
            length: 105
          }
        ],
        totalRegisters: 176
      };
      
      (service as any).discoveredModels.set('test-device', discovery);

      // Mock common model data
      const commonData = new Array(67).fill(0);
      
      // Mock meter data
      const meterData = new Array(103).fill(0);
      meterData[0] = 100;   // AC Current
      meterData[4] = -2;    // AC Current Scale Factor
      meterData[5] = 2400;  // AC Voltage AN
      meterData[11] = -1;   // AC Voltage Scale Factor
      meterData[14] = 2000; // AC Power
      meterData[18] = 0;    // AC Power Scale Factor

      mockModbusService.readHoldingRegisters
        .mockResolvedValueOnce({
          success: true,
          registers: commonData,
          rawData: []
        })
        .mockResolvedValueOnce({
          success: true,
          registers: meterData,
          rawData: []
        });

      const deviceData = await service.readDeviceData('test-device');

      expect(deviceData).toBeTruthy();
      expect(deviceData!.meter).toBeDefined();
      expect(deviceData!.meter!.acCurrent).toBe(1.0);
      expect(deviceData!.meter!.acVoltageAN).toBe(240.0);
      expect(deviceData!.meter!.acPower).toBe(2000);
    });

    test('should handle read errors gracefully', async () => {
      mockModbusService.readHoldingRegisters.mockRejectedValue(new Error('Read timeout'));

      const deviceData = await service.readDeviceData('test-device');

      expect(deviceData).toBeNull();
    });

    test('should fail for unconfigured device', async () => {
      const deviceData = await service.readDeviceData('unconfigured-device');

      expect(deviceData).toBeNull();
    });
  });

  describe('Data Processing and Utilities', () => {
    test('should extract strings correctly', () => {
      const service_private = service as any;
      
      // Test string extraction
      const registers = [0x4865, 0x6c6c, 0x6f20, 0x576f, 0x726c, 0x6400]; // "Hello World\0"
      const extracted = service_private.extractString(registers, 0, 12);
      expect(extracted).toBe('Hello World');
    });

    test('should handle SunSpec scale factors', () => {
      const service_private = service as any;
      
      expect(service_private.getSunSSF(0)).toBe(0);
      expect(service_private.getSunSSF(1)).toBe(1);
      expect(service_private.getSunSSF(65535)).toBe(-1);
      expect(service_private.getSunSSF(65534)).toBe(-2);
    });

    test('should apply scale factors correctly', () => {
      const service_private = service as any;
      
      expect(service_private.applyScaleFactor(100, 0)).toBe(100);
      expect(service_private.applyScaleFactor(100, 1)).toBe(1000);
      expect(service_private.applyScaleFactor(100, -1)).toBe(10);
      expect(service_private.applyScaleFactor(100, -2)).toBe(1);
    });

    test('should parse 16-bit signed integers', () => {
      const service_private = service as any;
      
      expect(service_private.getInt16(32767)).toBe(32767);
      expect(service_private.getInt16(32768)).toBe(-32768);
      expect(service_private.getInt16(65535)).toBe(-1);
    });

    test('should parse 32-bit unsigned integers', () => {
      const service_private = service as any;
      
      const registers = [0x0001, 0x0000]; // 65536
      expect(service_private.getUint32(registers, 0)).toBe(65536);
      
      const registers2 = [0xFFFF, 0xFFFF]; // 4294967295
      expect(service_private.getUint32(registers2, 0)).toBe(4294967295);
    });

    test('should calculate efficiency correctly', () => {
      const service_private = service as any;
      
      expect(service_private.calculateEfficiency(950, 1000)).toBe(95);
      expect(service_private.calculateEfficiency(0, 1000)).toBe(0);
      expect(service_private.calculateEfficiency(1000, 0)).toBe(0);
    });

    test('should identify model types correctly', () => {
      const service_private = service as any;
      
      expect(service_private.getModelTypeFromId(1)).toBe(SunSpecModelType.COMMON);
      expect(service_private.getModelTypeFromId(101)).toBe(SunSpecModelType.INVERTER_SINGLE_PHASE);
      expect(service_private.getModelTypeFromId(103)).toBe(SunSpecModelType.INVERTER_THREE_PHASE);
      expect(service_private.getModelTypeFromId(203)).toBe(SunSpecModelType.METER_THREE_PHASE_WYE);
      expect(service_private.getModelTypeFromId(999)).toBeNull();
      
      expect(service_private.isInverterModel(SunSpecModelType.INVERTER_SINGLE_PHASE)).toBe(true);
      expect(service_private.isInverterModel(SunSpecModelType.METER_SINGLE_PHASE)).toBe(false);
      
      expect(service_private.isMeterModel(SunSpecModelType.METER_THREE_PHASE_WYE)).toBe(true);
      expect(service_private.isMeterModel(SunSpecModelType.INVERTER_THREE_PHASE)).toBe(false);
    });
  });

  describe('Polling Management', () => {
    test('should start and stop polling', async () => {
      jest.useFakeTimers();
      
      const configWithPolling = { ...testConfiguration, pollingInterval: 1 }; // 1 second
      
      // Mock successful data read
      mockModbusService.readHoldingRegisters.mockResolvedValue({
        success: true,
        registers: new Array(67).fill(0),
        rawData: []
      });

      await service.configureDevice('test-device', configWithPolling);

      // Advance time to trigger polling
      jest.advanceTimersByTime(1000);
      await new Promise(resolve => setImmediate(resolve));

      service.stopPolling('test-device');

      jest.useRealTimers();
    });

    test('should handle polling errors', async () => {
      jest.useFakeTimers();
      
      const configWithPolling = { ...testConfiguration, pollingInterval: 1 };
      
      // Mock failed data read
      mockModbusService.readHoldingRegisters.mockRejectedValue(new Error('Polling error'));

      await service.configureDevice('test-device', configWithPolling);

      // Should not throw error
      jest.advanceTimersByTime(1000);
      await new Promise(resolve => setImmediate(resolve));

      service.stopPolling('test-device');

      jest.useRealTimers();
    });
  });

  describe('Cleanup', () => {
    test('should cleanup all resources', async () => {
      await service.configureDevice('test-device-1', testConfiguration);
      await service.configureDevice('test-device-2', testConfiguration);

      await service.cleanup();

      expect(service.getDeviceConfiguration('test-device-1')).toBeUndefined();
      expect(service.getDeviceConfiguration('test-device-2')).toBeUndefined();
    });
  });
});