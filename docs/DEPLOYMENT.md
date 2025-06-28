# Fulsk Deployment Guide

This document provides comprehensive instructions for deploying the Fulsk solar panel monitoring application in various environments.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Local Development](#local-development)
- [Production Deployment](#production-deployment)
- [Docker Configuration](#docker-configuration)
- [CI/CD Pipeline](#ci-cd-pipeline)
- [Monitoring and Maintenance](#monitoring-and-maintenance)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements

- **Node.js**: v18 or higher
- **npm**: v9 or higher
- **Docker**: v20.10 or higher
- **Docker Compose**: v2.0 or higher
- **PostgreSQL**: v15 or higher (with TimescaleDB extension)
- **Redis**: v7 or higher

### Hardware Requirements

#### Minimum (Development)
- 4 GB RAM
- 2 CPU cores
- 20 GB storage

#### Recommended (Production)
- 8 GB RAM
- 4 CPU cores
- 100 GB SSD storage
- Load balancer (for high availability)

## Environment Setup

### Environment Variables

Copy the example environment file and configure for your environment:

```bash
cp .env.example .env.production
```

#### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `REDIS_URL` | Redis connection string | `redis://:password@host:6379` |
| `JWT_SECRET` | JWT signing secret | `your-super-secret-key` |
| `JWT_REFRESH_SECRET` | JWT refresh token secret | `your-refresh-secret-key` |
| `CORS_ORIGIN` | Allowed CORS origins | `https://yourdomain.com` |

#### Optional Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Backend server port | `3001` |
| `LOG_LEVEL` | Logging level | `info` |
| `RATE_LIMIT_WINDOW` | Rate limiting window (minutes) | `15` |
| `RATE_LIMIT_MAX` | Max requests per window | `100` |

## Local Development

### Using Docker Compose (Recommended)

1. **Start development services:**
   ```bash
   docker-compose -f docker-compose.dev.yml up -d
   ```

2. **Install dependencies:**
   ```bash
   npm install
   cd client && npm install
   ```

3. **Run database migrations:**
   ```bash
   npx prisma migrate dev
   ```

4. **Start development servers:**
   ```bash
   # Backend (in root directory)
   npm run dev
   
   # Frontend (in client directory)
   cd client && npm run dev
   ```

### Manual Setup

1. **Start database services:**
   ```bash
   # PostgreSQL
   sudo systemctl start postgresql
   
   # Redis
   sudo systemctl start redis
   ```

2. **Create database:**
   ```sql
   CREATE DATABASE fulsk_dev;
   CREATE USER fulsk_user WITH PASSWORD 'fulsk_password';
   GRANT ALL PRIVILEGES ON DATABASE fulsk_dev TO fulsk_user;
   ```

3. **Follow steps 2-4 from Docker setup above**

## Production Deployment

### Quick Deployment

Use the automated deployment script:

```bash
./scripts/deploy.sh
```

### Manual Deployment

1. **Clone repository:**
   ```bash
   git clone <repository-url>
   cd fulsk
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env.production
   # Edit .env.production with your values
   ```

3. **Build and start services:**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

4. **Run migrations:**
   ```bash
   docker-compose -f docker-compose.prod.yml run --rm backend npm run prisma:migrate
   ```

5. **Verify deployment:**
   ```bash
   curl http://localhost/health
   ```

## Docker Configuration

### Available Docker Compose Files

| File | Purpose | Services |
|------|---------|----------|
| `docker-compose.yml` | Base infrastructure | postgres, redis, mqtt, pgadmin |
| `docker-compose.dev.yml` | Development | postgres, redis, mqtt (simplified) |
| `docker-compose.prod.yml` | Production | frontend, backend, postgres, redis, mqtt |

### Container Architecture

```
┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │
│   (nginx)       │◄──►│   (Node.js)     │
│   Port: 80      │    │   Port: 3001    │
└─────────────────┘    └─────────────────┘
         │                       │
         └───────────┬───────────┘
                     │
    ┌────────────────┼────────────────┐
    │                │                │
┌───▼────┐  ┌────────▼───┐  ┌────────▼───┐
│Postgres│  │   Redis    │  │    MQTT    │
│Port:5432│  │ Port:6379  │  │ Port:1883  │
└────────┘  └────────────┘  └────────────┘
```

### Health Checks

All services include health checks:

- **Frontend**: HTTP check on `/health`
- **Backend**: HTTP check on `/health`
- **PostgreSQL**: `pg_isready` command
- **Redis**: `redis-cli ping` command

## CI/CD Pipeline

### GitHub Actions Workflow

The CI/CD pipeline includes:

1. **Testing Phase**
   - Unit tests
   - Integration tests
   - ESLint and TypeScript checks
   - Security scanning

2. **Build Phase**
   - Docker image building
   - Multi-platform support
   - Image caching

3. **Deploy Phase**
   - Staging deployment (develop branch)
   - Production deployment (main branch)
   - Rollback capabilities

### Pipeline Configuration

Located in `.github/workflows/ci-cd.yml`:

```yaml
# Trigger on push to main/develop branches
on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]
```

### Required Secrets

Configure these secrets in your GitHub repository:

| Secret | Description |
|--------|-------------|
| `GITHUB_TOKEN` | Automatic (for Docker registry) |
| `SNYK_TOKEN` | Snyk security scanning |
| `SLACK_WEBHOOK` | Deployment notifications |

## Monitoring and Maintenance

### Health Monitoring

1. **Application Health:**
   ```bash
   curl http://localhost/health
   ```

2. **Service Status:**
   ```bash
   docker-compose -f docker-compose.prod.yml ps
   ```

3. **Resource Usage:**
   ```bash
   docker stats
   ```

### Logging

#### View Logs

```bash
# All services
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.yml logs -f backend
```

#### Log Rotation

Logs are automatically rotated using Docker's logging driver:

```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

### Database Maintenance

#### Backup

```bash
# Manual backup
./scripts/deploy.sh backup

# Automated backup (add to crontab)
0 2 * * * /path/to/fulsk/scripts/deploy.sh backup
```

#### Restore

```bash
docker-compose -f docker-compose.prod.yml exec -T postgres psql -U fulsk_user fulsk < backup.sql
```

### Performance Optimization

1. **Database Indexing:**
   - Monitor slow queries
   - Add indexes for frequently queried columns
   - Use TimescaleDB hypertables for time-series data

2. **Caching:**
   - Redis for session storage
   - Application-level caching for static data
   - CDN for static assets

3. **Load Balancing:**
   - Use nginx upstream for multiple backend instances
   - Implement horizontal scaling

## Troubleshooting

### Common Issues

#### Port Conflicts

```bash
# Check port usage
sudo lsof -i :80
sudo lsof -i :3001

# Stop conflicting services
sudo systemctl stop apache2
sudo systemctl stop nginx
```

#### Database Connection Issues

```bash
# Check database status
docker-compose -f docker-compose.prod.yml logs postgres

# Verify connection
docker-compose -f docker-compose.prod.yml exec postgres psql -U fulsk_user -d fulsk -c "SELECT 1;"
```

#### Memory Issues

```bash
# Check memory usage
free -h
docker stats

# Increase swap if needed
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### Debug Mode

Enable debug logging:

```bash
# Set environment variable
LOG_LEVEL=debug

# Restart services
docker-compose -f docker-compose.prod.yml restart
```

### Recovery Procedures

#### Service Recovery

```bash
# Restart specific service
docker-compose -f docker-compose.prod.yml restart backend

# Rebuild and restart
docker-compose -f docker-compose.prod.yml up -d --build backend
```

#### Database Recovery

```bash
# Stop application
docker-compose -f docker-compose.prod.yml stop backend frontend

# Restore from backup
docker-compose -f docker-compose.prod.yml exec -T postgres psql -U fulsk_user fulsk < latest_backup.sql

# Start application
docker-compose -f docker-compose.prod.yml start backend frontend
```

## Support

For additional support:

1. Check the [troubleshooting section](#troubleshooting)
2. Review service logs
3. Create an issue in the repository
4. Contact the development team

## Security Considerations

1. **Environment Variables**: Never commit sensitive data to version control
2. **SSL/TLS**: Always use HTTPS in production
3. **Database**: Use strong passwords and restricted access
4. **Updates**: Regularly update dependencies and base images
5. **Backups**: Encrypt and store backups securely