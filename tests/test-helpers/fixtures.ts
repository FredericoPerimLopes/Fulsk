import { User, UserRole } from '@models/User';
import { Device, DeviceType, DeviceStatus } from '@models/Device';

export const createMockUser = (overrides?: Partial<User>): User => ({
  id: 'user-123',
  email: 'test@example.com',
  password: 'hashed-password',
  firstName: 'John',
  lastName: 'Doe',
  role: UserRole.USER,
  isActive: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides
});

export const createMockDevice = (overrides?: Partial<Device>): Device => ({
  id: 'device-123',
  name: 'Test Inverter',
  serialNumber: 'SN123456',
  manufacturer: 'SolarTech',
  model: 'ST-5000',
  firmwareVersion: '1.2.3',
  type: DeviceType.INVERTER,
  status: DeviceStatus.ONLINE,
  ipAddress: '192.168.1.100',
  modbusAddress: 1,
  port: 502,
  location: 'Roof A',
  installationDate: new Date('2024-01-01'),
  userId: 'user-123',
  isActive: true,
  lastSeen: new Date(),
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides
});

export const createMockAuthResponse = () => ({
  user: {
    id: 'user-123',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    role: UserRole.USER,
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  },
  token: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  expiresIn: '24h'
});

export const createMockDeviceData = () => ({
  deviceId: 'device-123',
  timestamp: new Date(),
  data: {
    power: 4500,
    voltage: 240,
    current: 18.75,
    frequency: 50,
    powerFactor: 0.95,
    energy: 12500,
    temperature: 45,
    status: 'normal'
  }
});

export const createMockModbusData = () => ({
  ACPower: 4500,
  ACVoltageAB: 240,
  ACCurrent: 18.75,
  ACFrequency: 50,
  PowerFactor: 0.95,
  ACEnergy: 12500000,
  OperatingState: 4,
  Temperature: 45,
  Status1: 0,
  Status2: 0
});

export const createMockWebSocketMessage = (type: string, data: any) => ({
  type,
  data,
  timestamp: new Date().toISOString()
});

export const mockEnvironmentVariables = {
  NODE_ENV: 'test',
  PORT: '3000',
  HOST: 'localhost',
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  JWT_SECRET: 'test-jwt-secret',
  JWT_REFRESH_SECRET: 'test-refresh-secret',
  JWT_EXPIRES_IN: '24h',
  BCRYPT_ROUNDS: '10',
  CLIENT_URL: 'http://localhost:3001',
  ALLOWED_ORIGINS: 'http://localhost:3001,http://localhost:3000',
  LOG_LEVEL: 'error'
};