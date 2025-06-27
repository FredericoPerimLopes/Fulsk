import { v4 as uuidv4 } from 'uuid';
import { Device, CreateDeviceDto, UpdateDeviceDto, DeviceStatus, DeviceData } from '@models/Device';

// In-memory device storage (replace with database in production)
const devices: Device[] = [];
const deviceData: DeviceData[] = [];

export class DeviceService {
  /**
   * Register a new device
   */
  static async createDevice(deviceData: CreateDeviceDto, ownerId: string, installerId?: string): Promise<Device> {
    // Check if device with same serial number exists
    const existingDevice = devices.find(device => device.serialNumber === deviceData.serialNumber);
    if (existingDevice) {
      throw new Error('Device with this serial number already exists');
    }

    // Create new device
    const newDevice: Device = {
      id: uuidv4(),
      name: deviceData.name,
      type: deviceData.type,
      manufacturer: deviceData.manufacturer,
      model: deviceData.model,
      serialNumber: deviceData.serialNumber,
      firmwareVersion: deviceData.firmwareVersion,
      location: deviceData.location,
      configuration: deviceData.configuration,
      status: DeviceStatus.OFFLINE,
      owner: ownerId,
      installer: installerId,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    devices.push(newDevice);
    return newDevice;
  }

  /**
   * Get device by ID
   */
  static async getDeviceById(deviceId: string, userId: string): Promise<Device | null> {
    const device = devices.find(d => d.id === deviceId);
    
    if (!device) {
      return null;
    }

    // Check if user has access to this device
    if (device.owner !== userId && device.installer !== userId) {
      throw new Error('Access denied to this device');
    }

    return device;
  }

  /**
   * Get all devices for a user
   */
  static async getDevicesForUser(userId: string): Promise<Device[]> {
    return devices.filter(device => 
      device.owner === userId || device.installer === userId
    );
  }

  /**
   * Get all devices (Admin only)
   */
  static async getAllDevices(): Promise<Device[]> {
    return devices;
  }

  /**
   * Update device
   */
  static async updateDevice(deviceId: string, updates: UpdateDeviceDto, userId: string): Promise<Device> {
    const device = devices.find(d => d.id === deviceId);
    
    if (!device) {
      throw new Error('Device not found');
    }

    // Check if user has access to this device
    if (device.owner !== userId && device.installer !== userId) {
      throw new Error('Access denied to this device');
    }

    // Update device fields
    if (updates.name) device.name = updates.name;
    if (updates.location) device.location = { ...device.location, ...updates.location };
    if (updates.configuration) device.configuration = { ...device.configuration, ...updates.configuration };
    if (updates.status) device.status = updates.status;
    if (updates.isActive !== undefined) device.isActive = updates.isActive;

    device.updatedAt = new Date();

    return device;
  }

  /**
   * Delete device
   */
  static async deleteDevice(deviceId: string, userId: string): Promise<void> {
    const deviceIndex = devices.findIndex(d => d.id === deviceId);
    
    if (deviceIndex === -1) {
      throw new Error('Device not found');
    }

    const device = devices[deviceIndex];

    // Check if user has access to this device (only owner can delete)
    if (device.owner !== userId) {
      throw new Error('Only device owner can delete the device');
    }

    devices.splice(deviceIndex, 1);
    
    // Also remove associated data
    const dataIndices = deviceData.map((data, index) => data.deviceId === deviceId ? index : -1)
                                  .filter(index => index !== -1);
    
    for (let i = dataIndices.length - 1; i >= 0; i--) {
      deviceData.splice(dataIndices[i], 1);
    }
  }

  /**
   * Update device status (typically called by IoT devices)
   */
  static async updateDeviceStatus(deviceId: string, status: DeviceStatus): Promise<void> {
    const device = devices.find(d => d.id === deviceId);
    
    if (!device) {
      throw new Error('Device not found');
    }

    device.status = status;
    device.lastSeen = new Date();
    device.updatedAt = new Date();
  }

  /**
   * Get device real-time data
   */
  static async getDeviceData(deviceId: string, userId: string, limit: number = 100): Promise<DeviceData[]> {
    const device = devices.find(d => d.id === deviceId);
    
    if (!device) {
      throw new Error('Device not found');
    }

    // Check if user has access to this device
    if (device.owner !== userId && device.installer !== userId) {
      throw new Error('Access denied to this device');
    }

    return deviceData
      .filter(data => data.deviceId === deviceId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Store device data (typically called by data collection service)
   */
  static async storeDeviceData(data: DeviceData): Promise<void> {
    const device = devices.find(d => d.id === data.deviceId);
    
    if (!device) {
      throw new Error('Device not found');
    }

    deviceData.push(data);
    
    // Update device status based on data
    device.lastSeen = data.timestamp;
    device.status = data.status;
    device.updatedAt = new Date();

    // Keep only last 10000 records per device to prevent memory issues
    const deviceDataCount = deviceData.filter(d => d.deviceId === data.deviceId).length;
    if (deviceDataCount > 10000) {
      const oldestIndex = deviceData.findIndex(d => d.deviceId === data.deviceId);
      if (oldestIndex !== -1) {
        deviceData.splice(oldestIndex, 1);
      }
    }
  }

  /**
   * Get device statistics
   */
  static async getDeviceStats(deviceId: string, userId: string, period: 'day' | 'week' | 'month' | 'year'): Promise<any> {
    const device = devices.find(d => d.id === deviceId);
    
    if (!device) {
      throw new Error('Device not found');
    }

    // Check if user has access to this device
    if (device.owner !== userId && device.installer !== userId) {
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

    const periodData = deviceData.filter(data => 
      data.deviceId === deviceId && 
      data.timestamp >= startDate
    );

    if (periodData.length === 0) {
      return {
        deviceId,
        period,
        totalEnergy: 0,
        averagePower: 0,
        peakPower: 0,
        efficiency: 0,
        uptime: 0,
        alertsCount: 0
      };
    }

    const totalEnergy = periodData.reduce((sum, data) => sum + data.energyToday, 0);
    const averagePower = periodData.reduce((sum, data) => sum + data.power, 0) / periodData.length;
    const peakPower = Math.max(...periodData.map(data => data.power));
    const averageEfficiency = periodData.reduce((sum, data) => sum + (data.efficiency || 0), 0) / periodData.length;
    
    // Calculate uptime (percentage of time device was online)
    const onlineData = periodData.filter(data => data.status === DeviceStatus.ONLINE);
    const uptime = (onlineData.length / periodData.length) * 100;

    return {
      deviceId,
      period,
      totalEnergy: Math.round(totalEnergy * 100) / 100,
      averagePower: Math.round(averagePower * 100) / 100,
      peakPower: Math.round(peakPower * 100) / 100,
      efficiency: Math.round(averageEfficiency * 100) / 100,
      uptime: Math.round(uptime * 100) / 100,
      alertsCount: 0 // TODO: Implement alert tracking
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
    let filteredDevices = devices.filter(device => 
      device.owner === criteria.userId || device.installer === criteria.userId
    );

    if (criteria.manufacturer) {
      filteredDevices = filteredDevices.filter(device => 
        device.manufacturer.toLowerCase().includes(criteria.manufacturer!.toLowerCase())
      );
    }

    if (criteria.type) {
      filteredDevices = filteredDevices.filter(device => device.type === criteria.type);
    }

    if (criteria.status) {
      filteredDevices = filteredDevices.filter(device => device.status === criteria.status);
    }

    if (criteria.location) {
      filteredDevices = filteredDevices.filter(device => 
        device.location.city.toLowerCase().includes(criteria.location!.toLowerCase()) ||
        device.location.state.toLowerCase().includes(criteria.location!.toLowerCase())
      );
    }

    return filteredDevices;
  }
}