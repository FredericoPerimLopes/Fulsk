-- Database Monitoring and Alerting System for Solar Inverter Monitoring
-- Comprehensive monitoring, alerting, and performance tracking

-- ==================== MONITORING SCHEMA SETUP ====================

-- Create schema for monitoring and alerting
CREATE SCHEMA IF NOT EXISTS monitoring;

-- Performance metrics history table
CREATE TABLE IF NOT EXISTS monitoring.performance_metrics (
    id SERIAL PRIMARY KEY,
    metric_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metric_name TEXT NOT NULL,
    metric_value DECIMAL(15,4),
    metric_unit TEXT,
    metric_tags JSONB,
    threshold_warning DECIMAL(15,4),
    threshold_critical DECIMAL(15,4),
    status TEXT CHECK (status IN ('OK', 'WARNING', 'CRITICAL', 'UNKNOWN')),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Alert definitions table
CREATE TABLE IF NOT EXISTS monitoring.alert_definitions (
    id SERIAL PRIMARY KEY,
    alert_name TEXT NOT NULL UNIQUE,
    description TEXT,
    metric_query TEXT NOT NULL,
    threshold_warning DECIMAL(15,4),
    threshold_critical DECIMAL(15,4),
    evaluation_interval INTERVAL DEFAULT '5 minutes',
    notification_channels TEXT[], -- email, slack, webhook, etc.
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Alert instances table (when alerts fire)
CREATE TABLE IF NOT EXISTS monitoring.alert_instances (
    id SERIAL PRIMARY KEY,
    alert_definition_id INTEGER REFERENCES monitoring.alert_definitions(id),
    severity TEXT CHECK (severity IN ('WARNING', 'CRITICAL')),
    status TEXT CHECK (status IN ('FIRING', 'RESOLVED', 'ACKNOWLEDGED')),
    value DECIMAL(15,4),
    message TEXT,
    fired_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    acknowledged_by TEXT,
    notification_sent BOOLEAN DEFAULT FALSE
);

-- System health snapshots
CREATE TABLE IF NOT EXISTS monitoring.system_health_snapshots (
    id SERIAL PRIMARY KEY,
    snapshot_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    database_size_mb DECIMAL(12,2),
    active_connections INTEGER,
    slow_queries_count INTEGER,
    blocked_queries_count INTEGER,
    cpu_usage_percent DECIMAL(5,2),
    memory_usage_percent DECIMAL(5,2),
    disk_usage_percent DECIMAL(5,2),
    timescaledb_chunks_count INTEGER,
    compression_ratio_percent DECIMAL(5,2),
    last_vacuum_age INTERVAL,
    last_analyze_age INTERVAL,
    replication_lag INTERVAL,
    health_score DECIMAL(5,2)
);

-- ==================== PERFORMANCE MONITORING FUNCTIONS ====================

-- Function to collect database performance metrics
CREATE OR REPLACE FUNCTION monitoring.collect_performance_metrics()
RETURNS TABLE(
    metric_name TEXT,
    metric_value DECIMAL,
    metric_unit TEXT,
    status TEXT,
    message TEXT
) AS $$
DECLARE
    v_database_size_mb DECIMAL(12,2);
    v_active_connections INTEGER;
    v_slow_queries INTEGER;
    v_blocked_queries INTEGER;
    v_index_hit_ratio DECIMAL(5,2);
    v_cache_hit_ratio DECIMAL(5,2);
    v_avg_query_time DECIMAL(10,3);
    v_deadlock_count INTEGER;
    v_temp_files_size_mb DECIMAL(12,2);
    v_checkpoint_age INTERVAL;
BEGIN
    -- Database size
    SELECT pg_size_bytes(pg_database_size(current_database())) / 1024.0 / 1024.0 
    INTO v_database_size_mb;
    
    -- Active connections
    SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active' INTO v_active_connections;
    
    -- Slow queries (>5 seconds)
    SELECT COUNT(*) FROM pg_stat_activity 
    WHERE state = 'active' AND query_start < NOW() - INTERVAL '5 seconds'
    INTO v_slow_queries;
    
    -- Blocked queries
    SELECT COUNT(*) FROM pg_stat_activity WHERE wait_event_type = 'Lock' INTO v_blocked_queries;
    
    -- Index hit ratio
    SELECT ROUND(
        100.0 * sum(idx_blks_hit) / NULLIF(sum(idx_blks_hit + idx_blks_read), 0), 2
    ) FROM pg_statio_user_indexes INTO v_index_hit_ratio;
    
    -- Cache hit ratio
    SELECT ROUND(
        100.0 * sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit + heap_blks_read), 0), 2
    ) FROM pg_statio_user_tables INTO v_cache_hit_ratio;
    
    -- Average query time (from pg_stat_statements if available)
    SELECT COALESCE(AVG(mean_time), 0) FROM pg_stat_statements INTO v_avg_query_time;
    
    -- Deadlock count
    SELECT COALESCE(deadlocks, 0) FROM pg_stat_database WHERE datname = current_database() INTO v_deadlock_count;
    
    -- Temp files size
    SELECT COALESCE(sum(temp_bytes), 0) / 1024.0 / 1024.0 FROM pg_stat_database INTO v_temp_files_size_mb;
    
    -- Last checkpoint age
    SELECT NOW() - stats_reset FROM pg_stat_bgwriter LIMIT 1 INTO v_checkpoint_age;
    
    -- Insert metrics and return results
    INSERT INTO monitoring.performance_metrics (metric_name, metric_value, metric_unit, threshold_warning, threshold_critical, status)
    VALUES 
        ('database_size_mb', v_database_size_mb, 'MB', 10000, 50000, 
         CASE WHEN v_database_size_mb > 50000 THEN 'CRITICAL' 
              WHEN v_database_size_mb > 10000 THEN 'WARNING' 
              ELSE 'OK' END),
        ('active_connections', v_active_connections, 'count', 80, 95,
         CASE WHEN v_active_connections > 95 THEN 'CRITICAL'
              WHEN v_active_connections > 80 THEN 'WARNING'
              ELSE 'OK' END),
        ('slow_queries_count', v_slow_queries, 'count', 5, 10,
         CASE WHEN v_slow_queries > 10 THEN 'CRITICAL'
              WHEN v_slow_queries > 5 THEN 'WARNING'
              ELSE 'OK' END),
        ('blocked_queries_count', v_blocked_queries, 'count', 3, 10,
         CASE WHEN v_blocked_queries > 10 THEN 'CRITICAL'
              WHEN v_blocked_queries > 3 THEN 'WARNING'
              ELSE 'OK' END),
        ('index_hit_ratio', COALESCE(v_index_hit_ratio, 0), 'percent', 95, 90,
         CASE WHEN COALESCE(v_index_hit_ratio, 0) < 90 THEN 'CRITICAL'
              WHEN COALESCE(v_index_hit_ratio, 0) < 95 THEN 'WARNING'
              ELSE 'OK' END),
        ('cache_hit_ratio', COALESCE(v_cache_hit_ratio, 0), 'percent', 95, 90,
         CASE WHEN COALESCE(v_cache_hit_ratio, 0) < 90 THEN 'CRITICAL'
              WHEN COALESCE(v_cache_hit_ratio, 0) < 95 THEN 'WARNING'
              ELSE 'OK' END),
        ('avg_query_time_ms', COALESCE(v_avg_query_time, 0), 'milliseconds', 100, 500,
         CASE WHEN COALESCE(v_avg_query_time, 0) > 500 THEN 'CRITICAL'
              WHEN COALESCE(v_avg_query_time, 0) > 100 THEN 'WARNING'
              ELSE 'OK' END);
    
    RETURN QUERY
    SELECT 
        pm.metric_name,
        pm.metric_value,
        pm.metric_unit,
        pm.status,
        CASE 
            WHEN pm.status = 'CRITICAL' THEN format('CRITICAL: %s is %s %s (threshold: %s)', pm.metric_name, pm.metric_value, pm.metric_unit, pm.threshold_critical)
            WHEN pm.status = 'WARNING' THEN format('WARNING: %s is %s %s (threshold: %s)', pm.metric_name, pm.metric_value, pm.metric_unit, pm.threshold_warning)
            ELSE format('OK: %s is %s %s', pm.metric_name, pm.metric_value, pm.metric_unit)
        END as message
    FROM monitoring.performance_metrics pm
    WHERE pm.metric_timestamp >= NOW() - INTERVAL '1 minute'
    ORDER BY 
        CASE pm.status 
            WHEN 'CRITICAL' THEN 1 
            WHEN 'WARNING' THEN 2 
            WHEN 'OK' THEN 3 
            ELSE 4 
        END;
END;
$$ LANGUAGE plpgsql;

-- Function to collect TimescaleDB-specific metrics
CREATE OR REPLACE FUNCTION monitoring.collect_timescaledb_metrics()
RETURNS TABLE(
    metric_name TEXT,
    metric_value DECIMAL,
    metric_unit TEXT,
    status TEXT
) AS $$
DECLARE
    v_chunks_count INTEGER;
    v_compression_ratio DECIMAL(5,2);
    v_uncompressed_size_gb DECIMAL(12,2);
    v_compressed_size_gb DECIMAL(12,2);
    v_continuous_aggs_count INTEGER;
    v_jobs_failed INTEGER;
BEGIN
    -- Check if TimescaleDB is available
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
        RETURN QUERY SELECT 'timescaledb_available'::TEXT, 0::DECIMAL, 'boolean'::TEXT, 'CRITICAL'::TEXT;
        RETURN;
    END IF;
    
    -- Total chunks count
    SELECT COUNT(*) FROM timescaledb_information.chunks INTO v_chunks_count;
    
    -- Compression statistics
    SELECT 
        COALESCE(
            ROUND(AVG(
                CASE WHEN uncompressed_heap_size > 0 
                THEN (1 - compressed_heap_size::float / uncompressed_heap_size::float) * 100 
                ELSE 0 END
            ), 2), 0
        ),
        COALESCE(SUM(uncompressed_heap_size) / 1024.0 / 1024.0 / 1024.0, 0),
        COALESCE(SUM(compressed_heap_size) / 1024.0 / 1024.0 / 1024.0, 0)
    FROM timescaledb_information.compressed_chunk_stats
    INTO v_compression_ratio, v_uncompressed_size_gb, v_compressed_size_gb;
    
    -- Continuous aggregates count
    SELECT COUNT(*) FROM timescaledb_information.continuous_aggregates INTO v_continuous_aggs_count;
    
    -- Failed jobs count
    SELECT COUNT(*) FROM timescaledb_information.jobs 
    WHERE last_run_status = 'Error' INTO v_jobs_failed;
    
    -- Insert and return metrics
    INSERT INTO monitoring.performance_metrics (metric_name, metric_value, metric_unit, threshold_warning, threshold_critical, status)
    VALUES 
        ('timescaledb_chunks_count', v_chunks_count, 'count', 5000, 10000,
         CASE WHEN v_chunks_count > 10000 THEN 'CRITICAL'
              WHEN v_chunks_count > 5000 THEN 'WARNING'
              ELSE 'OK' END),
        ('compression_ratio', v_compression_ratio, 'percent', 50, 30,
         CASE WHEN v_compression_ratio < 30 THEN 'WARNING'
              ELSE 'OK' END),
        ('compressed_size_gb', v_compressed_size_gb, 'GB', 100, 500,
         CASE WHEN v_compressed_size_gb > 500 THEN 'CRITICAL'
              WHEN v_compressed_size_gb > 100 THEN 'WARNING'
              ELSE 'OK' END),
        ('continuous_aggregates_count', v_continuous_aggs_count, 'count', 50, 100,
         CASE WHEN v_continuous_aggs_count > 100 THEN 'WARNING'
              ELSE 'OK' END),
        ('timescaledb_failed_jobs', v_jobs_failed, 'count', 1, 5,
         CASE WHEN v_jobs_failed > 5 THEN 'CRITICAL'
              WHEN v_jobs_failed > 1 THEN 'WARNING'
              ELSE 'OK' END);
    
    RETURN QUERY
    SELECT 
        pm.metric_name,
        pm.metric_value,
        pm.metric_unit,
        pm.status
    FROM monitoring.performance_metrics pm
    WHERE pm.metric_timestamp >= NOW() - INTERVAL '1 minute'
    AND pm.metric_name LIKE 'timescaledb_%' OR pm.metric_name IN ('compression_ratio', 'compressed_size_gb', 'continuous_aggregates_count');
END;
$$ LANGUAGE plpgsql;

-- ==================== DATA QUALITY MONITORING ====================

-- Function to monitor data quality across time-series tables
CREATE OR REPLACE FUNCTION monitoring.monitor_data_quality()
RETURNS TABLE(
    table_name TEXT,
    quality_score DECIMAL,
    issues_found TEXT[],
    status TEXT
) AS $$
DECLARE
    rec RECORD;
    v_total_records BIGINT;
    v_null_records BIGINT;
    v_duplicate_records BIGINT;
    v_future_records BIGINT;
    v_old_records BIGINT;
    v_quality_score DECIMAL(5,2);
    v_issues TEXT[];
    v_status TEXT;
BEGIN
    -- Check data quality for main time-series tables
    FOR rec IN 
        SELECT t.table_name 
        FROM information_schema.tables t
        WHERE t.table_schema = 'public' 
        AND t.table_name IN ('device_data', 'inverter_data', 'inverter_mppt_modules', 'inverter_diagnostics')
    LOOP
        v_issues := ARRAY[]::TEXT[];
        
        -- Count total records from last 24 hours
        EXECUTE format('SELECT COUNT(*) FROM %s WHERE timestamp >= NOW() - INTERVAL ''24 hours''', 
                      rec.table_name) INTO v_total_records;
        
        IF v_total_records = 0 THEN
            v_quality_score := 0;
            v_issues := array_append(v_issues, 'No data in last 24 hours');
            v_status := 'CRITICAL';
        ELSE
            -- Check for null values in critical fields
            CASE rec.table_name
                WHEN 'device_data' THEN
                    EXECUTE format('SELECT COUNT(*) FROM %s WHERE timestamp >= NOW() - INTERVAL ''24 hours'' 
                                   AND (power IS NULL OR voltage IS NULL OR current IS NULL)', 
                                  rec.table_name) INTO v_null_records;
                WHEN 'inverter_data' THEN
                    EXECUTE format('SELECT COUNT(*) FROM %s WHERE timestamp >= NOW() - INTERVAL ''24 hours'' 
                                   AND (acPower IS NULL OR dcPower IS NULL)', 
                                  rec.table_name) INTO v_null_records;
                ELSE
                    v_null_records := 0;
            END CASE;
            
            -- Check for duplicates
            EXECUTE format('SELECT COUNT(*) - COUNT(DISTINCT (deviceId, timestamp)) FROM %s 
                           WHERE timestamp >= NOW() - INTERVAL ''24 hours''', 
                          rec.table_name) INTO v_duplicate_records;
            
            -- Check for future timestamps
            EXECUTE format('SELECT COUNT(*) FROM %s WHERE timestamp > NOW() + INTERVAL ''1 minute''', 
                          rec.table_name) INTO v_future_records;
            
            -- Check for very old unprocessed data
            EXECUTE format('SELECT COUNT(*) FROM %s WHERE timestamp < NOW() - INTERVAL ''7 days'' 
                           AND timestamp >= NOW() - INTERVAL ''8 days''', 
                          rec.table_name) INTO v_old_records;
            
            -- Calculate quality score
            v_quality_score := GREATEST(0, 100 - 
                (v_null_records::DECIMAL / v_total_records * 100) - 
                (v_duplicate_records::DECIMAL / v_total_records * 100) - 
                (v_future_records::DECIMAL / v_total_records * 100));
            
            -- Identify issues
            IF v_null_records > v_total_records * 0.05 THEN
                v_issues := array_append(v_issues, format('High null rate: %s%%', 
                    ROUND(v_null_records::DECIMAL / v_total_records * 100, 2)));
            END IF;
            
            IF v_duplicate_records > 0 THEN
                v_issues := array_append(v_issues, format('Duplicate records: %s', v_duplicate_records));
            END IF;
            
            IF v_future_records > 0 THEN
                v_issues := array_append(v_issues, format('Future timestamps: %s', v_future_records));
            END IF;
            
            IF v_old_records > v_total_records * 0.1 THEN
                v_issues := array_append(v_issues, 'High volume of old unprocessed data');
            END IF;
            
            -- Determine status
            v_status := CASE 
                WHEN v_quality_score >= 95 THEN 'OK'
                WHEN v_quality_score >= 85 THEN 'WARNING'
                ELSE 'CRITICAL'
            END;
        END IF;
        
        -- Store quality metrics
        INSERT INTO monitoring.performance_metrics (metric_name, metric_value, metric_unit, status, metric_tags)
        VALUES (
            'data_quality_score',
            v_quality_score,
            'percent',
            v_status,
            jsonb_build_object('table', rec.table_name, 'issues', v_issues)
        );
        
        RETURN QUERY SELECT rec.table_name, v_quality_score, v_issues, v_status;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ==================== ALERT MANAGEMENT FUNCTIONS ====================

-- Function to evaluate alert conditions
CREATE OR REPLACE FUNCTION monitoring.evaluate_alerts()
RETURNS TABLE(
    alert_name TEXT,
    severity TEXT,
    current_value DECIMAL,
    threshold DECIMAL,
    status TEXT,
    message TEXT
) AS $$
DECLARE
    alert_def RECORD;
    v_current_value DECIMAL;
    v_severity TEXT;
    v_threshold DECIMAL;
    v_should_fire BOOLEAN;
    v_existing_alert_id INTEGER;
BEGIN
    FOR alert_def IN SELECT * FROM monitoring.alert_definitions WHERE is_active = TRUE
    LOOP
        BEGIN
            -- Execute the metric query
            EXECUTE alert_def.metric_query INTO v_current_value;
            
            -- Determine if alert should fire
            v_should_fire := FALSE;
            v_severity := NULL;
            v_threshold := NULL;
            
            IF v_current_value >= alert_def.threshold_critical THEN
                v_should_fire := TRUE;
                v_severity := 'CRITICAL';
                v_threshold := alert_def.threshold_critical;
            ELSIF v_current_value >= alert_def.threshold_warning THEN
                v_should_fire := TRUE;
                v_severity := 'WARNING';
                v_threshold := alert_def.threshold_warning;
            END IF;
            
            -- Check for existing active alert
            SELECT id INTO v_existing_alert_id
            FROM monitoring.alert_instances
            WHERE alert_definition_id = alert_def.id
            AND status = 'FIRING'
            ORDER BY fired_at DESC
            LIMIT 1;
            
            IF v_should_fire THEN
                -- Fire new alert or update existing
                IF v_existing_alert_id IS NULL THEN
                    INSERT INTO monitoring.alert_instances (
                        alert_definition_id, severity, status, value, message
                    ) VALUES (
                        alert_def.id, v_severity, 'FIRING', v_current_value,
                        format('%s: %s (threshold: %s)', alert_def.alert_name, v_current_value, v_threshold)
                    );
                    
                    RETURN QUERY SELECT 
                        alert_def.alert_name, v_severity, v_current_value, v_threshold, 
                        'FIRED'::TEXT,
                        format('Alert fired: %s is %s (threshold: %s)', alert_def.alert_name, v_current_value, v_threshold);
                ELSE
                    -- Update existing alert
                    UPDATE monitoring.alert_instances 
                    SET value = v_current_value, severity = v_severity
                    WHERE id = v_existing_alert_id;
                    
                    RETURN QUERY SELECT 
                        alert_def.alert_name, v_severity, v_current_value, v_threshold, 
                        'ACTIVE'::TEXT,
                        format('Alert active: %s is %s (threshold: %s)', alert_def.alert_name, v_current_value, v_threshold);
                END IF;
            ELSE
                -- Resolve existing alert if value is now OK
                IF v_existing_alert_id IS NOT NULL THEN
                    UPDATE monitoring.alert_instances 
                    SET status = 'RESOLVED', resolved_at = NOW()
                    WHERE id = v_existing_alert_id;
                    
                    RETURN QUERY SELECT 
                        alert_def.alert_name, 'INFO'::TEXT, v_current_value, v_threshold, 
                        'RESOLVED'::TEXT,
                        format('Alert resolved: %s is now %s', alert_def.alert_name, v_current_value);
                END IF;
            END IF;
            
        EXCEPTION WHEN OTHERS THEN
            -- Log alert evaluation error
            INSERT INTO monitoring.alert_instances (
                alert_definition_id, severity, status, message
            ) VALUES (
                alert_def.id, 'CRITICAL', 'FIRING',
                format('Alert evaluation failed: %s - %s', alert_def.alert_name, SQLERRM)
            );
            
            RETURN QUERY SELECT 
                alert_def.alert_name, 'CRITICAL'::TEXT, 0::DECIMAL, 0::DECIMAL, 
                'ERROR'::TEXT,
                format('Alert evaluation error: %s', SQLERRM);
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ==================== SYSTEM HEALTH MONITORING ====================

-- Function to create system health snapshot
CREATE OR REPLACE FUNCTION monitoring.create_health_snapshot()
RETURNS monitoring.system_health_snapshots AS $$
DECLARE
    v_snapshot monitoring.system_health_snapshots;
    v_db_size_mb DECIMAL(12,2);
    v_active_connections INTEGER;
    v_slow_queries INTEGER;
    v_blocked_queries INTEGER;
    v_chunks_count INTEGER;
    v_compression_ratio DECIMAL(5,2);
    v_health_score DECIMAL(5,2);
BEGIN
    -- Collect basic metrics
    SELECT pg_size_bytes(pg_database_size(current_database())) / 1024.0 / 1024.0 INTO v_db_size_mb;
    SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active' INTO v_active_connections;
    SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active' AND query_start < NOW() - INTERVAL '30 seconds' INTO v_slow_queries;
    SELECT COUNT(*) FROM pg_stat_activity WHERE wait_event_type = 'Lock' INTO v_blocked_queries;
    
    -- TimescaleDB metrics
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
        SELECT COUNT(*) FROM timescaledb_information.chunks INTO v_chunks_count;
        SELECT COALESCE(AVG(
            CASE WHEN uncompressed_heap_size > 0 
            THEN (1 - compressed_heap_size::float / uncompressed_heap_size::float) * 100 
            ELSE 0 END
        ), 0) FROM timescaledb_information.compressed_chunk_stats INTO v_compression_ratio;
    ELSE
        v_chunks_count := 0;
        v_compression_ratio := 0;
    END IF;
    
    -- Calculate health score (0-100)
    v_health_score := 100;
    
    -- Deduct points for issues
    IF v_active_connections > 80 THEN v_health_score := v_health_score - 20; END IF;
    IF v_slow_queries > 5 THEN v_health_score := v_health_score - 15; END IF;
    IF v_blocked_queries > 0 THEN v_health_score := v_health_score - 10; END IF;
    IF v_chunks_count > 5000 THEN v_health_score := v_health_score - 10; END IF;
    IF v_compression_ratio < 50 THEN v_health_score := v_health_score - 5; END IF;
    
    v_health_score := GREATEST(0, v_health_score);
    
    -- Create snapshot
    INSERT INTO monitoring.system_health_snapshots (
        database_size_mb, active_connections, slow_queries_count, 
        blocked_queries_count, timescaledb_chunks_count, 
        compression_ratio_percent, health_score
    ) VALUES (
        v_db_size_mb, v_active_connections, v_slow_queries,
        v_blocked_queries, v_chunks_count, v_compression_ratio, v_health_score
    ) RETURNING * INTO v_snapshot;
    
    RETURN v_snapshot;
END;
$$ LANGUAGE plpgsql;

-- ==================== MONITORING VIEWS ====================

-- Current system status view
CREATE OR REPLACE VIEW monitoring.current_system_status AS
SELECT 
    'Database Health' as component,
    CASE 
        WHEN health_score >= 90 THEN 'HEALTHY'
        WHEN health_score >= 70 THEN 'WARNING' 
        ELSE 'CRITICAL'
    END as status,
    health_score as score,
    format('Health Score: %s/100', health_score) as details
FROM monitoring.system_health_snapshots 
ORDER BY snapshot_time DESC 
LIMIT 1

UNION ALL

SELECT 
    'Active Alerts' as component,
    CASE 
        WHEN COUNT(CASE WHEN severity = 'CRITICAL' THEN 1 END) > 0 THEN 'CRITICAL'
        WHEN COUNT(CASE WHEN severity = 'WARNING' THEN 1 END) > 0 THEN 'WARNING'
        ELSE 'OK'
    END as status,
    COUNT(*) as score,
    format('%s alerts (%s critical, %s warning)', 
           COUNT(*),
           COUNT(CASE WHEN severity = 'CRITICAL' THEN 1 END),
           COUNT(CASE WHEN severity = 'WARNING' THEN 1 END)) as details
FROM monitoring.alert_instances 
WHERE status = 'FIRING'

UNION ALL

SELECT 
    'Data Quality' as component,
    CASE 
        WHEN AVG(CASE WHEN metric_tags->>'table' = 'device_data' THEN metric_value END) >= 95 THEN 'OK'
        WHEN AVG(CASE WHEN metric_tags->>'table' = 'device_data' THEN metric_value END) >= 85 THEN 'WARNING'
        ELSE 'CRITICAL'
    END as status,
    ROUND(AVG(CASE WHEN metric_tags->>'table' = 'device_data' THEN metric_value END), 2) as score,
    format('Average Quality Score: %s%%', 
           ROUND(AVG(CASE WHEN metric_tags->>'table' = 'device_data' THEN metric_value END), 2)) as details
FROM monitoring.performance_metrics 
WHERE metric_name = 'data_quality_score' 
AND metric_timestamp >= NOW() - INTERVAL '1 hour';

-- Performance trends view
CREATE OR REPLACE VIEW monitoring.performance_trends AS
SELECT 
    DATE_TRUNC('hour', metric_timestamp) as hour,
    metric_name,
    AVG(metric_value) as avg_value,
    MIN(metric_value) as min_value,
    MAX(metric_value) as max_value,
    COUNT(*) as measurements,
    COUNT(CASE WHEN status IN ('WARNING', 'CRITICAL') THEN 1 END) as issues_count
FROM monitoring.performance_metrics 
WHERE metric_timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', metric_timestamp), metric_name
ORDER BY hour DESC, metric_name;

-- Active alerts summary
CREATE OR REPLACE VIEW monitoring.active_alerts_summary AS
SELECT 
    ad.alert_name,
    ai.severity,
    ai.value as current_value,
    CASE ai.severity 
        WHEN 'CRITICAL' THEN ad.threshold_critical 
        ELSE ad.threshold_warning 
    END as threshold,
    ai.fired_at,
    EXTRACT(EPOCH FROM (NOW() - ai.fired_at))/60 as duration_minutes,
    ai.message,
    ai.notification_sent
FROM monitoring.alert_instances ai
JOIN monitoring.alert_definitions ad ON ai.alert_definition_id = ad.id
WHERE ai.status = 'FIRING'
ORDER BY ai.severity DESC, ai.fired_at ASC;

-- ==================== DEFAULT ALERT DEFINITIONS ====================

-- Insert default alert definitions
INSERT INTO monitoring.alert_definitions (alert_name, description, metric_query, threshold_warning, threshold_critical, notification_channels) VALUES
('High Active Connections', 'Monitor active database connections', 
 'SELECT COUNT(*) FROM pg_stat_activity WHERE state = ''active''', 80, 95, ARRAY['email']),

('Slow Query Count', 'Monitor queries running longer than 30 seconds',
 'SELECT COUNT(*) FROM pg_stat_activity WHERE state = ''active'' AND query_start < NOW() - INTERVAL ''30 seconds''', 5, 10, ARRAY['email', 'slack']),

('Database Size Growth', 'Monitor database size in MB',
 'SELECT pg_size_bytes(pg_database_size(current_database())) / 1024.0 / 1024.0', 10000, 50000, ARRAY['email']),

('Low Cache Hit Ratio', 'Monitor cache hit ratio percentage',
 'SELECT 100.0 - ROUND(100.0 * sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit + heap_blks_read), 0), 2) FROM pg_statio_user_tables', 5, 10, ARRAY['email']),

('Data Quality Score', 'Monitor overall data quality for device_data',
 'SELECT 100 - AVG(metric_value) FROM monitoring.performance_metrics WHERE metric_name = ''data_quality_score'' AND metric_tags->>''table'' = ''device_data'' AND metric_timestamp >= NOW() - INTERVAL ''1 hour''', 15, 25, ARRAY['email']),

('TimescaleDB Chunks Count', 'Monitor number of TimescaleDB chunks',
 'SELECT COUNT(*) FROM timescaledb_information.chunks', 5000, 10000, ARRAY['email']),

('Failed Background Jobs', 'Monitor failed TimescaleDB background jobs',
 'SELECT COUNT(*) FROM timescaledb_information.jobs WHERE last_run_status = ''Error''', 1, 5, ARRAY['email', 'slack'])

ON CONFLICT (alert_name) DO UPDATE SET
    description = EXCLUDED.description,
    metric_query = EXCLUDED.metric_query,
    threshold_warning = EXCLUDED.threshold_warning,
    threshold_critical = EXCLUDED.threshold_critical,
    updated_at = NOW();

-- ==================== AUTOMATED MONITORING PROCEDURES ====================

-- Function to run comprehensive monitoring check
CREATE OR REPLACE FUNCTION monitoring.run_monitoring_check()
RETURNS TABLE(
    check_type TEXT,
    status TEXT,
    details TEXT,
    action_required BOOLEAN
) AS $$
BEGIN
    -- Collect performance metrics
    PERFORM monitoring.collect_performance_metrics();
    
    -- Collect TimescaleDB metrics
    PERFORM monitoring.collect_timescaledb_metrics();
    
    -- Monitor data quality
    PERFORM monitoring.monitor_data_quality();
    
    -- Evaluate alerts
    PERFORM monitoring.evaluate_alerts();
    
    -- Create health snapshot
    PERFORM monitoring.create_health_snapshot();
    
    -- Return summary of current status
    RETURN QUERY
    SELECT 
        'Performance Metrics'::TEXT as check_type,
        CASE 
            WHEN COUNT(CASE WHEN status IN ('WARNING', 'CRITICAL') THEN 1 END) = 0 THEN 'OK'
            WHEN COUNT(CASE WHEN status = 'CRITICAL' THEN 1 END) > 0 THEN 'CRITICAL'
            ELSE 'WARNING'
        END as status,
        format('Collected %s metrics, %s issues found', 
               COUNT(*), 
               COUNT(CASE WHEN status IN ('WARNING', 'CRITICAL') THEN 1 END)) as details,
        COUNT(CASE WHEN status = 'CRITICAL' THEN 1 END) > 0 as action_required
    FROM monitoring.performance_metrics 
    WHERE metric_timestamp >= NOW() - INTERVAL '5 minutes'
    
    UNION ALL
    
    SELECT 
        'Active Alerts'::TEXT as check_type,
        CASE 
            WHEN COUNT(CASE WHEN severity = 'CRITICAL' THEN 1 END) > 0 THEN 'CRITICAL'
            WHEN COUNT(*) > 0 THEN 'WARNING'
            ELSE 'OK'
        END as status,
        format('%s active alerts', COUNT(*)) as details,
        COUNT(*) > 0 as action_required
    FROM monitoring.alert_instances 
    WHERE status = 'FIRING';
END;
$$ LANGUAGE plpgsql;

-- Create indexes for monitoring tables
CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp ON monitoring.performance_metrics(metric_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_name_status ON monitoring.performance_metrics(metric_name, status);
CREATE INDEX IF NOT EXISTS idx_alert_instances_status_severity ON monitoring.alert_instances(status, severity);
CREATE INDEX IF NOT EXISTS idx_alert_instances_definition_status ON monitoring.alert_instances(alert_definition_id, status);
CREATE INDEX IF NOT EXISTS idx_health_snapshots_time ON monitoring.system_health_snapshots(snapshot_time DESC);

-- Grant permissions
GRANT ALL PRIVILEGES ON SCHEMA monitoring TO fulsk_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA monitoring TO fulsk_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA monitoring TO fulsk_user;

-- Summary
DO $$
BEGIN
    RAISE NOTICE '=== Database Monitoring and Alerting Setup Complete ===';
    RAISE NOTICE 'Created schema: monitoring';
    RAISE NOTICE 'Created tables: performance_metrics, alert_definitions, alert_instances, system_health_snapshots';
    RAISE NOTICE 'Created functions: collect_performance_metrics, collect_timescaledb_metrics, monitor_data_quality';
    RAISE NOTICE 'Created functions: evaluate_alerts, create_health_snapshot, run_monitoring_check';
    RAISE NOTICE 'Created views: current_system_status, performance_trends, active_alerts_summary';
    RAISE NOTICE 'Inserted % default alert definitions', (SELECT COUNT(*) FROM monitoring.alert_definitions);
    RAISE NOTICE '';
    RAISE NOTICE 'To run monitoring check: SELECT * FROM monitoring.run_monitoring_check();';
    RAISE NOTICE 'To view current status: SELECT * FROM monitoring.current_system_status;';
    RAISE NOTICE 'To view active alerts: SELECT * FROM monitoring.active_alerts_summary;';
END $$;