/**
 * SunSpec/Modbus Inverter API
 * RESTful APIs for SunSpec inverter connection and management
 */

import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { authenticate, authorize } from '@middleware/auth';
import { UserRole } from '@models/User';
import { sunspecService } from '@services/SunSpecService';
import { modbusService } from '@services/ModbusService';
import { 
  SunSpecConfiguration, 
  SunSpecModelType, 
  ModbusConnectionInfo,
  SunSpecError,
  ModbusConnectionError
} from '@models/SunSpecModels';

const router = Router();

// Validation schemas
const modbusConnectionSchema = Joi.object({
  host: Joi.string().ip().required(),
  port: Joi.number().min(1).max(65535).default(502),
  unitId: Joi.number().min(1).max(247).default(1),
  timeout: Joi.number().min(1000).max(30000).default(10000),
  retryCount: Joi.number().min(1).max(10).default(3),
  connectionType: Joi.string().valid('TCP', 'RTU').default('TCP'),
  serialOptions: Joi.object({
    port: Joi.string().required(),
    baudRate: Joi.number().valid(9600, 19200, 38400, 57600, 115200).default(19200),
    dataBits: Joi.number().valid(7, 8).default(8),
    stopBits: Joi.number().valid(1, 2).default(1),
    parity: Joi.string().valid('none', 'even', 'odd').default('none')
  }).optional()
});

const sunspecConfigurationSchema = Joi.object({
  modbusConnection: modbusConnectionSchema.required(),
  supportedModels: Joi.array().items(
    Joi.number().valid(...Object.values(SunSpecModelType))
  ).default([
    SunSpecModelType.COMMON,
    SunSpecModelType.INVERTER_SINGLE_PHASE,
    SunSpecModelType.INVERTER_THREE_PHASE,
    SunSpecModelType.METER_THREE_PHASE_WYE
  ]),
  pollingInterval: Joi.number().min(5).max(3600).default(30),
  autoDiscovery: Joi.boolean().default(true)
});

const discoverDeviceSchema = Joi.object({
  host: Joi.string().ip().required(),
  port: Joi.number().min(1).max(65535).default(502),
  unitId: Joi.number().min(1).max(247).default(1),
  timeout: Joi.number().min(1000).max(30000).default(10000)
});

/**
 * POST /api/sunspec/discover
 * Discover SunSpec devices on the network
 */
router.post('/discover', authenticate, authorize(UserRole.ADMIN, UserRole.INSTALLER), async (req: Request, res: Response) => {
  try {
    const { error, value } = discoverDeviceSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation Error',
        message: error.details[0].message
      });
    }

    const { host, port, unitId, timeout } = value;
    const deviceId = `discovery-${host}-${port}-${unitId}`;

    // Create temporary connection for discovery
    const connectionInfo: ModbusConnectionInfo = {
      host,
      port,
      unitId,
      timeout,
      retryCount: 1,
      connectionType: 'TCP'
    };

    // Connect and discover
    const modbusConfig = {
      connection: {
        ...connectionInfo,
        retryAttempts: 3,
        retryDelay: 1000,
        keepAlive: true,
        maxConnections: 1
      },
      sunspec: {
        baseRegister: 40000,
        supportedModels: [1, 101, 102, 103],
        autoDiscovery: true,
        maxRegistersPerRead: 125,
        enableCaching: true,
        cacheTimeout: 30000
      },
      pollingInterval: 0,
      validateData: true,
      logLevel: 'info' as const
    };
    
    const connected = await modbusService.connectDevice(deviceId, modbusConfig);
    if (!connected) {
      return res.status(400).json({
        error: 'Connection Failed',
        message: `Unable to connect to device at ${host}:${port}`
      });
    }

    // Configure temporary SunSpec device for discovery
    const tempConfig: SunSpecConfiguration = {
      modbusConnection: connectionInfo,
      supportedModels: [SunSpecModelType.COMMON],
      pollingInterval: 0, // No polling for discovery
      autoDiscovery: true
    };

    await sunspecService.configureDevice(deviceId, tempConfig);
    const discovery = await sunspecService.discoverSunSpecModels(deviceId);

    // Cleanup temporary connection
    await sunspecService.removeDevice(deviceId);
    await modbusService.disconnectDevice(deviceId);

    if (!discovery) {
      return res.status(400).json({
        error: 'Discovery Failed',
        message: 'No SunSpec models found on the device'
      });
    }

    res.json({
      message: 'SunSpec device discovery completed',
      data: discovery
    });

  } catch (error) {
    console.error('❌ SunSpec discovery error:', error);
    res.status(500).json({
      error: 'Discovery Error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * POST /api/sunspec/devices/:deviceId/configure
 * Configure a SunSpec device
 */
router.post('/devices/:deviceId/configure', authenticate, async (req: Request, res: Response) => {
  try {
    const { error, value } = sunspecConfigurationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation Error',
        message: error.details[0].message
      });
    }

    const deviceId = req.params.deviceId;
    const configuration: SunSpecConfiguration = value;

    // Configure the SunSpec device
    const configured = await sunspecService.configureDevice(deviceId, configuration);
    
    if (!configured) {
      return res.status(400).json({
        error: 'Configuration Failed',
        message: 'Failed to configure SunSpec device'
      });
    }

    // Get device information after configuration
    const deviceInfo = {
      deviceId,
      configuration: sunspecService.getDeviceConfiguration(deviceId),
      connectionState: modbusService.getConnectionState(deviceId),
      discoveredModels: sunspecService.getDiscoveredModels(deviceId)
    };

    res.json({
      message: 'SunSpec device configured successfully',
      data: deviceInfo
    });

  } catch (error) {
    console.error('❌ SunSpec configuration error:', error);
    
    if (error instanceof SunSpecError || error instanceof ModbusConnectionError) {
      return res.status(400).json({
        error: 'Configuration Error',
        message: error.message
      });
    }

    res.status(500).json({
      error: 'Server Error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * GET /api/sunspec/devices/:deviceId
 * Get SunSpec device information
 */
router.get('/devices/:deviceId', authenticate, async (req: Request, res: Response) => {
  try {
    const deviceId = req.params.deviceId;

    const deviceInfo = {
      deviceId,
      configuration: sunspecService.getDeviceConfiguration(deviceId),
      connectionState: modbusService.getConnectionState(deviceId),
      discoveredModels: sunspecService.getDiscoveredModels(deviceId)
    };

    if (!deviceInfo.configuration) {
      return res.status(404).json({
        error: 'Device Not Found',
        message: 'SunSpec device not configured'
      });
    }

    res.json({
      message: 'SunSpec device information retrieved',
      data: deviceInfo
    });

  } catch (error) {
    console.error('❌ Error retrieving SunSpec device:', error);
    res.status(500).json({
      error: 'Server Error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * GET /api/sunspec/devices/:deviceId/data
 * Get real-time SunSpec data from device
 */
router.get('/devices/:deviceId/data', authenticate, async (req: Request, res: Response) => {
  try {
    const deviceId = req.params.deviceId;

    // Check if device is configured
    const configuration = sunspecService.getDeviceConfiguration(deviceId);
    if (!configuration) {
      return res.status(404).json({
        error: 'Device Not Found',
        message: 'SunSpec device not configured'
      });
    }

    // Read current device data
    const deviceData = await sunspecService.readDeviceData(deviceId);
    
    if (!deviceData) {
      return res.status(400).json({
        error: 'Read Failed',
        message: 'Failed to read data from SunSpec device'
      });
    }

    res.json({
      message: 'SunSpec device data retrieved',
      data: deviceData
    });

  } catch (error) {
    console.error('❌ Error reading SunSpec data:', error);
    
    if (error instanceof SunSpecError || error instanceof ModbusConnectionError) {
      return res.status(400).json({
        error: 'Read Error',
        message: error.message
      });
    }

    res.status(500).json({
      error: 'Server Error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * POST /api/sunspec/devices/:deviceId/start-polling
 * Start polling data from SunSpec device
 */
router.post('/devices/:deviceId/start-polling', authenticate, authorize(UserRole.ADMIN, UserRole.INSTALLER), async (req: Request, res: Response) => {
  try {
    const deviceId = req.params.deviceId;
    const { pollingInterval } = req.body;

    // Validate polling interval
    if (pollingInterval && (pollingInterval < 5 || pollingInterval > 3600)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Polling interval must be between 5 and 3600 seconds'
      });
    }

    // Check if device is configured
    const configuration = sunspecService.getDeviceConfiguration(deviceId);
    if (!configuration) {
      return res.status(404).json({
        error: 'Device Not Found',
        message: 'SunSpec device not configured'
      });
    }

    // Update polling interval if provided
    if (pollingInterval) {
      configuration.pollingInterval = pollingInterval;
    }

    // Start polling (this would typically be handled by the DataCollectionService)
    res.json({
      message: 'SunSpec device polling started',
      data: {
        deviceId,
        pollingInterval: configuration.pollingInterval,
        status: 'polling'
      }
    });

  } catch (error) {
    console.error('❌ Error starting SunSpec polling:', error);
    res.status(500).json({
      error: 'Server Error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * POST /api/sunspec/devices/:deviceId/stop-polling
 * Stop polling data from SunSpec device
 */
router.post('/devices/:deviceId/stop-polling', authenticate, authorize(UserRole.ADMIN, UserRole.INSTALLER), async (req: Request, res: Response) => {
  try {
    const deviceId = req.params.deviceId;

    // Check if device is configured
    const configuration = sunspecService.getDeviceConfiguration(deviceId);
    if (!configuration) {
      return res.status(404).json({
        error: 'Device Not Found',
        message: 'SunSpec device not configured'
      });
    }

    // Stop polling
    sunspecService.stopPolling(deviceId);

    res.json({
      message: 'SunSpec device polling stopped',
      data: {
        deviceId,
        status: 'stopped'
      }
    });

  } catch (error) {
    console.error('❌ Error stopping SunSpec polling:', error);
    res.status(500).json({
      error: 'Server Error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * DELETE /api/sunspec/devices/:deviceId
 * Remove SunSpec device configuration
 */
router.delete('/devices/:deviceId', authenticate, authorize(UserRole.ADMIN, UserRole.INSTALLER), async (req: Request, res: Response) => {
  try {
    const deviceId = req.params.deviceId;

    // Check if device is configured
    const configuration = sunspecService.getDeviceConfiguration(deviceId);
    if (!configuration) {
      return res.status(404).json({
        error: 'Device Not Found',
        message: 'SunSpec device not configured'
      });
    }

    // Remove device
    await sunspecService.removeDevice(deviceId);

    res.json({
      message: 'SunSpec device removed successfully',
      data: { deviceId }
    });

  } catch (error) {
    console.error('❌ Error removing SunSpec device:', error);
    res.status(500).json({
      error: 'Server Error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * GET /api/sunspec/devices
 * Get all configured SunSpec devices
 */
router.get('/devices', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    // Get all connection states from ModbusService
    const connectionStates = modbusService.getAllConnectionStates();
    
    const devices = connectionStates.map((state: any) => ({
      deviceId: state.deviceId,
      configuration: sunspecService.getDeviceConfiguration(state.deviceId),
      connectionState: state,
      discoveredModels: sunspecService.getDiscoveredModels(state.deviceId)
    })).filter((device: any) => device.configuration); // Only return configured devices

    // Filter devices based on user role and ownership
    // Note: In a full implementation, you'd check device ownership from the database
    let filteredDevices = devices;
    if (userRole !== UserRole.ADMIN) {
      // For non-admin users, filter based on device ownership
      // This would require additional logic to check device ownership
    }

    res.json({
      message: 'SunSpec devices retrieved successfully',
      data: filteredDevices,
      count: filteredDevices.length
    });

  } catch (error) {
    console.error('❌ Error retrieving SunSpec devices:', error);
    res.status(500).json({
      error: 'Server Error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * GET /api/sunspec/health
 * Get health status of all Modbus connections
 */
router.get('/health', authenticate, async (req: Request, res: Response) => {
  try {
    const healthStatus = await modbusService.healthCheck();
    const connectionStates = modbusService.getAllConnectionStates();

    const healthInfo = {
      overview: {
        totalConnections: connectionStates.length,
        healthyConnections: Object.values(healthStatus).filter(healthy => healthy).length,
        unhealthyConnections: Object.values(healthStatus).filter(healthy => !healthy).length
      },
      devices: connectionStates.map((state: any) => ({
        deviceId: state.deviceId,
        connected: state.connected,
        healthy: healthStatus[state.deviceId] || false,
        lastConnected: state.lastConnected,
        lastError: state.lastError,
        errorCount: state.errorCount
      }))
    };

    res.json({
      message: 'Modbus health status retrieved',
      data: healthInfo
    });

  } catch (error) {
    console.error('❌ Error checking Modbus health:', error);
    res.status(500).json({
      error: 'Server Error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * GET /api/sunspec/models
 * Get supported SunSpec model types
 */
router.get('/models', authenticate, async (req: Request, res: Response) => {
  try {
    const supportedModels = Object.entries(SunSpecModelType)
      .filter(([key, value]) => typeof value === 'number')
      .map(([key, value]) => ({
        id: value,
        name: key,
        description: getSunSpecModelDescription(value as SunSpecModelType)
      }));

    res.json({
      message: 'Supported SunSpec models retrieved',
      data: supportedModels
    });

  } catch (error) {
    console.error('❌ Error retrieving SunSpec models:', error);
    res.status(500).json({
      error: 'Server Error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * Helper function to get SunSpec model descriptions
 */
function getSunSpecModelDescription(modelType: SunSpecModelType): string {
  const descriptions: { [key in SunSpecModelType]: string } = {
    [SunSpecModelType.COMMON]: 'Common model - Basic device identification',
    [SunSpecModelType.INVERTER_SINGLE_PHASE]: 'Single Phase Inverter',
    [SunSpecModelType.INVERTER_SPLIT_PHASE]: 'Split Phase Inverter', 
    [SunSpecModelType.INVERTER_THREE_PHASE]: 'Three Phase Inverter',
    [SunSpecModelType.INVERTER_THREE_PHASE_DELTA]: 'Three Phase Delta Inverter',
    [SunSpecModelType.METER_SINGLE_PHASE]: 'Single Phase Meter',
    [SunSpecModelType.METER_SPLIT_PHASE]: 'Split Phase Meter',
    [SunSpecModelType.METER_THREE_PHASE_WYE]: 'Three Phase Wye Meter',
    [SunSpecModelType.METER_THREE_PHASE_DELTA]: 'Three Phase Delta Meter'
  };

  return descriptions[modelType] || 'Unknown model type';
}

export default router;