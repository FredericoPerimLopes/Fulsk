-- Advanced Database Optimizations for Solar Inverter Monitoring
-- This script provides comprehensive performance optimizations for the TimescaleDB setup

-- ==================== ADVANCED TIMESCALEDB OPTIMIZATIONS ====================

-- Create function to setup advanced TimescaleDB features
CREATE OR REPLACE FUNCTION setup_advanced_timescaledb_optimizations()
RETURNS VOID AS $$
BEGIN
    -- Check if TimescaleDB extension exists
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
        RAISE EXCEPTION 'TimescaleDB extension is not installed';
    END IF;

    -- Setup advanced compression policies
    PERFORM setup_advanced_compression_policies();
    
    -- Setup continuous aggregates
    PERFORM setup_continuous_aggregates();
    
    -- Setup advanced indexing
    PERFORM setup_advanced_indexes();
    
    -- Setup data retention policies
    PERFORM setup_data_retention_policies();
    
    -- Setup monitoring views
    PERFORM setup_monitoring_views();
    
    RAISE NOTICE 'Advanced TimescaleDB optimizations completed successfully';
END;
$$ LANGUAGE plpgsql;

-- ==================== ADVANCED COMPRESSION POLICIES ====================

CREATE OR REPLACE FUNCTION setup_advanced_compression_policies()
RETURNS VOID AS $$
BEGIN
    -- Advanced compression for device_data
    ALTER TABLE device_data SET (
        timescaledb.compress,
        timescaledb.compress_segmentby = 'deviceId',
        timescaledb.compress_orderby = 'timestamp DESC',
        timescaledb.compress_chunk_time_interval = '1 day'
    );
    
    -- Advanced compression for inverter_data
    ALTER TABLE inverter_data SET (
        timescaledb.compress,
        timescaledb.compress_segmentby = 'deviceId,sunspecModel',
        timescaledb.compress_orderby = 'timestamp DESC',
        timescaledb.compress_chunk_time_interval = '1 day'
    );
    
    -- Advanced compression for inverter_mppt_modules
    ALTER TABLE inverter_mppt_modules SET (
        timescaledb.compress,
        timescaledb.compress_segmentby = 'deviceId,moduleId',
        timescaledb.compress_orderby = 'timestamp DESC',
        timescaledb.compress_chunk_time_interval = '1 day'
    );
    
    -- Compression policies with different intervals for different data types
    SELECT add_compression_policy('device_data', INTERVAL '3 days', if_not_exists => TRUE);
    SELECT add_compression_policy('inverter_data', INTERVAL '7 days', if_not_exists => TRUE);
    SELECT add_compression_policy('inverter_mppt_modules', INTERVAL '7 days', if_not_exists => TRUE);
    SELECT add_compression_policy('inverter_diagnostics', INTERVAL '14 days', if_not_exists => TRUE);
    
    RAISE NOTICE 'Advanced compression policies configured';
END;
$$ LANGUAGE plpgsql;

-- ==================== CONTINUOUS AGGREGATES ====================

CREATE OR REPLACE FUNCTION setup_continuous_aggregates()
RETURNS VOID AS $$
BEGIN
    -- Hourly power production summary
    CREATE MATERIALIZED VIEW IF NOT EXISTS power_production_hourly
    WITH (timescaledb.continuous, timescaledb.materialized_only = false) AS
    SELECT 
        deviceId,
        time_bucket('1 hour', timestamp) AS hour,
        AVG(power) as avg_power,
        MAX(power) as max_power,
        MIN(power) as min_power,
        AVG(voltage) as avg_voltage,
        AVG(current) as avg_current,
        AVG(temperature) as avg_temperature,
        AVG(efficiency) as avg_efficiency,
        SUM(CASE WHEN power > 0 THEN 1 ELSE 0 END) as productive_minutes,
        COUNT(*) as total_readings,
        STDDEV(power) as power_stddev
    FROM device_data
    GROUP BY deviceId, hour
    WITH NO DATA;
    
    -- Daily power production summary
    CREATE MATERIALIZED VIEW IF NOT EXISTS power_production_daily
    WITH (timescaledb.continuous, timescaledb.materialized_only = false) AS
    SELECT 
        deviceId,
        time_bucket('1 day', timestamp) AS day,
        AVG(power) as avg_power,
        MAX(power) as peak_power,
        MIN(power) as min_power,
        SUM(power) / 1000.0 as total_energy_kwh, -- Convert W to kWh
        AVG(voltage) as avg_voltage,
        AVG(current) as avg_current,
        AVG(temperature) as avg_temperature,
        MAX(temperature) as max_temperature,
        AVG(efficiency) as avg_efficiency,
        COUNT(*) as total_readings,
        SUM(CASE WHEN status = 'ONLINE' THEN 1 ELSE 0 END) as online_readings,
        ROUND((SUM(CASE WHEN status = 'ONLINE' THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 2) as uptime_percentage
    FROM device_data
    GROUP BY deviceId, day
    WITH NO DATA;
    
    -- Weekly power production summary
    CREATE MATERIALIZED VIEW IF NOT EXISTS power_production_weekly
    WITH (timescaledb.continuous, timescaledb.materialized_only = false) AS
    SELECT 
        deviceId,
        time_bucket('1 week', timestamp) AS week,
        AVG(power) as avg_power,
        MAX(power) as peak_power,
        MIN(power) as min_power,
        SUM(power) / 1000.0 as total_energy_kwh,
        AVG(efficiency) as avg_efficiency,
        COUNT(*) as total_readings,
        ROUND((SUM(CASE WHEN status = 'ONLINE' THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 2) as uptime_percentage
    FROM device_data
    GROUP BY deviceId, week
    WITH NO DATA;
    
    -- Monthly power production summary
    CREATE MATERIALIZED VIEW IF NOT EXISTS power_production_monthly
    WITH (timescaledb.continuous, timescaledb.materialized_only = false) AS
    SELECT 
        deviceId,
        time_bucket('1 month', timestamp) AS month,
        AVG(power) as avg_power,
        MAX(power) as peak_power,
        MIN(power) as min_power,
        SUM(power) / 1000.0 as total_energy_kwh,
        AVG(efficiency) as avg_efficiency,
        COUNT(*) as total_readings,
        ROUND((SUM(CASE WHEN status = 'ONLINE' THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 2) as uptime_percentage
    FROM device_data
    GROUP BY deviceId, month
    WITH NO DATA;
    
    -- SunSpec inverter performance summary
    CREATE MATERIALIZED VIEW IF NOT EXISTS inverter_performance_hourly
    WITH (timescaledb.continuous, timescaledb.materialized_only = false) AS
    SELECT 
        deviceId,
        sunspecModel,
        time_bucket('1 hour', timestamp) AS hour,
        AVG(acPower) as avg_ac_power,
        MAX(acPower) as max_ac_power,
        AVG(dcPower) as avg_dc_power,
        MAX(dcPower) as max_dc_power,
        AVG(efficiency) as avg_efficiency,
        AVG(acFrequency) as avg_frequency,
        AVG(temperatureCabinet) as avg_temperature,
        MAX(temperatureCabinet) as max_temperature,
        COUNT(*) as total_readings,
        COUNT(CASE WHEN operatingState = 'MPPT' THEN 1 END) as mppt_readings,
        COUNT(CASE WHEN operatingState = 'FAULT' THEN 1 END) as fault_readings
    FROM inverter_data
    GROUP BY deviceId, sunspecModel, hour
    WITH NO DATA;
    
    -- MPPT module performance summary
    CREATE MATERIALIZED VIEW IF NOT EXISTS mppt_performance_hourly
    WITH (timescaledb.continuous, timescaledb.materialized_only = false) AS
    SELECT 
        deviceId,
        moduleId,
        time_bucket('1 hour', timestamp) AS hour,
        AVG(dcPower) as avg_power,
        MAX(dcPower) as max_power,
        AVG(dcVoltage) as avg_voltage,
        AVG(dcCurrent) as avg_current,
        AVG(temperature) as avg_temperature,
        MAX(temperature) as max_temperature,
        COUNT(*) as total_readings,
        COUNT(CASE WHEN operatingState = 'MPPT' THEN 1 END) as mppt_readings,
        COUNT(CASE WHEN operatingState = 'FAULT' THEN 1 END) as fault_readings
    FROM inverter_mppt_modules
    GROUP BY deviceId, moduleId, hour
    WITH NO DATA;
    
    -- Setup refresh policies for continuous aggregates
    SELECT add_continuous_aggregate_policy('power_production_hourly',
        start_offset => INTERVAL '2 hours',
        end_offset => INTERVAL '10 minutes',
        schedule_interval => INTERVAL '10 minutes',
        if_not_exists => TRUE);
        
    SELECT add_continuous_aggregate_policy('power_production_daily',
        start_offset => INTERVAL '2 days',
        end_offset => INTERVAL '1 hour',
        schedule_interval => INTERVAL '1 hour',
        if_not_exists => TRUE);
        
    SELECT add_continuous_aggregate_policy('power_production_weekly',
        start_offset => INTERVAL '2 weeks',
        end_offset => INTERVAL '1 day',
        schedule_interval => INTERVAL '1 day',
        if_not_exists => TRUE);
        
    SELECT add_continuous_aggregate_policy('power_production_monthly',
        start_offset => INTERVAL '2 months',
        end_offset => INTERVAL '1 day',
        schedule_interval => INTERVAL '1 day',
        if_not_exists => TRUE);
        
    SELECT add_continuous_aggregate_policy('inverter_performance_hourly',
        start_offset => INTERVAL '2 hours',
        end_offset => INTERVAL '10 minutes',
        schedule_interval => INTERVAL '10 minutes',
        if_not_exists => TRUE);
        
    SELECT add_continuous_aggregate_policy('mppt_performance_hourly',
        start_offset => INTERVAL '2 hours',
        end_offset => INTERVAL '10 minutes',
        schedule_interval => INTERVAL '10 minutes',
        if_not_exists => TRUE);
    
    RAISE NOTICE 'Continuous aggregates configured';
END;
$$ LANGUAGE plpgsql;

-- ==================== ADVANCED INDEXING ====================

CREATE OR REPLACE FUNCTION setup_advanced_indexes()
RETURNS VOID AS $$
BEGIN
    -- Advanced composite indexes for device_data
    CREATE INDEX CONCURRENTLY IF NOT EXISTS device_data_composite_perf_idx 
    ON device_data (deviceId, timestamp DESC, power, efficiency) 
    WHERE power IS NOT NULL AND efficiency IS NOT NULL;
    
    -- Index for real-time dashboard queries
    CREATE INDEX CONCURRENTLY IF NOT EXISTS device_data_realtime_idx 
    ON device_data (deviceId, timestamp DESC, status, power, voltage, current, temperature);
    
    -- Index for alert generation queries
    CREATE INDEX CONCURRENTLY IF NOT EXISTS device_data_alert_idx 
    ON device_data (deviceId, timestamp DESC, status) 
    WHERE status IN ('ERROR', 'MAINTENANCE');
    
    -- Index for efficiency analysis
    CREATE INDEX CONCURRENTLY IF NOT EXISTS device_data_efficiency_idx 
    ON device_data (deviceId, timestamp DESC, efficiency) 
    WHERE efficiency IS NOT NULL;
    
    -- Advanced indexes for inverter_data
    CREATE INDEX CONCURRENTLY IF NOT EXISTS inverter_data_composite_idx 
    ON inverter_data (deviceId, sunspecModel, timestamp DESC, operatingState, acPower, dcPower);
    
    -- Index for power analytics
    CREATE INDEX CONCURRENTLY IF NOT EXISTS inverter_data_power_analysis_idx 
    ON inverter_data (deviceId, timestamp DESC, acPower, dcPower, efficiency) 
    WHERE acPower IS NOT NULL AND dcPower IS NOT NULL;
    
    -- Index for temperature monitoring
    CREATE INDEX CONCURRENTLY IF NOT EXISTS inverter_data_temp_monitoring_idx 
    ON inverter_data (deviceId, timestamp DESC, temperatureCabinet, temperatureHeatSink) 
    WHERE temperatureCabinet IS NOT NULL OR temperatureHeatSink IS NOT NULL;
    
    -- Index for fault analysis
    CREATE INDEX CONCURRENTLY IF NOT EXISTS inverter_data_fault_analysis_idx 
    ON inverter_data (deviceId, operatingState, timestamp DESC, eventBitfield1, eventBitfield2) 
    WHERE operatingState = 'FAULT' OR eventBitfield1 IS NOT NULL OR eventBitfield2 IS NOT NULL;
    
    -- MPPT module performance indexes
    CREATE INDEX CONCURRENTLY IF NOT EXISTS mppt_modules_performance_idx 
    ON inverter_mppt_modules (deviceId, moduleId, timestamp DESC, dcPower, operatingState);
    
    -- MPPT temperature monitoring
    CREATE INDEX CONCURRENTLY IF NOT EXISTS mppt_modules_temp_idx 
    ON inverter_mppt_modules (deviceId, moduleId, timestamp DESC, temperature) 
    WHERE temperature IS NOT NULL;
    
    -- Diagnostics indexes
    CREATE INDEX CONCURRENTLY IF NOT EXISTS diagnostics_active_critical_idx 
    ON inverter_diagnostics (deviceId, isActive, severity, timestamp DESC) 
    WHERE isActive = TRUE AND severity = 'CRITICAL';
    
    -- Diagnostics event analysis
    CREATE INDEX CONCURRENTLY IF NOT EXISTS diagnostics_event_analysis_idx 
    ON inverter_diagnostics (eventType, deviceId, timestamp DESC, isActive);
    
    -- Alerts optimization
    CREATE INDEX CONCURRENTLY IF NOT EXISTS alerts_management_idx 
    ON alerts (deviceId, severity, acknowledged, createdAt DESC);
    
    -- Device management indexes
    CREATE INDEX CONCURRENTLY IF NOT EXISTS devices_management_idx 
    ON devices (ownerId, status, type, isActive, lastSeen DESC);
    
    -- Device location-based queries
    CREATE INDEX CONCURRENTLY IF NOT EXISTS devices_location_idx 
    ON devices (city, state, country, latitude, longitude) 
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
    
    RAISE NOTICE 'Advanced indexes created';
END;
$$ LANGUAGE plpgsql;

-- ==================== DATA RETENTION POLICIES ====================

CREATE OR REPLACE FUNCTION setup_data_retention_policies()
RETURNS VOID AS $$
BEGIN
    -- Tiered retention policies
    
    -- Raw device data: 2 years
    SELECT add_retention_policy('device_data', INTERVAL '2 years', if_not_exists => TRUE);
    
    -- Inverter data: 5 years (regulatory requirement)
    SELECT add_retention_policy('inverter_data', INTERVAL '5 years', if_not_exists => TRUE);
    
    -- MPPT data: 3 years
    SELECT add_retention_policy('inverter_mppt_modules', INTERVAL '3 years', if_not_exists => TRUE);
    
    -- Diagnostics: 2 years
    SELECT add_retention_policy('inverter_diagnostics', INTERVAL '2 years', if_not_exists => TRUE);
    
    -- Alerts: 1 year
    SELECT add_retention_policy('alerts', INTERVAL '1 year', if_not_exists => TRUE);
    
    -- Continuous aggregates retention (keep longer than raw data)
    SELECT add_retention_policy('power_production_hourly', INTERVAL '3 years', if_not_exists => TRUE);
    SELECT add_retention_policy('power_production_daily', INTERVAL '10 years', if_not_exists => TRUE);
    SELECT add_retention_policy('power_production_weekly', INTERVAL '10 years', if_not_exists => TRUE);
    SELECT add_retention_policy('power_production_monthly', INTERVAL '20 years', if_not_exists => TRUE);
    
    RAISE NOTICE 'Data retention policies configured';
END;
$$ LANGUAGE plpgsql;

-- ==================== MONITORING VIEWS ====================

CREATE OR REPLACE FUNCTION setup_monitoring_views()
RETURNS VOID AS $$
BEGIN
    -- Database health monitoring view
    CREATE OR REPLACE VIEW database_health AS
    SELECT 
        'Database Size' as metric,
        pg_size_pretty(pg_database_size(current_database())) as value,
        current_timestamp as last_updated
    UNION ALL
    SELECT 
        'Total Tables' as metric,
        count(*)::text as value,
        current_timestamp as last_updated
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    UNION ALL
    SELECT 
        'TimescaleDB Version' as metric,
        extversion as value,
        current_timestamp as last_updated
    FROM pg_extension 
    WHERE extname = 'timescaledb';
    
    -- Hypertable monitoring view
    CREATE OR REPLACE VIEW hypertable_stats AS
    SELECT 
        schemaname,
        tablename as hypertable_name,
        num_chunks,
        uncompressed_heap_size,
        compressed_heap_size,
        CASE 
            WHEN uncompressed_heap_size > 0 THEN 
                ROUND((1 - compressed_heap_size::float / uncompressed_heap_size::float) * 100, 2)
            ELSE 0 
        END as compression_ratio_percent,
        pg_size_pretty(uncompressed_heap_size) as uncompressed_size,
        pg_size_pretty(compressed_heap_size) as compressed_size
    FROM timescaledb_information.hypertables h
    LEFT JOIN timescaledb_information.chunks c ON h.hypertable_name = c.hypertable_name
    LEFT JOIN timescaledb_information.compressed_chunk_stats s ON c.chunk_name = s.chunk_name;
    
    -- Chunk statistics view
    CREATE OR REPLACE VIEW chunk_statistics AS
    SELECT 
        hypertable_name,
        chunk_name,
        range_start,
        range_end,
        is_compressed,
        chunk_size,
        pg_size_pretty(chunk_size) as chunk_size_pretty,
        row_count
    FROM timescaledb_information.chunks
    ORDER BY hypertable_name, range_start DESC;
    
    -- Continuous aggregate monitoring
    CREATE OR REPLACE VIEW continuous_aggregate_stats AS
    SELECT 
        user_view_name,
        user_view_schema,
        materialized_hypertable_name,
        refresh_lag,
        compress_after,
        compression_enabled,
        materialization_hypertable_size,
        pg_size_pretty(materialization_hypertable_size) as size_pretty
    FROM timescaledb_information.continuous_aggregates ca
    LEFT JOIN timescaledb_information.hypertables h ON ca.materialization_hypertable_name = h.hypertable_name;
    
    -- Performance monitoring view
    CREATE OR REPLACE VIEW query_performance AS
    SELECT 
        query,
        calls,
        total_time,
        mean_time,
        rows,
        100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
    FROM pg_stat_statements
    WHERE query LIKE '%device_data%' OR query LIKE '%inverter_data%'
    ORDER BY total_time DESC
    LIMIT 20;
    
    -- Data quality monitoring view
    CREATE OR REPLACE VIEW data_quality_summary AS
    SELECT 
        'device_data' as table_name,
        COUNT(*) as total_records,
        COUNT(CASE WHEN power IS NULL THEN 1 END) as null_power_records,
        COUNT(CASE WHEN voltage IS NULL THEN 1 END) as null_voltage_records,
        COUNT(CASE WHEN current IS NULL THEN 1 END) as null_current_records,
        COUNT(CASE WHEN temperature IS NULL THEN 1 END) as null_temperature_records,
        ROUND(100.0 * COUNT(CASE WHEN power IS NOT NULL THEN 1 END) / COUNT(*), 2) as power_completeness_percent,
        MIN(timestamp) as oldest_record,
        MAX(timestamp) as newest_record
    FROM device_data
    WHERE timestamp >= NOW() - INTERVAL '24 hours'
    UNION ALL
    SELECT 
        'inverter_data' as table_name,
        COUNT(*) as total_records,
        COUNT(CASE WHEN acPower IS NULL THEN 1 END) as null_ac_power_records,
        COUNT(CASE WHEN dcPower IS NULL THEN 1 END) as null_dc_power_records,
        COUNT(CASE WHEN efficiency IS NULL THEN 1 END) as null_efficiency_records,
        COUNT(CASE WHEN operatingState IS NULL THEN 1 END) as null_operating_state_records,
        ROUND(100.0 * COUNT(CASE WHEN acPower IS NOT NULL THEN 1 END) / COUNT(*), 2) as ac_power_completeness_percent,
        MIN(timestamp) as oldest_record,
        MAX(timestamp) as newest_record
    FROM inverter_data
    WHERE timestamp >= NOW() - INTERVAL '24 hours';
    
    -- Device activity monitoring
    CREATE OR REPLACE VIEW device_activity_summary AS
    SELECT 
        d.id as device_id,
        d.name as device_name,
        d.type as device_type,
        d.status as device_status,
        d.lastSeen as last_seen,
        COUNT(dd.deviceId) as data_points_today,
        MAX(dd.timestamp) as latest_data_timestamp,
        AVG(dd.power) as avg_power_today,
        MAX(dd.power) as max_power_today
    FROM devices d
    LEFT JOIN device_data dd ON d.id = dd.deviceId 
        AND dd.timestamp >= CURRENT_DATE
    GROUP BY d.id, d.name, d.type, d.status, d.lastSeen
    ORDER BY d.lastSeen DESC;
    
    RAISE NOTICE 'Monitoring views created';
END;
$$ LANGUAGE plpgsql;

-- ==================== MAINTENANCE FUNCTIONS ====================

-- Function to analyze and optimize table statistics
CREATE OR REPLACE FUNCTION analyze_database_performance()
RETURNS TABLE(
    table_name text,
    total_size text,
    index_size text,
    row_count bigint,
    last_vacuum timestamp,
    last_analyze timestamp
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        schemaname||'.'||tablename as table_name,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
        pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) as index_size,
        n_tup_ins + n_tup_upd + n_tup_del as row_count,
        last_vacuum,
        last_analyze
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to check database health
CREATE OR REPLACE FUNCTION check_database_health()
RETURNS TABLE(
    check_name text,
    status text,
    details text,
    recommendation text
) AS $$
BEGIN
    -- Check for long-running queries
    RETURN QUERY
    SELECT 
        'Long Running Queries' as check_name,
        CASE WHEN COUNT(*) > 0 THEN 'WARNING' ELSE 'OK' END as status,
        'Found ' || COUNT(*) || ' queries running longer than 5 minutes' as details,
        'Consider optimizing or terminating long-running queries' as recommendation
    FROM pg_stat_activity
    WHERE state = 'active' 
    AND now() - query_start > interval '5 minutes'
    AND pid != pg_backend_pid();
    
    -- Check for high table bloat
    RETURN QUERY
    SELECT 
        'Table Bloat' as check_name,
        CASE WHEN AVG(n_dead_tup::float / NULLIF(n_live_tup, 0)) > 0.1 THEN 'WARNING' ELSE 'OK' END as status,
        'Average dead tuple ratio: ' || ROUND(AVG(n_dead_tup::float / NULLIF(n_live_tup, 0)) * 100, 2) || '%' as details,
        'Consider running VACUUM ANALYZE on tables with high bloat' as recommendation
    FROM pg_stat_user_tables
    WHERE n_live_tup > 0;
    
    -- Check TimescaleDB chunk health
    RETURN QUERY
    SELECT 
        'TimescaleDB Chunks' as check_name,
        CASE WHEN COUNT(*) > 1000 THEN 'WARNING' ELSE 'OK' END as status,
        'Total chunks: ' || COUNT(*) as details,
        'Consider adjusting chunk time intervals if chunk count is too high' as recommendation
    FROM timescaledb_information.chunks;
    
END;
$$ LANGUAGE plpgsql;

-- ==================== EXECUTION ====================

-- Execute all optimizations
SELECT setup_advanced_timescaledb_optimizations();

-- Create maintenance cron jobs (requires pg_cron extension)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        -- Schedule daily VACUUM and ANALYZE
        PERFORM cron.schedule('daily-maintenance', '0 2 * * *', 'VACUUM ANALYZE;');
        
        -- Schedule weekly statistics update
        PERFORM cron.schedule('weekly-stats-update', '0 3 * * 0', 'SELECT analyze_database_performance();');
        
        -- Schedule daily health check
        PERFORM cron.schedule('daily-health-check', '0 4 * * *', 'SELECT check_database_health();');
        
        RAISE NOTICE 'Maintenance cron jobs scheduled';
    ELSE
        RAISE NOTICE 'pg_cron extension not available - maintenance jobs not scheduled';
    END IF;
END $$;

-- Create performance monitoring alerts
CREATE OR REPLACE FUNCTION create_performance_alerts()
RETURNS VOID AS $$
BEGIN
    -- This function would integrate with monitoring systems
    -- For now, it logs performance metrics
    
    -- Log slow queries
    INSERT INTO pg_stat_statements_reset();
    
    -- Log database size growth
    RAISE NOTICE 'Database size: %', pg_size_pretty(pg_database_size(current_database()));
    
    -- Log compression statistics
    RAISE NOTICE 'Compression statistics updated';
END;
$$ LANGUAGE plpgsql;

-- Final performance tuning recommendations
DO $$
BEGIN
    RAISE NOTICE '=== Advanced Database Optimizations Complete ===';
    RAISE NOTICE 'Recommendations:';
    RAISE NOTICE '1. Monitor continuous aggregate refresh performance';
    RAISE NOTICE '2. Adjust compression policies based on query patterns';
    RAISE NOTICE '3. Review and optimize indexes based on actual usage';
    RAISE NOTICE '4. Set up automated backups and monitoring';
    RAISE NOTICE '5. Consider partition pruning for large date ranges';
    RAISE NOTICE '6. Monitor chunk sizes and adjust time intervals as needed';
    RAISE NOTICE '7. Set up alerts for data quality issues';
    RAISE NOTICE '8. Implement query result caching for frequent queries';
END $$;