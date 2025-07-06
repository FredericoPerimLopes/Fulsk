-- Data Lifecycle Management for Solar Inverter Monitoring
-- Comprehensive data archival, backup, and recovery procedures

-- ==================== DATA LIFECYCLE CONFIGURATION ====================

-- Create schema for archival and management
CREATE SCHEMA IF NOT EXISTS data_lifecycle;

-- Configuration table for data lifecycle policies
CREATE TABLE IF NOT EXISTS data_lifecycle.lifecycle_policies (
    id SERIAL PRIMARY KEY,
    table_name TEXT NOT NULL,
    policy_type TEXT NOT NULL, -- 'retention', 'archival', 'compression'
    condition_sql TEXT NOT NULL,
    action_sql TEXT NOT NULL,
    schedule_cron TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Audit table for lifecycle operations
CREATE TABLE IF NOT EXISTS data_lifecycle.lifecycle_audit (
    id SERIAL PRIMARY KEY,
    operation_type TEXT NOT NULL,
    table_name TEXT NOT NULL,
    records_affected BIGINT,
    operation_details JSONB,
    execution_time INTERVAL,
    status TEXT NOT NULL, -- 'SUCCESS', 'FAILED', 'PARTIAL'
    error_message TEXT,
    executed_at TIMESTAMP DEFAULT NOW()
);

-- Data quality metrics tracking
CREATE TABLE IF NOT EXISTS data_lifecycle.data_quality_history (
    id SERIAL PRIMARY KEY,
    table_name TEXT NOT NULL,
    metric_date DATE NOT NULL,
    total_records BIGINT,
    null_records BIGINT,
    duplicate_records BIGINT,
    invalid_records BIGINT,
    completeness_score DECIMAL(5,2),
    accuracy_score DECIMAL(5,2),
    timeliness_score DECIMAL(5,2),
    overall_quality_score DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(table_name, metric_date)
);

-- ==================== DATA ARCHIVAL FUNCTIONS ====================

-- Function to archive old data to external storage or archive tables
CREATE OR REPLACE FUNCTION data_lifecycle.archive_old_data(
    p_table_name TEXT,
    p_archive_threshold INTERVAL,
    p_batch_size INTEGER DEFAULT 10000
)
RETURNS TABLE(
    records_archived BIGINT,
    execution_time INTERVAL,
    status TEXT
) AS $$
DECLARE
    v_start_time TIMESTAMP;
    v_end_time TIMESTAMP;
    v_records_processed BIGINT := 0;
    v_archive_table TEXT;
    v_sql TEXT;
    v_error_msg TEXT;
BEGIN
    v_start_time := clock_timestamp();
    v_archive_table := p_table_name || '_archive';
    
    -- Create archive table if it doesn't exist
    v_sql := format('
        CREATE TABLE IF NOT EXISTS %s (LIKE %s INCLUDING ALL);
        ', v_archive_table, p_table_name);
    
    EXECUTE v_sql;
    
    -- Archive data in batches
    LOOP
        v_sql := format('
            WITH archived_data AS (
                DELETE FROM %s 
                WHERE timestamp < NOW() - %L
                AND timestamp IN (
                    SELECT timestamp FROM %s 
                    WHERE timestamp < NOW() - %L
                    ORDER BY timestamp 
                    LIMIT %s
                )
                RETURNING *
            )
            INSERT INTO %s SELECT * FROM archived_data;
            ', p_table_name, p_archive_threshold, p_table_name, p_archive_threshold, p_batch_size, v_archive_table);
        
        EXECUTE v_sql;
        GET DIAGNOSTICS v_records_processed = ROW_COUNT;
        
        -- Log progress
        IF v_records_processed > 0 THEN
            RAISE NOTICE 'Archived % records from %', v_records_processed, p_table_name;
        END IF;
        
        -- Exit if no more records to archive
        EXIT WHEN v_records_processed = 0;
        
        -- Commit batch and pause briefly
        COMMIT;
        PERFORM pg_sleep(0.1);
    END LOOP;
    
    v_end_time := clock_timestamp();
    
    -- Log archival operation
    INSERT INTO data_lifecycle.lifecycle_audit (
        operation_type, table_name, records_affected, 
        execution_time, status, operation_details
    ) VALUES (
        'ARCHIVE', p_table_name, v_records_processed,
        v_end_time - v_start_time, 'SUCCESS',
        jsonb_build_object(
            'archive_threshold', p_archive_threshold,
            'batch_size', p_batch_size,
            'archive_table', v_archive_table
        )
    );
    
    RETURN QUERY SELECT 
        v_records_processed,
        v_end_time - v_start_time,
        'SUCCESS'::TEXT;
        
EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error_msg = MESSAGE_TEXT;
    
    -- Log failed operation
    INSERT INTO data_lifecycle.lifecycle_audit (
        operation_type, table_name, records_affected,
        execution_time, status, error_message
    ) VALUES (
        'ARCHIVE', p_table_name, 0,
        clock_timestamp() - v_start_time, 'FAILED', v_error_msg
    );
    
    RETURN QUERY SELECT 
        0::BIGINT,
        clock_timestamp() - v_start_time,
        'FAILED'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ==================== DATA QUALITY ASSESSMENT ====================

-- Function to assess data quality
CREATE OR REPLACE FUNCTION data_lifecycle.assess_data_quality(
    p_table_name TEXT,
    p_assessment_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
    table_name TEXT,
    total_records BIGINT,
    null_records BIGINT,
    duplicate_records BIGINT,
    invalid_records BIGINT,
    completeness_score DECIMAL,
    accuracy_score DECIMAL,
    timeliness_score DECIMAL,
    overall_quality_score DECIMAL
) AS $$
DECLARE
    v_total_records BIGINT;
    v_null_records BIGINT;
    v_duplicate_records BIGINT;
    v_invalid_records BIGINT;
    v_completeness_score DECIMAL(5,2);
    v_accuracy_score DECIMAL(5,2);
    v_timeliness_score DECIMAL(5,2);
    v_overall_quality_score DECIMAL(5,2);
    v_sql TEXT;
BEGIN
    -- Assess data quality based on table type
    CASE p_table_name
        WHEN 'device_data' THEN
            -- Count total records for the day
            EXECUTE format('SELECT COUNT(*) FROM %s WHERE DATE(timestamp) = %L', 
                p_table_name, p_assessment_date) INTO v_total_records;
            
            -- Count null records (critical fields)
            EXECUTE format('
                SELECT COUNT(*) FROM %s 
                WHERE DATE(timestamp) = %L 
                AND (power IS NULL OR voltage IS NULL OR current IS NULL)', 
                p_table_name, p_assessment_date) INTO v_null_records;
            
            -- Count duplicate records
            EXECUTE format('
                SELECT COUNT(*) - COUNT(DISTINCT (deviceId, timestamp)) FROM %s 
                WHERE DATE(timestamp) = %L', 
                p_table_name, p_assessment_date) INTO v_duplicate_records;
            
            -- Count invalid records (out of range values)
            EXECUTE format('
                SELECT COUNT(*) FROM %s 
                WHERE DATE(timestamp) = %L 
                AND (power < 0 OR power > 100000 OR voltage < 0 OR voltage > 1000 
                     OR current < 0 OR current > 1000 OR temperature < -50 OR temperature > 150)', 
                p_table_name, p_assessment_date) INTO v_invalid_records;
                
        WHEN 'inverter_data' THEN
            -- Similar assessments for inverter data
            EXECUTE format('SELECT COUNT(*) FROM %s WHERE DATE(timestamp) = %L', 
                p_table_name, p_assessment_date) INTO v_total_records;
            
            EXECUTE format('
                SELECT COUNT(*) FROM %s 
                WHERE DATE(timestamp) = %L 
                AND (acPower IS NULL OR dcPower IS NULL)', 
                p_table_name, p_assessment_date) INTO v_null_records;
            
            EXECUTE format('
                SELECT COUNT(*) - COUNT(DISTINCT (deviceId, timestamp)) FROM %s 
                WHERE DATE(timestamp) = %L', 
                p_table_name, p_assessment_date) INTO v_duplicate_records;
            
            EXECUTE format('
                SELECT COUNT(*) FROM %s 
                WHERE DATE(timestamp) = %L 
                AND (acPower < 0 OR dcPower < 0 OR efficiency < 0 OR efficiency > 100)', 
                p_table_name, p_assessment_date) INTO v_invalid_records;
                
        ELSE
            -- Generic assessment for other tables
            EXECUTE format('SELECT COUNT(*) FROM %s WHERE DATE(timestamp) = %L', 
                p_table_name, p_assessment_date) INTO v_total_records;
            v_null_records := 0;
            v_duplicate_records := 0;
            v_invalid_records := 0;
    END CASE;
    
    -- Calculate quality scores
    v_completeness_score := CASE 
        WHEN v_total_records = 0 THEN 0 
        ELSE ROUND((1.0 - v_null_records::DECIMAL / v_total_records) * 100, 2) 
    END;
    
    v_accuracy_score := CASE 
        WHEN v_total_records = 0 THEN 0 
        ELSE ROUND((1.0 - v_invalid_records::DECIMAL / v_total_records) * 100, 2) 
    END;
    
    v_timeliness_score := CASE 
        WHEN v_total_records = 0 THEN 0 
        ELSE ROUND((1.0 - v_duplicate_records::DECIMAL / v_total_records) * 100, 2) 
    END;
    
    v_overall_quality_score := ROUND((v_completeness_score + v_accuracy_score + v_timeliness_score) / 3, 2);
    
    -- Store in history
    INSERT INTO data_lifecycle.data_quality_history (
        table_name, metric_date, total_records, null_records, 
        duplicate_records, invalid_records, completeness_score,
        accuracy_score, timeliness_score, overall_quality_score
    ) VALUES (
        p_table_name, p_assessment_date, v_total_records, v_null_records,
        v_duplicate_records, v_invalid_records, v_completeness_score,
        v_accuracy_score, v_timeliness_score, v_overall_quality_score
    ) ON CONFLICT (table_name, metric_date) DO UPDATE SET
        total_records = EXCLUDED.total_records,
        null_records = EXCLUDED.null_records,
        duplicate_records = EXCLUDED.duplicate_records,
        invalid_records = EXCLUDED.invalid_records,
        completeness_score = EXCLUDED.completeness_score,
        accuracy_score = EXCLUDED.accuracy_score,
        timeliness_score = EXCLUDED.timeliness_score,
        overall_quality_score = EXCLUDED.overall_quality_score,
        created_at = NOW();
    
    RETURN QUERY SELECT 
        p_table_name,
        v_total_records,
        v_null_records,
        v_duplicate_records,
        v_invalid_records,
        v_completeness_score,
        v_accuracy_score,
        v_timeliness_score,
        v_overall_quality_score;
END;
$$ LANGUAGE plpgsql;

-- ==================== DATA CLEANUP FUNCTIONS ====================

-- Function to clean up duplicate and invalid data
CREATE OR REPLACE FUNCTION data_lifecycle.cleanup_data_quality_issues(
    p_table_name TEXT,
    p_fix_duplicates BOOLEAN DEFAULT TRUE,
    p_fix_nulls BOOLEAN DEFAULT FALSE,
    p_fix_invalid BOOLEAN DEFAULT TRUE
)
RETURNS TABLE(
    issue_type TEXT,
    records_fixed BIGINT,
    status TEXT
) AS $$
DECLARE
    v_duplicates_fixed BIGINT := 0;
    v_nulls_fixed BIGINT := 0;
    v_invalid_fixed BIGINT := 0;
    v_sql TEXT;
BEGIN
    -- Fix duplicates by keeping the latest record
    IF p_fix_duplicates THEN
        v_sql := format('
            DELETE FROM %s a USING %s b 
            WHERE a.deviceId = b.deviceId 
            AND a.timestamp = b.timestamp 
            AND a.ctid < b.ctid', p_table_name, p_table_name);
        
        EXECUTE v_sql;
        GET DIAGNOSTICS v_duplicates_fixed = ROW_COUNT;
        
        RETURN QUERY SELECT 'DUPLICATES'::TEXT, v_duplicates_fixed, 'SUCCESS'::TEXT;
    END IF;
    
    -- Handle null values (interpolation or deletion)
    IF p_fix_nulls THEN
        CASE p_table_name
            WHEN 'device_data' THEN
                -- For device_data, interpolate power values
                v_sql := format('
                    UPDATE %s SET power = (
                        SELECT AVG(power) FROM %s b 
                        WHERE b.deviceId = %s.deviceId 
                        AND b.timestamp BETWEEN %s.timestamp - INTERVAL ''1 hour'' 
                                            AND %s.timestamp + INTERVAL ''1 hour''
                        AND b.power IS NOT NULL
                    ) WHERE power IS NULL AND timestamp >= NOW() - INTERVAL ''7 days''',
                    p_table_name, p_table_name, p_table_name, p_table_name, p_table_name);
                
                EXECUTE v_sql;
                GET DIAGNOSTICS v_nulls_fixed = ROW_COUNT;
        END CASE;
        
        RETURN QUERY SELECT 'NULL_VALUES'::TEXT, v_nulls_fixed, 'SUCCESS'::TEXT;
    END IF;
    
    -- Fix invalid values
    IF p_fix_invalid THEN
        CASE p_table_name
            WHEN 'device_data' THEN
                -- Delete records with impossible values
                v_sql := format('
                    DELETE FROM %s 
                    WHERE power < 0 OR power > 100000 
                    OR voltage < 0 OR voltage > 1000 
                    OR current < 0 OR current > 1000 
                    OR temperature < -50 OR temperature > 150',
                    p_table_name);
                
                EXECUTE v_sql;
                GET DIAGNOSTICS v_invalid_fixed = ROW_COUNT;
                
            WHEN 'inverter_data' THEN
                -- Delete records with impossible values
                v_sql := format('
                    DELETE FROM %s 
                    WHERE acPower < 0 OR dcPower < 0 
                    OR efficiency < 0 OR efficiency > 100',
                    p_table_name);
                
                EXECUTE v_sql;
                GET DIAGNOSTICS v_invalid_fixed = ROW_COUNT;
        END CASE;
        
        RETURN QUERY SELECT 'INVALID_VALUES'::TEXT, v_invalid_fixed, 'SUCCESS'::TEXT;
    END IF;
    
    -- Log cleanup operation
    INSERT INTO data_lifecycle.lifecycle_audit (
        operation_type, table_name, records_affected, 
        status, operation_details
    ) VALUES (
        'CLEANUP', p_table_name, v_duplicates_fixed + v_nulls_fixed + v_invalid_fixed,
        'SUCCESS',
        jsonb_build_object(
            'duplicates_fixed', v_duplicates_fixed,
            'nulls_fixed', v_nulls_fixed,
            'invalid_fixed', v_invalid_fixed
        )
    );
END;
$$ LANGUAGE plpgsql;

-- ==================== BACKUP AND RECOVERY FUNCTIONS ====================

-- Function to create logical backup of specific time range
CREATE OR REPLACE FUNCTION data_lifecycle.create_logical_backup(
    p_table_name TEXT,
    p_start_date TIMESTAMP,
    p_end_date TIMESTAMP,
    p_backup_path TEXT DEFAULT '/tmp/backups/'
)
RETURNS TABLE(
    backup_file TEXT,
    records_backed_up BIGINT,
    file_size_mb DECIMAL,
    status TEXT
) AS $$
DECLARE
    v_backup_file TEXT;
    v_sql TEXT;
    v_records_count BIGINT;
BEGIN
    -- Generate backup filename
    v_backup_file := p_backup_path || p_table_name || '_' || 
                     to_char(p_start_date, 'YYYY-MM-DD') || '_to_' || 
                     to_char(p_end_date, 'YYYY-MM-DD') || '_' ||
                     to_char(NOW(), 'YYYY-MM-DD_HH24-MI-SS') || '.sql';
    
    -- Create backup directory if it doesn't exist
    PERFORM pg_catalog.pg_file_write(v_backup_file, '', false);
    
    -- Count records to be backed up
    v_sql := format('SELECT COUNT(*) FROM %s WHERE timestamp BETWEEN %L AND %L',
                   p_table_name, p_start_date, p_end_date);
    EXECUTE v_sql INTO v_records_count;
    
    -- Create the backup using pg_dump-like functionality
    v_sql := format('COPY (SELECT * FROM %s WHERE timestamp BETWEEN %L AND %L) TO %L WITH CSV HEADER',
                   p_table_name, p_start_date, p_end_date, v_backup_file);
    
    EXECUTE v_sql;
    
    -- Log backup operation
    INSERT INTO data_lifecycle.lifecycle_audit (
        operation_type, table_name, records_affected,
        status, operation_details
    ) VALUES (
        'BACKUP', p_table_name, v_records_count,
        'SUCCESS',
        jsonb_build_object(
            'backup_file', v_backup_file,
            'start_date', p_start_date,
            'end_date', p_end_date
        )
    );
    
    RETURN QUERY SELECT 
        v_backup_file,
        v_records_count,
        0.0::DECIMAL, -- File size would need to be calculated externally
        'SUCCESS'::TEXT;
        
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 
        v_backup_file,
        0::BIGINT,
        0.0::DECIMAL,
        'FAILED'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Function to restore data from backup
CREATE OR REPLACE FUNCTION data_lifecycle.restore_from_backup(
    p_table_name TEXT,
    p_backup_file TEXT,
    p_restore_mode TEXT DEFAULT 'APPEND' -- 'APPEND', 'REPLACE', 'MERGE'
)
RETURNS TABLE(
    records_restored BIGINT,
    status TEXT,
    message TEXT
) AS $$
DECLARE
    v_temp_table TEXT;
    v_records_restored BIGINT;
    v_sql TEXT;
BEGIN
    v_temp_table := p_table_name || '_restore_temp';
    
    -- Create temporary table
    v_sql := format('CREATE TEMP TABLE %s (LIKE %s INCLUDING ALL)', v_temp_table, p_table_name);
    EXECUTE v_sql;
    
    -- Load data from backup file
    v_sql := format('COPY %s FROM %L WITH CSV HEADER', v_temp_table, p_backup_file);
    EXECUTE v_sql;
    
    -- Get count of records to restore
    v_sql := format('SELECT COUNT(*) FROM %s', v_temp_table);
    EXECUTE v_sql INTO v_records_restored;
    
    -- Handle different restore modes
    CASE p_restore_mode
        WHEN 'REPLACE' THEN
            -- Delete existing data in the time range and insert new
            v_sql := format('
                DELETE FROM %s WHERE timestamp IN (
                    SELECT timestamp FROM %s
                );
                INSERT INTO %s SELECT * FROM %s;',
                p_table_name, v_temp_table, p_table_name, v_temp_table);
            
        WHEN 'APPEND' THEN
            -- Just insert new data (may create duplicates)
            v_sql := format('INSERT INTO %s SELECT * FROM %s', p_table_name, v_temp_table);
            
        WHEN 'MERGE' THEN
            -- Insert only if not exists
            v_sql := format('
                INSERT INTO %s 
                SELECT * FROM %s t
                WHERE NOT EXISTS (
                    SELECT 1 FROM %s e 
                    WHERE e.deviceId = t.deviceId AND e.timestamp = t.timestamp
                )', p_table_name, v_temp_table, p_table_name);
    END CASE;
    
    EXECUTE v_sql;
    
    -- Drop temporary table
    v_sql := format('DROP TABLE %s', v_temp_table);
    EXECUTE v_sql;
    
    -- Log restore operation
    INSERT INTO data_lifecycle.lifecycle_audit (
        operation_type, table_name, records_affected,
        status, operation_details
    ) VALUES (
        'RESTORE', p_table_name, v_records_restored,
        'SUCCESS',
        jsonb_build_object(
            'backup_file', p_backup_file,
            'restore_mode', p_restore_mode
        )
    );
    
    RETURN QUERY SELECT 
        v_records_restored,
        'SUCCESS'::TEXT,
        format('Successfully restored %s records from %s', v_records_restored, p_backup_file);
        
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 
        0::BIGINT,
        'FAILED'::TEXT,
        SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- ==================== AUTOMATED LIFECYCLE POLICIES ====================

-- Insert default lifecycle policies
INSERT INTO data_lifecycle.lifecycle_policies (table_name, policy_type, condition_sql, action_sql, schedule_cron) VALUES
-- Archive old device data
('device_data', 'archival', 'timestamp < NOW() - INTERVAL ''1 year''', 
 'SELECT data_lifecycle.archive_old_data(''device_data'', ''1 year'', 10000)', '0 2 1 * *'),

-- Archive old inverter data
('inverter_data', 'archival', 'timestamp < NOW() - INTERVAL ''2 years''', 
 'SELECT data_lifecycle.archive_old_data(''inverter_data'', ''2 years'', 10000)', '0 3 1 * *'),

-- Clean up data quality issues daily
('device_data', 'cleanup', 'DATE(timestamp) = CURRENT_DATE - 1', 
 'SELECT data_lifecycle.cleanup_data_quality_issues(''device_data'', true, false, true)', '0 4 * * *'),

-- Assess data quality daily
('device_data', 'quality_check', 'DATE(timestamp) = CURRENT_DATE - 1', 
 'SELECT data_lifecycle.assess_data_quality(''device_data'', CURRENT_DATE - 1)', '0 5 * * *'),

-- Weekly backup of recent data
('device_data', 'backup', 'timestamp >= CURRENT_DATE - INTERVAL ''7 days''', 
 'SELECT data_lifecycle.create_logical_backup(''device_data'', CURRENT_DATE - INTERVAL ''7 days'', CURRENT_DATE)', '0 6 * * 0');

-- ==================== MONITORING AND REPORTING ====================

-- View for lifecycle policy monitoring
CREATE OR REPLACE VIEW data_lifecycle.policy_execution_summary AS
SELECT 
    lp.table_name,
    lp.policy_type,
    lp.schedule_cron,
    lp.is_active,
    la.executed_at as last_execution,
    la.status as last_status,
    la.records_affected as last_records_affected,
    la.execution_time as last_execution_time
FROM data_lifecycle.lifecycle_policies lp
LEFT JOIN LATERAL (
    SELECT * FROM data_lifecycle.lifecycle_audit la2
    WHERE la2.operation_type = UPPER(lp.policy_type)
    AND la2.table_name = lp.table_name
    ORDER BY la2.executed_at DESC
    LIMIT 1
) la ON true
ORDER BY lp.table_name, lp.policy_type;

-- View for data quality trends
CREATE OR REPLACE VIEW data_lifecycle.data_quality_trends AS
SELECT 
    table_name,
    metric_date,
    overall_quality_score,
    completeness_score,
    accuracy_score,
    timeliness_score,
    LAG(overall_quality_score) OVER (PARTITION BY table_name ORDER BY metric_date) as prev_quality_score,
    overall_quality_score - LAG(overall_quality_score) OVER (PARTITION BY table_name ORDER BY metric_date) as quality_trend
FROM data_lifecycle.data_quality_history
WHERE metric_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY table_name, metric_date DESC;

-- ==================== MAINTENANCE PROCEDURES ====================

-- Function to execute lifecycle policies
CREATE OR REPLACE FUNCTION data_lifecycle.execute_lifecycle_policies()
RETURNS TABLE(
    policy_id INTEGER,
    table_name TEXT,
    policy_type TEXT,
    execution_result TEXT
) AS $$
DECLARE
    policy_record RECORD;
    v_sql TEXT;
    v_result TEXT;
BEGIN
    FOR policy_record IN 
        SELECT * FROM data_lifecycle.lifecycle_policies 
        WHERE is_active = TRUE
    LOOP
        BEGIN
            -- Execute the policy action
            EXECUTE policy_record.action_sql;
            v_result := 'SUCCESS';
            
        EXCEPTION WHEN OTHERS THEN
            v_result := 'FAILED: ' || SQLERRM;
        END;
        
        RETURN QUERY SELECT 
            policy_record.id,
            policy_record.table_name,
            policy_record.policy_type,
            v_result;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for lifecycle tables
CREATE INDEX IF NOT EXISTS idx_lifecycle_audit_table_time ON data_lifecycle.lifecycle_audit(table_name, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_quality_history_table_date ON data_lifecycle.data_quality_history(table_name, metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_lifecycle_policies_active ON data_lifecycle.lifecycle_policies(is_active, table_name);

-- Grant permissions to the fulsk_user
GRANT ALL PRIVILEGES ON SCHEMA data_lifecycle TO fulsk_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA data_lifecycle TO fulsk_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA data_lifecycle TO fulsk_user;

-- Final summary
DO $$
BEGIN
    RAISE NOTICE '=== Data Lifecycle Management Setup Complete ===';
    RAISE NOTICE 'Created schema: data_lifecycle';
    RAISE NOTICE 'Created tables: lifecycle_policies, lifecycle_audit, data_quality_history';
    RAISE NOTICE 'Created functions: archive_old_data, assess_data_quality, cleanup_data_quality_issues';
    RAISE NOTICE 'Created functions: create_logical_backup, restore_from_backup, execute_lifecycle_policies';
    RAISE NOTICE 'Created views: policy_execution_summary, data_quality_trends';
    RAISE NOTICE 'Inserted default lifecycle policies';
    RAISE NOTICE '';
    RAISE NOTICE 'To execute lifecycle policies manually: SELECT * FROM data_lifecycle.execute_lifecycle_policies();';
    RAISE NOTICE 'To check data quality: SELECT * FROM data_lifecycle.assess_data_quality(''device_data'');';
    RAISE NOTICE 'To view policy status: SELECT * FROM data_lifecycle.policy_execution_summary;';
END $$;