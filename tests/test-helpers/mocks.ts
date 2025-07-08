import { Request, Response, NextFunction } from 'express';
import { Socket } from 'socket.io';

export const createMockRequest = (overrides?: any): Partial<Request> => ({
  body: {},
  query: {},
  params: {},
  headers: {},
  ...overrides
});

export const createMockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    sendStatus: jest.fn().mockReturnThis(),
    end: jest.fn(),
    on: jest.fn()
  };
  return res;
};

export const createMockNext = (): NextFunction => jest.fn();

export const createMockSocket = (): Partial<Socket> => ({
  id: 'socket-123',
  join: jest.fn(),
  leave: jest.fn(),
  emit: jest.fn(),
  on: jest.fn(),
  disconnect: jest.fn()
});

export const mockPrismaClient = {
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn()
  },
  device: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn()
  },
  refreshToken: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn()
  },
  deviceData: {
    create: jest.fn(),
    createMany: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn()
  },
  $transaction: jest.fn()
};

export const mockModbusClient = {
  connectTCP: jest.fn(),
  setID: jest.fn(),
  readHoldingRegisters: jest.fn(),
  writeRegister: jest.fn(),
  writeRegisters: jest.fn(),
  setTimeout: jest.fn(),
  close: jest.fn(),
  isOpen: false
};

export const mockRedisClient = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
  expire: jest.fn(),
  ttl: jest.fn(),
  keys: jest.fn(),
  flushDb: jest.fn()
};

export const mockLogger = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  http: jest.fn()
};