// API Types for Fulsk Solar Monitoring Dashboard

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}

export const UserRole = {
  ADMIN: 'ADMIN',
  INSTALLER: 'INSTALLER', 
  VIEWER: 'VIEWER'
} as const;

export type UserRole = typeof UserRole[keyof typeof UserRole];

export interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
  expiresIn: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  manufacturer: string;
  model: string;
  serialNumber: string;
  firmwareVersion?: string;
  status: DeviceStatus;
  isActive: boolean;
  lastSeen?: string;
  createdAt: string;
  updatedAt: string;
  location: DeviceLocation;
  configuration: DeviceConfiguration;
  owner: string;
  installer?: string;
}

export const DeviceType = {
  INVERTER: 'INVERTER',
  PANEL: 'PANEL',
  BATTERY: 'BATTERY',
  METER: 'METER',
  SENSOR: 'SENSOR'
} as const;

export type DeviceType = typeof DeviceType[keyof typeof DeviceType];

export const DeviceStatus = {
  ONLINE: 'ONLINE',
  OFFLINE: 'OFFLINE', 
  ERROR: 'ERROR',
  MAINTENANCE: 'MAINTENANCE'
} as const;

export type DeviceStatus = typeof DeviceStatus[keyof typeof DeviceStatus];

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
  communicationProtocol: 'MQTT' | 'HTTP' | 'MODBUS';
  dataCollectionInterval: number;
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

export interface DeviceData {
  deviceId: string;
  timestamp: string;
  power: number;
  voltage: number;
  current: number;
  temperature: number;
  irradiance?: number;
  efficiency?: number;
  energyToday: number;
  energyTotal: number;
  status: DeviceStatus;
}

export interface DeviceStats {
  deviceId: string;
  period: 'day' | 'week' | 'month' | 'year';
  totalEnergy: number;
  averagePower: number;
  peakPower: number;
  efficiency: number;
  uptime: number;
  dataPoints: number;
}

export interface RealtimeMetrics {
  totalDevices: number;
  onlineDevices: number;
  errorDevices: number;
  offlineDevices: number;
  totalPower: number;
  totalEnergyToday: number;
  averageEfficiency: number;
  timestamp: string;
}

export interface Alert {
  id: string;
  deviceId: string;
  deviceName: string;
  type: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
  timestamp: string;
  acknowledged: boolean;
  read?: boolean;
  isNew?: boolean;
}

export interface ApiResponse<T> {
  message: string;
  data: T;
  count?: number;
}