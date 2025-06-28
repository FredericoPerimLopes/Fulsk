#!/bin/bash

# Fulsk Deployment Script
# This script automates the deployment process for production

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="fulsk"
COMPOSE_FILE="docker-compose.prod.yml"
BACKUP_DIR="./backups"
ENV_FILE=".env.production"

# Functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed. Please install Docker first."
    fi
    
    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed. Please install Docker Compose first."
    fi
    
    # Check if environment file exists
    if [[ ! -f "$ENV_FILE" ]]; then
        warning "Environment file $ENV_FILE not found. Using .env.example as template."
        cp .env.example "$ENV_FILE"
        warning "Please edit $ENV_FILE with your production values before continuing."
        read -p "Press Enter to continue after editing the environment file..."
    fi
    
    success "Prerequisites check completed."
}

# Create necessary directories
create_directories() {
    log "Creating necessary directories..."
    
    mkdir -p logs
    mkdir -p uploads
    mkdir -p "$BACKUP_DIR"
    mkdir -p nginx/ssl
    
    success "Directories created."
}

# Generate SSL certificates (self-signed for development)
generate_ssl() {
    log "Generating SSL certificates..."
    
    if [[ ! -f "nginx/ssl/fulsk.crt" ]] || [[ ! -f "nginx/ssl/fulsk.key" ]]; then
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout nginx/ssl/fulsk.key \
            -out nginx/ssl/fulsk.crt \
            -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
        
        success "SSL certificates generated."
    else
        log "SSL certificates already exist."
    fi
}

# Build Docker images
build_images() {
    log "Building Docker images..."
    
    docker-compose -f "$COMPOSE_FILE" build --no-cache
    
    success "Docker images built successfully."
}

# Run database migrations
run_migrations() {
    log "Running database migrations..."
    
    # Wait for database to be ready
    docker-compose -f "$COMPOSE_FILE" up -d postgres redis
    sleep 30
    
    # Run Prisma migrations
    docker-compose -f "$COMPOSE_FILE" run --rm backend npm run prisma:migrate
    
    success "Database migrations completed."
}

# Start services
start_services() {
    log "Starting services..."
    
    docker-compose -f "$COMPOSE_FILE" up -d
    
    success "Services started successfully."
}

# Check service health
check_health() {
    log "Checking service health..."
    
    local max_attempts=30
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -f http://localhost/health &> /dev/null; then
            success "All services are healthy."
            return 0
        fi
        
        log "Attempt $attempt/$max_attempts: Services not ready yet. Waiting..."
        sleep 10
        ((attempt++))
    done
    
    error "Services failed to become healthy after $max_attempts attempts."
}

# Create backup
create_backup() {
    log "Creating backup..."
    
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$BACKUP_DIR/backup_$timestamp.sql"
    
    docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_dump -U fulsk_user fulsk > "$backup_file"
    
    success "Backup created: $backup_file"
}

# Show deployment info
show_info() {
    log "Deployment completed successfully!"
    echo ""
    echo "🌐 Application URLs:"
    echo "   Frontend: http://localhost"
    echo "   Backend API: http://localhost/api"
    echo "   Health Check: http://localhost/health"
    echo ""
    echo "📊 Monitoring:"
    echo "   Container Status: docker-compose -f $COMPOSE_FILE ps"
    echo "   Logs: docker-compose -f $COMPOSE_FILE logs -f [service_name]"
    echo ""
    echo "🔧 Management Commands:"
    echo "   Stop: docker-compose -f $COMPOSE_FILE down"
    echo "   Restart: docker-compose -f $COMPOSE_FILE restart"
    echo "   Update: ./scripts/deploy.sh"
    echo ""
}

# Main deployment function
deploy() {
    log "Starting $PROJECT_NAME deployment..."
    
    check_prerequisites
    create_directories
    
    # Optional SSL generation
    read -p "Generate SSL certificates for HTTPS? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        generate_ssl
    fi
    
    # Create backup before deployment
    if docker-compose -f "$COMPOSE_FILE" ps | grep -q postgres; then
        read -p "Create database backup before deployment? (Y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Nn]$ ]]; then
            create_backup
        fi
    fi
    
    build_images
    run_migrations
    start_services
    check_health
    show_info
}

# Handle script arguments
case "${1:-deploy}" in
    "deploy")
        deploy
        ;;
    "backup")
        create_backup
        ;;
    "health")
        check_health
        ;;
    "logs")
        docker-compose -f "$COMPOSE_FILE" logs -f "${2:-}"
        ;;
    "stop")
        log "Stopping services..."
        docker-compose -f "$COMPOSE_FILE" down
        success "Services stopped."
        ;;
    "restart")
        log "Restarting services..."
        docker-compose -f "$COMPOSE_FILE" restart "${2:-}"
        success "Services restarted."
        ;;
    *)
        echo "Usage: $0 {deploy|backup|health|logs|stop|restart} [service_name]"
        echo ""
        echo "Commands:"
        echo "  deploy   - Full deployment (default)"
        echo "  backup   - Create database backup"
        echo "  health   - Check service health"
        echo "  logs     - Show service logs"
        echo "  stop     - Stop all services"
        echo "  restart  - Restart services"
        exit 1
        ;;
esac