import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { DatabaseDeviceService as DeviceService } from '@services/DatabaseDeviceService';
import { CreateDeviceDto, UpdateDeviceDto, DeviceType, DeviceStatus } from '@models/Device';
import { authenticate, authorize } from '@middleware/auth';
import { UserRole } from '@models/User';

const router = Router();

// Validation schemas
const createDeviceSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  type: Joi.string().valid(...Object.values(DeviceType)).required(),
  manufacturer: Joi.string().min(2).max(50).required(),
  model: Joi.string().min(2).max(50).required(),
  serialNumber: Joi.string().min(5).max(50).required(),
  firmwareVersion: Joi.string().max(20).optional(),
  location: Joi.object({
    address: Joi.string().required(),
    city: Joi.string().required(),
    state: Joi.string().required(),
    country: Joi.string().required(),
    zipCode: Joi.string().required(),
    coordinates: Joi.object({
      latitude: Joi.number().min(-90).max(90).required(),
      longitude: Joi.number().min(-180).max(180).required()
    }).required(),
    timezone: Joi.string().required()
  }).required(),
  configuration: Joi.object({
    communicationProtocol: Joi.string().valid('mqtt', 'http', 'modbus').required(),
    dataCollectionInterval: Joi.number().min(1).max(3600).required(),
    alertThresholds: Joi.object({
      minPower: Joi.number().min(0).required(),
      maxTemperature: Joi.number().min(0).max(100).required(),
      minVoltage: Joi.number().min(0).required(),
      maxVoltage: Joi.number().min(0).required()
    }).required(),
    notifications: Joi.object({
      email: Joi.boolean().required(),
      sms: Joi.boolean().required(),
      push: Joi.boolean().required()
    }).required()
  }).required()
});

const updateDeviceSchema = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  location: Joi.object({
    address: Joi.string().optional(),
    city: Joi.string().optional(),
    state: Joi.string().optional(),
    country: Joi.string().optional(),
    zipCode: Joi.string().optional(),
    coordinates: Joi.object({
      latitude: Joi.number().min(-90).max(90).optional(),
      longitude: Joi.number().min(-180).max(180).optional()
    }).optional(),
    timezone: Joi.string().optional()
  }).optional(),
  configuration: Joi.object({
    communicationProtocol: Joi.string().valid('mqtt', 'http', 'modbus').optional(),
    dataCollectionInterval: Joi.number().min(1).max(3600).optional(),
    alertThresholds: Joi.object({
      minPower: Joi.number().min(0).optional(),
      maxTemperature: Joi.number().min(0).max(100).optional(),
      minVoltage: Joi.number().min(0).optional(),
      maxVoltage: Joi.number().min(0).optional()
    }).optional(),
    notifications: Joi.object({
      email: Joi.boolean().optional(),
      sms: Joi.boolean().optional(),
      push: Joi.boolean().optional()
    }).optional()
  }).optional(),
  status: Joi.string().valid(...Object.values(DeviceStatus)).optional(),
  isActive: Joi.boolean().optional()
});

/**
 * POST /api/devices
 * Register a new device
 */
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { error, value } = createDeviceSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation Error',
        message: error.details[0].message
      });
    }

    const deviceData: CreateDeviceDto = value;
    const userId = req.user!.userId;
    const installerId = req.user!.role === UserRole.INSTALLER ? userId : undefined;

    const device = await DeviceService.createDevice(deviceData, userId, installerId);

    res.status(201).json({
      message: 'Device registered successfully',
      data: device
    });
  } catch (error) {
    res.status(400).json({
      error: 'Device Registration Failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/devices
 * Get all devices for the authenticated user
 */
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { manufacturer, type, status, location } = req.query;

    let devices;
    
    if (req.user!.role === UserRole.ADMIN) {
      devices = await DeviceService.getAllDevices();
    } else if (manufacturer || type || status || location) {
      // Search with criteria
      devices = await DeviceService.searchDevices({
        userId,
        manufacturer: manufacturer as string,
        type: type as string,
        status: status as DeviceStatus,
        location: location as string
      });
    } else {
      devices = await DeviceService.getDevicesForUser(userId);
    }

    res.json({
      message: 'Devices retrieved successfully',
      data: devices,
      count: devices.length
    });
  } catch (error) {
    res.status(500).json({
      error: 'Server Error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/devices/:id
 * Get a specific device by ID
 */
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const deviceId = req.params.id;
    const userId = req.user!.userId;

    const device = await DeviceService.getDeviceById(deviceId, userId);

    if (!device) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Device not found'
      });
    }

    res.json({
      message: 'Device retrieved successfully',
      data: device
    });
  } catch (error) {
    const statusCode = error instanceof Error && error.message === 'Access denied to this device' ? 403 : 500;
    res.status(statusCode).json({
      error: statusCode === 403 ? 'Access Denied' : 'Server Error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PUT /api/devices/:id
 * Update a device
 */
router.put('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { error, value } = updateDeviceSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation Error',
        message: error.details[0].message
      });
    }

    const deviceId = req.params.id;
    const userId = req.user!.userId;
    const updates: UpdateDeviceDto = value;

    const device = await DeviceService.updateDevice(deviceId, updates, userId);

    res.json({
      message: 'Device updated successfully',
      data: device
    });
  } catch (error) {
    const statusCode = error instanceof Error && error.message.includes('Access denied') ? 403 : 
                      error instanceof Error && error.message === 'Device not found' ? 404 : 500;
    res.status(statusCode).json({
      error: statusCode === 403 ? 'Access Denied' : statusCode === 404 ? 'Not Found' : 'Server Error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/devices/:id
 * Delete a device
 */
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const deviceId = req.params.id;
    const userId = req.user!.userId;

    await DeviceService.deleteDevice(deviceId, userId);

    res.json({
      message: 'Device deleted successfully'
    });
  } catch (error) {
    const statusCode = error instanceof Error && error.message.includes('Access denied') ? 403 : 
                      error instanceof Error && error.message === 'Device not found' ? 404 : 500;
    res.status(statusCode).json({
      error: statusCode === 403 ? 'Access Denied' : statusCode === 404 ? 'Not Found' : 'Server Error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/devices/:id/data
 * Get real-time data for a device
 */
router.get('/:id/data', authenticate, async (req: Request, res: Response) => {
  try {
    const deviceId = req.params.id;
    const userId = req.user!.userId;
    const limit = parseInt(req.query.limit as string) || 100;

    const data = await DeviceService.getDeviceData(deviceId, userId, limit);

    res.json({
      message: 'Device data retrieved successfully',
      data: data,
      count: data.length
    });
  } catch (error) {
    const statusCode = error instanceof Error && error.message.includes('Access denied') ? 403 : 
                      error instanceof Error && error.message === 'Device not found' ? 404 : 500;
    res.status(statusCode).json({
      error: statusCode === 403 ? 'Access Denied' : statusCode === 404 ? 'Not Found' : 'Server Error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/devices/:id/stats
 * Get device statistics
 */
router.get('/:id/stats', authenticate, async (req: Request, res: Response) => {
  try {
    const deviceId = req.params.id;
    const userId = req.user!.userId;
    const period = (req.query.period as 'day' | 'week' | 'month' | 'year') || 'day';

    if (!['day', 'week', 'month', 'year'].includes(period)) {
      return res.status(400).json({
        error: 'Invalid Period',
        message: 'Period must be one of: day, week, month, year'
      });
    }

    const stats = await DeviceService.getDeviceStats(deviceId, userId, period);

    res.json({
      message: 'Device statistics retrieved successfully',
      data: stats
    });
  } catch (error) {
    const statusCode = error instanceof Error && error.message.includes('Access denied') ? 403 : 
                      error instanceof Error && error.message === 'Device not found' ? 404 : 500;
    res.status(statusCode).json({
      error: statusCode === 403 ? 'Access Denied' : statusCode === 404 ? 'Not Found' : 'Server Error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/devices/:id/status
 * Update device status (for IoT devices)
 */
router.post('/:id/status', authenticate, authorize(UserRole.ADMIN, UserRole.INSTALLER), async (req: Request, res: Response) => {
  try {
    const deviceId = req.params.id;
    const { status } = req.body;

    if (!Object.values(DeviceStatus).includes(status)) {
      return res.status(400).json({
        error: 'Invalid Status',
        message: 'Status must be one of: online, offline, error, maintenance'
      });
    }

    await DeviceService.updateDeviceStatus(deviceId, status);

    res.json({
      message: 'Device status updated successfully'
    });
  } catch (error) {
    res.status(404).json({
      error: 'Not Found',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;