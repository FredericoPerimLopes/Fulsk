#!/bin/bash

# Fulsk Backup Script
# Automated backup system for PostgreSQL, Redis, and application data

set -e

# Configuration
BACKUP_DIR="/backups"
RETENTION_DAYS=30
COMPRESSION_LEVEL=9
ENCRYPTION_KEY_FILE="/etc/fulsk/backup.key"
COMPOSE_FILE="docker-compose.prod.yml"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="fulsk_backup_$TIMESTAMP"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$BACKUP_DIR/backup.log"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$BACKUP_DIR/backup.log"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$BACKUP_DIR/backup.log"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$BACKUP_DIR/backup.log"
    exit 1
}

# Create backup directory
create_backup_dir() {
    log "Creating backup directory: $BACKUP_DIR/$BACKUP_NAME"
    mkdir -p "$BACKUP_DIR/$BACKUP_NAME"
    mkdir -p "$BACKUP_DIR/$BACKUP_NAME/postgres"
    mkdir -p "$BACKUP_DIR/$BACKUP_NAME/redis"
    mkdir -p "$BACKUP_DIR/$BACKUP_NAME/files"
    mkdir -p "$BACKUP_DIR/$BACKUP_NAME/config"
}

# Backup PostgreSQL
backup_postgres() {
    log "Starting PostgreSQL backup..."
    
    # Full database backup
    docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_dump -U fulsk_user -d fulsk > "$BACKUP_DIR/$BACKUP_NAME/postgres/fulsk_full.sql"
    
    # Schema-only backup
    docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_dump -U fulsk_user -d fulsk --schema-only > "$BACKUP_DIR/$BACKUP_NAME/postgres/fulsk_schema.sql"
    
    # Data-only backup
    docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_dump -U fulsk_user -d fulsk --data-only > "$BACKUP_DIR/$BACKUP_NAME/postgres/fulsk_data.sql"
    
    # Custom format backup (for parallel restore)
    docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_dump -U fulsk_user -d fulsk -Fc > "$BACKUP_DIR/$BACKUP_NAME/postgres/fulsk_custom.dump"
    
    # Backup global objects (users, roles, etc.)
    docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_dumpall -U fulsk_user --globals-only > "$BACKUP_DIR/$BACKUP_NAME/postgres/globals.sql"
    
    # Backup TimescaleDB specific data
    docker-compose -f "$BACKUP_NAME" exec -T postgres psql -U fulsk_user -d fulsk -c "SELECT * FROM timescaledb_information.hypertables;" > "$BACKUP_DIR/$BACKUP_NAME/postgres/timescaledb_info.sql"
    
    success "PostgreSQL backup completed"
}

# Backup Redis
backup_redis() {
    log "Starting Redis backup..."
    
    # Create Redis snapshot
    docker-compose -f "$COMPOSE_FILE" exec redis redis-cli --rdb /data/backup.rdb BGSAVE
    
    # Wait for backup to complete
    sleep 10
    
    # Copy RDB file
    docker-compose -f "$COMPOSE_FILE" exec redis cp /data/dump.rdb /data/backup_$TIMESTAMP.rdb
    docker cp $(docker-compose -f "$COMPOSE_FILE" ps -q redis):/data/backup_$TIMESTAMP.rdb "$BACKUP_DIR/$BACKUP_NAME/redis/redis_backup.rdb"
    
    # Backup Redis configuration
    docker-compose -f "$COMPOSE_FILE" exec redis cp /etc/redis/redis.conf "$BACKUP_DIR/$BACKUP_NAME/redis/redis.conf"
    
    success "Redis backup completed"
}

# Backup application files
backup_files() {
    log "Starting application files backup..."
    
    # Backup uploaded files
    if [ -d "./uploads" ]; then
        cp -r ./uploads "$BACKUP_DIR/$BACKUP_NAME/files/"
        success "Uploaded files backed up"
    else
        warning "No uploads directory found"
    fi
    
    # Backup logs
    if [ -d "./logs" ]; then
        cp -r ./logs "$BACKUP_DIR/$BACKUP_NAME/files/"
        success "Log files backed up"
    else
        warning "No logs directory found"
    fi
    
    # Backup certificates
    if [ -d "./nginx/ssl" ]; then
        cp -r ./nginx/ssl "$BACKUP_DIR/$BACKUP_NAME/files/"
        success "SSL certificates backed up"
    else
        warning "No SSL certificates found"
    fi
    
    success "Application files backup completed"
}

# Backup configuration files
backup_config() {
    log "Starting configuration backup..."
    
    # Backup environment files
    cp .env.production "$BACKUP_DIR/$BACKUP_NAME/config/" 2>/dev/null || warning "No .env.production found"
    
    # Backup Docker Compose files
    cp docker-compose.prod.yml "$BACKUP_DIR/$BACKUP_NAME/config/"
    cp docker-compose.monitoring.yml "$BACKUP_DIR/$BACKUP_NAME/config/" 2>/dev/null || warning "No monitoring compose file found"
    
    # Backup nginx configuration
    cp -r nginx/ "$BACKUP_DIR/$BACKUP_NAME/config/" 2>/dev/null || warning "No nginx config found"
    
    # Backup monitoring configuration
    cp -r monitoring/ "$BACKUP_DIR/$BACKUP_NAME/config/" 2>/dev/null || warning "No monitoring config found"
    
    # Backup scripts
    cp -r scripts/ "$BACKUP_DIR/$BACKUP_NAME/config/"
    
    success "Configuration backup completed"
}

# Create backup manifest
create_manifest() {
    log "Creating backup manifest..."
    
    cat > "$BACKUP_DIR/$BACKUP_NAME/manifest.json" << EOF
{
    "backup_name": "$BACKUP_NAME",
    "timestamp": "$TIMESTAMP",
    "version": "1.0.0",
    "components": {
        "postgres": {
            "full_backup": "postgres/fulsk_full.sql",
            "schema_backup": "postgres/fulsk_schema.sql",
            "data_backup": "postgres/fulsk_data.sql",
            "custom_backup": "postgres/fulsk_custom.dump",
            "globals_backup": "postgres/globals.sql"
        },
        "redis": {
            "rdb_backup": "redis/redis_backup.rdb",
            "config": "redis/redis.conf"
        },
        "files": {
            "uploads": "files/uploads/",
            "logs": "files/logs/",
            "ssl": "files/ssl/"
        },
        "config": {
            "env_file": "config/.env.production",
            "compose_files": "config/docker-compose.*.yml",
            "nginx_config": "config/nginx/",
            "monitoring_config": "config/monitoring/",
            "scripts": "config/scripts/"
        }
    },
    "backup_size": "$(du -sh "$BACKUP_DIR/$BACKUP_NAME" | cut -f1)",
    "backup_method": "docker-compose",
    "encryption": "$([ -f "$ENCRYPTION_KEY_FILE" ] && echo 'enabled' || echo 'disabled')"
}
EOF
    
    success "Backup manifest created"
}

# Compress backup
compress_backup() {
    log "Compressing backup..."
    
    cd "$BACKUP_DIR"
    tar -czf "$BACKUP_NAME.tar.gz" "$BACKUP_NAME/"
    
    if [ -f "$ENCRYPTION_KEY_FILE" ]; then
        log "Encrypting backup..."
        openssl enc -aes-256-cbc -salt -in "$BACKUP_NAME.tar.gz" -out "$BACKUP_NAME.tar.gz.enc" -pass file:"$ENCRYPTION_KEY_FILE"
        rm "$BACKUP_NAME.tar.gz"
        success "Backup encrypted"
    fi
    
    rm -rf "$BACKUP_NAME/"
    success "Backup compressed"
}

# Verify backup integrity
verify_backup() {
    log "Verifying backup integrity..."
    
    if [ -f "$BACKUP_DIR/$BACKUP_NAME.tar.gz.enc" ]; then
        # Verify encrypted backup
        openssl enc -aes-256-cbc -d -in "$BACKUP_DIR/$BACKUP_NAME.tar.gz.enc" -pass file:"$ENCRYPTION_KEY_FILE" | tar -tzf - > /dev/null
        success "Encrypted backup verified"
    elif [ -f "$BACKUP_DIR/$BACKUP_NAME.tar.gz" ]; then
        # Verify compressed backup
        tar -tzf "$BACKUP_DIR/$BACKUP_NAME.tar.gz" > /dev/null
        success "Compressed backup verified"
    else
        error "Backup file not found"
    fi
}

# Upload to remote storage (optional)
upload_backup() {
    if [ -n "$REMOTE_BACKUP_LOCATION" ]; then
        log "Uploading backup to remote storage..."
        
        # Example for AWS S3
        if command -v aws &> /dev/null; then
            aws s3 cp "$BACKUP_DIR/$BACKUP_NAME.tar.gz*" "$REMOTE_BACKUP_LOCATION/" --storage-class STANDARD_IA
            success "Backup uploaded to S3"
        fi
        
        # Example for rsync
        if command -v rsync &> /dev/null && [ -n "$REMOTE_HOST" ]; then
            rsync -avz "$BACKUP_DIR/$BACKUP_NAME.tar.gz*" "$REMOTE_HOST:$REMOTE_BACKUP_LOCATION/"
            success "Backup uploaded via rsync"
        fi
    else
        warning "No remote backup location configured"
    fi
}

# Clean old backups
cleanup_old_backups() {
    log "Cleaning up old backups (older than $RETENTION_DAYS days)..."
    
    find "$BACKUP_DIR" -name "fulsk_backup_*.tar.gz*" -type f -mtime +$RETENTION_DAYS -delete
    
    local deleted_count=$(find "$BACKUP_DIR" -name "fulsk_backup_*.tar.gz*" -type f -mtime +$RETENTION_DAYS | wc -l)
    success "Cleaned up $deleted_count old backups"
}

# Send notification
send_notification() {
    local status=$1
    local message=$2
    
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"Fulsk Backup $status: $message\"}" \
            "$SLACK_WEBHOOK_URL"
    fi
    
    if [ -n "$EMAIL_RECIPIENT" ]; then
        echo "$message" | mail -s "Fulsk Backup $status" "$EMAIL_RECIPIENT"
    fi
}

# Main backup function
main() {
    log "Starting Fulsk backup process..."
    
    # Check if services are running
    if ! docker-compose -f "$COMPOSE_FILE" ps | grep -q "Up"; then
        error "Docker services are not running"
    fi
    
    # Create backup directory
    create_backup_dir
    
    # Perform backups
    backup_postgres
    backup_redis
    backup_files
    backup_config
    
    # Create manifest
    create_manifest
    
    # Compress and encrypt
    compress_backup
    
    # Verify integrity
    verify_backup
    
    # Upload to remote storage
    upload_backup
    
    # Clean old backups
    cleanup_old_backups
    
    # Calculate backup size
    if [ -f "$BACKUP_DIR/$BACKUP_NAME.tar.gz.enc" ]; then
        BACKUP_SIZE=$(du -sh "$BACKUP_DIR/$BACKUP_NAME.tar.gz.enc" | cut -f1)
        BACKUP_FILE="$BACKUP_NAME.tar.gz.enc"
    else
        BACKUP_SIZE=$(du -sh "$BACKUP_DIR/$BACKUP_NAME.tar.gz" | cut -f1)
        BACKUP_FILE="$BACKUP_NAME.tar.gz"
    fi
    
    success "Backup completed successfully!"
    log "Backup file: $BACKUP_FILE"
    log "Backup size: $BACKUP_SIZE"
    log "Backup location: $BACKUP_DIR"
    
    # Send success notification
    send_notification "SUCCESS" "Backup completed successfully. File: $BACKUP_FILE, Size: $BACKUP_SIZE"
}

# Error handling
trap 'error "Backup failed at line $LINENO"' ERR

# Run main function
main "$@"