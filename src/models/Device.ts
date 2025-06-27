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

import { DeviceType as PrismaDeviceType, DeviceStatus as PrismaDeviceStatus, CommunicationProtocol as PrismaCommunicationProtocol } from '@prisma/client';

// Use Prisma's generated enums
export type DeviceType = PrismaDeviceType;
export const DeviceType = PrismaDeviceType;

export type DeviceStatus = PrismaDeviceStatus;
export const DeviceStatus = PrismaDeviceStatus;

export type CommunicationProtocol = PrismaCommunicationProtocol;

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
  communicationProtocol: CommunicationProtocol;
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