import { prisma } from '@utils/database';
import { Device, CreateDeviceDto, UpdateDeviceDto, DeviceStatus, DeviceData } from '@models/Device';
import { UserRole } from '@models/User';

export class DatabaseDeviceService {
  /**
   * Register a new device
   */
  static async createDevice(deviceData: CreateDeviceDto, ownerId: string, installerId?: string): Promise<Device> {
    // Check if device with same serial number exists
    const existingDevice = await prisma.device.findUnique({
      where: { serialNumber: deviceData.serialNumber }
    });
    
    if (existingDevice) {
      throw new Error('Device with this serial number already exists');
    }

    // Create new device
    const newDevice = await prisma.device.create({
      data: {
        name: deviceData.name,
        type: deviceData.type,
        manufacturer: deviceData.manufacturer,
        model: deviceData.model,
        serialNumber: deviceData.serialNumber,
        firmwareVersion: deviceData.firmwareVersion,
        status: DeviceStatus.OFFLINE,
        isActive: true,
        
        // Location data
        address: deviceData.location.address,
        city: deviceData.location.city,
        state: deviceData.location.state,
        country: deviceData.location.country,
        zipCode: deviceData.location.zipCode,
        latitude: deviceData.location.coordinates.latitude,
        longitude: deviceData.location.coordinates.longitude,
        timezone: deviceData.location.timezone,
        
        // Configuration data
        communicationProtocol: deviceData.configuration.communicationProtocol,
        dataCollectionInterval: deviceData.configuration.dataCollectionInterval,
        minPowerThreshold: deviceData.configuration.alertThresholds.minPower,
        maxTemperatureThreshold: deviceData.configuration.alertThresholds.maxTemperature,
        minVoltageThreshold: deviceData.configuration.alertThresholds.minVoltage,
        maxVoltageThreshold: deviceData.configuration.alertThresholds.maxVoltage,
        emailNotifications: deviceData.configuration.notifications.email,
        smsNotifications: deviceData.configuration.notifications.sms,
        pushNotifications: deviceData.configuration.notifications.push,
        
        // Relationships
        ownerId,
        installerId
      },
      include: {
        owner: true,
        installer: true
      }
    });

    return this.formatDeviceResponse(newDevice);
  }

  /**
   * Get device by ID
   */
  static async getDeviceById(deviceId: string, userId: string): Promise<Device | null> {
    const device = await prisma.device.findUnique({
      where: { id: deviceId },
      include: {
        owner: true,
        installer: true
      }
    });
    
    if (!device) {
      return null;
    }

    // Check if user has access to this device
    if (device.ownerId !== userId && device.installerId !== userId) {
      throw new Error('Access denied to this device');
    }

    return this.formatDeviceResponse(device);
  }

  /**
   * Get all devices for a user
   */
  static async getDevicesForUser(userId: string): Promise<Device[]> {
    const devices = await prisma.device.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { installerId: userId }
        ]
      },
      include: {
        owner: true,
        installer: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    return devices.map(device => this.formatDeviceResponse(device));
  }

  /**
   * Get all devices (Admin only)
   */
  static async getAllDevices(): Promise<Device[]> {
    const devices = await prisma.device.findMany({
      include: {
        owner: true,
        installer: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    return devices.map(device => this.formatDeviceResponse(device));
  }

  /**
   * Update device
   */
  static async updateDevice(deviceId: string, updates: UpdateDeviceDto, userId: string): Promise<Device> {
    const device = await prisma.device.findUnique({
      where: { id: deviceId }
    });
    
    if (!device) {
      throw new Error('Device not found');
    }

    // Check if user has access to this device
    if (device.ownerId !== userId && device.installerId !== userId) {
      throw new Error('Access denied to this device');
    }

    // Prepare update data
    const updateData: any = {};
    
    if (updates.name) updateData.name = updates.name;
    if (updates.status) updateData.status = updates.status;
    if (updates.isActive !== undefined) updateData.isActive = updates.isActive;
    
    // Update location if provided
    if (updates.location) {
      if (updates.location.address) updateData.address = updates.location.address;
      if (updates.location.city) updateData.city = updates.location.city;
      if (updates.location.state) updateData.state = updates.location.state;
      if (updates.location.country) updateData.country = updates.location.country;
      if (updates.location.zipCode) updateData.zipCode = updates.location.zipCode;
      if (updates.location.coordinates?.latitude) updateData.latitude = updates.location.coordinates.latitude;
      if (updates.location.coordinates?.longitude) updateData.longitude = updates.location.coordinates.longitude;
      if (updates.location.timezone) updateData.timezone = updates.location.timezone;
    }
    
    // Update configuration if provided
    if (updates.configuration) {
      if (updates.configuration.communicationProtocol) updateData.communicationProtocol = updates.configuration.communicationProtocol;
      if (updates.configuration.dataCollectionInterval) updateData.dataCollectionInterval = updates.configuration.dataCollectionInterval;
      if (updates.configuration.alertThresholds?.minPower) updateData.minPowerThreshold = updates.configuration.alertThresholds.minPower;
      if (updates.configuration.alertThresholds?.maxTemperature) updateData.maxTemperatureThreshold = updates.configuration.alertThresholds.maxTemperature;
      if (updates.configuration.alertThresholds?.minVoltage) updateData.minVoltageThreshold = updates.configuration.alertThresholds.minVoltage;
      if (updates.configuration.alertThresholds?.maxVoltage) updateData.maxVoltageThreshold = updates.configuration.alertThresholds.maxVoltage;
      if (updates.configuration.notifications?.email !== undefined) updateData.emailNotifications = updates.configuration.notifications.email;
      if (updates.configuration.notifications?.sms !== undefined) updateData.smsNotifications = updates.configuration.notifications.sms;
      if (updates.configuration.notifications?.push !== undefined) updateData.pushNotifications = updates.configuration.notifications.push;
    }

    const updatedDevice = await prisma.device.update({
      where: { id: deviceId },
      data: updateData,
      include: {
        owner: true,
        installer: true
      }
    });

    return this.formatDeviceResponse(updatedDevice);
  }

  /**
   * Delete device
   */
  static async deleteDevice(deviceId: string, userId: string): Promise<void> {
    const device = await prisma.device.findUnique({
      where: { id: deviceId }
    });
    
    if (!device) {
      throw new Error('Device not found');
    }

    // Check if user has access to this device (only owner can delete)
    if (device.ownerId !== userId) {
      throw new Error('Only device owner can delete the device');
    }

    await prisma.device.delete({
      where: { id: deviceId }
    });
  }

  /**
   * Update device status (typically called by IoT devices)
   */
  static async updateDeviceStatus(deviceId: string, status: DeviceStatus): Promise<void> {
    const device = await prisma.device.findUnique({
      where: { id: deviceId }
    });
    
    if (!device) {
      throw new Error('Device not found');
    }

    await prisma.device.update({
      where: { id: deviceId },
      data: { 
        status,
        lastSeen: new Date()
      }
    });
  }

  /**
   * Get device real-time data
   */
  static async getDeviceData(deviceId: string, userId: string, limit: number = 100): Promise<DeviceData[]> {
    const device = await prisma.device.findUnique({
      where: { id: deviceId }
    });
    
    if (!device) {
      throw new Error('Device not found');
    }

    // Check if user has access to this device
    if (device.ownerId !== userId && device.installerId !== userId) {
      throw new Error('Access denied to this device');
    }

    const deviceData = await prisma.deviceData.findMany({
      where: { deviceId },
      orderBy: { timestamp: 'desc' },
      take: limit
    });

    return deviceData.map(data => ({
      deviceId: data.deviceId,
      timestamp: data.timestamp,
      power: data.power,
      voltage: data.voltage,
      current: data.current,
      temperature: data.temperature,
      irradiance: data.irradiance ?? undefined,
      efficiency: data.efficiency ?? undefined,
      energyToday: data.energyToday,
      energyTotal: data.energyTotal,
      status: data.status as DeviceStatus
    }));
  }

  /**
   * Store device data (typically called by data collection service)
   */
  static async storeDeviceData(data: DeviceData): Promise<void> {
    const device = await prisma.device.findUnique({
      where: { id: data.deviceId }
    });
    
    if (!device) {
      throw new Error('Device not found');
    }

    await prisma.deviceData.create({
      data: {
        deviceId: data.deviceId,
        timestamp: data.timestamp,
        power: data.power,
        voltage: data.voltage,
        current: data.current,
        temperature: data.temperature,
        irradiance: data.irradiance,
        efficiency: data.efficiency,
        energyToday: data.energyToday,
        energyTotal: data.energyTotal,
        status: data.status
      }
    });

    // Update device status and last seen
    await prisma.device.update({
      where: { id: data.deviceId },
      data: {
        status: data.status,
        lastSeen: data.timestamp
      }
    });
  }

  /**
   * Get device statistics
   */
  static async getDeviceStats(deviceId: string, userId: string, period: 'day' | 'week' | 'month' | 'year'): Promise<any> {
    const device = await prisma.device.findUnique({
      where: { id: deviceId }
    });
    
    if (!device) {
      throw new Error('Device not found');
    }

    // Check if user has access to this device
    if (device.ownerId !== userId && device.installerId !== userId) {
      throw new Error('Access denied to this device');
    }

    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'day':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
    }

    // Use raw SQL for aggregation queries
    const stats = await prisma.$queryRaw`
      SELECT 
        COUNT(*) as data_points,
        AVG(power) as avg_power,
        MAX(power) as max_power,
        MIN(power) as min_power,
        AVG(voltage) as avg_voltage,
        AVG(current) as avg_current,
        AVG(temperature) as avg_temperature,
        AVG(efficiency) as avg_efficiency,
        MAX(energy_today) as total_energy,
        COUNT(CASE WHEN status = 'ONLINE' THEN 1 END) * 100.0 / COUNT(*) as uptime_percentage
      FROM device_data 
      WHERE device_id = ${deviceId} 
        AND timestamp >= ${startDate}
        AND timestamp <= ${now}
    `;

    const result = Array.isArray(stats) ? stats[0] : stats;

    return {
      deviceId,
      period,
      totalEnergy: Number(result?.total_energy || 0),
      averagePower: Number(result?.avg_power || 0),
      peakPower: Number(result?.max_power || 0),
      efficiency: Number(result?.avg_efficiency || 0),
      uptime: Number(result?.uptime_percentage || 0),
      dataPoints: Number(result?.data_points || 0)
    };
  }

  /**
   * Search devices by criteria
   */
  static async searchDevices(criteria: {
    userId: string;
    manufacturer?: string;
    type?: string;
    status?: DeviceStatus;
    location?: string;
  }): Promise<Device[]> {
    const whereClause: any = {
      OR: [
        { ownerId: criteria.userId },
        { installerId: criteria.userId }
      ]
    };

    if (criteria.manufacturer) {
      whereClause.manufacturer = {
        contains: criteria.manufacturer,
        mode: 'insensitive'
      };
    }

    if (criteria.type) {
      whereClause.type = criteria.type;
    }

    if (criteria.status) {
      whereClause.status = criteria.status;
    }

    if (criteria.location) {
      whereClause.OR = [
        ...(whereClause.OR || []),
        {
          city: {
            contains: criteria.location,
            mode: 'insensitive'
          }
        },
        {
          state: {
            contains: criteria.location,
            mode: 'insensitive'
          }
        }
      ];
    }

    const devices = await prisma.device.findMany({
      where: whereClause,
      include: {
        owner: true,
        installer: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return devices.map(device => this.formatDeviceResponse(device));
  }

  /**
   * Format device response from database to match Device interface
   */
  private static formatDeviceResponse(device: any): Device {
    return {
      id: device.id,
      name: device.name,
      type: device.type,
      manufacturer: device.manufacturer,
      model: device.model,
      serialNumber: device.serialNumber,
      firmwareVersion: device.firmwareVersion,
      status: device.status,
      isActive: device.isActive,
      lastSeen: device.lastSeen,
      createdAt: device.createdAt,
      updatedAt: device.updatedAt,
      location: {
        address: device.address,
        city: device.city,
        state: device.state,
        country: device.country,
        zipCode: device.zipCode,
        coordinates: {
          latitude: device.latitude,
          longitude: device.longitude
        },
        timezone: device.timezone
      },
      configuration: {
        communicationProtocol: device.communicationProtocol,
        dataCollectionInterval: device.dataCollectionInterval,
        alertThresholds: {
          minPower: device.minPowerThreshold,
          maxTemperature: device.maxTemperatureThreshold,
          minVoltage: device.minVoltageThreshold,
          maxVoltage: device.maxVoltageThreshold
        },
        notifications: {
          email: device.emailNotifications,
          sms: device.smsNotifications,
          push: device.pushNotifications
        }
      },
      owner: device.ownerId,
      installer: device.installerId
    };
  }
}