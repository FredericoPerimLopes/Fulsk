#!/bin/bash

# Fulsk Disaster Recovery Script
# Automated disaster recovery system for complete system restoration

set -e

# Configuration
BACKUP_DIR="/backups"
COMPOSE_FILE="docker-compose.prod.yml"
ENCRYPTION_KEY_FILE="/etc/fulsk/backup.key"
RECOVERY_LOG="/var/log/fulsk-recovery.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$RECOVERY_LOG"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$RECOVERY_LOG"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$RECOVERY_LOG"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$RECOVERY_LOG"
    exit 1
}

# Show usage
usage() {
    cat << EOF
Usage: $0 [OPTIONS] BACKUP_FILE

Fulsk Disaster Recovery Script

Options:
    -f, --backup-file    Path to backup file
    -l, --list-backups   List available backups
    -v, --verify         Verify backup integrity before restore
    -p, --partial        Partial restore (specify components)
    -y, --yes            Skip confirmation prompts
    -h, --help           Show this help message

Examples:
    $0 -f fulsk_backup_20240101_120000.tar.gz
    $0 -l
    $0 -v -f fulsk_backup_20240101_120000.tar.gz
    $0 -p postgres,redis -f fulsk_backup_20240101_120000.tar.gz

EOF
}

# List available backups
list_backups() {
    log "Available backups:"
    echo ""
    printf "%-30s %-15s %-15s\n" "Backup File" "Date" "Size"
    printf "%-30s %-15s %-15s\n" "----------" "----" "----"
    
    find "$BACKUP_DIR" -name "fulsk_backup_*.tar.gz*" -type f -printf "%f %TY-%Tm-%Td %s\n" | sort -r | while read -r file date size; do
        human_size=$(numfmt --to=iec --suffix=B "$size")
        printf "%-30s %-15s %-15s\n" "$file" "$date" "$human_size"
    done
    echo ""
}

# Verify backup integrity
verify_backup() {
    local backup_file=$1
    
    log "Verifying backup integrity: $backup_file"
    
    if [[ "$backup_file" == *.enc ]]; then
        if [ ! -f "$ENCRYPTION_KEY_FILE" ]; then
            error "Encryption key file not found: $ENCRYPTION_KEY_FILE"
        fi
        
        openssl enc -aes-256-cbc -d -in "$backup_file" -pass file:"$ENCRYPTION_KEY_FILE" | tar -tzf - > /dev/null
        success "Encrypted backup verified"
    else
        tar -tzf "$backup_file" > /dev/null
        success "Backup verified"
    fi
}

# Extract backup
extract_backup() {
    local backup_file=$1
    local extract_dir="$BACKUP_DIR/restore_$(date +%Y%m%d_%H%M%S)"
    
    log "Extracting backup to: $extract_dir"
    mkdir -p "$extract_dir"
    
    if [[ "$backup_file" == *.enc ]]; then
        openssl enc -aes-256-cbc -d -in "$backup_file" -pass file:"$ENCRYPTION_KEY_FILE" | tar -xzf - -C "$extract_dir"
    else
        tar -xzf "$backup_file" -C "$extract_dir"
    fi
    
    # Find the backup directory
    BACKUP_EXTRACT_DIR=$(find "$extract_dir" -name "fulsk_backup_*" -type d | head -1)
    
    if [ -z "$BACKUP_EXTRACT_DIR" ]; then
        error "Backup directory not found in extracted files"
    fi
    
    success "Backup extracted to: $BACKUP_EXTRACT_DIR"
}

# Stop services
stop_services() {
    log "Stopping services..."
    
    docker-compose -f "$COMPOSE_FILE" down --volumes || warning "Some services may already be stopped"
    
    # Stop monitoring services if they exist
    if [ -f "docker-compose.monitoring.yml" ]; then
        docker-compose -f "docker-compose.monitoring.yml" down || warning "Monitoring services already stopped"
    fi
    
    success "Services stopped"
}

# Restore PostgreSQL
restore_postgres() {
    log "Restoring PostgreSQL database..."
    
    # Start only PostgreSQL service
    docker-compose -f "$COMPOSE_FILE" up -d postgres
    
    # Wait for PostgreSQL to be ready
    log "Waiting for PostgreSQL to be ready..."
    for i in {1..30}; do
        if docker-compose -f "$COMPOSE_FILE" exec postgres pg_isready -U fulsk_user > /dev/null 2>&1; then
            break
        fi
        sleep 2
    done
    
    # Drop existing database and recreate
    log "Recreating database..."
    docker-compose -f "$COMPOSE_FILE" exec postgres psql -U fulsk_user -c "DROP DATABASE IF EXISTS fulsk;"
    docker-compose -f "$COMPOSE_FILE" exec postgres psql -U fulsk_user -c "CREATE DATABASE fulsk;"
    
    # Restore globals first
    if [ -f "$BACKUP_EXTRACT_DIR/postgres/globals.sql" ]; then
        log "Restoring global objects..."
        docker-compose -f "$COMPOSE_FILE" exec -T postgres psql -U fulsk_user < "$BACKUP_EXTRACT_DIR/postgres/globals.sql"
    fi
    
    # Restore database
    if [ -f "$BACKUP_EXTRACT_DIR/postgres/fulsk_custom.dump" ]; then
        log "Restoring from custom format backup..."
        docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_restore -U fulsk_user -d fulsk --clean --if-exists < "$BACKUP_EXTRACT_DIR/postgres/fulsk_custom.dump"
    elif [ -f "$BACKUP_EXTRACT_DIR/postgres/fulsk_full.sql" ]; then
        log "Restoring from SQL backup..."
        docker-compose -f "$COMPOSE_FILE" exec -T postgres psql -U fulsk_user -d fulsk < "$BACKUP_EXTRACT_DIR/postgres/fulsk_full.sql"
    else
        error "No PostgreSQL backup found"
    fi
    
    success "PostgreSQL restore completed"
}

# Restore Redis
restore_redis() {
    log "Restoring Redis data..."
    
    # Start only Redis service
    docker-compose -f "$COMPOSE_FILE" up -d redis
    
    # Wait for Redis to be ready
    log "Waiting for Redis to be ready..."
    for i in {1..30}; do
        if docker-compose -f "$COMPOSE_FILE" exec redis redis-cli ping > /dev/null 2>&1; then
            break
        fi
        sleep 2
    done
    
    # Stop Redis to replace data
    docker-compose -f "$COMPOSE_FILE" stop redis
    
    # Restore Redis data
    if [ -f "$BACKUP_EXTRACT_DIR/redis/redis_backup.rdb" ]; then
        log "Restoring Redis RDB file..."
        docker cp "$BACKUP_EXTRACT_DIR/redis/redis_backup.rdb" $(docker-compose -f "$COMPOSE_FILE" ps -q redis):/data/dump.rdb
        docker-compose -f "$COMPOSE_FILE" start redis
    else
        warning "No Redis backup found"
    fi
    
    success "Redis restore completed"
}

# Restore application files
restore_files() {
    log "Restoring application files..."
    
    # Restore uploaded files
    if [ -d "$BACKUP_EXTRACT_DIR/files/uploads" ]; then
        log "Restoring uploaded files..."
        rm -rf ./uploads
        cp -r "$BACKUP_EXTRACT_DIR/files/uploads" ./
        success "Uploaded files restored"
    else
        warning "No uploaded files found in backup"
    fi
    
    # Restore SSL certificates
    if [ -d "$BACKUP_EXTRACT_DIR/files/ssl" ]; then
        log "Restoring SSL certificates..."
        mkdir -p ./nginx/ssl
        cp -r "$BACKUP_EXTRACT_DIR/files/ssl/"* ./nginx/ssl/
        success "SSL certificates restored"
    else
        warning "No SSL certificates found in backup"
    fi
    
    success "Application files restore completed"
}

# Restore configuration
restore_config() {
    log "Restoring configuration files..."
    
    # Backup current configuration
    if [ -f ".env.production" ]; then
        cp .env.production .env.production.backup.$(date +%Y%m%d_%H%M%S)
        log "Current configuration backed up"
    fi
    
    # Restore environment file
    if [ -f "$BACKUP_EXTRACT_DIR/config/.env.production" ]; then
        cp "$BACKUP_EXTRACT_DIR/config/.env.production" ./
        success "Environment configuration restored"
    else
        warning "No environment file found in backup"
    fi
    
    # Restore nginx configuration
    if [ -d "$BACKUP_EXTRACT_DIR/config/nginx" ]; then
        cp -r "$BACKUP_EXTRACT_DIR/config/nginx/"* ./nginx/
        success "Nginx configuration restored"
    else
        warning "No nginx configuration found in backup"
    fi
    
    # Restore monitoring configuration
    if [ -d "$BACKUP_EXTRACT_DIR/config/monitoring" ]; then
        cp -r "$BACKUP_EXTRACT_DIR/config/monitoring" ./
        success "Monitoring configuration restored"
    else
        warning "No monitoring configuration found in backup"
    fi
    
    success "Configuration restore completed"
}

# Start services
start_services() {
    log "Starting services..."
    
    docker-compose -f "$COMPOSE_FILE" up -d
    
    # Start monitoring services
    if [ -f "docker-compose.monitoring.yml" ]; then
        docker-compose -f "docker-compose.monitoring.yml" up -d
    fi
    
    success "Services started"
}

# Verify restore
verify_restore() {
    log "Verifying restore..."
    
    # Check if services are running
    local max_attempts=30
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -f http://localhost/health &> /dev/null; then
            success "Application is responding"
            break
        fi
        
        log "Attempt $attempt/$max_attempts: Waiting for application to start..."
        sleep 10
        ((attempt++))
    done
    
    if [[ $attempt -gt $max_attempts ]]; then
        error "Application failed to start after restore"
    fi
    
    # Check database connectivity
    if docker-compose -f "$COMPOSE_FILE" exec postgres psql -U fulsk_user -d fulsk -c "SELECT 1;" > /dev/null 2>&1; then
        success "Database connectivity verified"
    else
        error "Database connectivity failed"
    fi
    
    # Check Redis connectivity
    if docker-compose -f "$COMPOSE_FILE" exec redis redis-cli ping > /dev/null 2>&1; then
        success "Redis connectivity verified"
    else
        error "Redis connectivity failed"
    fi
    
    success "Restore verification completed"
}

# Generate restore report
generate_report() {
    local backup_file=$1
    local restore_start_time=$2
    local restore_end_time=$3
    
    log "Generating restore report..."
    
    cat > "$BACKUP_DIR/restore_report_$(date +%Y%m%d_%H%M%S).txt" << EOF
Fulsk Disaster Recovery Report
=============================

Restore Date: $(date)
Backup File: $backup_file
Restore Start Time: $restore_start_time
Restore End Time: $restore_end_time
Duration: $((restore_end_time - restore_start_time)) seconds

Components Restored:
- PostgreSQL Database: ✓
- Redis Cache: ✓
- Application Files: ✓
- Configuration Files: ✓

Service Status:
$(docker-compose -f "$COMPOSE_FILE" ps)

Health Check Results:
$(curl -s http://localhost/health 2>/dev/null || echo "Failed to connect")

Database Status:
$(docker-compose -f "$COMPOSE_FILE" exec postgres psql -U fulsk_user -d fulsk -c "SELECT version();" 2>/dev/null || echo "Database connection failed")

Redis Status:
$(docker-compose -f "$COMPOSE_FILE" exec redis redis-cli info server 2>/dev/null | grep redis_version || echo "Redis connection failed")

Restore completed successfully.
EOF
    
    success "Restore report generated"
}

# Send notification
send_notification() {
    local status=$1
    local message=$2
    
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"Fulsk Disaster Recovery $status: $message\"}" \
            "$SLACK_WEBHOOK_URL"
    fi
    
    if [ -n "$EMAIL_RECIPIENT" ]; then
        echo "$message" | mail -s "Fulsk Disaster Recovery $status" "$EMAIL_RECIPIENT"
    fi
}

# Main restore function
main() {
    local backup_file=""
    local verify_only=false
    local partial_restore=""
    local skip_confirmation=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -f|--backup-file)
                backup_file="$2"
                shift 2
                ;;
            -l|--list-backups)
                list_backups
                exit 0
                ;;
            -v|--verify)
                verify_only=true
                shift
                ;;
            -p|--partial)
                partial_restore="$2"
                shift 2
                ;;
            -y|--yes)
                skip_confirmation=true
                shift
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            *)
                backup_file="$1"
                shift
                ;;
        esac
    done
    
    # Validate backup file
    if [ -z "$backup_file" ]; then
        error "Backup file not specified. Use -f option or provide as argument."
    fi
    
    if [ ! -f "$backup_file" ]; then
        error "Backup file not found: $backup_file"
    fi
    
    # Verify backup integrity
    verify_backup "$backup_file"
    
    if [ "$verify_only" = true ]; then
        success "Backup verification completed"
        exit 0
    fi
    
    # Confirmation prompt
    if [ "$skip_confirmation" = false ]; then
        echo ""
        warning "This will restore the system from backup: $backup_file"
        warning "ALL CURRENT DATA WILL BE LOST!"
        echo ""
        read -p "Are you sure you want to continue? (yes/no): " -r
        if [[ ! $REPLY =~ ^[Yy]es$ ]]; then
            log "Restore cancelled by user"
            exit 0
        fi
    fi
    
    local restore_start_time=$(date +%s)
    
    log "Starting disaster recovery process..."
    log "Backup file: $backup_file"
    
    # Extract backup
    extract_backup "$backup_file"
    
    # Stop services
    stop_services
    
    # Restore components
    if [ -z "$partial_restore" ]; then
        restore_postgres
        restore_redis
        restore_files
        restore_config
    else
        IFS=',' read -ra COMPONENTS <<< "$partial_restore"
        for component in "${COMPONENTS[@]}"; do
            case $component in
                postgres)
                    restore_postgres
                    ;;
                redis)
                    restore_redis
                    ;;
                files)
                    restore_files
                    ;;
                config)
                    restore_config
                    ;;
                *)
                    warning "Unknown component: $component"
                    ;;
            esac
        done
    fi
    
    # Start services
    start_services
    
    # Verify restore
    verify_restore
    
    local restore_end_time=$(date +%s)
    
    # Generate report
    generate_report "$backup_file" "$restore_start_time" "$restore_end_time"
    
    # Cleanup
    rm -rf "$BACKUP_EXTRACT_DIR"
    
    success "Disaster recovery completed successfully!"
    log "Restore duration: $((restore_end_time - restore_start_time)) seconds"
    
    # Send success notification
    send_notification "SUCCESS" "Disaster recovery completed successfully from backup: $backup_file"
}

# Error handling
trap 'error "Disaster recovery failed at line $LINENO"' ERR

# Run main function
main "$@"