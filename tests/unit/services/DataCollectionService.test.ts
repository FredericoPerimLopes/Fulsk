import { Server } from 'socket.io';
import mqtt from 'mqtt';
import { DataCollectionService } from '@services/DataCollectionService.refactored';
import { DatabaseDeviceService } from '@services/DatabaseDeviceService';
import { modbusService } from '@services/ModbusService';
import { DeviceStatus, DeviceType } from '@models/Device';
import { CommunicationProtocol } from '@prisma/client';
import { logError, logInfo, logWarn } from '@utils/logger';

// Mock all dependencies
jest.mock('socket.io');
jest.mock('mqtt');
jest.mock('@services/DatabaseDeviceService');
jest.mock('@services/ModbusService');
jest.mock('@utils/logger');
jest.mock('node-cron', () => ({
  schedule: jest.fn(() => ({ stop: jest.fn() }))
}));

describe('DataCollectionService', () => {
  let mockIoServer: jest.Mocked<Server>;
  let mockMqttClient: any;
  let dataCollectionService: DataCollectionService;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Setup mock Socket.IO server
    mockIoServer = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn()
    } as any;

    // Setup mock MQTT client
    mockMqttClient = {
      on: jest.fn(),
      subscribe: jest.fn((topic, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }
        callback?.(null);
      }),
      end: jest.fn((force, options, callback) => {
        callback?.();
      }),
      connected: true
    };

    (mqtt.connect as jest.Mock).mockReturnValue(mockMqttClient);

    // Setup environment
    process.env.MQTT_BROKER_URL = 'mqtt://localhost:1883';
    process.env.NODE_ENV = 'test';
  });

  afterEach(async () => {
    if (dataCollectionService) {
      await dataCollectionService.cleanup();
    }
  });

  describe('initialization', () => {
    it('should initialize successfully with MQTT', async () => {
      // Mock device service responses
      (DatabaseDeviceService.getDevicesByProtocol as jest.Mock).mockResolvedValue([]);

      // Create service
      dataCollectionService = new DataCollectionService(mockIoServer);

      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mqtt.connect).toHaveBeenCalledWith(
        'mqtt://localhost:1883',
        expect.objectContaining({
          keepalive: 60,
          reconnectPeriod: 5000,
          clean: true,
          clientId: expect.stringContaining('fulsk-backend-test-')
        })
      );

      expect(mockMqttClient.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockMqttClient.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockMqttClient.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(logInfo).toHaveBeenCalledWith('DataCollectionService initialized successfully');
    });

    it('should initialize without MQTT when URL not configured', async () => {
      delete process.env.MQTT_BROKER_URL;
      
      (DatabaseDeviceService.getDevicesByProtocol as jest.Mock).mockResolvedValue([]);

      dataCollectionService = new DataCollectionService(mockIoServer);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mqtt.connect).not.toHaveBeenCalled();
      expect(logInfo).toHaveBeenCalledWith('MQTT broker URL not configured, running without MQTT');
    });

    it('should handle MQTT connection errors', async () => {
      const mockError = new Error('Connection failed');
      
      (mqtt.connect as jest.Mock).mockImplementation(() => {
        const client = {
          on: jest.fn((event, handler) => {
            if (event === 'error') {
              setTimeout(() => handler(mockError), 10);
            }
          }),
          connected: false
        };
        return client;
      });

      (DatabaseDeviceService.getDevicesByProtocol as jest.Mock).mockResolvedValue([]);

      await expect(async () => {
        dataCollectionService = new DataCollectionService(mockIoServer);
        await new Promise(resolve => setTimeout(resolve, 100));
      }).rejects.toThrow();

      expect(logError).toHaveBeenCalledWith(
        mockError,
        expect.objectContaining({ context: 'MQTT connection error' })
      );
    });
  });

  describe('MQTT message handling', () => {
    beforeEach(async () => {
      (DatabaseDeviceService.getDevicesByProtocol as jest.Mock).mockResolvedValue([]);
      dataCollectionService = new DataCollectionService(mockIoServer);
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should handle valid MQTT messages', async () => {
      const deviceId = 'device-123';
      const topic = `fulsk/devices/${deviceId}/data`;
      const deviceData = {
        power: 4500,
        voltage: 240,
        current: 18.75,
        temperature: 45
      };
      const message = Buffer.from(JSON.stringify(deviceData));

      // Get message handler
      const messageHandler = mockMqttClient.on.mock.calls.find(
        call => call[0] === 'message'
      )?.[1];

      (DatabaseDeviceService.storeDeviceData as jest.Mock).mockResolvedValue(true);
      (DatabaseDeviceService.updateDeviceStatus as jest.Mock).mockResolvedValue(true);

      await messageHandler(topic, message);

      expect(DatabaseDeviceService.storeDeviceData).toHaveBeenCalledWith(deviceId, deviceData);
      expect(DatabaseDeviceService.updateDeviceStatus).toHaveBeenCalledWith(
        deviceId,
        DeviceStatus.ONLINE
      );
      expect(mockIoServer.to).toHaveBeenCalledWith(`device-${deviceId}`);
      expect(mockIoServer.emit).toHaveBeenCalledWith('device-data', {
        deviceId,
        data: deviceData,
        timestamp: expect.any(Date)
      });
    });

    it('should reject invalid topic format', async () => {
      const topic = 'invalid/topic';
      const message = Buffer.from('{}');

      const messageHandler = mockMqttClient.on.mock.calls.find(
        call => call[0] === 'message'
      )?.[1];

      await messageHandler(topic, message);

      expect(logWarn).toHaveBeenCalledWith('Invalid MQTT topic format', { topic });
      expect(DatabaseDeviceService.storeDeviceData).not.toHaveBeenCalled();
    });

    it('should reject invalid device data', async () => {
      const deviceId = 'device-123';
      const topic = `fulsk/devices/${deviceId}/data`;
      const message = Buffer.from('{"invalid": "data"}');

      const messageHandler = mockMqttClient.on.mock.calls.find(
        call => call[0] === 'message'
      )?.[1];

      await messageHandler(topic, message);

      expect(logWarn).toHaveBeenCalledWith('Invalid device data received', { deviceId, topic });
      expect(DatabaseDeviceService.storeDeviceData).not.toHaveBeenCalled();
    });

    it('should handle JSON parsing errors', async () => {
      const topic = 'fulsk/devices/device-123/data';
      const message = Buffer.from('invalid json');

      const messageHandler = mockMqttClient.on.mock.calls.find(
        call => call[0] === 'message'
      )?.[1];

      await messageHandler(topic, message);

      expect(logError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ context: 'Failed to handle MQTT message' })
      );
    });
  });

  describe('Modbus device management', () => {
    const mockDevice = {
      id: 'device-123',
      name: 'Test Inverter',
      type: DeviceType.INVERTER,
      protocol: CommunicationProtocol.MODBUS,
      modbusConfig: {
        connection: {
          host: '192.168.1.100',
          port: 502,
          unitId: 1
        }
      }
    };

    beforeEach(async () => {
      (DatabaseDeviceService.getDevicesByProtocol as jest.Mock).mockResolvedValue([mockDevice]);
      (DatabaseDeviceService.extractModbusConfig as jest.Mock).mockResolvedValue(
        mockDevice.modbusConfig
      );
      (modbusService.readDeviceData as jest.Mock).mockResolvedValue({
        power: 4500,
        voltage: 240
      });

      dataCollectionService = new DataCollectionService(mockIoServer);
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should initialize Modbus devices on startup', () => {
      expect(DatabaseDeviceService.getDevicesByProtocol).toHaveBeenCalledWith(
        CommunicationProtocol.MODBUS
      );
      expect(DatabaseDeviceService.extractModbusConfig).toHaveBeenCalledWith(mockDevice.id);
    });

    it('should poll Modbus devices periodically', async () => {
      // Wait for polling interval
      await new Promise(resolve => setTimeout(resolve, 6000));

      expect(modbusService.readDeviceData).toHaveBeenCalledWith(mockDevice.id);
      expect(DatabaseDeviceService.storeDeviceData).toHaveBeenCalled();
      expect(mockIoServer.emit).toHaveBeenCalledWith('device-data', expect.any(Object));
    });

    it('should handle Modbus polling errors with backoff', async () => {
      const error = new Error('Modbus read failed');
      (modbusService.readDeviceData as jest.Mock).mockRejectedValue(error);

      // Wait for polling attempt
      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(logError).toHaveBeenCalledWith(
        error,
        expect.objectContaining({ context: 'Modbus polling error' })
      );
    });
  });

  describe('real-time metrics', () => {
    beforeEach(async () => {
      (DatabaseDeviceService.getDevicesByProtocol as jest.Mock).mockResolvedValue([]);
      dataCollectionService = new DataCollectionService(mockIoServer);
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should return real-time metrics for all devices', async () => {
      const mockDevices = [
        {
          id: 'device-1',
          name: 'Inverter 1',
          type: DeviceType.INVERTER,
          status: DeviceStatus.ONLINE
        },
        {
          id: 'device-2',
          name: 'Inverter 2',
          type: DeviceType.INVERTER,
          status: DeviceStatus.OFFLINE
        }
      ];

      const mockData = { power: 4500, voltage: 240 };

      (DatabaseDeviceService.getAllDevices as jest.Mock).mockResolvedValue(mockDevices);
      (DatabaseDeviceService.getLatestDeviceData as jest.Mock).mockResolvedValue(mockData);

      const metrics = await dataCollectionService.getRealTimeMetrics();

      expect(metrics).toMatchObject({
        timestamp: expect.any(Date),
        deviceCount: 2,
        devices: expect.arrayContaining([
          expect.objectContaining({
            deviceId: 'device-1',
            name: 'Inverter 1',
            data: mockData
          }),
          expect.objectContaining({
            deviceId: 'device-2',
            name: 'Inverter 2',
            data: mockData
          })
        ])
      });
    });

    it('should use cached data when available', async () => {
      const mockDevice = {
        id: 'device-1',
        name: 'Inverter 1',
        type: DeviceType.INVERTER,
        status: DeviceStatus.ONLINE
      };

      (DatabaseDeviceService.getAllDevices as jest.Mock).mockResolvedValue([mockDevice]);

      // Simulate cached data
      const cachedData = { power: 5000, voltage: 245 };
      const cacheStore = (dataCollectionService as any).dataCache;
      cacheStore.set('device-1', { data: cachedData, timestamp: Date.now() });

      const metrics = await dataCollectionService.getRealTimeMetrics();

      expect(DatabaseDeviceService.getLatestDeviceData).not.toHaveBeenCalled();
      expect(metrics.devices[0].data).toEqual(cachedData);
    });
  });

  describe('cleanup', () => {
    beforeEach(async () => {
      (DatabaseDeviceService.getDevicesByProtocol as jest.Mock).mockResolvedValue([]);
      dataCollectionService = new DataCollectionService(mockIoServer);
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should cleanup all resources properly', async () => {
      await dataCollectionService.cleanup();

      expect(mockMqttClient.end).toHaveBeenCalledWith(false, {}, expect.any(Function));
      expect(logInfo).toHaveBeenCalledWith('DataCollectionService cleanup completed');
    });
  });
});