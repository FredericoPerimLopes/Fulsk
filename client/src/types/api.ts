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

// Inverter-specific SunSpec data types
export interface InverterConfiguration {
  ipAddress: string;
  port: number;
  unitId: number;
  pollInterval: number; // in seconds
  timeout: number; // in milliseconds
  sunspecDeviceId: number;
  enabled: boolean;
  registerMap: {
    [key: string]: {
      address: number;
      type: 'uint16' | 'int16' | 'uint32' | 'int32' | 'float32' | 'string';
      scaleFactor?: number;
      units?: string;
    };
  };
}

export interface InverterData extends DeviceData {
  // SunSpec model data
  acPowerTotal: number;
  acPowerPhaseA?: number;
  acPowerPhaseB?: number;
  acPowerPhaseC?: number;
  acVoltageAB?: number;
  acVoltageBC?: number;
  acVoltageCA?: number;
  acVoltageAN?: number;
  acVoltageBN?: number;
  acVoltageCN?: number;
  acCurrentA?: number;
  acCurrentB?: number;
  acCurrentC?: number;
  acFrequency: number;
  dcPower: number;
  dcVoltage: number;
  dcCurrent: number;
  cabinetTemperature: number;
  heatsinkTemperature?: number;
  transformerTemperature?: number;
  otherTemperature?: number;
  operatingState: InverterOperatingState;
  eventFlags: number;
  manufacturerEventFlags?: number;
  // Energy production
  energyLifetime: number;
  energyDaily: number;
  energyMonthly: number;
  energyYearly: number;
  // Efficiency and performance
  systemEfficiency: number;
  dcToAcEfficiency: number;
  weightedEfficiency?: number;
  // Connection and communication
  connectionQuality: number; // 0-100%
  communicationErrors: number;
  lastSuccessfulRead: string;
  registerErrors: string[];
}

export const InverterOperatingState = {
  OFF: 'OFF',
  SLEEPING: 'SLEEPING',
  STARTING: 'STARTING',
  MPPT: 'MPPT',
  THROTTLED: 'THROTTLED',
  SHUTTING_DOWN: 'SHUTTING_DOWN',
  FAULT: 'FAULT',
  STANDBY: 'STANDBY',
  UNKNOWN: 'UNKNOWN'
} as const;

export type InverterOperatingState = typeof InverterOperatingState[keyof typeof InverterOperatingState];

export interface InverterAlert extends Alert {
  eventCode?: number;
  sunspecAlarmCode?: number;
  registerAddress?: number;
  rawValue?: number;
  expectedValue?: number;
  troubleshootingSteps?: string[];
}

export interface InverterDiagnosticData {
  deviceId: string;
  timestamp: string;
  connectionTest: {
    success: boolean;
    responseTime: number;
    error?: string;
  };
  registerReads: {
    [address: number]: {
      success: boolean;
      value?: number | string;
      error?: string;
      timestamp: string;
    };
  };
  communicationStats: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    lastSuccessfulRead: string;
    errorRate: number;
  };
  deviceInfo: {
    manufacturer?: string;
    model?: string;
    serialNumber?: string;
    firmwareVersion?: string;
    sunspecVersion?: string;
    supportedModels?: number[];
  };
}

export interface InverterPerformanceMetrics {
  deviceId: string;
  period: 'hour' | 'day' | 'week' | 'month' | 'year';
  startTime: string;
  endTime: string;
  totalEnergy: number;
  averagePower: number;
  peakPower: number;
  minimumPower: number;
  averageEfficiency: number;
  peakEfficiency: number;
  averageTemperature: number;
  peakTemperature: number;
  uptime: number; // percentage
  communicationUptime: number; // percentage
  dataPoints: {
    timestamp: string;
    power: number;
    efficiency: number;
    temperature: number;
  }[];
}