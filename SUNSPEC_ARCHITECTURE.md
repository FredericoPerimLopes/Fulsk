# SunSpec/Modbus TCP Integration Architecture for Fulsk

## Executive Summary

This document outlines the comprehensive architecture for integrating SunSpec protocol over Modbus TCP/IP into the Fulsk solar monitoring application. The integration will enable real-time communication with solar inverters from various manufacturers using the industry-standard SunSpec specification.

## 1. SunSpec Protocol Research Summary

### 1.1 Protocol Overview
- **SunSpec**: Open standard for communicating with solar inverters and energy management devices
- **Transport**: Modbus TCP/IP (standard port 502)
- **Models**: Standardized register maps (Model 103 for 3-phase inverters, Model 113 for EV charging)
- **Interoperability**: IEEE 1547-2018 compliant, supported by major manufacturers (SMA, Fronius, SolarEdge, ABB)

### 1.2 Technical Characteristics
- **Register Range**: Typically 40070-40120 for Model 103 (45 registers)
- **Data Types**: 16-bit and 32-bit values with scaling factors
- **Common Data Points**: AC/DC voltage, current, power, frequency, energy, temperature, efficiency
- **Device Discovery**: Well-known base addresses starting with 'SunS' identifier (0x53756e53)

### 1.3 Node.js Integration
- **Primary Library**: `@svrooij/sunspec` - TypeScript-based SunSpec client
- **Fallback Libraries**: `jsmodbus`, `modbus-serial` for general Modbus TCP
- **Protocol Support**: Standard Modbus function codes with SunSpec application layer

## 2. Current Architecture Analysis

### 2.1 Existing System Components
```
Current Fulsk Architecture:
├── Express Backend (TypeScript)
├── Real-time WebSocket (Socket.io)
├── Device Management (DeviceService)
├── Data Collection (DataCollectionService)
├── Database Layer (Prisma + PostgreSQL/TimescaleDB)
├── React Frontend
└── MQTT Support (existing)
```

### 2.2 Existing Device Model
- **DeviceType**: Already includes `INVERTER` enum
- **CommunicationProtocol**: Already includes `MODBUS` enum
- **DeviceData**: Compatible with SunSpec data points
- **Real-time Pipeline**: WebSocket broadcasting ready

### 2.3 Integration Points
- Extend `DataCollectionService` with SunSpec client
- Enhance device configuration for Modbus TCP settings
- Modify database schema for SunSpec-specific parameters
- Add real-time monitoring capabilities

## 3. Integration Architecture Design

### 3.1 High-Level Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Solar         │    │   Fulsk          │    │   Frontend      │
│   Inverters     │◄───┤   Backend        │◄───┤   Dashboard     │
│   (SunSpec)     │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                        │
    Modbus TCP/IP            WebSocket                React UI
    Port 502                 Real-time                Monitoring
                                                      
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   SunSpec       │    │   Data           │    │   TimescaleDB   │
│   Client        │───►│   Collection     │───►│   Time Series   │
│   Service       │    │   Pipeline       │    │   Storage       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### 3.2 Component Architecture

```
SunSpecService
├── Connection Manager (Pool management, Health checks)
├── Model Discovery (Auto-detect supported models)
├── Data Reader (Scheduled polling, Real-time monitoring)
├── Error Handler (Retry logic, Connection recovery)
└── Data Mapper (SunSpec → DeviceData transformation)

DataCollectionService (Enhanced)
├── MQTT Handler (existing)
├── HTTP Handler (existing)
├── SunSpec Handler (new)
└── WebSocket Broadcaster (existing)
```

## 4. Database Schema Extensions

### 4.1 Device Configuration Extensions
```prisma
model Device {
  // ... existing fields ...
  
  // SunSpec/Modbus TCP Configuration
  modbusHost        String?     // IP address of inverter
  modbusPort        Int?        // Modbus port (default 502)
  modbusUnitId      Int?        // Modbus unit/slave ID
  sunspecModels     Json?       // Array of supported SunSpec models
  
  // Connection Settings
  connectionTimeout Int?        // Connection timeout in ms
  readTimeout       Int?        // Read timeout in ms
  retryAttempts     Int?        // Max retry attempts
  pollingInterval   Int?        // Data polling interval in seconds
  
  // Advanced Settings
  registerOffset    Int?        // Custom register offset if needed
  byteOrder         String?     // Big/Little endian configuration
  
  @@map("devices")
}
```

### 4.2 Enhanced DeviceData Model
```prisma
model DeviceData {
  // ... existing fields ...
  
  // Extended SunSpec Data Points
  acFrequency       Float?      // Hz
  apparentPower     Float?      // VA
  reactivePower     Float?      // VAR
  powerFactor       Float?      // Power factor
  dcVoltage         Float?      // DC voltage
  dcCurrent         Float?      // DC current
  dcPower           Float?      // DC power
  
  // Phase-specific data (3-phase inverters)
  voltageL1         Float?      // Phase 1 voltage
  voltageL2         Float?      // Phase 2 voltage
  voltageL3         Float?      // Phase 3 voltage
  currentL1         Float?      // Phase 1 current
  currentL2         Float?      // Phase 2 current
  currentL3         Float?      // Phase 3 current
  
  // Inverter specific
  inverterState     String?     // Operating state
  eventFlags        Json?       // Event/alarm flags from inverter
  
  @@map("device_data")
}
```

### 4.3 New SunSpec Configuration Model
```prisma
model SunSpecConfiguration {
  id                String      @id @default(cuid())
  deviceId          String      @unique
  discoveredModels  Json        // Array of discovered SunSpec models
  modelConfigs      Json        // Configuration for each model
  lastDiscovery     DateTime?   // Last model discovery
  isConfigured      Boolean     @default(false)
  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt
  
  // Relationships
  device            Device      @relation(fields: [deviceId], references: [id], onDelete: Cascade)
  
  @@map("sunspec_configurations")
}
```

## 5. Service Layer Implementation

### 5.1 SunSpecService Architecture
```typescript
export class SunSpecService {
  private connectionPool: Map<string, SunSpecClient> = new Map();
  private pollingIntervals: Map<string, NodeJS.Timeout> = new Map();
  
  async discoverDevice(host: string, port: number, unitId: number): Promise<SunSpecDeviceInfo>
  async connectToDevice(deviceId: string, config: SunSpecConfig): Promise<void>
  async readDeviceData(deviceId: string): Promise<SunSpecData>
  async startPolling(deviceId: string): Promise<void>
  async stopPolling(deviceId: string): Promise<void>
  private handleConnectionError(deviceId: string, error: Error): Promise<void>
  private mapSunSpecToDeviceData(sunspecData: SunSpecData): DeviceData
}
```

### 5.2 Enhanced DataCollectionService
```typescript
export class DataCollectionService {
  private sunspecService: SunSpecService;
  
  constructor(ioServer: Server) {
    this.ioServer = ioServer;
    this.sunspecService = new SunSpecService();
    this.initializeMQTT();
    this.initializeSunSpec(); // New initialization
  }
  
  private async initializeSunSpec(): Promise<void>
  async startSunSpecDeviceCollection(deviceId: string): Promise<void>
  async stopSunSpecDeviceCollection(deviceId: string): Promise<void>
  private async processSunSpecData(data: DeviceData): Promise<void>
}
```

## 6. Configuration Management

### 6.1 Device Configuration Format
```json
{
  "communicationProtocol": "MODBUS",
  "modbus": {
    "tcp": {
      "host": "192.168.1.100",
      "port": 502,
      "unitId": 1,
      "timeout": 5000,
      "retryAttempts": 3
    },
    "sunspec": {
      "models": [103, 113],
      "autoDiscover": true,
      "pollingInterval": 30,
      "registerOffset": 40000
    }
  },
  "dataCollectionInterval": 30,
  "alertThresholds": {
    "minPower": 100,
    "maxTemperature": 65,
    "minVoltage": 200,
    "maxVoltage": 280,
    "minEfficiency": 80
  }
}
```

### 6.2 Environment Configuration
```env
# SunSpec/Modbus Configuration
SUNSPEC_DEFAULT_PORT=502
SUNSPEC_CONNECTION_TIMEOUT=5000
SUNSPEC_READ_TIMEOUT=3000
SUNSPEC_MAX_RETRY_ATTEMPTS=3
SUNSPEC_DEFAULT_POLLING_INTERVAL=30
SUNSPEC_AUTO_RECONNECT=true
SUNSPEC_CONNECTION_POOL_SIZE=50
```

## 7. Data Flow Architecture

### 7.1 Real-time Data Pipeline
```
Inverter → SunSpec/Modbus TCP → SunSpecService → DataCollectionService → WebSocket → Frontend
                                      ↓
                               DatabaseService → TimescaleDB
                                      ↓
                               AlertService → Notifications
```

### 7.2 Data Processing Flow
1. **Connection Establishment**: Automatic device discovery and connection pooling
2. **Model Discovery**: Identify supported SunSpec models (103, 113, etc.)
3. **Data Polling**: Scheduled register reads based on polling interval
4. **Data Transformation**: Map SunSpec registers to DeviceData model
5. **Real-time Broadcasting**: WebSocket emission to connected clients
6. **Database Storage**: Time-series storage in TimescaleDB
7. **Alert Processing**: Threshold checking and notification triggering

## 8. Error Handling & Resilience

### 8.1 Connection Management
- **Connection Pooling**: Reuse TCP connections for efficiency
- **Health Checks**: Periodic connection validation
- **Automatic Reconnection**: Exponential backoff retry strategy
- **Timeout Handling**: Configurable connection and read timeouts

### 8.2 Error Recovery Strategies
```typescript
interface ErrorRecoveryConfig {
  maxRetryAttempts: number;
  baseRetryDelay: number;
  maxRetryDelay: number;
  exponentialBackoff: boolean;
  circuitBreakerThreshold: number;
  reconnectInterval: number;
}
```

### 8.3 Data Validation
- **Register Validation**: Ensure read data is within expected ranges
- **Model Validation**: Verify SunSpec model compatibility
- **Data Integrity**: Checksum validation and duplicate detection
- **Graceful Degradation**: Continue operation with partial data

## 9. Security Considerations

### 9.1 Network Security
- **Network Isolation**: Recommend VLAN segregation for Modbus network
- **Firewall Rules**: Restrict access to port 502 from authorized systems only
- **IP Whitelisting**: Configure inverter IP ranges in application
- **TLS Consideration**: Note that standard Modbus TCP is unencrypted

### 9.2 Application Security
- **Input Validation**: Sanitize all network inputs and configuration data
- **Access Control**: Verify user permissions for device configuration
- **Audit Logging**: Log all configuration changes and connection attempts
- **Rate Limiting**: Prevent excessive polling that could impact inverter performance

### 9.3 Data Security
- **Data Encryption**: Encrypt sensitive configuration data at rest
- **Authentication**: Secure API endpoints for device configuration
- **Data Retention**: Implement proper data lifecycle management
- **Privacy Compliance**: Ensure compliance with data protection regulations

## 10. Performance Optimization

### 10.1 Connection Optimization
- **Connection Pooling**: Maintain persistent connections to reduce overhead
- **Batch Reading**: Read multiple registers in single requests when possible
- **Intelligent Polling**: Adjust polling frequency based on data criticality
- **Load Balancing**: Distribute polling load across multiple service instances

### 10.2 Data Optimization
- **Selective Reading**: Only poll necessary data points based on user needs
- **Data Compression**: Compress historical data for storage efficiency
- **Caching Strategy**: Cache frequently accessed configuration data
- **Database Indexing**: Optimize TimescaleDB indexes for time-series queries

## 11. Monitoring & Observability

### 11.1 Service Monitoring
- **Connection Status**: Track active connections and health status
- **Data Flow Metrics**: Monitor data ingestion rates and processing times
- **Error Rates**: Track connection failures and retry statistics
- **Performance Metrics**: Monitor response times and throughput

### 11.2 Alerting Strategy
- **Connection Alerts**: Notify on persistent connection failures
- **Data Quality Alerts**: Alert on missing or invalid data
- **Performance Alerts**: Notify on degraded performance or high error rates
- **Security Alerts**: Alert on suspicious connection attempts

## 12. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
- [ ] Install and configure SunSpec library dependencies
- [ ] Extend database schema with SunSpec-specific fields
- [ ] Implement basic SunSpecService with connection management
- [ ] Create device configuration UI for Modbus TCP settings

### Phase 2: Core Integration (Week 3-4)
- [ ] Implement SunSpec device discovery and model detection
- [ ] Integrate SunSpecService with DataCollectionService
- [ ] Add data transformation and mapping logic
- [ ] Implement error handling and retry mechanisms

### Phase 3: Real-time Features (Week 5)
- [ ] Enable real-time data streaming via WebSocket
- [ ] Implement polling management and scheduling
- [ ] Add connection health monitoring
- [ ] Create SunSpec-specific dashboard components

### Phase 4: Advanced Features (Week 6)
- [ ] Implement advanced error recovery and circuit breakers
- [ ] Add performance monitoring and metrics
- [ ] Implement security hardening measures
- [ ] Create comprehensive testing suite

### Phase 5: Production Readiness (Week 7-8)
- [ ] Performance optimization and load testing
- [ ] Documentation and deployment guides
- [ ] User training materials
- [ ] Production deployment and monitoring setup

## 13. Testing Strategy

### 13.1 Unit Testing
- SunSpecService connection methods
- Data transformation functions
- Error handling scenarios
- Configuration validation

### 13.2 Integration Testing
- End-to-end data flow testing
- Real inverter communication testing
- Database integration testing
- WebSocket real-time testing

### 13.3 Performance Testing
- Connection pooling under load
- High-frequency polling scenarios
- Large-scale device management
- Database performance with time-series data

## 14. Deployment Considerations

### 14.1 Infrastructure Requirements
- Network connectivity to inverter Modbus TCP ports
- Adequate server resources for connection pooling
- TimescaleDB optimization for time-series workloads
- Monitoring and alerting infrastructure

### 14.2 Configuration Management
- Environment-specific configuration files
- Secure storage of sensitive configuration data
- Version control for device configurations
- Automated deployment and rollback procedures

## Conclusion

This architecture provides a comprehensive framework for integrating SunSpec/Modbus TCP communication into the Fulsk solar monitoring application. The design emphasizes reliability, scalability, and maintainability while leveraging existing system components and ensuring seamless user experience.

The modular approach allows for incremental implementation and testing, while the robust error handling and security considerations ensure production-ready deployment. The architecture supports future expansion to additional SunSpec models and can accommodate various inverter manufacturers and configurations.