/**
 * Integration tests for SunSpec API endpoints
 * Tests end-to-end functionality of the SunSpec/Modbus API
 */

import request from 'supertest';
import express from 'express';
import sunspecRouter from '../../src/api/sunspec';
import { sunspecService } from '../../src/services/SunSpecService';
import { modbusService } from '../../src/services/ModbusService';
import { SunSpecModelType } from '../../src/models/SunSpecModels';

// Mock services
jest.mock('../../src/services/SunSpecService');
jest.mock('../../src/services/ModbusService');
jest.mock('../../src/middleware/auth', () => ({
  authenticate: (req: any, res: any, next: any) => {
    req.user = { userId: 'test-user', role: 'ADMIN' };
    next();
  },
  authorize: (...roles: string[]) => (req: any, res: any, next: any) => next()
}));

describe('SunSpec API Integration Tests', () => {
  let app: express.Application;
  const mockSunspecService = sunspecService as jest.Mocked<typeof sunspecService>;
  const mockModbusService = modbusService as jest.Mocked<typeof modbusService>;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/sunspec', sunspecRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/sunspec/discover', () => {
    const validDiscoveryRequest = {
      host: '192.168.1.100',
      port: 502,
      unitId: 1,
      timeout: 10000
    };

    test('should discover SunSpec device successfully', async () => {
      const mockDiscovery = {
        deviceId: 'discovery-192.168.1.100-502-1',
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

      mockModbusService.connectDevice.mockResolvedValue(true);
      mockSunspecService.configureDevice.mockResolvedValue(true);
      mockSunspecService.discoverSunSpecModels.mockResolvedValue(mockDiscovery);
      mockSunspecService.removeDevice.mockResolvedValue(undefined);
      mockModbusService.disconnectDevice.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/sunspec/discover')
        .send(validDiscoveryRequest)
        .expect(200);

      expect(response.body.message).toBe('SunSpec device discovery completed');
      expect(response.body.data).toEqual(mockDiscovery);
      expect(mockModbusService.connectDevice).toHaveBeenCalled();
      expect(mockSunspecService.discoverSunSpecModels).toHaveBeenCalled();
      expect(mockSunspecService.removeDevice).toHaveBeenCalled();
    });

    test('should fail discovery with invalid IP address', async () => {
      const invalidRequest = { ...validDiscoveryRequest, host: 'invalid-ip' };

      const response = await request(app)
        .post('/api/sunspec/discover')
        .send(invalidRequest)
        .expect(400);

      expect(response.body.error).toBe('Validation Error');
    });

    test('should fail discovery if Modbus connection fails', async () => {
      mockModbusService.connectDevice.mockResolvedValue(false);

      const response = await request(app)
        .post('/api/sunspec/discover')
        .send(validDiscoveryRequest)
        .expect(400);

      expect(response.body.error).toBe('Connection Failed');
      expect(response.body.message).toContain('Unable to connect to device');
    });

    test('should fail discovery if no SunSpec models found', async () => {
      mockModbusService.connectDevice.mockResolvedValue(true);
      mockSunspecService.configureDevice.mockResolvedValue(true);
      mockSunspecService.discoverSunSpecModels.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/sunspec/discover')
        .send(validDiscoveryRequest)
        .expect(400);

      expect(response.body.error).toBe('Discovery Failed');
      expect(response.body.message).toBe('No SunSpec models found on the device');
    });

    test('should handle discovery errors', async () => {
      mockModbusService.connectDevice.mockRejectedValue(new Error('Network error'));

      const response = await request(app)
        .post('/api/sunspec/discover')
        .send(validDiscoveryRequest)
        .expect(500);

      expect(response.body.error).toBe('Discovery Error');
      expect(response.body.message).toBe('Network error');
    });
  });

  describe('POST /api/sunspec/devices/:deviceId/configure', () => {
    const validConfiguration = {
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

    test('should configure device successfully', async () => {
      const mockDeviceInfo = {
        deviceId: 'test-device',
        configuration: validConfiguration,
        connectionState: { connected: true },
        discoveredModels: {
          deviceId: 'test-device',
          sunspecId: 'SunS',
          availableModels: [],
          totalRegisters: 0
        }
      };

      mockSunspecService.configureDevice.mockResolvedValue(true);
      mockSunspecService.getDeviceConfiguration.mockReturnValue(validConfiguration as any);
      mockModbusService.getConnectionState.mockReturnValue({ connected: true } as any);
      mockSunspecService.getDiscoveredModels.mockReturnValue(mockDeviceInfo.discoveredModels as any);

      const response = await request(app)
        .post('/api/sunspec/devices/test-device/configure')
        .send(validConfiguration)
        .expect(200);

      expect(response.body.message).toBe('SunSpec device configured successfully');
      expect(response.body.data.deviceId).toBe('test-device');
      expect(mockSunspecService.configureDevice).toHaveBeenCalledWith('test-device', validConfiguration);
    });

    test('should fail configuration with invalid data', async () => {
      const invalidConfiguration = {
        ...validConfiguration,
        modbusConnection: {
          ...validConfiguration.modbusConnection,
          host: '' // Invalid host
        }
      };

      const response = await request(app)
        .post('/api/sunspec/devices/test-device/configure')
        .send(invalidConfiguration)
        .expect(400);

      expect(response.body.error).toBe('Validation Error');
    });

    test('should fail if device configuration fails', async () => {
      mockSunspecService.configureDevice.mockResolvedValue(false);

      const response = await request(app)
        .post('/api/sunspec/devices/test-device/configure')
        .send(validConfiguration)
        .expect(400);

      expect(response.body.error).toBe('Configuration Failed');
    });
  });

  describe('GET /api/sunspec/devices/:deviceId', () => {
    test('should get device information successfully', async () => {
      const mockDeviceInfo = {
        deviceId: 'test-device',
        configuration: {
          modbusConnection: {
            host: '192.168.1.100',
            port: 502,
            unitId: 1
          },
          pollingInterval: 30
        },
        connectionState: { connected: true },
        discoveredModels: {
          deviceId: 'test-device',
          availableModels: []
        }
      };

      mockSunspecService.getDeviceConfiguration.mockReturnValue(mockDeviceInfo.configuration as any);
      mockModbusService.getConnectionState.mockReturnValue(mockDeviceInfo.connectionState as any);
      mockSunspecService.getDiscoveredModels.mockReturnValue(mockDeviceInfo.discoveredModels as any);

      const response = await request(app)
        .get('/api/sunspec/devices/test-device')
        .expect(200);

      expect(response.body.message).toBe('SunSpec device information retrieved');
      expect(response.body.data.deviceId).toBe('test-device');
    });

    test('should return 404 for unconfigured device', async () => {
      mockSunspecService.getDeviceConfiguration.mockReturnValue(undefined);

      const response = await request(app)
        .get('/api/sunspec/devices/unknown-device')
        .expect(404);

      expect(response.body.error).toBe('Device Not Found');
    });
  });

  describe('GET /api/sunspec/devices/:deviceId/data', () => {
    test('should read device data successfully', async () => {
      const mockDeviceData = {
        deviceId: 'test-device',
        timestamp: new Date(),
        common: {
          deviceId: 'test-device',
          manufacturer: 'Test Manufacturer',
          model: 'Test Model',
          serialNumber: 'TEST123',
          firmwareVersion: '1.0.0',
          deviceAddress: 1
        },
        inverter: {
          acCurrent: 10.5,
          acVoltageAN: 240.0,
          acPower: 2520,
          dcCurrent: 11.0,
          dcVoltage: 350.0,
          dcPower: 3850,
          operatingState: 4,
          efficiency: 97.3
        },
        connectionInfo: {
          host: '192.168.1.100',
          port: 502,
          unitId: 1
        }
      };

      mockSunspecService.getDeviceConfiguration.mockReturnValue({} as any);
      mockSunspecService.readDeviceData.mockResolvedValue(mockDeviceData as any);

      const response = await request(app)
        .get('/api/sunspec/devices/test-device/data')
        .expect(200);

      expect(response.body.message).toBe('SunSpec device data retrieved');
      expect(response.body.data.deviceId).toBe('test-device');
      expect(response.body.data.inverter.acPower).toBe(2520);
      expect(response.body.data.inverter.efficiency).toBe(97.3);
    });

    test('should return 404 for unconfigured device', async () => {
      mockSunspecService.getDeviceConfiguration.mockReturnValue(undefined);

      const response = await request(app)
        .get('/api/sunspec/devices/unknown-device/data')
        .expect(404);

      expect(response.body.error).toBe('Device Not Found');
    });

    test('should handle read failures', async () => {
      mockSunspecService.getDeviceConfiguration.mockReturnValue({} as any);
      mockSunspecService.readDeviceData.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/sunspec/devices/test-device/data')
        .expect(400);

      expect(response.body.error).toBe('Read Failed');
    });
  });

  describe('POST /api/sunspec/devices/:deviceId/start-polling', () => {
    test('should start polling successfully', async () => {
      mockSunspecService.getDeviceConfiguration.mockReturnValue({
        pollingInterval: 30
      } as any);

      const response = await request(app)
        .post('/api/sunspec/devices/test-device/start-polling')
        .send({ pollingInterval: 60 })
        .expect(200);

      expect(response.body.message).toBe('SunSpec device polling started');
      expect(response.body.data.pollingInterval).toBe(60);
    });

    test('should reject invalid polling interval', async () => {
      const response = await request(app)
        .post('/api/sunspec/devices/test-device/start-polling')
        .send({ pollingInterval: 3 }) // Too low
        .expect(400);

      expect(response.body.error).toBe('Validation Error');
      expect(response.body.message).toContain('Polling interval must be between 5 and 3600 seconds');
    });

    test('should return 404 for unconfigured device', async () => {
      mockSunspecService.getDeviceConfiguration.mockReturnValue(undefined);

      const response = await request(app)
        .post('/api/sunspec/devices/unknown-device/start-polling')
        .send({ pollingInterval: 30 })
        .expect(404);

      expect(response.body.error).toBe('Device Not Found');
    });
  });

  describe('POST /api/sunspec/devices/:deviceId/stop-polling', () => {
    test('should stop polling successfully', async () => {
      mockSunspecService.getDeviceConfiguration.mockReturnValue({} as any);
      mockSunspecService.stopPolling.mockReturnValue(undefined);

      const response = await request(app)
        .post('/api/sunspec/devices/test-device/stop-polling')
        .expect(200);

      expect(response.body.message).toBe('SunSpec device polling stopped');
      expect(mockSunspecService.stopPolling).toHaveBeenCalledWith('test-device');
    });

    test('should return 404 for unconfigured device', async () => {
      mockSunspecService.getDeviceConfiguration.mockReturnValue(undefined);

      const response = await request(app)
        .post('/api/sunspec/devices/unknown-device/stop-polling')
        .expect(404);

      expect(response.body.error).toBe('Device Not Found');
    });
  });

  describe('DELETE /api/sunspec/devices/:deviceId', () => {
    test('should remove device successfully', async () => {
      mockSunspecService.getDeviceConfiguration.mockReturnValue({} as any);
      mockSunspecService.removeDevice.mockResolvedValue(undefined);

      const response = await request(app)
        .delete('/api/sunspec/devices/test-device')
        .expect(200);

      expect(response.body.message).toBe('SunSpec device removed successfully');
      expect(mockSunspecService.removeDevice).toHaveBeenCalledWith('test-device');
    });

    test('should return 404 for unconfigured device', async () => {
      mockSunspecService.getDeviceConfiguration.mockReturnValue(undefined);

      const response = await request(app)
        .delete('/api/sunspec/devices/unknown-device')
        .expect(404);

      expect(response.body.error).toBe('Device Not Found');
    });
  });

  describe('GET /api/sunspec/devices', () => {
    test('should get all devices successfully', async () => {
      const mockConnectionStates = [
        {
          deviceId: 'device-1',
          connected: true,
          lastConnected: new Date(),
          errorCount: 0
        },
        {
          deviceId: 'device-2',
          connected: false,
          lastError: 'Connection timeout',
          errorCount: 3
        }
      ];

      mockModbusService.getAllConnectionStates.mockReturnValue(mockConnectionStates as any);
      mockSunspecService.getDeviceConfiguration
        .mockReturnValueOnce({ pollingInterval: 30 } as any)
        .mockReturnValueOnce({ pollingInterval: 60 } as any);
      mockSunspecService.getDiscoveredModels
        .mockReturnValueOnce({ availableModels: [] } as any)
        .mockReturnValueOnce({ availableModels: [] } as any);

      const response = await request(app)
        .get('/api/sunspec/devices')
        .expect(200);

      expect(response.body.message).toBe('SunSpec devices retrieved successfully');
      expect(response.body.data).toHaveLength(2);
      expect(response.body.count).toBe(2);
    });

    test('should filter out unconfigured devices', async () => {
      const mockConnectionStates = [
        { deviceId: 'device-1', connected: true },
        { deviceId: 'device-2', connected: false }
      ];

      mockModbusService.getAllConnectionStates.mockReturnValue(mockConnectionStates as any);
      mockSunspecService.getDeviceConfiguration
        .mockReturnValueOnce({ pollingInterval: 30 } as any)
        .mockReturnValueOnce(undefined); // Unconfigured device

      const response = await request(app)
        .get('/api/sunspec/devices')
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].deviceId).toBe('device-1');
    });
  });

  describe('GET /api/sunspec/health', () => {
    test('should get health status successfully', async () => {
      const mockHealthStatus = {
        'device-1': true,
        'device-2': false
      };

      const mockConnectionStates = [
        {
          deviceId: 'device-1',
          connected: true,
          lastConnected: new Date(),
          errorCount: 0
        },
        {
          deviceId: 'device-2',
          connected: false,
          lastError: 'Connection timeout',
          errorCount: 3
        }
      ];

      mockModbusService.healthCheck.mockResolvedValue(mockHealthStatus);
      mockModbusService.getAllConnectionStates.mockReturnValue(mockConnectionStates as any);

      const response = await request(app)
        .get('/api/sunspec/health')
        .expect(200);

      expect(response.body.message).toBe('Modbus health status retrieved');
      expect(response.body.data.overview.totalConnections).toBe(2);
      expect(response.body.data.overview.healthyConnections).toBe(1);
      expect(response.body.data.overview.unhealthyConnections).toBe(1);
      expect(response.body.data.devices).toHaveLength(2);
    });
  });

  describe('GET /api/sunspec/models', () => {
    test('should get supported SunSpec models', async () => {
      const response = await request(app)
        .get('/api/sunspec/models')
        .expect(200);

      expect(response.body.message).toBe('Supported SunSpec models retrieved');
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);
      
      const commonModel = response.body.data.find((model: any) => model.id === SunSpecModelType.COMMON);
      expect(commonModel).toBeDefined();
      expect(commonModel.name).toBe('COMMON');
      expect(commonModel.description).toBe('Common model - Basic device identification');
    });
  });

  describe('Error Handling', () => {
    test('should handle internal server errors', async () => {
      mockSunspecService.getDeviceConfiguration.mockImplementation(() => {
        throw new Error('Internal error');
      });

      const response = await request(app)
        .get('/api/sunspec/devices/test-device')
        .expect(500);

      expect(response.body.error).toBe('Server Error');
      expect(response.body.message).toBe('Internal error');
    });

    test('should handle SunSpec-specific errors', async () => {
      const sunspecError = new Error('SunSpec protocol error');
      sunspecError.name = 'SunSpecError';
      
      mockSunspecService.readDeviceData.mockRejectedValue(sunspecError);
      mockSunspecService.getDeviceConfiguration.mockReturnValue({} as any);

      const response = await request(app)
        .get('/api/sunspec/devices/test-device/data')
        .expect(400);

      expect(response.body.error).toBe('Read Error');
    });
  });
});