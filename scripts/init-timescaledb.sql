-- Initialize TimescaleDB extension for Fulsk Solar Monitoring
-- This script runs automatically when the PostgreSQL container starts

-- Create TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Create the database (if it doesn't exist from environment)
SELECT 'CREATE DATABASE fulsk'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'fulsk')\gexec

-- Switch to fulsk database context will be handled by the container
-- The following commands will run in the fulsk database

-- Enable TimescaleDB on the database
-- Note: This will be executed after Prisma migrations create the tables

-- Function to setup hypertable after device_data table is created
CREATE OR REPLACE FUNCTION setup_timescaledb_hypertables()
RETURNS VOID AS $$
BEGIN
    -- Check if device_data table exists and convert to hypertable
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'device_data'
    ) THEN
        -- Convert device_data to hypertable if not already
        IF NOT EXISTS (
            SELECT FROM timescaledb_information.hypertables 
            WHERE hypertable_name = 'device_data'
        ) THEN
            PERFORM create_hypertable('device_data', 'timestamp', 
                                    chunk_time_interval => INTERVAL '1 day',
                                    if_not_exists => TRUE);
        END IF;
        
        -- Add compression policy (compress chunks older than 7 days)
        SELECT add_compression_policy('device_data', INTERVAL '7 days', if_not_exists => TRUE);
        
        -- Add retention policy (drop chunks older than 2 years)
        SELECT add_retention_policy('device_data', INTERVAL '2 years', if_not_exists => TRUE);
        
        -- Create continuous aggregates for hourly data
        CREATE MATERIALIZED VIEW IF NOT EXISTS device_data_hourly
        WITH (timescaledb.continuous) AS
        SELECT 
            device_id,
            time_bucket('1 hour', timestamp) AS hour,
            AVG(power) as avg_power,
            MAX(power) as max_power,
            MIN(power) as min_power,
            AVG(voltage) as avg_voltage,
            AVG(current) as avg_current,
            AVG(temperature) as avg_temperature,
            AVG(efficiency) as avg_efficiency,
            SUM(energy_today) as total_energy_hour,
            COUNT(*) as data_points
        FROM device_data
        GROUP BY device_id, hour;
        
        -- Create continuous aggregates for daily data
        CREATE MATERIALIZED VIEW IF NOT EXISTS device_data_daily
        WITH (timescaledb.continuous) AS
        SELECT 
            device_id,
            time_bucket('1 day', timestamp) AS day,
            AVG(power) as avg_power,
            MAX(power) as max_power,
            MIN(power) as min_power,
            AVG(voltage) as avg_voltage,
            AVG(current) as avg_current,
            AVG(temperature) as avg_temperature,
            AVG(efficiency) as avg_efficiency,
            MAX(energy_today) as total_energy_day,
            COUNT(*) as data_points
        FROM device_data
        GROUP BY device_id, day;
        
        -- Add refresh policies for continuous aggregates
        SELECT add_continuous_aggregate_policy('device_data_hourly',
            start_offset => INTERVAL '3 hours',
            end_offset => INTERVAL '1 hour',
            schedule_interval => INTERVAL '1 hour',
            if_not_exists => TRUE);
            
        SELECT add_continuous_aggregate_policy('device_data_daily',
            start_offset => INTERVAL '2 days',
            end_offset => INTERVAL '1 day',
            schedule_interval => INTERVAL '1 day',
            if_not_exists => TRUE);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions to fulsk_user
GRANT ALL PRIVILEGES ON DATABASE fulsk TO fulsk_user;
GRANT USAGE ON SCHEMA public TO fulsk_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO fulsk_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO fulsk_user;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO fulsk_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO fulsk_user;

-- Create function to call after migrations
CREATE OR REPLACE FUNCTION initialize_fulsk_timescaledb()
RETURNS VOID AS $$
BEGIN
    PERFORM setup_timescaledb_hypertables();
    RAISE NOTICE 'TimescaleDB setup completed for Fulsk';
END;
$$ LANGUAGE plpgsql;