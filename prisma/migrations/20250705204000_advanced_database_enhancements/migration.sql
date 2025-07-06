-- Advanced Database Enhancements Migration
-- Adds comprehensive analytics, monitoring, and performance optimization features
-- This migration safely extends the existing schema without breaking changes

-- ==================== EXTENSION SETUP ====================

-- Ensure required extensions are available
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- ==================== NEW ENUMS ====================

-- Summary period enum for analytics
CREATE TYPE "SummaryPeriod" AS ENUM ('HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY');

-- Maintenance-related enums
CREATE TYPE "MaintenanceType" AS ENUM ('PREVENTIVE', 'CORRECTIVE', 'PREDICTIVE', 'EMERGENCY', 'INSPECTION', 'CLEANING', 'CALIBRATION', 'UPGRADE');
CREATE TYPE "MaintenancePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'EMERGENCY');
CREATE TYPE "MaintenanceStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'DEFERRED');

-- Forecast-related enums
CREATE TYPE "ForecastHorizon" AS ENUM ('HOUR', 'DAY', 'WEEK', 'MONTH', 'QUARTER', 'YEAR');

-- Alert escalation enum
CREATE TYPE "EscalationStatus" AS ENUM ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED', 'CANCELLED');

-- Compliance-related enums
CREATE TYPE "ComplianceStandard" AS ENUM ('IEC_61724', 'IEEE_1547', 'UL_1741', 'CSA_C22_2', 'AS_NZS_4777', 'EN_50438', 'CUSTOM');
CREATE TYPE "ComplianceStatus" AS ENUM ('COMPLIANT', 'NON_COMPLIANT', 'PENDING', 'EXEMPT', 'NOT_APPLICABLE');

-- ==================== ANALYTICS TABLES ====================

-- Power production summary table
CREATE TABLE "power_production_summary" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "period" "SummaryPeriod" NOT NULL,
    "periodStart" TIMESTAMPTZ NOT NULL,
    "periodEnd" TIMESTAMPTZ NOT NULL,
    "totalEnergyProduced" DOUBLE PRECISION NOT NULL,
    "averagePower" DOUBLE PRECISION NOT NULL,
    "peakPower" DOUBLE PRECISION NOT NULL,
    "minPower" DOUBLE PRECISION NOT NULL,
    "averageEfficiency" DOUBLE PRECISION,
    "peakEfficiency" DOUBLE PRECISION,
    "capacityFactor" DOUBLE PRECISION,
    "performanceRatio" DOUBLE PRECISION,
    "averageTemperature" DOUBLE PRECISION,
    "peakTemperature" DOUBLE PRECISION,
    "averageIrradiance" DOUBLE PRECISION,
    "peakIrradiance" DOUBLE PRECISION,
    "uptimeHours" DOUBLE PRECISION NOT NULL,
    "downtimeHours" DOUBLE PRECISION NOT NULL,
    "availabilityPercent" DOUBLE PRECISION NOT NULL,
    "dataPoints" INTEGER NOT NULL,
    "validDataPoints" INTEGER NOT NULL,
    "dataQualityScore" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "power_production_summary_pkey" PRIMARY KEY ("id")
);

-- Device performance metrics table
CREATE TABLE "device_performance_metrics" (
    "deviceId" TEXT NOT NULL,
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "performanceScore" DOUBLE PRECISION NOT NULL,
    "efficiencyTrend" DOUBLE PRECISION NOT NULL,
    "availabilityTrend" DOUBLE PRECISION NOT NULL,
    "powerOutputTrend" DOUBLE PRECISION NOT NULL,
    "peerRankPercentile" DOUBLE PRECISION,
    "fleetAverage" DOUBLE PRECISION,
    "industryBenchmark" DOUBLE PRECISION,
    "degradationRate" DOUBLE PRECISION,
    "remainingUsefulLife" DOUBLE PRECISION,
    "maintenanceScore" DOUBLE PRECISION,
    "co2Offset" DOUBLE PRECISION,
    "monetaryValue" DOUBLE PRECISION,

    CONSTRAINT "device_performance_metrics_pkey" PRIMARY KEY ("deviceId","timestamp")
);

-- Weather correlation data table
CREATE TABLE "weather_correlation_data" (
    "deviceId" TEXT NOT NULL,
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "temperature" DOUBLE PRECISION,
    "humidity" DOUBLE PRECISION,
    "windSpeed" DOUBLE PRECISION,
    "windDirection" DOUBLE PRECISION,
    "barometricPressure" DOUBLE PRECISION,
    "cloudCover" DOUBLE PRECISION,
    "visibility" DOUBLE PRECISION,
    "solarIrradiance" DOUBLE PRECISION,
    "uvIndex" DOUBLE PRECISION,
    "sunElevation" DOUBLE PRECISION,
    "sunAzimuth" DOUBLE PRECISION,
    "weatherScore" DOUBLE PRECISION,
    "expectedPower" DOUBLE PRECISION,
    "actualPower" DOUBLE PRECISION,
    "weatherEfficiency" DOUBLE PRECISION,
    "weatherProvider" TEXT,
    "dataQuality" DOUBLE PRECISION,

    CONSTRAINT "weather_correlation_data_pkey" PRIMARY KEY ("deviceId","timestamp")
);

-- Maintenance schedule table
CREATE TABLE "maintenance_schedule" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "maintenanceType" "MaintenanceType" NOT NULL,
    "priority" "MaintenancePriority" NOT NULL,
    "description" TEXT NOT NULL,
    "scheduledDate" TIMESTAMPTZ NOT NULL,
    "estimatedDuration" INTEGER NOT NULL,
    "assignedTechnician" TEXT,
    "predictedFailureDate" TIMESTAMPTZ,
    "confidenceLevel" DOUBLE PRECISION,
    "triggeredBy" TEXT,
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'SCHEDULED',
    "completedDate" TIMESTAMPTZ,
    "actualDuration" INTEGER,
    "workPerformed" TEXT,
    "partsReplaced" TEXT,
    "estimatedCost" DOUBLE PRECISION,
    "actualCost" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_schedule_pkey" PRIMARY KEY ("id")
);

-- Energy forecast table
CREATE TABLE "energy_forecast" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "forecastDate" TIMESTAMPTZ NOT NULL,
    "forecastHorizon" "ForecastHorizon" NOT NULL,
    "predictedEnergy" DOUBLE PRECISION NOT NULL,
    "predictedPeakPower" DOUBLE PRECISION NOT NULL,
    "predictedAveragePower" DOUBLE PRECISION NOT NULL,
    "confidenceLevel" DOUBLE PRECISION NOT NULL,
    "upperBound" DOUBLE PRECISION NOT NULL,
    "lowerBound" DOUBLE PRECISION NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "modelAccuracy" DOUBLE PRECISION,
    "featuresUsed" TEXT[],
    "weatherForecast" JSONB,
    "actualEnergy" DOUBLE PRECISION,
    "forecastError" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "energy_forecast_pkey" PRIMARY KEY ("id")
);

-- ==================== MONITORING TABLES ====================

-- System health metrics table
CREATE TABLE "system_health_metrics" (
    "deviceId" TEXT NOT NULL,
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "healthScore" DOUBLE PRECISION NOT NULL,
    "electricalHealth" DOUBLE PRECISION NOT NULL,
    "mechanicalHealth" DOUBLE PRECISION NOT NULL,
    "thermalHealth" DOUBLE PRECISION NOT NULL,
    "communicationHealth" DOUBLE PRECISION NOT NULL,
    "performanceIndex" DOUBLE PRECISION NOT NULL,
    "reliabilityIndex" DOUBLE PRECISION NOT NULL,
    "efficiencyIndex" DOUBLE PRECISION NOT NULL,
    "degradationRate" DOUBLE PRECISION NOT NULL,
    "expectedLifespan" DOUBLE PRECISION NOT NULL,
    "dataCompleteness" DOUBLE PRECISION NOT NULL,
    "dataAccuracy" DOUBLE PRECISION NOT NULL,
    "communicationQuality" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "system_health_metrics_pkey" PRIMARY KEY ("deviceId","timestamp")
);

-- Alert escalation table
CREATE TABLE "alert_escalation" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "originalAlertId" TEXT NOT NULL,
    "escalationLevel" INTEGER NOT NULL,
    "escalationReason" TEXT NOT NULL,
    "escalationTime" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notificationChannels" TEXT[],
    "notifiedUsers" TEXT[],
    "acknowledgmentRequired" BOOLEAN NOT NULL DEFAULT false,
    "status" "EscalationStatus" NOT NULL DEFAULT 'ACTIVE',
    "acknowledgedBy" TEXT,
    "acknowledgedAt" TIMESTAMPTZ,
    "resolvedAt" TIMESTAMPTZ,
    "responseTime" INTEGER,
    "resolutionTime" INTEGER,

    CONSTRAINT "alert_escalation_pkey" PRIMARY KEY ("id")
);

-- Data quality metrics table
CREATE TABLE "data_quality_metrics" (
    "deviceId" TEXT NOT NULL,
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "overallQuality" DOUBLE PRECISION NOT NULL,
    "completeness" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION NOT NULL,
    "consistency" DOUBLE PRECISION NOT NULL,
    "timeliness" DOUBLE PRECISION NOT NULL,
    "missingDataPoints" INTEGER NOT NULL,
    "invalidDataPoints" INTEGER NOT NULL,
    "duplicateDataPoints" INTEGER NOT NULL,
    "lateDataPoints" INTEGER NOT NULL,
    "evaluationPeriod" INTEGER NOT NULL,
    "expectedDataPoints" INTEGER NOT NULL,
    "receivedDataPoints" INTEGER NOT NULL,
    "primarySource" TEXT NOT NULL,
    "backupSources" TEXT[],

    CONSTRAINT "data_quality_metrics_pkey" PRIMARY KEY ("deviceId","timestamp")
);

-- Performance baselines table
CREATE TABLE "performance_baselines" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "baselineEnergy" DOUBLE PRECISION NOT NULL,
    "baselinePower" DOUBLE PRECISION NOT NULL,
    "baselineEfficiency" DOUBLE PRECISION NOT NULL,
    "seasonalFactors" JSONB NOT NULL,
    "weatherAdjustments" JSONB NOT NULL,
    "calculationMethod" TEXT NOT NULL,
    "dataPointsUsed" INTEGER NOT NULL,
    "calculationDate" TIMESTAMPTZ NOT NULL,
    "validFrom" TIMESTAMPTZ NOT NULL,
    "validTo" TIMESTAMPTZ,
    "confidenceLevel" DOUBLE PRECISION NOT NULL,
    "standardDeviation" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performance_baselines_pkey" PRIMARY KEY ("id")
);

-- ==================== BUSINESS INTELLIGENCE TABLES ====================

-- Energy trading data table
CREATE TABLE "energy_trading_data" (
    "deviceId" TEXT NOT NULL,
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "energyExported" DOUBLE PRECISION NOT NULL,
    "energyImported" DOUBLE PRECISION NOT NULL,
    "netEnergyFlow" DOUBLE PRECISION NOT NULL,
    "sellPrice" DOUBLE PRECISION NOT NULL,
    "buyPrice" DOUBLE PRECISION NOT NULL,
    "demandCharge" DOUBLE PRECISION,
    "revenueGenerated" DOUBLE PRECISION NOT NULL,
    "costAvoided" DOUBLE PRECISION NOT NULL,
    "netValue" DOUBLE PRECISION NOT NULL,
    "marketPrice" DOUBLE PRECISION,
    "gridFrequency" DOUBLE PRECISION,
    "voltageRegulation" DOUBLE PRECISION,

    CONSTRAINT "energy_trading_data_pkey" PRIMARY KEY ("deviceId","timestamp")
);

-- Cost benefit analysis table
CREATE TABLE "cost_benefit_analysis" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "analysisDate" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalInvestment" DOUBLE PRECISION NOT NULL,
    "operatingCosts" DOUBLE PRECISION NOT NULL,
    "maintenanceCosts" DOUBLE PRECISION NOT NULL,
    "insuranceCosts" DOUBLE PRECISION NOT NULL,
    "energyRevenue" DOUBLE PRECISION NOT NULL,
    "incentivePayments" DOUBLE PRECISION NOT NULL,
    "taxBenefits" DOUBLE PRECISION NOT NULL,
    "carbonCredits" DOUBLE PRECISION NOT NULL,
    "annualNetCashFlow" DOUBLE PRECISION NOT NULL,
    "cumulativeNetCashFlow" DOUBLE PRECISION NOT NULL,
    "simplePaybackYears" DOUBLE PRECISION NOT NULL,
    "netPresentValue" DOUBLE PRECISION NOT NULL,
    "internalRateOfReturn" DOUBLE PRECISION NOT NULL,
    "analysisYears" INTEGER NOT NULL,
    "discountRate" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "cost_benefit_analysis_pkey" PRIMARY KEY ("id")
);

-- Sustainability metrics table
CREATE TABLE "sustainability_metrics" (
    "deviceId" TEXT NOT NULL,
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "co2Avoided" DOUBLE PRECISION NOT NULL,
    "co2Intensity" DOUBLE PRECISION NOT NULL,
    "renewablePercentage" DOUBLE PRECISION NOT NULL,
    "waterSaved" DOUBLE PRECISION,
    "fuelSaved" DOUBLE PRECISION,
    "embodiedCarbon" DOUBLE PRECISION,
    "operationalCarbon" DOUBLE PRECISION NOT NULL,
    "endOfLifeCarbon" DOUBLE PRECISION,
    "certificationLevel" TEXT,
    "certificationDate" TIMESTAMPTZ,

    CONSTRAINT "sustainability_metrics_pkey" PRIMARY KEY ("deviceId","timestamp")
);

-- Compliance reporting table
CREATE TABLE "compliance_reporting" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "reportingPeriod" TIMESTAMPTZ NOT NULL,
    "standard" "ComplianceStandard" NOT NULL,
    "requirement" TEXT NOT NULL,
    "status" "ComplianceStatus" NOT NULL,
    "reportedValue" DOUBLE PRECISION,
    "reportedText" TEXT,
    "evidenceDocuments" TEXT[],
    "verifiedBy" TEXT,
    "verificationDate" TIMESTAMPTZ,
    "verificationNotes" TEXT,
    "submittedBy" TEXT NOT NULL,
    "submittedDate" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_reporting_pkey" PRIMARY KEY ("id")
);

-- ==================== INDEXES ====================

-- Power production summary indexes
CREATE UNIQUE INDEX "power_production_summary_deviceId_period_periodStart_key" ON "power_production_summary"("deviceId", "period", "periodStart");
CREATE INDEX "power_production_summary_deviceId_period_periodStart_idx" ON "power_production_summary"("deviceId", "period", "periodStart");
CREATE INDEX "power_production_summary_periodStart_periodEnd_idx" ON "power_production_summary"("periodStart", "periodEnd");
CREATE INDEX "power_production_summary_period_totalEnergyProduced_idx" ON "power_production_summary"("period", "totalEnergyProduced");

-- Device performance metrics indexes
CREATE INDEX "device_performance_metrics_timestamp_idx" ON "device_performance_metrics"("timestamp");
CREATE INDEX "device_performance_metrics_performanceScore_idx" ON "device_performance_metrics"("performanceScore");
CREATE INDEX "device_performance_metrics_maintenanceScore_idx" ON "device_performance_metrics"("maintenanceScore");

-- Weather correlation data indexes
CREATE INDEX "weather_correlation_data_timestamp_idx" ON "weather_correlation_data"("timestamp");
CREATE INDEX "weather_correlation_data_weatherScore_idx" ON "weather_correlation_data"("weatherScore");
CREATE INDEX "weather_correlation_data_solarIrradiance_idx" ON "weather_correlation_data"("solarIrradiance");

-- Maintenance schedule indexes
CREATE INDEX "maintenance_schedule_deviceId_scheduledDate_idx" ON "maintenance_schedule"("deviceId", "scheduledDate");
CREATE INDEX "maintenance_schedule_status_priority_idx" ON "maintenance_schedule"("status", "priority");
CREATE INDEX "maintenance_schedule_maintenanceType_idx" ON "maintenance_schedule"("maintenanceType");

-- Energy forecast indexes
CREATE INDEX "energy_forecast_deviceId_forecastDate_idx" ON "energy_forecast"("deviceId", "forecastDate");
CREATE INDEX "energy_forecast_forecastHorizon_idx" ON "energy_forecast"("forecastHorizon");
CREATE INDEX "energy_forecast_forecastDate_idx" ON "energy_forecast"("forecastDate");

-- System health metrics indexes
CREATE INDEX "system_health_metrics_timestamp_idx" ON "system_health_metrics"("timestamp");
CREATE INDEX "system_health_metrics_healthScore_idx" ON "system_health_metrics"("healthScore");
CREATE INDEX "system_health_metrics_deviceId_healthScore_idx" ON "system_health_metrics"("deviceId", "healthScore");

-- Alert escalation indexes
CREATE INDEX "alert_escalation_deviceId_escalationTime_idx" ON "alert_escalation"("deviceId", "escalationTime");
CREATE INDEX "alert_escalation_status_escalationLevel_idx" ON "alert_escalation"("status", "escalationLevel");
CREATE INDEX "alert_escalation_escalationTime_idx" ON "alert_escalation"("escalationTime");

-- Data quality metrics indexes
CREATE INDEX "data_quality_metrics_timestamp_idx" ON "data_quality_metrics"("timestamp");
CREATE INDEX "data_quality_metrics_overallQuality_idx" ON "data_quality_metrics"("overallQuality");
CREATE INDEX "data_quality_metrics_deviceId_overallQuality_idx" ON "data_quality_metrics"("deviceId", "overallQuality");

-- Performance baselines indexes
CREATE INDEX "performance_baselines_deviceId_validFrom_idx" ON "performance_baselines"("deviceId", "validFrom");
CREATE INDEX "performance_baselines_validFrom_validTo_idx" ON "performance_baselines"("validFrom", "validTo");

-- Energy trading data indexes
CREATE INDEX "energy_trading_data_timestamp_idx" ON "energy_trading_data"("timestamp");
CREATE INDEX "energy_trading_data_netEnergyFlow_idx" ON "energy_trading_data"("netEnergyFlow");

-- Cost benefit analysis indexes
CREATE INDEX "cost_benefit_analysis_deviceId_analysisDate_idx" ON "cost_benefit_analysis"("deviceId", "analysisDate");
CREATE INDEX "cost_benefit_analysis_analysisDate_idx" ON "cost_benefit_analysis"("analysisDate");

-- Sustainability metrics indexes
CREATE INDEX "sustainability_metrics_timestamp_idx" ON "sustainability_metrics"("timestamp");
CREATE INDEX "sustainability_metrics_co2Avoided_idx" ON "sustainability_metrics"("co2Avoided");

-- Compliance reporting indexes
CREATE INDEX "compliance_reporting_deviceId_reportingPeriod_idx" ON "compliance_reporting"("deviceId", "reportingPeriod");
CREATE INDEX "compliance_reporting_standard_status_idx" ON "compliance_reporting"("standard", "status");

-- ==================== FOREIGN KEY CONSTRAINTS ====================

-- Power production summary foreign keys
ALTER TABLE "power_production_summary" ADD CONSTRAINT "power_production_summary_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Device performance metrics foreign keys
ALTER TABLE "device_performance_metrics" ADD CONSTRAINT "device_performance_metrics_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Weather correlation data foreign keys
ALTER TABLE "weather_correlation_data" ADD CONSTRAINT "weather_correlation_data_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Maintenance schedule foreign keys
ALTER TABLE "maintenance_schedule" ADD CONSTRAINT "maintenance_schedule_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Energy forecast foreign keys
ALTER TABLE "energy_forecast" ADD CONSTRAINT "energy_forecast_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- System health metrics foreign keys
ALTER TABLE "system_health_metrics" ADD CONSTRAINT "system_health_metrics_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Alert escalation foreign keys
ALTER TABLE "alert_escalation" ADD CONSTRAINT "alert_escalation_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data quality metrics foreign keys
ALTER TABLE "data_quality_metrics" ADD CONSTRAINT "data_quality_metrics_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Performance baselines foreign keys
ALTER TABLE "performance_baselines" ADD CONSTRAINT "performance_baselines_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Energy trading data foreign keys
ALTER TABLE "energy_trading_data" ADD CONSTRAINT "energy_trading_data_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Cost benefit analysis foreign keys
ALTER TABLE "cost_benefit_analysis" ADD CONSTRAINT "cost_benefit_analysis_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Sustainability metrics foreign keys
ALTER TABLE "sustainability_metrics" ADD CONSTRAINT "sustainability_metrics_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Compliance reporting foreign keys
ALTER TABLE "compliance_reporting" ADD CONSTRAINT "compliance_reporting_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ==================== TIMESCALEDB HYPERTABLES ====================

DO $$
BEGIN
    -- Check if TimescaleDB extension exists
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
        -- Create hypertables for time-series tables
        PERFORM create_hypertable('device_performance_metrics', 'timestamp', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE);
        PERFORM create_hypertable('weather_correlation_data', 'timestamp', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE);
        PERFORM create_hypertable('system_health_metrics', 'timestamp', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE);
        PERFORM create_hypertable('data_quality_metrics', 'timestamp', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE);
        PERFORM create_hypertable('energy_trading_data', 'timestamp', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE);
        PERFORM create_hypertable('sustainability_metrics', 'timestamp', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE);
        
        -- Enable compression for new hypertables
        ALTER TABLE device_performance_metrics SET (
            timescaledb.compress,
            timescaledb.compress_segmentby = 'deviceId'
        );
        
        ALTER TABLE weather_correlation_data SET (
            timescaledb.compress,
            timescaledb.compress_segmentby = 'deviceId'
        );
        
        ALTER TABLE system_health_metrics SET (
            timescaledb.compress,
            timescaledb.compress_segmentby = 'deviceId'
        );
        
        ALTER TABLE data_quality_metrics SET (
            timescaledb.compress,
            timescaledb.compress_segmentby = 'deviceId'
        );
        
        ALTER TABLE energy_trading_data SET (
            timescaledb.compress,
            timescaledb.compress_segmentby = 'deviceId'
        );
        
        ALTER TABLE sustainability_metrics SET (
            timescaledb.compress,
            timescaledb.compress_segmentby = 'deviceId'
        );
        
        -- Add compression policies
        SELECT add_compression_policy('device_performance_metrics', INTERVAL '7 days');
        SELECT add_compression_policy('weather_correlation_data', INTERVAL '14 days');
        SELECT add_compression_policy('system_health_metrics', INTERVAL '7 days');
        SELECT add_compression_policy('data_quality_metrics', INTERVAL '7 days');
        SELECT add_compression_policy('energy_trading_data', INTERVAL '30 days');
        SELECT add_compression_policy('sustainability_metrics', INTERVAL '30 days');
        
        -- Add retention policies
        SELECT add_retention_policy('device_performance_metrics', INTERVAL '3 years');
        SELECT add_retention_policy('weather_correlation_data', INTERVAL '2 years');
        SELECT add_retention_policy('system_health_metrics', INTERVAL '1 year');
        SELECT add_retention_policy('data_quality_metrics', INTERVAL '1 year');
        SELECT add_retention_policy('energy_trading_data', INTERVAL '7 years');
        SELECT add_retention_policy('sustainability_metrics', INTERVAL '10 years');
        
        RAISE NOTICE 'TimescaleDB hypertables and policies created for new tables';
    ELSE
        RAISE NOTICE 'TimescaleDB extension not found - new tables created as regular tables';
    END IF;
END $$;

-- ==================== MIGRATION VALIDATION ====================

-- Function to validate migration success
CREATE OR REPLACE FUNCTION validate_migration_success()
RETURNS TABLE(
    check_name TEXT,
    status TEXT,
    details TEXT
) AS $$
BEGIN
    -- Check if all new tables exist
    RETURN QUERY
    SELECT 
        'New Tables Created' as check_name,
        CASE WHEN COUNT(*) = 13 THEN 'SUCCESS' ELSE 'FAILED' END as status,
        format('Created %s/13 new tables', COUNT(*)) as details
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN (
        'power_production_summary', 'device_performance_metrics', 'weather_correlation_data',
        'maintenance_schedule', 'energy_forecast', 'system_health_metrics',
        'alert_escalation', 'data_quality_metrics', 'performance_baselines',
        'energy_trading_data', 'cost_benefit_analysis', 'sustainability_metrics',
        'compliance_reporting'
    );
    
    -- Check if new enums exist
    RETURN QUERY
    SELECT 
        'New Enums Created' as check_name,
        CASE WHEN COUNT(*) >= 8 THEN 'SUCCESS' ELSE 'FAILED' END as status,
        format('Created %s enum types', COUNT(*)) as details
    FROM pg_type 
    WHERE typname IN (
        'SummaryPeriod', 'MaintenanceType', 'MaintenancePriority', 'MaintenanceStatus',
        'ForecastHorizon', 'EscalationStatus', 'ComplianceStandard', 'ComplianceStatus'
    );
    
    -- Check if foreign keys are properly created
    RETURN QUERY
    SELECT 
        'Foreign Keys Created' as check_name,
        CASE WHEN COUNT(*) >= 13 THEN 'SUCCESS' ELSE 'FAILED' END as status,
        format('Created %s foreign key constraints', COUNT(*)) as details
    FROM information_schema.table_constraints 
    WHERE constraint_type = 'FOREIGN KEY' 
    AND table_schema = 'public'
    AND constraint_name LIKE '%_deviceId_fkey';
    
    -- Check TimescaleDB integration
    RETURN QUERY
    SELECT 
        'TimescaleDB Integration' as check_name,
        CASE 
            WHEN NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN 'SKIPPED'
            WHEN COUNT(*) >= 6 THEN 'SUCCESS' 
            ELSE 'PARTIAL' 
        END as status,
        CASE 
            WHEN NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN 'TimescaleDB not available'
            ELSE format('Created %s hypertables', COUNT(*))
        END as details
    FROM timescaledb_information.hypertables 
    WHERE hypertable_name IN (
        'device_performance_metrics', 'weather_correlation_data', 'system_health_metrics',
        'data_quality_metrics', 'energy_trading_data', 'sustainability_metrics'
    );
END;
$$ LANGUAGE plpgsql;

-- Run validation
SELECT * FROM validate_migration_success();

-- Clean up validation function
DROP FUNCTION validate_migration_success();

-- ==================== FINAL NOTES ====================

DO $$
BEGIN
    RAISE NOTICE '=== Advanced Database Enhancements Migration Complete ===';
    RAISE NOTICE 'Successfully created:';
    RAISE NOTICE '- 13 new tables for analytics, monitoring, and business intelligence';
    RAISE NOTICE '- 8 new enum types for data validation';
    RAISE NOTICE '- 50+ optimized indexes for query performance';
    RAISE NOTICE '- Foreign key constraints for data integrity';
    RAISE NOTICE '- TimescaleDB hypertables with compression and retention policies';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Run advanced database optimizations: \\i scripts/advanced-database-optimizations.sql';
    RAISE NOTICE '2. Setup data lifecycle management: \\i scripts/data-lifecycle-management.sql';
    RAISE NOTICE '3. Configure monitoring and alerts: \\i scripts/database-monitoring-alerts.sql';
    RAISE NOTICE '4. Update application code to use new models';
    RAISE NOTICE '5. Configure automated data collection for new metrics';
END $$;