/**
 * End-to-end tests for complete Modbus/SunSpec workflow
 * Tests the entire flow from device discovery to data collection
 */

import { ModbusService, ModbusServiceManager } from '../../src/services/ModbusService';
import { SunSpecService } from '../../src/services/SunSpecService';
import { 
  SunSpecConfiguration, 
  SunSpecModelType,
  InverterOperatingState 
} from '../../src/models/SunSpecModels';
import { ModbusDeviceConfig } from '../../src/interfaces/ModbusConfig';

// Mock modbus-serial for E2E testing
const mockModbusClient = {
  connectTCP: jest.fn(),
  setID: jest.fn(),
  setTimeout: jest.fn(),
  readHoldingRegisters: jest.fn(),
  close: jest.fn(),
  on: jest.fn(),
  isOpen: false,
};

jest.mock('modbus-serial', () => {
  return jest.fn(() => mockModbusClient);
});

describe('Modbus/SunSpec E2E Workflow', () => {
  let sunspecService: SunSpecService;
  
  const testDeviceConfig: ModbusDeviceConfig = {
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
    },
    pollingInterval: 30,
    validateData: true,
    logLevel: 'info'
  };

  const sunspecConfig: SunSpecConfiguration = {
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
      SunSpecModelType.INVERTER_THREE_PHASE
    ],
    pollingInterval: 30,
    autoDiscovery: true
  };

  beforeEach(() => {
    jest.clearAllMocks();
    sunspecService = new SunSpecService();
    
    // Reset mock client state
    mockModbusClient.isOpen = false;
    mockModbusClient.connectTCP.mockResolvedValue(undefined);
    mockModbusClient.setID.mockImplementation(() => {});
    mockModbusClient.setTimeout.mockImplementation(() => {});
    mockModbusClient.close.mockImplementation((callback) => callback && callback());
    mockModbusClient.on.mockImplementation(() => {});
  });

  afterEach(async () => {
    await ModbusServiceManager.cleanup();
    await sunspecService.cleanup();
  });

  describe('Complete Device Setup Workflow', () => {
    test('should complete full device setup from connection to data reading', async () => {
      // Step 1: Connect to Modbus device
      mockModbusClient.isOpen = true;
      
      const connected = await ModbusServiceManager.connectDevice('solar-inverter-1', testDeviceConfig);
      expect(connected).toBe(true);

      // Step 2: Mock SunSpec discovery responses
      const sunspecIdentifier = [0x5375, 0x6e53, 1, 65]; // 'SunS'
      const commonModelData = createMockCommonModelData();
      const inverterModelData = createMockInverterModelData();

      mockModbusClient.readHoldingRegisters
        .mockResolvedValueOnce({ data: sunspecIdentifier })
        .mockResolvedValueOnce({ data: commonModelData })
        .mockResolvedValueOnce({ data: [103, 50] }) // Inverter model header
        .mockResolvedValueOnce({ data: [0xFFFF, 0] }); // End marker

      // Step 3: Configure SunSpec service
      const configured = await sunspecService.configureDevice('solar-inverter-1', sunspecConfig);
      expect(configured).toBe(true);

      // Step 4: Verify device discovery
      const discovery = await sunspecService.discoverSunSpecModels('solar-inverter-1');
      expect(discovery).toBeTruthy();
      expect(discovery!.availableModels).toHaveLength(2); // Common + Inverter
      
      const modelTypes = discovery!.availableModels.map(m => m.modelType);
      expect(modelTypes).toContain(SunSpecModelType.COMMON);
      expect(modelTypes).toContain(SunSpecModelType.INVERTER_THREE_PHASE);

      // Step 5: Mock data reading responses
      mockModbusClient.readHoldingRegisters
        .mockResolvedValueOnce({ data: commonModelData })
        .mockResolvedValueOnce({ data: inverterModelData });

      // Step 6: Read device data
      const deviceData = await sunspecService.readDeviceData('solar-inverter-1');
      expect(deviceData).toBeTruthy();
      expect(deviceData!.deviceId).toBe('solar-inverter-1');
      expect(deviceData!.common).toBeDefined();
      expect(deviceData!.inverter).toBeDefined();

      // Verify common model data
      expect(deviceData!.common.manufacturer).toBe('SolarMax');
      expect(deviceData!.common.model).toBe('SM-5000-TL');
      expect(deviceData!.common.serialNumber).toBe('SM123456789');

      // Verify inverter data
      expect(deviceData!.inverter!.acPower).toBe(5000); // 5000W
      expect(deviceData!.inverter!.acVoltageAB).toBe(400.0); // 400V
      expect(deviceData!.inverter!.operatingState).toBe(InverterOperatingState.MPPT);
      expect(deviceData!.inverter!.efficiency).toBeCloseTo(96.1, 1);

      // Step 7: Verify connection health
      const health = await ModbusServiceManager.healthCheck();
      expect(health['solar-inverter-1']).toBe(true);

      // Step 8: Clean disconnect
      await sunspecService.removeDevice('solar-inverter-1');
      await ModbusServiceManager.disconnectDevice('solar-inverter-1');
      
      const finalState = ModbusServiceManager.getConnectionState('solar-inverter-1');
      expect(finalState).toBeNull();
    });

    test('should handle device setup with multiple models', async () => {
      // Connect device
      mockModbusClient.isOpen = true;
      await ModbusServiceManager.connectDevice('hybrid-system-1', testDeviceConfig);

      // Mock discovery for device with inverter + meter
      const sunspecIdentifier = [0x5375, 0x6e53, 1, 65];
      const commonModelData = createMockCommonModelData();
      const inverterModelData = createMockInverterModelData();
      const meterModelData = createMockMeterModelData();

      mockModbusClient.readHoldingRegisters
        .mockResolvedValueOnce({ data: sunspecIdentifier })
        .mockResolvedValueOnce({ data: commonModelData })
        .mockResolvedValueOnce({ data: [103, 50] }) // Inverter model
        .mockResolvedValueOnce({ data: [203, 105] }) // Meter model
        .mockResolvedValueOnce({ data: [0xFFFF, 0] }); // End marker

      await sunspecService.configureDevice('hybrid-system-1', sunspecConfig);
      const discovery = await sunspecService.discoverSunSpecModels('hybrid-system-1');

      expect(discovery!.availableModels).toHaveLength(3); // Common + Inverter + Meter
      
      // Mock data reading for all models
      mockModbusClient.readHoldingRegisters
        .mockResolvedValueOnce({ data: commonModelData })
        .mockResolvedValueOnce({ data: inverterModelData })
        .mockResolvedValueOnce({ data: meterModelData });

      const deviceData = await sunspecService.readDeviceData('hybrid-system-1');
      
      expect(deviceData!.inverter).toBeDefined();
      expect(deviceData!.meter).toBeDefined();
      expect(deviceData!.meter!.acPower).toBe(4800); // Grid consumption
      expect(deviceData!.meter!.acEnergyWh).toBe(1500000); // 1.5 MWh
    });
  });

  describe('Error Recovery Scenarios', () => {
    test('should recover from connection timeout and retry', async () => {
      // Simulate initial connection failure
      mockModbusClient.connectTCP
        .mockRejectedValueOnce(new Error('Connection timeout'))
        .mockResolvedValueOnce(undefined);

      // First attempt should fail
      const connected1 = await ModbusServiceManager.connectDevice('unreliable-device', testDeviceConfig);
      expect(connected1).toBe(false);

      // Mock successful connection on retry
      mockModbusClient.isOpen = true;
      const connected2 = await ModbusServiceManager.connectDevice('unreliable-device', testDeviceConfig);
      expect(connected2).toBe(true);

      await ModbusServiceManager.disconnectDevice('unreliable-device');
    });

    test('should handle read errors gracefully during data collection', async () => {
      // Setup successful connection
      mockModbusClient.isOpen = true;
      await ModbusServiceManager.connectDevice('flaky-device', testDeviceConfig);
      await sunspecService.configureDevice('flaky-device', sunspecConfig);

      // Mock successful discovery
      const sunspecIdentifier = [0x5375, 0x6e53, 1, 65];
      mockModbusClient.readHoldingRegisters
        .mockResolvedValueOnce({ data: sunspecIdentifier })
        .mockResolvedValueOnce({ data: [103, 50] })
        .mockResolvedValueOnce({ data: [0xFFFF, 0] });

      await sunspecService.discoverSunSpecModels('flaky-device');

      // Simulate read failure
      mockModbusClient.readHoldingRegisters.mockRejectedValue(new Error('Read timeout'));

      const deviceData = await sunspecService.readDeviceData('flaky-device');
      expect(deviceData).toBeNull();

      await sunspecService.removeDevice('flaky-device');
    });

    test('should handle invalid SunSpec data gracefully', async () => {
      mockModbusClient.isOpen = true;
      await ModbusServiceManager.connectDevice('invalid-device', testDeviceConfig);

      // Mock invalid SunSpec identifier
      const invalidIdentifier = [0x1234, 0x5678, 1, 65];
      mockModbusClient.readHoldingRegisters.mockResolvedValueOnce({ data: invalidIdentifier });

      await sunspecService.configureDevice('invalid-device', sunspecConfig);
      const discovery = await sunspecService.discoverSunSpecModels('invalid-device');

      expect(discovery).toBeNull();
      await sunspecService.removeDevice('invalid-device');
    });
  });

  describe('Performance and Scale Testing', () => {
    test('should handle multiple simultaneous device connections', async () => {
      const deviceConfigs = [
        { ...testDeviceConfig, connection: { ...testDeviceConfig.connection, host: '192.168.1.101' } },
        { ...testDeviceConfig, connection: { ...testDeviceConfig.connection, host: '192.168.1.102' } },
        { ...testDeviceConfig, connection: { ...testDeviceConfig.connection, host: '192.168.1.103' } }
      ];

      mockModbusClient.isOpen = true;

      // Connect all devices simultaneously
      const connectionPromises = deviceConfigs.map((config, index) => 
        ModbusServiceManager.connectDevice(`device-${index + 1}`, config)
      );

      const results = await Promise.all(connectionPromises);
      expect(results.every(result => result === true)).toBe(true);

      // Verify all connections
      const states = ModbusServiceManager.getAllConnectionStates();
      expect(states).toHaveLength(3);

      // Health check
      const health = await ModbusServiceManager.healthCheck();
      expect(Object.keys(health)).toHaveLength(3);
      expect(Object.values(health).every(healthy => healthy === true)).toBe(true);

      // Cleanup
      await Promise.all([
        ModbusServiceManager.disconnectDevice('device-1'),
        ModbusServiceManager.disconnectDevice('device-2'),
        ModbusServiceManager.disconnectDevice('device-3')
      ]);
    });

    test('should handle rapid consecutive data reads', async () => {
      mockModbusClient.isOpen = true;
      await ModbusServiceManager.connectDevice('high-frequency-device', testDeviceConfig);
      await sunspecService.configureDevice('high-frequency-device', sunspecConfig);

      // Mock consistent responses
      const commonModelData = createMockCommonModelData();
      const inverterModelData = createMockInverterModelData();

      mockModbusClient.readHoldingRegisters
        .mockResolvedValue({ data: commonModelData })
        .mockResolvedValue({ data: inverterModelData });

      // Perform rapid consecutive reads
      const readPromises = Array.from({ length: 10 }, () =>
        sunspecService.readDeviceData('high-frequency-device')
      );

      const results = await Promise.all(readPromises);
      
      // All reads should succeed
      expect(results.every(result => result !== null)).toBe(true);
      expect(results.every(result => result!.success !== false)).toBe(true);

      await sunspecService.removeDevice('high-frequency-device');
    });
  });

  describe('Data Validation and Integrity', () => {
    test('should validate SunSpec data types and scale factors', async () => {
      mockModbusClient.isOpen = true;
      await ModbusServiceManager.connectDevice('precision-device', testDeviceConfig);
      await sunspecService.configureDevice('precision-device', sunspecConfig);

      // Create test data with specific scale factors
      const preciseInverterData = createMockInverterModelData();
      // Set precise values with scale factors
      preciseInverterData[0] = 1000;  // AC Current = 10.00A (SF = -2)
      preciseInverterData[4] = -2;    // AC Current Scale Factor
      preciseInverterData[5] = 2400;  // AC Voltage = 240.0V (SF = -1)
      preciseInverterData[11] = -1;   // AC Voltage Scale Factor
      preciseInverterData[12] = 5000; // AC Power = 5000W (SF = 0)
      preciseInverterData[13] = 0;    // AC Power Scale Factor

      const commonModelData = createMockCommonModelData();

      mockModbusClient.readHoldingRegisters
        .mockResolvedValueOnce({ data: commonModelData })
        .mockResolvedValueOnce({ data: preciseInverterData });

      const deviceData = await sunspecService.readDeviceData('precision-device');

      expect(deviceData!.inverter!.acCurrent).toBe(10.00);
      expect(deviceData!.inverter!.acVoltageAB).toBe(240.0);
      expect(deviceData!.inverter!.acPower).toBe(5000);

      await sunspecService.removeDevice('precision-device');
    });

    test('should handle NaN values correctly', async () => {
      mockModbusClient.isOpen = true;
      await ModbusServiceManager.connectDevice('nan-device', testDeviceConfig);
      await sunspecService.configureDevice('nan-device', sunspecConfig);

      // Create data with NaN values
      const nanInverterData = createMockInverterModelData();
      nanInverterData[31] = 0x8000; // NaN for INT16 temperature
      nanInverterData[32] = 0x8000; // NaN for INT16 temperature

      const commonModelData = createMockCommonModelData();

      mockModbusClient.readHoldingRegisters
        .mockResolvedValueOnce({ data: commonModelData })
        .mockResolvedValueOnce({ data: nanInverterData });

      const deviceData = await sunspecService.readDeviceData('nan-device');

      // NaN values should not be included or should be handled appropriately
      expect(deviceData!.inverter).toBeDefined();
      // The service should handle NaN values gracefully

      await sunspecService.removeDevice('nan-device');
    });
  });

  // Helper functions to create mock data
  function createMockCommonModelData(): number[] {
    const data = new Array(67).fill(0);
    
    // SunSpec identifier
    data[0] = 0x5375; // 'Su'
    data[1] = 0x6e53; // 'nS'
    data[2] = 1;      // Device ID
    data[3] = 65;     // Model length
    
    // Manufacturer: "SolarMax"
    data[4] = 0x536f;  // 'So'
    data[5] = 0x6c61;  // 'la'
    data[6] = 0x724d;  // 'rM'
    data[7] = 0x6178;  // 'ax'
    data[8] = 0x0000;  // Null terminator
    
    // Model: "SM-5000-TL"
    data[20] = 0x534d; // 'SM'
    data[21] = 0x2d35; // '-5'
    data[22] = 0x3030; // '00'
    data[23] = 0x302d; // '0-'
    data[24] = 0x544c; // 'TL'
    data[25] = 0x0000; // Null terminator
    
    // Serial Number: "SM123456789"
    data[52] = 0x534d; // 'SM'
    data[53] = 0x3132; // '12'
    data[54] = 0x3334; // '34'
    data[55] = 0x3536; // '56'
    data[56] = 0x3738; // '78'
    data[57] = 0x3900; // '9\0'
    
    // Device Address
    data[66] = 1;
    
    return data;
  }

  function createMockInverterModelData(): number[] {
    const data = new Array(48).fill(0);
    
    // Three-phase inverter data (Model 103)
    data[0] = 125;  // AC Current (12.5A with SF = -1)
    data[1] = 120;  // AC Current A
    data[2] = 125;  // AC Current B  
    data[3] = 130;  // AC Current C
    data[4] = -1;   // AC Current Scale Factor
    
    data[5] = 4000;  // AC Voltage AB (400.0V with SF = -1)
    data[6] = 4010;  // AC Voltage BC
    data[7] = 3990;  // AC Voltage CA
    data[8] = 2300;  // AC Voltage AN (230.0V)
    data[9] = 2310;  // AC Voltage BN
    data[10] = 2290; // AC Voltage CN
    data[11] = -1;   // AC Voltage Scale Factor
    
    data[12] = 5000; // AC Power (5000W with SF = 0)
    data[13] = 0;    // AC Power Scale Factor
    
    data[14] = 500;  // AC Frequency (50.0Hz with SF = -1)
    data[15] = -1;   // AC Frequency Scale Factor
    
    data[25] = 110;  // DC Current (11.0A with SF = -1)
    data[26] = -1;   // DC Current Scale Factor
    
    data[27] = 4500; // DC Voltage (450.0V with SF = -1)
    data[28] = -1;   // DC Voltage Scale Factor
    
    data[29] = 5200; // DC Power (5200W with SF = 0)
    data[30] = 0;    // DC Power Scale Factor
    
    data[31] = 350;  // Cabinet Temperature (35.0°C with SF = -1)
    data[32] = 450;  // Heatsink Temperature (45.0°C)
    data[35] = -1;   // Temperature Scale Factor
    
    data[36] = InverterOperatingState.MPPT; // Operating State
    data[37] = 0;    // Vendor Operating State
    
    return data;
  }

  function createMockMeterModelData(): number[] {
    const data = new Array(103).fill(0);
    
    // Three-phase meter data (Model 203)
    data[0] = 100;   // AC Current (10.0A with SF = -1)
    data[1] = 95;    // AC Current A
    data[2] = 100;   // AC Current B
    data[3] = 105;   // AC Current C
    data[4] = -1;    // AC Current Scale Factor
    
    data[5] = 2300;  // AC Voltage AN (230.0V with SF = -1)
    data[6] = 2310;  // AC Voltage BN
    data[7] = 2290;  // AC Voltage CN
    data[11] = -1;   // AC Voltage Scale Factor
    
    data[14] = 4800; // AC Power (4800W with SF = 0)
    data[18] = 0;    // AC Power Scale Factor
    
    data[25] = 15000; // AC Energy Wh (1500000Wh = 1.5MWh with SF = 2)
    data[26] = 0;     // High word
    data[27] = 2;     // AC Energy Scale Factor
    
    return data;
  }
});