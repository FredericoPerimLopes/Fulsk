# SunSpec Database Schema Extension

## Overview

This document describes the comprehensive database schema extensions for SunSpec inverter data support in the Fulsk solar monitoring application. The extensions provide full support for SunSpec Common Models 101, 102, 103, and 160, with optimized time-series storage and performance features.

## Schema Architecture

### New Models

#### 1. InverterData
**Purpose**: Time-series storage for comprehensive SunSpec inverter measurements  
**Key Features**:
- Composite primary key `[deviceId, timestamp]` for TimescaleDB optimization
- Complete AC measurements (single/split/three-phase support)
- DC measurements with separate tracking
- Energy counters (lifetime and daily)
- Temperature monitoring (cabinet, heat sink, transformer, other)
- Operating states and event bitfields
- Scale factors for proper data interpretation
- Automatic efficiency calculation

**Indexes**:
- `timestamp` - Time-series queries
- `deviceId, sunspecModel` - Device-specific model queries
- `operatingState` - Fault detection
- `deviceId, timestamp DESC, sunspecModel` - Time-range analytics
- Power and temperature monitoring indexes

#### 2. InverterMpptModule
**Purpose**: MPPT module-specific data (SunSpec Model 160)  
**Key Features**:
- Per-module DC measurements and states
- Module identification and timestamps
- Temperature monitoring per module
- Event bitfields for module-specific faults
- Linked to InverterData for correlation

**Indexes**:
- `deviceId, timestamp` - Time-series per device
- `moduleId` - Module-specific queries
- `deviceId, moduleId, timestamp DESC, dcPower` - Performance analytics

#### 3. InverterConfiguration
**Purpose**: Device configuration and SunSpec model settings  
**Key Features**:
- Supported SunSpec models and primary model identification
- Device identification from SunSpec Model 1
- Nameplate ratings from Model 120
- Communication settings (SunSpec address, model offset)
- MPPT configuration
- One-to-one relationship with Device

#### 4. InverterDiagnostics
**Purpose**: Fault and event management with SunSpec event correlation  
**Key Features**:
- Structured event types with SunSpec event codes
- Bitfield analysis for common faults (ground fault, arc detection, etc.)
- Time-series event tracking with resolution timestamps
- JSON storage for additional event data
- Automatic severity classification

**Indexes**:
- `deviceId, timestamp` - Event timeline
- `eventType, severity` - Alert filtering
- `isActive` - Active fault monitoring
- Critical event prioritization

#### 5. SunSpecModel
**Purpose**: Model definitions and validation rules  
**Key Features**:
- Model specifications and block lengths
- JSON schema for data points with types, units, and scale factors
- Mandatory vs optional point definitions
- Support for all SunSpec model types

### Enhanced Enums

```typescript
enum InverterOperatingState {
  OFF, SLEEPING, STARTING, MPPT, THROTTLED, 
  SHUTTING_DOWN, FAULT, STANDBY, TEST, VENDOR_SPECIFIC
}

enum InverterEventType {
  GROUND_FAULT, INPUT_OVER_VOLTAGE, INPUT_UNDER_VOLTAGE,
  INPUT_OVER_CURRENT, DC_DISCONNECT, CABINET_OPEN,
  MANUAL_SHUTDOWN, OVER_TEMP, UNDER_TEMP, MEMORY_LOSS,
  ARC_DETECTION, TEST_FAILED, BLOWN_FUSE, HARDWARE_FAILURE,
  COMMUNICATION_ERROR, VENDOR_SPECIFIC
}

enum SunSpecModelType {
  COMMON, INVERTER, METER, BATTERY, TRACKER, EXTENSION
}
```

## SunSpec Model Support

### Model 101 - Single Phase Inverter
- **Data Points**: 50 registers
- **Key Measurements**: A, AphA, PhVphA, W, Hz (mandatory)
- **Optional**: Multi-phase support, power triangle, energy counters
- **Use Case**: Residential single-phase installations

### Model 102 - Split Phase Inverter
- **Data Points**: 50 registers
- **Key Measurements**: A, AphA, AphB, PhVphA, PhVphB, W, Hz (mandatory)
- **Features**: Dual-phase measurements, line-to-line voltages
- **Use Case**: North American split-phase residential systems

### Model 103 - Three Phase Inverter
- **Data Points**: 50 registers
- **Key Measurements**: Complete three-phase power measurements
- **Features**: Full power triangle (W, VA, VAr, PF), temperature monitoring
- **Use Case**: Commercial and industrial three-phase installations

### Model 160 - Multiple MPPT Extension
- **Data Points**: 28 registers + repeating blocks
- **Features**: Per-module DC measurements, module states, temperatures
- **Scaling**: Supports up to 32 MPPT modules per inverter
- **Use Case**: Large commercial inverters with multiple string inputs

## Performance Optimizations

### TimescaleDB Integration
- **Hypertables**: Automatic conversion with 1-day time chunks
- **Compression**: Data compression after 7 days (inverter_data, inverter_mppt_modules)
- **Retention Policies**: 
  - Inverter data: 5 years
  - MPPT data: 5 years  
  - Diagnostics: 2 years
- **Continuous Aggregates**: 
  - Daily power production summaries
  - Hourly MPPT performance summaries

### Advanced Indexing Strategy
```sql
-- Time-range analytics with model filtering
CREATE INDEX inverter_data_device_time_range_idx 
ON inverter_data (deviceId, timestamp DESC, sunspecModel);

-- Power analytics with null filtering
CREATE INDEX inverter_data_power_analytics_idx 
ON inverter_data (deviceId, timestamp DESC, acPower, dcPower) 
WHERE acPower IS NOT NULL OR dcPower IS NOT NULL;

-- Fault detection with state filtering
CREATE INDEX inverter_data_fault_detection_idx 
ON inverter_data (deviceId, operatingState, timestamp DESC) 
WHERE operatingState IN ('FAULT', 'ERROR', 'SHUTTING_DOWN');
```

### Data Validation and Automation

#### Automatic Data Validation
- SunSpec model number validation
- Power relationship validation (DC ≥ AC accounting for losses)
- Automatic efficiency calculation
- Scale factor application

#### Event Processing
- Automatic diagnostic event creation from bitfields
- Ground fault detection (bit 0 of eventBitfield1)
- Over-temperature monitoring (bit 7 of eventBitfield1)
- Arc detection alerts (bit 10 of eventBitfield1)

## Usage Examples

### Storing SunSpec Data
```typescript
// Model 103 three-phase inverter data
await prisma.inverterData.create({
  data: {
    deviceId: "inv_001",
    sunspecModel: 103,
    acCurrent: 25.5,
    acCurrentPhaseA: 8.5,
    acCurrentPhaseB: 8.3,
    acCurrentPhaseC: 8.7,
    acPower: 5500,
    dcPower: 5800,
    acFrequency: 60.0,
    operatingState: "MPPT",
    temperatureCabinet: 45.2
  }
});

// MPPT module data (Model 160)
await prisma.inverterMpptModule.create({
  data: {
    deviceId: "inv_001",
    moduleId: 1,
    dcCurrent: 8.5,
    dcVoltage: 450,
    dcPower: 3825,
    operatingState: "MPPT",
    temperature: 42.1
  }
});
```

### Querying Performance Data
```typescript
// Daily power production summary
const dailyProduction = await prisma.$queryRaw`
  SELECT 
    DATE(timestamp) as day,
    AVG(acPower) as avg_power,
    MAX(acPower) as peak_power,
    AVG(efficiency) as avg_efficiency
  FROM inverter_data 
  WHERE deviceId = ${deviceId}
    AND timestamp >= NOW() - INTERVAL '30 days'
  GROUP BY DATE(timestamp)
  ORDER BY day DESC
`;

// MPPT module comparison
const mpptPerformance = await prisma.inverterMpptModule.groupBy({
  by: ['moduleId'],
  where: {
    deviceId: deviceId,
    timestamp: {
      gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
    }
  },
  _avg: {
    dcPower: true,
    temperature: true
  },
  _max: {
    dcPower: true
  }
});
```

### Fault Detection
```typescript
// Active critical faults
const criticalFaults = await prisma.inverterDiagnostics.findMany({
  where: {
    deviceId: deviceId,
    isActive: true,
    severity: 'CRITICAL'
  },
  orderBy: {
    timestamp: 'desc'
  }
});

// Recent ground faults
const groundFaults = await prisma.inverterDiagnostics.findMany({
  where: {
    deviceId: deviceId,
    eventType: 'GROUND_FAULT',
    timestamp: {
      gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last week
    }
  }
});
```

## Migration Strategy

### Development Environment
1. Run migration: `npx prisma migrate dev`
2. Seed SunSpec models: `psql -f prisma/seed-sunspec-models.sql`
3. Verify TimescaleDB features are enabled

### Production Deployment
1. **Backup database** before migration
2. Apply migration during maintenance window
3. Monitor performance after hypertable creation
4. Verify compression and retention policies
5. Test continuous aggregates refresh

### Data Migration from Legacy Schema
```sql
-- Migrate existing device_data to inverter_data
INSERT INTO inverter_data (
  deviceId, timestamp, sunspecModel, 
  acPower, dcPower, acFrequency, 
  temperatureCabinet, efficiency
)
SELECT 
  deviceId, timestamp, 
  CASE 
    WHEN device.type = 'INVERTER' THEN 103 -- Default to three-phase
    ELSE 101 
  END as sunspecModel,
  power as acPower,
  power * 1.05 as dcPower, -- Estimate DC power
  50.0 as acFrequency, -- Default frequency
  temperature as temperatureCabinet,
  efficiency
FROM device_data 
JOIN devices device ON device_data.deviceId = device.id
WHERE device.type = 'INVERTER';
```

## Monitoring and Maintenance

### Performance Monitoring
- Monitor hypertable chunk sizes and compression ratios
- Track continuous aggregate refresh performance
- Monitor index usage and query performance
- Alert on retention policy execution

### Data Quality Checks
- Validate SunSpec model consistency
- Monitor for data gaps and anomalies
- Check scale factor application accuracy
- Verify event bitfield processing

### Backup and Recovery
- Include all SunSpec tables in backup procedures
- Test hypertable restoration procedures
- Verify continuous aggregate recovery
- Document retention policy recovery steps

## Support and Troubleshooting

### Common Issues
1. **TimescaleDB not installed**: Schema will work but without time-series optimizations
2. **Scale factor errors**: Check SunSpec model definitions and data point types
3. **Performance issues**: Verify indexes are being used for queries
4. **Event processing failures**: Check bitfield data format and trigger functions

### Performance Tuning
- Adjust chunk time intervals based on data volume
- Modify compression policies for storage optimization
- Tune continuous aggregate refresh intervals
- Optimize query patterns with proper indexing

For additional support, refer to the SunSpec Alliance specifications and TimescaleDB documentation.