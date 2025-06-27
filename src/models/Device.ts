export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  manufacturer: string;
  model: string;
  serialNumber: string;
  firmwareVersion?: string;
  location: DeviceLocation;
  configuration: DeviceConfiguration;
  status: DeviceStatus;
  owner: string; // User ID
  installer?: string; // User ID
  isActive: boolean;
  lastSeen?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export enum DeviceType {
  INVERTER = 'inverter',
  PANEL = 'panel',
  BATTERY = 'battery',
  METER = 'meter',
  SENSOR = 'sensor'
}

export enum DeviceStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  ERROR = 'error',
  MAINTENANCE = 'maintenance'
}

export interface DeviceLocation {
  address: string;
  city: string;
  state: string;
  country: string;
  zipCode: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  timezone: string;
}

export interface DeviceConfiguration {
  communicationProtocol: 'mqtt' | 'http' | 'modbus';
  dataCollectionInterval: number; // seconds
  alertThresholds: {
    minPower: number;
    maxTemperature: number;
    minVoltage: number;
    maxVoltage: number;
  };
  notifications: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
}

export interface CreateDeviceDto {
  name: string;
  type: DeviceType;
  manufacturer: string;
  model: string;
  serialNumber: string;
  firmwareVersion?: string;
  location: DeviceLocation;
  configuration: DeviceConfiguration;
}

export interface UpdateDeviceDto {
  name?: string;
  location?: Partial<DeviceLocation>;
  configuration?: Partial<DeviceConfiguration>;
  status?: DeviceStatus;
  isActive?: boolean;
}

export interface DeviceData {
  deviceId: string;
  timestamp: Date;
  power: number; // Watts
  voltage: number; // Volts
  current: number; // Amperes
  temperature: number; // Celsius
  irradiance?: number; // W/m²
  efficiency?: number; // Percentage
  energyToday: number; // kWh
  energyTotal: number; // kWh
  status: DeviceStatus;
}

export interface DeviceStats {
  deviceId: string;
  period: 'day' | 'week' | 'month' | 'year';
  totalEnergy: number;
  averagePower: number;
  peakPower: number;
  efficiency: number;
  uptime: number; // Percentage
  alertsCount: number;
}