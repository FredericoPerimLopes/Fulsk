-- CreateEnum
CREATE TYPE "InverterOperatingState" AS ENUM ('OFF', 'SLEEPING', 'STARTING', 'MPPT', 'THROTTLED', 'SHUTTING_DOWN', 'FAULT', 'STANDBY', 'TEST', 'VENDOR_SPECIFIC');

-- CreateEnum
CREATE TYPE "MpptOperatingState" AS ENUM ('OFF', 'SLEEPING', 'STARTING', 'MPPT', 'THROTTLED', 'SHUTTING_DOWN', 'FAULT', 'STANDBY', 'TEST');

-- CreateEnum
CREATE TYPE "InverterEventType" AS ENUM ('GROUND_FAULT', 'INPUT_OVER_VOLTAGE', 'INPUT_UNDER_VOLTAGE', 'INPUT_OVER_CURRENT', 'DC_DISCONNECT', 'CABINET_OPEN', 'MANUAL_SHUTDOWN', 'OVER_TEMP', 'UNDER_TEMP', 'MEMORY_LOSS', 'ARC_DETECTION', 'TEST_FAILED', 'BLOWN_FUSE', 'HARDWARE_FAILURE', 'COMMUNICATION_ERROR', 'VENDOR_SPECIFIC');

-- CreateEnum
CREATE TYPE "SunSpecModelType" AS ENUM ('COMMON', 'INVERTER', 'METER', 'BATTERY', 'TRACKER', 'EXTENSION');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AlertType" ADD VALUE 'SUNSPEC_EVENT';
ALTER TYPE "AlertType" ADD VALUE 'MPPT_FAULT';
ALTER TYPE "AlertType" ADD VALUE 'GROUND_FAULT';
ALTER TYPE "AlertType" ADD VALUE 'ARC_DETECTION';

-- AlterEnum
ALTER TYPE "CommunicationProtocol" ADD VALUE 'SUNSPEC_MODBUS';

-- CreateTable
CREATE TABLE "inverter_data" (
    "deviceId" TEXT NOT NULL,
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sunspecModel" INTEGER NOT NULL,
    "deviceClass" TEXT,
    "acCurrent" DOUBLE PRECISION,
    "acCurrentPhaseA" DOUBLE PRECISION,
    "acCurrentPhaseB" DOUBLE PRECISION,
    "acCurrentPhaseC" DOUBLE PRECISION,
    "acVoltagePhaseA" DOUBLE PRECISION,
    "acVoltagePhaseB" DOUBLE PRECISION,
    "acVoltagePhaseC" DOUBLE PRECISION,
    "acVoltagePhaseAB" DOUBLE PRECISION,
    "acVoltagePhaseBC" DOUBLE PRECISION,
    "acVoltagePhaseCA" DOUBLE PRECISION,
    "acPower" DOUBLE PRECISION,
    "acPowerApparent" DOUBLE PRECISION,
    "acPowerReactive" DOUBLE PRECISION,
    "acPowerFactor" DOUBLE PRECISION,
    "acFrequency" DOUBLE PRECISION,
    "dcCurrent" DOUBLE PRECISION,
    "dcVoltage" DOUBLE PRECISION,
    "dcPower" DOUBLE PRECISION,
    "acEnergyLifetime" DOUBLE PRECISION,
    "dcEnergyLifetime" DOUBLE PRECISION,
    "acEnergyToday" DOUBLE PRECISION,
    "temperatureCabinet" DOUBLE PRECISION,
    "temperatureHeatSink" DOUBLE PRECISION,
    "temperatureTransformer" DOUBLE PRECISION,
    "temperatureOther" DOUBLE PRECISION,
    "operatingState" "InverterOperatingState",
    "eventBitfield1" BIGINT,
    "eventBitfield2" BIGINT,
    "currentScaleFactor" INTEGER,
    "voltageScaleFactor" INTEGER,
    "powerScaleFactor" INTEGER,
    "frequencyScaleFactor" INTEGER,
    "efficiency" DOUBLE PRECISION,

    CONSTRAINT "inverter_data_pkey" PRIMARY KEY ("deviceId","timestamp")
);

-- CreateTable
CREATE TABLE "inverter_mppt_modules" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "timestamp" TIMESTAMPTZ NOT NULL,
    "moduleId" INTEGER NOT NULL,
    "moduleIdStr" TEXT,
    "dcCurrent" DOUBLE PRECISION,
    "dcVoltage" DOUBLE PRECISION,
    "dcPower" DOUBLE PRECISION,
    "dcEnergy" DOUBLE PRECISION,
    "operatingState" "MpptOperatingState",
    "temperature" DOUBLE PRECISION,
    "timestamp_secs" INTEGER,
    "eventBitfield" BIGINT,

    CONSTRAINT "inverter_mppt_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inverter_configurations" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "supportedModels" INTEGER[],
    "primaryModel" INTEGER NOT NULL,
    "manufacturer" TEXT,
    "model" TEXT,
    "options" TEXT,
    "version" TEXT,
    "serialNumber" TEXT,
    "deviceAddress" INTEGER,
    "ratedPower" DOUBLE PRECISION,
    "ratedVoltage" DOUBLE PRECISION,
    "ratedCurrent" DOUBLE PRECISION,
    "ratedFrequency" DOUBLE PRECISION,
    "maxPowerOutput" DOUBLE PRECISION,
    "powerFactorTarget" DOUBLE PRECISION,
    "voltageRegulation" BOOLEAN,
    "mpptModuleCount" INTEGER,
    "timestampPeriod" INTEGER,
    "sunspecAddress" INTEGER,
    "modelOffset" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inverter_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inverter_diagnostics" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventType" "InverterEventType" NOT NULL,
    "eventCode" TEXT NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "message" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "eventData" JSONB,
    "groundFault" BOOLEAN,
    "inputOverVoltage" BOOLEAN,
    "inputUnderVoltage" BOOLEAN,
    "inputOverCurrent" BOOLEAN,
    "dcDisconnect" BOOLEAN,
    "cabinetOpen" BOOLEAN,
    "manualShutdown" BOOLEAN,
    "overTemp" BOOLEAN,
    "underTemp" BOOLEAN,
    "memoryLoss" BOOLEAN,
    "arcDetection" BOOLEAN,
    "testFailed" BOOLEAN,
    "blownFuse" BOOLEAN,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "inverter_diagnostics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sunspec_models" (
    "id" TEXT NOT NULL,
    "modelNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" TEXT,
    "modelType" "SunSpecModelType" NOT NULL,
    "blockLength" INTEGER NOT NULL,
    "dataPoints" JSONB NOT NULL,
    "mandatoryPoints" TEXT[],
    "optionalPoints" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sunspec_models_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inverter_data_timestamp_idx" ON "inverter_data"("timestamp");

-- CreateIndex
CREATE INDEX "inverter_data_deviceId_sunspecModel_idx" ON "inverter_data"("deviceId", "sunspecModel");

-- CreateIndex
CREATE INDEX "inverter_data_operatingState_idx" ON "inverter_data"("operatingState");

-- CreateIndex
CREATE INDEX "inverter_mppt_modules_deviceId_timestamp_idx" ON "inverter_mppt_modules"("deviceId", "timestamp");

-- CreateIndex
CREATE INDEX "inverter_mppt_modules_moduleId_idx" ON "inverter_mppt_modules"("moduleId");

-- CreateIndex
CREATE UNIQUE INDEX "inverter_configurations_deviceId_key" ON "inverter_configurations"("deviceId");

-- CreateIndex
CREATE INDEX "inverter_diagnostics_deviceId_timestamp_idx" ON "inverter_diagnostics"("deviceId", "timestamp");

-- CreateIndex
CREATE INDEX "inverter_diagnostics_eventType_severity_idx" ON "inverter_diagnostics"("eventType", "severity");

-- CreateIndex
CREATE INDEX "inverter_diagnostics_isActive_idx" ON "inverter_diagnostics"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "sunspec_models_modelNumber_key" ON "sunspec_models"("modelNumber");

-- AddForeignKey
ALTER TABLE "inverter_data" ADD CONSTRAINT "inverter_data_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inverter_mppt_modules" ADD CONSTRAINT "inverter_mppt_modules_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inverter_mppt_modules" ADD CONSTRAINT "inverter_mppt_modules_deviceId_timestamp_fkey" FOREIGN KEY ("deviceId", "timestamp") REFERENCES "inverter_data"("deviceId", "timestamp") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inverter_configurations" ADD CONSTRAINT "inverter_configurations_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inverter_diagnostics" ADD CONSTRAINT "inverter_diagnostics_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- TimescaleDB Hypertable Creation for time-series optimization
-- Convert inverter_data to hypertable (if TimescaleDB extension is available)
DO $$
BEGIN
    -- Check if TimescaleDB extension exists
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
        -- Create hypertable for inverter_data with 1-day time chunks
        PERFORM create_hypertable('inverter_data', 'timestamp', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE);
        
        -- Create hypertable for inverter_mppt_modules with 1-day time chunks
        PERFORM create_hypertable('inverter_mppt_modules', 'timestamp', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE);
        
        -- Create hypertable for inverter_diagnostics with 1-day time chunks
        PERFORM create_hypertable('inverter_diagnostics', 'timestamp', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE);
        
        -- Enable compression on hypertables (compress data older than 7 days)
        ALTER TABLE inverter_data SET (
            timescaledb.compress,
            timescaledb.compress_segmentby = 'deviceId,sunspecModel'
        );
        
        ALTER TABLE inverter_mppt_modules SET (
            timescaledb.compress,
            timescaledb.compress_segmentby = 'deviceId,moduleId'
        );
        
        ALTER TABLE inverter_diagnostics SET (
            timescaledb.compress,
            timescaledb.compress_segmentby = 'deviceId,eventType'
        );
        
        -- Create compression policies
        SELECT add_compression_policy('inverter_data', INTERVAL '7 days');
        SELECT add_compression_policy('inverter_mppt_modules', INTERVAL '7 days');
        SELECT add_compression_policy('inverter_diagnostics', INTERVAL '30 days');
        
        -- Create retention policies (keep data for 5 years)
        SELECT add_retention_policy('inverter_data', INTERVAL '5 years');
        SELECT add_retention_policy('inverter_mppt_modules', INTERVAL '5 years');
        SELECT add_retention_policy('inverter_diagnostics', INTERVAL '2 years');
        
        RAISE NOTICE 'TimescaleDB hypertables created and optimized successfully';
    ELSE
        RAISE NOTICE 'TimescaleDB extension not found - skipping hypertable creation';
    END IF;
END $$;

-- Create additional performance indexes for common query patterns
-- Index for time-range queries by device and model
CREATE INDEX CONCURRENTLY IF NOT EXISTS "inverter_data_device_time_range_idx" 
ON "inverter_data" ("deviceId", "timestamp" DESC, "sunspecModel");

-- Index for power and energy analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS "inverter_data_power_analytics_idx" 
ON "inverter_data" ("deviceId", "timestamp" DESC, "acPower", "dcPower") 
WHERE "acPower" IS NOT NULL OR "dcPower" IS NOT NULL;

-- Index for temperature monitoring
CREATE INDEX CONCURRENTLY IF NOT EXISTS "inverter_data_temperature_idx" 
ON "inverter_data" ("deviceId", "timestamp" DESC) 
WHERE "temperatureCabinet" IS NOT NULL OR "temperatureHeatSink" IS NOT NULL;

-- Index for fault detection queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS "inverter_data_fault_detection_idx" 
ON "inverter_data" ("deviceId", "operatingState", "timestamp" DESC) 
WHERE "operatingState" IN ('FAULT', 'ERROR', 'SHUTTING_DOWN');

-- Index for MPPT module performance queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS "inverter_mppt_performance_idx" 
ON "inverter_mppt_modules" ("deviceId", "moduleId", "timestamp" DESC, "dcPower") 
WHERE "dcPower" IS NOT NULL;

-- Index for active diagnostics
CREATE INDEX CONCURRENTLY IF NOT EXISTS "inverter_diagnostics_active_idx" 
ON "inverter_diagnostics" ("deviceId", "isActive", "timestamp" DESC) 
WHERE "isActive" = TRUE;

-- Partial index for critical events
CREATE INDEX CONCURRENTLY IF NOT EXISTS "inverter_diagnostics_critical_idx" 
ON "inverter_diagnostics" ("deviceId", "timestamp" DESC, "eventType") 
WHERE "severity" = 'CRITICAL';

-- Create function for SunSpec data validation
CREATE OR REPLACE FUNCTION validate_sunspec_data()
RETURNS TRIGGER AS $$
BEGIN
    -- Validate SunSpec model number
    IF NEW.sunspecModel NOT IN (101, 102, 103, 160) THEN
        RAISE WARNING 'Unsupported SunSpec model: %', NEW.sunspecModel;
    END IF;
    
    -- Validate power relationships (DC should generally be >= AC due to losses)
    IF NEW.dcPower IS NOT NULL AND NEW.acPower IS NOT NULL AND NEW.dcPower > 0 THEN
        IF NEW.acPower > NEW.dcPower * 1.1 THEN -- Allow 10% margin for measurement variance
            RAISE WARNING 'AC power (%) exceeds DC power (%) for device %', NEW.acPower, NEW.dcPower, NEW.deviceId;
        END IF;
    END IF;
    
    -- Calculate efficiency if both AC and DC power are available
    IF NEW.dcPower IS NOT NULL AND NEW.acPower IS NOT NULL AND NEW.dcPower > 0 THEN
        NEW.efficiency := (NEW.acPower / NEW.dcPower) * 100.0;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for data validation
CREATE TRIGGER validate_sunspec_inverter_data
    BEFORE INSERT OR UPDATE ON inverter_data
    FOR EACH ROW
    EXECUTE FUNCTION validate_sunspec_data();

-- Create function for automatic diagnostic event creation
CREATE OR REPLACE FUNCTION create_diagnostic_from_bitfield()
RETURNS TRIGGER AS $$
DECLARE
    event_record RECORD;
BEGIN
    -- Check for ground fault
    IF (NEW.eventBitfield1 & (1::bigint << 0))::boolean AND 
       (OLD.eventBitfield1 IS NULL OR NOT (OLD.eventBitfield1 & (1::bigint << 0))::boolean) THEN
        INSERT INTO inverter_diagnostics (deviceId, timestamp, eventType, eventCode, severity, message)
        VALUES (NEW.deviceId, NEW.timestamp, 'GROUND_FAULT', 'GF01', 'CRITICAL', 'Ground fault detected');
    END IF;
    
    -- Check for over temperature
    IF (NEW.eventBitfield1 & (1::bigint << 7))::boolean AND 
       (OLD.eventBitfield1 IS NULL OR NOT (OLD.eventBitfield1 & (1::bigint << 7))::boolean) THEN
        INSERT INTO inverter_diagnostics (deviceId, timestamp, eventType, eventCode, severity, message)
        VALUES (NEW.deviceId, NEW.timestamp, 'OVER_TEMP', 'OT01', 'WARNING', 'Over temperature condition detected');
    END IF;
    
    -- Check for arc detection
    IF (NEW.eventBitfield1 & (1::bigint << 10))::boolean AND 
       (OLD.eventBitfield1 IS NULL OR NOT (OLD.eventBitfield1 & (1::bigint << 10))::boolean) THEN
        INSERT INTO inverter_diagnostics (deviceId, timestamp, eventType, eventCode, severity, message)
        VALUES (NEW.deviceId, NEW.timestamp, 'ARC_DETECTION', 'AD01', 'CRITICAL', 'Arc fault detected');
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic diagnostic creation
CREATE TRIGGER auto_create_diagnostics
    AFTER INSERT OR UPDATE OF eventBitfield1, eventBitfield2 ON inverter_data
    FOR EACH ROW
    WHEN (NEW.eventBitfield1 IS NOT NULL OR NEW.eventBitfield2 IS NOT NULL)
    EXECUTE FUNCTION create_diagnostic_from_bitfield();

-- Create continuous aggregates for performance analytics (TimescaleDB feature)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
        -- Daily power production summary
        CREATE MATERIALIZED VIEW IF NOT EXISTS inverter_daily_summary
        WITH (timescaledb.continuous) AS
        SELECT 
            deviceId,
            sunspecModel,
            time_bucket('1 day', timestamp) AS day,
            AVG(acPower) as avg_ac_power,
            MAX(acPower) as max_ac_power,
            AVG(dcPower) as avg_dc_power,
            MAX(dcPower) as max_dc_power,
            AVG(efficiency) as avg_efficiency,
            AVG(acFrequency) as avg_frequency,
            AVG(temperatureCabinet) as avg_temperature,
            COUNT(*) as measurement_count
        FROM inverter_data
        WHERE timestamp >= NOW() - INTERVAL '1 month'
        GROUP BY deviceId, sunspecModel, day;
        
        -- Hourly MPPT performance summary
        CREATE MATERIALIZED VIEW IF NOT EXISTS mppt_hourly_summary
        WITH (timescaledb.continuous) AS
        SELECT 
            deviceId,
            moduleId,
            time_bucket('1 hour', timestamp) AS hour,
            AVG(dcPower) as avg_power,
            MAX(dcPower) as max_power,
            AVG(dcVoltage) as avg_voltage,
            AVG(dcCurrent) as avg_current,
            AVG(temperature) as avg_temperature,
            COUNT(*) as measurement_count
        FROM inverter_mppt_modules
        WHERE timestamp >= NOW() - INTERVAL '1 week'
        GROUP BY deviceId, moduleId, hour;
        
        -- Add refresh policies
        SELECT add_continuous_aggregate_policy('inverter_daily_summary',
            start_offset => INTERVAL '1 month',
            end_offset => INTERVAL '1 hour',
            schedule_interval => INTERVAL '1 hour');
            
        SELECT add_continuous_aggregate_policy('mppt_hourly_summary',
            start_offset => INTERVAL '1 week',
            end_offset => INTERVAL '10 minutes',
            schedule_interval => INTERVAL '10 minutes');
        
        RAISE NOTICE 'TimescaleDB continuous aggregates created successfully';
    END IF;
END $$;
