# SunSpec Implementation Examples

## 1. SunSpecService Implementation

### 1.1 Core Service Class

```typescript
// src/services/SunSpecService.ts
import { SunSpecReader } from '@svrooij/sunspec';
import { EventEmitter } from 'events';
import { DeviceData, DeviceStatus } from '@models/Device';

export interface SunSpecConfig {
  host: string;
  port: number;
  unitId: number;
  timeout: number;
  retryAttempts: number;
  pollingInterval: number;
  models: number[];
}

export interface SunSpecDeviceInfo {
  manufacturer: string;
  model: string;
  version: string;
  serialNumber: string;
  supportedModels: number[];
}

export interface SunSpecData {
  timestamp: Date;
  model: number;
  registers: Map<string, any>;
  rawData: any;
}

export class SunSpecService extends EventEmitter {
  private connections: Map<string, SunSpecReader> = new Map();
  private pollingIntervals: Map<string, NodeJS.Timeout> = new Map();
  private connectionStates: Map<string, 'connected' | 'disconnected' | 'error'> = new Map();
  
  constructor() {
    super();
    this.setupErrorHandling();
  }

  /**
   * Discover SunSpec device and supported models
   */
  async discoverDevice(config: SunSpecConfig): Promise<SunSpecDeviceInfo> {
    const reader = new SunSpecReader(config.host, config.port, config.unitId);
    
    try {
      await reader.connect();
      
      // Read common model (Model 1) for device info
      const commonModel = await reader.readModel(1);
      
      // Discover available models
      const supportedModels = await this.discoverModels(reader);
      
      await reader.disconnect();
      
      return {
        manufacturer: commonModel.Mn || 'Unknown',
        model: commonModel.Md || 'Unknown',
        version: commonModel.Vr || 'Unknown',
        serialNumber: commonModel.SN || 'Unknown',
        supportedModels
      };
    } catch (error) {
      await reader.disconnect();
      throw new Error(`Device discovery failed: ${error.message}`);
    }
  }

  /**
   * Connect to a SunSpec device
   */
  async connectToDevice(deviceId: string, config: SunSpecConfig): Promise<void> {
    try {
      const reader = new SunSpecReader(config.host, config.port, config.unitId);
      await reader.connect();
      
      this.connections.set(deviceId, reader);
      this.connectionStates.set(deviceId, 'connected');
      
      console.log(`✅ Connected to SunSpec device ${deviceId} at ${config.host}:${config.port}`);
      this.emit('deviceConnected', deviceId);
      
    } catch (error) {
      this.connectionStates.set(deviceId, 'error');
      this.emit('connectionError', deviceId, error);
      throw error;
    }
  }

  /**
   * Disconnect from a SunSpec device
   */
  async disconnectFromDevice(deviceId: string): Promise<void> {
    const reader = this.connections.get(deviceId);
    if (reader) {
      await reader.disconnect();
      this.connections.delete(deviceId);
      this.connectionStates.set(deviceId, 'disconnected');
      
      console.log(`🔌 Disconnected from SunSpec device ${deviceId}`);
      this.emit('deviceDisconnected', deviceId);
    }
  }

  /**
   * Read data from a SunSpec device
   */
  async readDeviceData(deviceId: string, models: number[] = [103]): Promise<SunSpecData[]> {
    const reader = this.connections.get(deviceId);
    if (!reader) {
      throw new Error(`Device ${deviceId} not connected`);
    }

    const results: SunSpecData[] = [];

    try {
      for (const modelId of models) {
        const modelData = await reader.readModel(modelId);
        
        results.push({
          timestamp: new Date(),
          model: modelId,
          registers: new Map(Object.entries(modelData)),
          rawData: modelData
        });
      }

      this.emit('dataRead', deviceId, results);
      return results;

    } catch (error) {
      this.emit('readError', deviceId, error);
      throw error;
    }
  }

  /**
   * Start polling a device
   */
  async startPolling(deviceId: string, config: SunSpecConfig): Promise<void> {
    if (this.pollingIntervals.has(deviceId)) {
      this.stopPolling(deviceId);
    }

    const interval = setInterval(async () => {
      try {
        const data = await this.readDeviceData(deviceId, config.models);
        this.emit('pollingData', deviceId, data);
      } catch (error) {
        this.emit('pollingError', deviceId, error);
        await this.handlePollingError(deviceId, error);
      }
    }, config.pollingInterval * 1000);

    this.pollingIntervals.set(deviceId, interval);
    console.log(`📊 Started polling device ${deviceId} every ${config.pollingInterval} seconds`);
  }

  /**
   * Stop polling a device
   */
  stopPolling(deviceId: string): void {
    const interval = this.pollingIntervals.get(deviceId);
    if (interval) {
      clearInterval(interval);
      this.pollingIntervals.delete(deviceId);
      console.log(`⏹️ Stopped polling device ${deviceId}`);
    }
  }

  /**
   * Get connection status for a device
   */
  getConnectionStatus(deviceId: string): 'connected' | 'disconnected' | 'error' {
    return this.connectionStates.get(deviceId) || 'disconnected';
  }

  /**
   * Transform SunSpec data to DeviceData format
   */
  transformToDeviceData(deviceId: string, sunspecData: SunSpecData[]): DeviceData {
    // Find Model 103 (inverter) data
    const inverterData = sunspecData.find(data => data.model === 103);
    if (!inverterData) {
      throw new Error('No inverter data (Model 103) found');
    }

    const registers = inverterData.registers;
    
    return {
      deviceId,
      timestamp: inverterData.timestamp,
      power: this.scaleValue(registers.get('W'), registers.get('W_SF')),
      voltage: this.scaleValue(registers.get('PPVphAB'), registers.get('V_SF')),
      current: this.scaleValue(registers.get('AphA'), registers.get('A_SF')),
      temperature: this.scaleValue(registers.get('TmpCab'), registers.get('Tmp_SF')),
      irradiance: null, // Not available in standard SunSpec Model 103
      efficiency: this.calculateEfficiency(registers),
      energyToday: this.scaleValue(registers.get('WH'), registers.get('WH_SF')) / 1000, // Convert to kWh
      energyTotal: this.scaleValue(registers.get('WH'), registers.get('WH_SF')) / 1000, // Convert to kWh
      status: this.mapDeviceStatus(registers.get('St'))
    };
  }

  /**
   * Discover available SunSpec models on device
   */
  private async discoverModels(reader: SunSpecReader): Promise<number[]> {
    const supportedModels: number[] = [];
    
    // Common models to check
    const modelsToCheck = [1, 103, 113, 160, 701, 702, 703];
    
    for (const modelId of modelsToCheck) {
      try {
        await reader.readModel(modelId);
        supportedModels.push(modelId);
      } catch (error) {
        // Model not supported, continue
      }
    }
    
    return supportedModels;
  }

  /**
   * Handle polling errors with retry logic
   */
  private async handlePollingError(deviceId: string, error: Error): Promise<void> {
    console.error(`❌ Polling error for device ${deviceId}:`, error.message);
    
    // Set status to error
    this.connectionStates.set(deviceId, 'error');
    
    // Attempt to reconnect
    setTimeout(async () => {
      try {
        const reader = this.connections.get(deviceId);
        if (reader) {
          await reader.reconnect();
          this.connectionStates.set(deviceId, 'connected');
          console.log(`🔄 Reconnected to device ${deviceId}`);
        }
      } catch (reconnectError) {
        console.error(`❌ Failed to reconnect to device ${deviceId}:`, reconnectError.message);
      }
    }, 5000); // Retry after 5 seconds
  }

  /**
   * Setup global error handling
   */
  private setupErrorHandling(): void {
    this.on('error', (error) => {
      console.error('❌ SunSpecService error:', error);
    });
  }

  /**
   * Scale SunSpec values using scale factors
   */
  private scaleValue(value: number, scaleFactor: number): number {
    if (value === null || value === undefined || scaleFactor === null || scaleFactor === undefined) {
      return 0;
    }
    return value * Math.pow(10, scaleFactor);
  }

  /**
   * Calculate efficiency from SunSpec registers
   */
  private calculateEfficiency(registers: Map<string, any>): number {
    const acPower = this.scaleValue(registers.get('W'), registers.get('W_SF'));
    const dcPower = this.scaleValue(registers.get('DCW'), registers.get('DCW_SF'));
    
    if (dcPower > 0) {
      return Math.round((acPower / dcPower) * 100 * 100) / 100;
    }
    
    return 0;
  }

  /**
   * Map SunSpec status to DeviceStatus
   */
  private mapDeviceStatus(sunspecStatus: number): DeviceStatus {
    switch (sunspecStatus) {
      case 1: // Off
      case 2: // Sleeping
        return DeviceStatus.OFFLINE;
      case 3: // Starting
      case 4: // MPPT
      case 5: // Throttled
        return DeviceStatus.ONLINE;
      case 6: // Shutting down
      case 7: // Fault
      case 8: // Standby
        return DeviceStatus.ERROR;
      default:
        return DeviceStatus.OFFLINE;
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    // Stop all polling
    for (const [deviceId] of this.pollingIntervals) {
      this.stopPolling(deviceId);
    }

    // Disconnect all devices
    const disconnectPromises = Array.from(this.connections.keys()).map(deviceId => 
      this.disconnectFromDevice(deviceId)
    );
    
    await Promise.all(disconnectPromises);
    
    console.log('🧹 SunSpecService cleaned up');
  }
}
```

### 1.2 Enhanced DataCollectionService Integration

```typescript
// src/services/DataCollectionService.ts (enhanced version)
import { Server } from 'socket.io';
import mqtt from 'mqtt';
import cron from 'node-cron';
import { DeviceData, DeviceStatus } from '@models/Device';
import { DatabaseDeviceService as DeviceService } from '@services/DatabaseDeviceService';
import { CommunicationProtocol } from '@prisma/client';
import { SunSpecService, SunSpecConfig } from '@services/SunSpecService';

export class DataCollectionService {
  private ioServer: Server;
  private mqttClient?: mqtt.MqttClient;
  private sunspecService: SunSpecService;
  private dataGeneratorIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(ioServer: Server) {
    this.ioServer = ioServer;
    this.sunspecService = new SunSpecService();
    
    this.initializeMQTT();
    this.initializeSunSpec();
    
    if (process.env.NODE_ENV === 'development') {
      this.startDataSimulation();
    }
    
    this.scheduleDataCleanup();
  }

  /**
   * Initialize SunSpec service with event handlers
   */
  private initializeSunSpec(): void {
    this.sunspecService.on('pollingData', async (deviceId: string, sunspecData: any[]) => {
      try {
        const deviceData = this.sunspecService.transformToDeviceData(deviceId, sunspecData);
        await this.processDeviceData(deviceData);
      } catch (error) {
        console.error(`❌ Error processing SunSpec data for device ${deviceId}:`, error);
      }
    });

    this.sunspecService.on('connectionError', (deviceId: string, error: Error) => {
      console.error(`❌ SunSpec connection error for device ${deviceId}:`, error);
      this.ioServer.to(`device-${deviceId}`).emit('device-error', {
        deviceId,
        error: error.message,
        timestamp: new Date()
      });
    });

    this.sunspecService.on('deviceConnected', (deviceId: string) => {
      console.log(`✅ SunSpec device ${deviceId} connected`);
      this.ioServer.to(`device-${deviceId}`).emit('device-connected', {
        deviceId,
        timestamp: new Date()
      });
    });

    this.sunspecService.on('deviceDisconnected', (deviceId: string) => {
      console.log(`🔌 SunSpec device ${deviceId} disconnected`);
      this.ioServer.to(`device-${deviceId}`).emit('device-disconnected', {
        deviceId,
        timestamp: new Date()
      });
    });

    console.log('✅ SunSpec service initialized');
  }

  /**
   * Start SunSpec data collection for a device
   */
  public async startSunSpecDeviceCollection(deviceId: string): Promise<void> {
    try {
      const devices = await DeviceService.getAllDevices();
      const device = devices.find(d => d.id === deviceId);
      
      if (!device) {
        throw new Error('Device not found');
      }

      if (device.configuration.communicationProtocol !== CommunicationProtocol.MODBUS) {
        throw new Error('Device is not configured for Modbus communication');
      }

      const modbusConfig = device.configuration.modbus;
      if (!modbusConfig || !modbusConfig.tcp) {
        throw new Error('Modbus TCP configuration not found');
      }

      const sunspecConfig: SunSpecConfig = {
        host: modbusConfig.tcp.host,
        port: modbusConfig.tcp.port || 502,
        unitId: modbusConfig.tcp.unitId || 1,
        timeout: modbusConfig.tcp.timeout || 5000,
        retryAttempts: modbusConfig.tcp.retryAttempts || 3,
        pollingInterval: modbusConfig.sunspec?.pollingInterval || device.configuration.dataCollectionInterval || 30,
        models: modbusConfig.sunspec?.models || [103]
      };

      // Connect to device
      await this.sunspecService.connectToDevice(deviceId, sunspecConfig);
      
      // Start polling
      await this.sunspecService.startPolling(deviceId, sunspecConfig);
      
      console.log(`📊 Started SunSpec data collection for device ${deviceId}`);
      
    } catch (error) {
      console.error(`❌ Error starting SunSpec data collection for device ${deviceId}:`, error);
      throw error;
    }
  }

  /**
   * Stop SunSpec data collection for a device
   */
  public async stopSunSpecDeviceCollection(deviceId: string): Promise<void> {
    try {
      this.sunspecService.stopPolling(deviceId);
      await this.sunspecService.disconnectFromDevice(deviceId);
      
      console.log(`⏹️ Stopped SunSpec data collection for device ${deviceId}`);
      
    } catch (error) {
      console.error(`❌ Error stopping SunSpec data collection for device ${deviceId}:`, error);
      throw error;
    }
  }

  /**
   * Discover SunSpec device
   */
  public async discoverSunSpecDevice(host: string, port: number = 502, unitId: number = 1): Promise<any> {
    try {
      const config: SunSpecConfig = {
        host,
        port,
        unitId,
        timeout: 5000,
        retryAttempts: 3,
        pollingInterval: 30,
        models: [1, 103]
      };

      const deviceInfo = await this.sunspecService.discoverDevice(config);
      console.log(`🔍 Discovered SunSpec device at ${host}:${port}:`, deviceInfo);
      
      return deviceInfo;
      
    } catch (error) {
      console.error(`❌ Error discovering SunSpec device at ${host}:${port}:`, error);
      throw error;
    }
  }

  /**
   * Get SunSpec device connection status
   */
  public getSunSpecDeviceStatus(deviceId: string): string {
    return this.sunspecService.getConnectionStatus(deviceId);
  }

  /**
   * Enhanced device data collection start method
   */
  public async startDeviceDataCollection(deviceId: string): Promise<void> {
    try {
      const devices = await DeviceService.getAllDevices();
      const device = devices.find(d => d.id === deviceId);
      
      if (!device) {
        throw new Error('Device not found');
      }

      // Stop existing collection if any
      await this.stopDeviceDataCollection(deviceId);

      // Start appropriate collection based on communication protocol
      switch (device.configuration.communicationProtocol) {
        case CommunicationProtocol.MODBUS:
          await this.startSunSpecDeviceCollection(deviceId);
          break;
          
        case CommunicationProtocol.MQTT:
          if (this.mqttClient) {
            this.mqttClient.subscribe(`fulsk/devices/${deviceId}/data`);
            console.log(`📡 Started MQTT data collection for device ${deviceId}`);
          }
          break;
          
        case CommunicationProtocol.HTTP:
          // HTTP polling would be implemented here
          console.log(`🌐 HTTP data collection not yet implemented for device ${deviceId}`);
          break;
          
        default:
          if (process.env.NODE_ENV === 'development') {
            this.startSimulatedDataCollection(deviceId, device);
          }
          break;
      }
      
    } catch (error) {
      console.error(`❌ Error starting data collection for device ${deviceId}:`, error);
      throw error;
    }
  }

  /**
   * Enhanced device data collection stop method
   */
  public async stopDeviceDataCollection(deviceId: string): Promise<void> {
    try {
      // Stop SunSpec collection
      await this.stopSunSpecDeviceCollection(deviceId);
      
      // Stop MQTT subscription
      if (this.mqttClient) {
        this.mqttClient.unsubscribe(`fulsk/devices/${deviceId}/data`);
      }
      
      // Stop simulated data collection
      const interval = this.dataGeneratorIntervals.get(deviceId);
      if (interval) {
        clearInterval(interval);
        this.dataGeneratorIntervals.delete(deviceId);
      }
      
      console.log(`⏹️ Stopped all data collection for device ${deviceId}`);
      
    } catch (error) {
      console.error(`❌ Error stopping data collection for device ${deviceId}:`, error);
    }
  }

  // ... rest of existing methods ...

  /**
   * Cleanup all resources
   */
  public async cleanup(): Promise<void> {
    // Clear all intervals
    for (const [deviceId, interval] of this.dataGeneratorIntervals) {
      clearInterval(interval);
    }
    this.dataGeneratorIntervals.clear();

    // Close MQTT connection
    if (this.mqttClient) {
      this.mqttClient.end();
    }

    // Cleanup SunSpec service
    await this.sunspecService.cleanup();

    console.log('🧹 Data collection service cleaned up');
  }
}
```

## 2. Database Migration

```typescript
// prisma/migrations/add_sunspec_support.sql
-- Add SunSpec configuration fields to Device table
ALTER TABLE "devices" ADD COLUMN "modbusHost" TEXT;
ALTER TABLE "devices" ADD COLUMN "modbusPort" INTEGER;
ALTER TABLE "devices" ADD COLUMN "modbusUnitId" INTEGER;
ALTER TABLE "devices" ADD COLUMN "sunspecModels" JSONB;
ALTER TABLE "devices" ADD COLUMN "connectionTimeout" INTEGER;
ALTER TABLE "devices" ADD COLUMN "readTimeout" INTEGER;
ALTER TABLE "devices" ADD COLUMN "retryAttempts" INTEGER;
ALTER TABLE "devices" ADD COLUMN "pollingInterval" INTEGER;
ALTER TABLE "devices" ADD COLUMN "registerOffset" INTEGER;
ALTER TABLE "devices" ADD COLUMN "byteOrder" TEXT;

-- Add extended data fields to DeviceData table
ALTER TABLE "device_data" ADD COLUMN "acFrequency" DOUBLE PRECISION;
ALTER TABLE "device_data" ADD COLUMN "apparentPower" DOUBLE PRECISION;
ALTER TABLE "device_data" ADD COLUMN "reactivePower" DOUBLE PRECISION;
ALTER TABLE "device_data" ADD COLUMN "powerFactor" DOUBLE PRECISION;
ALTER TABLE "device_data" ADD COLUMN "dcVoltage" DOUBLE PRECISION;
ALTER TABLE "device_data" ADD COLUMN "dcCurrent" DOUBLE PRECISION;
ALTER TABLE "device_data" ADD COLUMN "dcPower" DOUBLE PRECISION;
ALTER TABLE "device_data" ADD COLUMN "voltageL1" DOUBLE PRECISION;
ALTER TABLE "device_data" ADD COLUMN "voltageL2" DOUBLE PRECISION;
ALTER TABLE "device_data" ADD COLUMN "voltageL3" DOUBLE PRECISION;
ALTER TABLE "device_data" ADD COLUMN "currentL1" DOUBLE PRECISION;
ALTER TABLE "device_data" ADD COLUMN "currentL2" DOUBLE PRECISION;
ALTER TABLE "device_data" ADD COLUMN "currentL3" DOUBLE PRECISION;
ALTER TABLE "device_data" ADD COLUMN "inverterState" TEXT;
ALTER TABLE "device_data" ADD COLUMN "eventFlags" JSONB;

-- Create SunSpec configuration table
CREATE TABLE "sunspec_configurations" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "discoveredModels" JSONB NOT NULL,
    "modelConfigs" JSONB NOT NULL,
    "lastDiscovery" TIMESTAMP(3),
    "isConfigured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sunspec_configurations_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE UNIQUE INDEX "sunspec_configurations_deviceId_key" ON "sunspec_configurations"("deviceId");
CREATE INDEX "sunspec_configurations_lastDiscovery_idx" ON "sunspec_configurations"("lastDiscovery");

-- Add foreign key constraints
ALTER TABLE "sunspec_configurations" ADD CONSTRAINT "sunspec_configurations_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

## 3. API Endpoints

```typescript
// src/api/sunspec.ts
import { Router, Request, Response } from 'express';
import { authenticate } from '@middleware/auth';
import { DataCollectionService } from '@services/DataCollectionService';
import { DatabaseDeviceService as DeviceService } from '@services/DatabaseDeviceService';

const router = Router();

/**
 * POST /api/sunspec/discover
 * Discover SunSpec device at given address
 */
router.post('/discover', authenticate, async (req: Request, res: Response) => {
  try {
    const { host, port = 502, unitId = 1 } = req.body;
    
    if (!host) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Host address is required'
      });
    }

    // This would need to be injected or accessed differently in real implementation
    const dataCollectionService = req.app.get('dataCollectionService') as DataCollectionService;
    
    const deviceInfo = await dataCollectionService.discoverSunSpecDevice(host, port, unitId);
    
    res.json({
      message: 'Device discovered successfully',
      data: deviceInfo
    });
    
  } catch (error) {
    res.status(500).json({
      error: 'Discovery Failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/sunspec/devices/:id/connect
 * Connect to SunSpec device
 */
router.post('/devices/:id/connect', authenticate, async (req: Request, res: Response) => {
  try {
    const deviceId = req.params.id;
    const userId = req.user!.userId;
    
    // Verify user has access to device
    const device = await DeviceService.getDeviceById(deviceId, userId);
    if (!device) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Device not found'
      });
    }
    
    const dataCollectionService = req.app.get('dataCollectionService') as DataCollectionService;
    await dataCollectionService.startSunSpecDeviceCollection(deviceId);
    
    res.json({
      message: 'Successfully connected to SunSpec device',
      deviceId
    });
    
  } catch (error) {
    const statusCode = error instanceof Error && error.message.includes('Access denied') ? 403 : 500;
    res.status(statusCode).json({
      error: statusCode === 403 ? 'Access Denied' : 'Connection Failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/sunspec/devices/:id/disconnect
 * Disconnect from SunSpec device
 */
router.post('/devices/:id/disconnect', authenticate, async (req: Request, res: Response) => {
  try {
    const deviceId = req.params.id;
    const userId = req.user!.userId;
    
    // Verify user has access to device
    const device = await DeviceService.getDeviceById(deviceId, userId);
    if (!device) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Device not found'
      });
    }
    
    const dataCollectionService = req.app.get('dataCollectionService') as DataCollectionService;
    await dataCollectionService.stopSunSpecDeviceCollection(deviceId);
    
    res.json({
      message: 'Successfully disconnected from SunSpec device',
      deviceId
    });
    
  } catch (error) {
    const statusCode = error instanceof Error && error.message.includes('Access denied') ? 403 : 500;
    res.status(statusCode).json({
      error: statusCode === 403 ? 'Access Denied' : 'Disconnection Failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/sunspec/devices/:id/status
 * Get SunSpec device connection status
 */
router.get('/devices/:id/status', authenticate, async (req: Request, res: Response) => {
  try {
    const deviceId = req.params.id;
    const userId = req.user!.userId;
    
    // Verify user has access to device
    const device = await DeviceService.getDeviceById(deviceId, userId);
    if (!device) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Device not found'
      });
    }
    
    const dataCollectionService = req.app.get('dataCollectionService') as DataCollectionService;
    const status = dataCollectionService.getSunSpecDeviceStatus(deviceId);
    
    res.json({
      message: 'Device status retrieved successfully',
      data: {
        deviceId,
        status,
        timestamp: new Date()
      }
    });
    
  } catch (error) {
    const statusCode = error instanceof Error && error.message.includes('Access denied') ? 403 : 500;
    res.status(statusCode).json({
      error: statusCode === 403 ? 'Access Denied' : 'Status Check Failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
```

## 4. Frontend Components

```typescript
// client/src/components/SunSpecDiscovery.tsx
import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';

interface SunSpecDeviceInfo {
  manufacturer: string;
  model: string;
  version: string;
  serialNumber: string;
  supportedModels: number[];
}

interface SunSpecDiscoveryProps {
  onDeviceDiscovered: (deviceInfo: SunSpecDeviceInfo & { host: string; port: number; unitId: number }) => void;
}

export const SunSpecDiscovery: React.FC<SunSpecDiscoveryProps> = ({ onDeviceDiscovered }) => {
  const [host, setHost] = useState('');
  const [port, setPort] = useState(502);
  const [unitId, setUnitId] = useState(1);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discoveredDevice, setDiscoveredDevice] = useState<SunSpecDeviceInfo | null>(null);

  const handleDiscover = async () => {
    if (!host) {
      setError('Please enter a host address');
      return;
    }

    setIsDiscovering(true);
    setError(null);
    setDiscoveredDevice(null);

    try {
      const response = await fetch('/api/sunspec/discover', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ host, port, unitId })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Discovery failed');
      }

      const result = await response.json();
      setDiscoveredDevice(result.data);
      
      // Callback to parent component
      onDeviceDiscovered({ ...result.data, host, port, unitId });
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Discovery failed');
    } finally {
      setIsDiscovering(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Discover SunSpec Device</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="host">IP Address</Label>
          <Input
            id="host"
            type="text"
            placeholder="192.168.1.100"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            disabled={isDiscovering}
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="port">Port</Label>
            <Input
              id="port"
              type="number"
              value={port}
              onChange={(e) => setPort(parseInt(e.target.value))}
              disabled={isDiscovering}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="unitId">Unit ID</Label>
            <Input
              id="unitId"
              type="number"
              value={unitId}
              onChange={(e) => setUnitId(parseInt(e.target.value))}
              disabled={isDiscovering}
            />
          </div>
        </div>

        <Button 
          onClick={handleDiscover} 
          disabled={isDiscovering || !host}
          className="w-full"
        >
          {isDiscovering && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isDiscovering ? 'Discovering...' : 'Discover Device'}
        </Button>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {discoveredDevice && (
          <Alert>
            <AlertDescription>
              <div className="space-y-1">
                <div><strong>Manufacturer:</strong> {discoveredDevice.manufacturer}</div>
                <div><strong>Model:</strong> {discoveredDevice.model}</div>
                <div><strong>Serial:</strong> {discoveredDevice.serialNumber}</div>
                <div><strong>Supported Models:</strong> {discoveredDevice.supportedModels.join(', ')}</div>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};
```

## 5. Configuration Examples

### 5.1 Environment Variables

```env
# SunSpec/Modbus Configuration
SUNSPEC_DEFAULT_PORT=502
SUNSPEC_CONNECTION_TIMEOUT=5000
SUNSPEC_READ_TIMEOUT=3000
SUNSPEC_MAX_RETRY_ATTEMPTS=3
SUNSPEC_DEFAULT_POLLING_INTERVAL=30
SUNSPEC_AUTO_RECONNECT=true
SUNSPEC_CONNECTION_POOL_SIZE=50
SUNSPEC_MAX_CONCURRENT_CONNECTIONS=10
SUNSPEC_HEALTH_CHECK_INTERVAL=60
SUNSPEC_RETRY_DELAY_BASE=1000
SUNSPEC_RETRY_DELAY_MAX=30000
```

### 5.2 Device Configuration JSON

```json
{
  "name": "Solar Inverter #1",
  "type": "INVERTER",
  "manufacturer": "SMA",
  "model": "STP 60-10",
  "serialNumber": "2130123456",
  "firmwareVersion": "3.20.25.R",
  "location": {
    "address": "123 Solar Street",
    "city": "Sunnyville",
    "state": "CA",
    "country": "USA",
    "zipCode": "90210",
    "coordinates": {
      "latitude": 34.0522,
      "longitude": -118.2437
    },
    "timezone": "America/Los_Angeles"
  },
  "configuration": {
    "communicationProtocol": "MODBUS",
    "dataCollectionInterval": 30,
    "modbus": {
      "tcp": {
        "host": "192.168.1.100",
        "port": 502,
        "unitId": 1,
        "timeout": 5000,
        "retryAttempts": 3
      },
      "sunspec": {
        "models": [1, 103, 113],
        "autoDiscover": true,
        "pollingInterval": 30,
        "registerOffset": 40000,
        "byteOrder": "big-endian"
      }
    },
    "alertThresholds": {
      "minPower": 100,
      "maxTemperature": 65,
      "minVoltage": 200,
      "maxVoltage": 280,
      "minEfficiency": 80
    },
    "notifications": {
      "email": true,
      "sms": false,
      "push": true
    }
  }
}
```

This implementation provides a comprehensive foundation for SunSpec/Modbus TCP integration with proper error handling, real-time capabilities, and extensible architecture.