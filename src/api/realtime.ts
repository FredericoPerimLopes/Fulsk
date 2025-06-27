import { Router, Request, Response } from 'express';
import { authenticate } from '@middleware/auth';
import { DatabaseDeviceService as DeviceService } from '@services/DatabaseDeviceService';
import { DeviceStatus } from '@models/Device';

const router = Router();

/**
 * GET /api/realtime/metrics
 * Get real-time system metrics
 */
router.get('/metrics', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const devices = await DeviceService.getDevicesForUser(userId);
    
    let totalPower = 0;
    let totalEnergyToday = 0;
    let onlineDevices = 0;
    let errorDevices = 0;

    for (const device of devices) {
      const recentData = await DeviceService.getDeviceData(device.id, userId, 1);
      
      if (recentData.length > 0) {
        const data = recentData[0];
        totalPower += data.power;
        totalEnergyToday += data.energyToday;
        
        if (data.status === DeviceStatus.ONLINE) {
          onlineDevices++;
        } else if (data.status === DeviceStatus.ERROR) {
          errorDevices++;
        }
      }
    }

    const metrics = {
      totalDevices: devices.length,
      onlineDevices,
      errorDevices,
      offlineDevices: devices.length - onlineDevices - errorDevices,
      totalPower: Math.round(totalPower * 100) / 100,
      totalEnergyToday: Math.round(totalEnergyToday * 100) / 100,
      averageEfficiency: devices.length > 0 ? Math.round((onlineDevices / devices.length) * 100) : 0,
      timestamp: new Date()
    };

    res.json({
      message: 'Real-time metrics retrieved successfully',
      data: metrics
    });
  } catch (error) {
    res.status(500).json({
      error: 'Server Error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/realtime/devices/:id/current
 * Get current real-time data for a specific device
 */
router.get('/devices/:id/current', authenticate, async (req: Request, res: Response) => {
  try {
    const deviceId = req.params.id;
    const userId = req.user!.userId;

    const recentData = await DeviceService.getDeviceData(deviceId, userId, 1);
    
    if (recentData.length === 0) {
      return res.status(404).json({
        error: 'No Data',
        message: 'No recent data available for this device'
      });
    }

    res.json({
      message: 'Current device data retrieved successfully',
      data: recentData[0]
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
 * GET /api/realtime/devices/:id/stream
 * Get streaming data for a device (last 50 data points)
 */
router.get('/devices/:id/stream', authenticate, async (req: Request, res: Response) => {
  try {
    const deviceId = req.params.id;
    const userId = req.user!.userId;
    const limit = parseInt(req.query.limit as string) || 50;

    const streamData = await DeviceService.getDeviceData(deviceId, userId, Math.min(limit, 100));

    res.json({
      message: 'Device stream data retrieved successfully',
      data: streamData,
      count: streamData.length
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
 * GET /api/realtime/alerts
 * Get recent alerts for user's devices
 */
router.get('/alerts', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const devices = await DeviceService.getDevicesForUser(userId);
    
    // This would typically fetch from an alerts database
    // For now, return mock alerts based on device status
    const alerts = [];
    
    for (const device of devices) {
      const recentData = await DeviceService.getDeviceData(device.id, userId, 1);
      
      if (recentData.length > 0) {
        const data = recentData[0];
        
        if (data.status === DeviceStatus.ERROR) {
          alerts.push({
            id: `alert-${device.id}-${Date.now()}`,
            deviceId: device.id,
            deviceName: device.name,
            type: 'error',
            severity: 'critical',
            message: 'Device reported error status',
            timestamp: data.timestamp,
            acknowledged: false
          });
        }
        
        if (data.power < device.configuration.alertThresholds.minPower) {
          alerts.push({
            id: `alert-${device.id}-power-${Date.now()}`,
            deviceId: device.id,
            deviceName: device.name,
            type: 'low_power',
            severity: 'warning',
            message: `Low power output: ${data.power}W (minimum: ${device.configuration.alertThresholds.minPower}W)`,
            timestamp: data.timestamp,
            acknowledged: false
          });
        }
        
        if (data.temperature > device.configuration.alertThresholds.maxTemperature) {
          alerts.push({
            id: `alert-${device.id}-temp-${Date.now()}`,
            deviceId: device.id,
            deviceName: device.name,
            type: 'high_temperature',
            severity: 'warning',
            message: `High temperature: ${data.temperature}°C (maximum: ${device.configuration.alertThresholds.maxTemperature}°C)`,
            timestamp: data.timestamp,
            acknowledged: false
          });
        }
      }
    }

    // Sort by timestamp (newest first)
    alerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    res.json({
      message: 'Alerts retrieved successfully',
      data: alerts.slice(0, 20), // Return last 20 alerts
      count: alerts.length
    });
  } catch (error) {
    res.status(500).json({
      error: 'Server Error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;