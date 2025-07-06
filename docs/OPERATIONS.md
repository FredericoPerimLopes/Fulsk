# Fulsk Operations Guide

## Table of Contents

1. [System Overview](#system-overview)
2. [Monitoring & Alerting](#monitoring--alerting)
3. [Backup & Recovery](#backup--recovery)
4. [Security Operations](#security-operations)
5. [Incident Response](#incident-response)
6. [Performance Monitoring](#performance-monitoring)
7. [Troubleshooting](#troubleshooting)
8. [Runbooks](#runbooks)

---

## System Overview

### Architecture
```
┌─────────────────────────────────────────────────────────────────┐
│                     Production Environment                      │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │  Frontend   │  │  Backend    │  │ PostgreSQL  │  │   Redis     │  │
│  │  (nginx)    │  │ (Node.js)   │  │(TimescaleDB)│  │   Cache     │  │
│  │  Port: 80   │  │ Port: 3001  │  │ Port: 5432  │  │ Port: 6379  │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │
│          │                │                │                │        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │    MQTT     │  │ Monitoring  │  │   Logging   │  │   Backup    │  │
│  │  Broker     │  │ (Grafana)   │  │   (Loki)    │  │  System     │  │
│  │ Port: 1883  │  │ Port: 3000  │  │ Port: 3100  │  │   (Cron)    │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Service Dependencies
- **Frontend**: Depends on Backend
- **Backend**: Depends on PostgreSQL, Redis, MQTT
- **PostgreSQL**: Independent (data persistence)
- **Redis**: Independent (caching layer)
- **MQTT**: Independent (IoT communication)
- **Monitoring**: Depends on all services
- **Logging**: Independent (log aggregation)

### Key Directories
- `/opt/fulsk`: Application directory
- `/backups`: Backup storage
- `/var/log/fulsk`: Application logs
- `/etc/fulsk`: Configuration files
- `/var/lib/docker`: Docker data

---

## Monitoring & Alerting

### Monitoring Stack
- **Prometheus**: Metrics collection and alerting
- **Grafana**: Visualization and dashboards
- **AlertManager**: Alert routing and management
- **Loki**: Log aggregation
- **Jaeger**: Distributed tracing

### Key Metrics to Monitor

#### System Metrics
- CPU utilization (threshold: >80%)
- Memory usage (threshold: >85%)
- Disk space (threshold: <10% free)
- Network I/O
- Load average

#### Application Metrics
- HTTP response times (threshold: >2s)
- Error rates (threshold: >5%)
- Database connections (threshold: >80% of max)
- Queue sizes
- Active WebSocket connections

#### Business Metrics
- Solar inverter status
- Power generation levels
- Data collection rates
- User activity

### Alert Escalation
1. **Low Severity**: Slack notification
2. **Medium Severity**: Email + Slack
3. **High Severity**: Email + SMS + Slack
4. **Critical Severity**: PagerDuty + Phone calls

### Dashboard URLs
- **Main Dashboard**: http://monitoring.fulsk.local:3000/d/main
- **Infrastructure**: http://monitoring.fulsk.local:3000/d/infrastructure
- **Application**: http://monitoring.fulsk.local:3000/d/application
- **Solar Monitoring**: http://monitoring.fulsk.local:3000/d/solar

---

## Backup & Recovery

### Backup Strategy
- **Daily**: Full database + incremental files
- **Weekly**: Full system backup
- **Monthly**: Archive to long-term storage
- **Retention**: 30 days local, 1 year archived

### Backup Types
1. **Database Backup**: PostgreSQL dump + TimescaleDB data
2. **Redis Backup**: RDB snapshots
3. **File Backup**: Uploads, certificates, logs
4. **Configuration Backup**: Docker configs, nginx, monitoring

### Backup Automation
```bash
# Daily backup (runs at 2 AM)
0 2 * * * /opt/fulsk/scripts/backup.sh

# Weekly full backup (runs Sunday at 3 AM)
0 3 * * 0 /opt/fulsk/scripts/backup.sh --full

# Monthly archive (runs 1st of month at 4 AM)
0 4 1 * * /opt/fulsk/scripts/backup.sh --archive
```

### Recovery Procedures
1. **Database Recovery**: Use `disaster-recovery.sh`
2. **Partial Recovery**: Use `--partial` flag
3. **Point-in-Time Recovery**: Use timestamped backups
4. **Full System Recovery**: Complete infrastructure rebuild

### Recovery Testing
- **Monthly**: Test backup integrity
- **Quarterly**: Full recovery simulation
- **Annually**: Disaster recovery drill

---

## Security Operations

### Security Monitoring
- **Fail2Ban**: Intrusion detection
- **OSSEC**: Host-based intrusion detection
- **Vulnerability Scanning**: Weekly Snyk scans
- **Log Analysis**: Security event correlation

### Security Hardening
- **SSL/TLS**: Strong ciphers, HSTS enabled
- **Firewall**: Restrictive rules, fail2ban
- **Access Control**: SSH key authentication
- **Container Security**: Non-root users, minimal images
- **Network Security**: Isolated networks, VPN access

### Security Incident Response
1. **Detection**: Automated alerts + manual monitoring
2. **Analysis**: Log analysis, traffic inspection
3. **Containment**: Isolate affected systems
4. **Eradication**: Remove threats, patch vulnerabilities
5. **Recovery**: Restore services, validate integrity
6. **Post-Incident**: Document lessons learned

### Security Contacts
- **Security Team**: security@fulsk.local
- **Incident Response**: +1-555-SECURITY
- **External Support**: security-vendor@company.com

---

## Performance Monitoring

### Performance Baselines
- **Page Load Time**: <2 seconds
- **API Response Time**: <500ms
- **Database Query Time**: <100ms
- **WebSocket Latency**: <50ms

### Performance Optimization
1. **Database**: Index optimization, query tuning
2. **Caching**: Redis optimization, CDN usage
3. **Application**: Code optimization, connection pooling
4. **Infrastructure**: Resource scaling, load balancing

### Performance Testing
- **Load Testing**: Weekly synthetic tests
- **Stress Testing**: Monthly capacity tests
- **Chaos Engineering**: Quarterly failure simulations

---

## Troubleshooting

### Common Issues

#### Service Won't Start
```bash
# Check service status
docker-compose -f docker-compose.prod.yml ps

# Check logs
docker-compose -f docker-compose.prod.yml logs service_name

# Check health
curl -f http://localhost/health
```

#### Database Connection Issues
```bash
# Check database connectivity
docker-compose -f docker-compose.prod.yml exec postgres psql -U fulsk_user -c "SELECT 1;"

# Check connection limits
docker-compose -f docker-compose.prod.yml exec postgres psql -U fulsk_user -c "SELECT * FROM pg_stat_activity;"

# Restart database
docker-compose -f docker-compose.prod.yml restart postgres
```

#### High Memory Usage
```bash
# Check memory usage
free -h
docker stats

# Check for memory leaks
docker-compose -f docker-compose.prod.yml exec backend npm run heap-dump

# Restart services
docker-compose -f docker-compose.prod.yml restart backend
```

#### SSL Certificate Issues
```bash
# Check certificate validity
openssl x509 -in /etc/nginx/ssl/fullchain.pem -text -noout

# Renew certificates
certbot renew --dry-run

# Update nginx
docker-compose -f docker-compose.prod.yml restart nginx
```

---

## Runbooks

### Runbook: Service Restart
**When**: Service is unresponsive or showing errors
**Who**: DevOps team

**Steps**:
1. Check service logs
2. Attempt graceful restart
3. If fails, force restart
4. Verify service health
5. Check dependent services
6. Update incident log

**Commands**:
```bash
# Graceful restart
docker-compose -f docker-compose.prod.yml restart service_name

# Force restart
docker-compose -f docker-compose.prod.yml kill service_name
docker-compose -f docker-compose.prod.yml up -d service_name

# Health check
curl -f http://localhost/health
```

### Runbook: Database Failover
**When**: Primary database is failing
**Who**: Database administrator

**Steps**:
1. Assess database health
2. Check replication status
3. Initiate failover procedure
4. Update application config
5. Verify data integrity
6. Monitor performance

**Commands**:
```bash
# Check replication status
docker-compose -f docker-compose.prod.yml exec postgres psql -U fulsk_user -c "SELECT * FROM pg_stat_replication;"

# Promote standby
docker-compose -f docker-compose.prod.yml exec postgres-standby pg_promote

# Update connection string
# Edit .env.production with new database endpoint
```

### Runbook: Scale Up Services
**When**: High load or performance issues
**Who**: DevOps team

**Steps**:
1. Identify bottleneck service
2. Scale up instances
3. Update load balancer
4. Monitor performance
5. Verify health checks

**Commands**:
```bash
# Scale backend service
docker-compose -f docker-compose.prod.yml up -d --scale backend=3

# Scale frontend service
docker-compose -f docker-compose.prod.yml up -d --scale frontend=2

# Check scaled services
docker-compose -f docker-compose.prod.yml ps
```

### Runbook: Security Incident Response
**When**: Security alert or suspected breach
**Who**: Security team + DevOps

**Steps**:
1. **Immediate Response** (0-15 minutes):
   - Isolate affected systems
   - Preserve evidence
   - Notify security team
   
2. **Investigation** (15-60 minutes):
   - Analyze logs
   - Identify attack vector
   - Assess impact
   
3. **Containment** (1-4 hours):
   - Block malicious traffic
   - Patch vulnerabilities
   - Update firewall rules
   
4. **Recovery** (4-24 hours):
   - Restore from clean backups
   - Validate system integrity
   - Resume normal operations
   
5. **Post-Incident** (24-48 hours):
   - Document incident
   - Update security procedures
   - Conduct lessons learned

**Commands**:
```bash
# Block IP address
iptables -A INPUT -s MALICIOUS_IP -j DROP

# Check active connections
netstat -tulpn | grep :80

# Analyze logs
grep "suspicious_pattern" /var/log/nginx/access.log

# Restore from backup
./scripts/disaster-recovery.sh -f backup_file.tar.gz
```

### Runbook: Backup Failure
**When**: Backup job fails or backup integrity check fails
**Who**: DevOps team

**Steps**:
1. Check backup logs
2. Verify disk space
3. Test backup script manually
4. Check database connectivity
5. Retry backup process
6. Verify backup integrity

**Commands**:
```bash
# Check backup logs
tail -f /backups/backup.log

# Manual backup
./scripts/backup.sh --verbose

# Verify backup
./scripts/disaster-recovery.sh -v -f latest_backup.tar.gz

# Check disk space
df -h /backups
```

### Runbook: Performance Degradation
**When**: Response times increase or throughput decreases
**Who**: DevOps team + Development team

**Steps**:
1. Identify performance bottleneck
2. Check resource utilization
3. Analyze database performance
4. Review recent changes
5. Implement immediate fixes
6. Plan long-term optimization

**Commands**:
```bash
# Check system resources
top
htop
iostat -x 1

# Database performance
docker-compose -f docker-compose.prod.yml exec postgres psql -U fulsk_user -c "SELECT * FROM pg_stat_activity WHERE state = 'active';"

# Application performance
docker-compose -f docker-compose.prod.yml exec backend npm run profile

# Cache performance
docker-compose -f docker-compose.prod.yml exec redis redis-cli info stats
```

---

## Emergency Contacts

### Primary Contacts
- **DevOps Lead**: +1-555-DEVOPS (devops-lead@fulsk.local)
- **Database Admin**: +1-555-DATABASE (dba@fulsk.local)
- **Security Team**: +1-555-SECURITY (security@fulsk.local)
- **Development Lead**: +1-555-DEVELOP (dev-lead@fulsk.local)

### Escalation Path
1. **Level 1**: DevOps team member
2. **Level 2**: DevOps lead + relevant specialist
3. **Level 3**: CTO + external support
4. **Level 4**: CEO + crisis management team

### External Vendors
- **Cloud Provider**: AWS Support
- **Security Vendor**: CrowdStrike Support
- **Monitoring Vendor**: Grafana Support
- **Backup Vendor**: Backup service provider

---

## Documentation Updates

This document should be updated:
- **Monthly**: Review and update procedures
- **After incidents**: Document lessons learned
- **After changes**: Update configurations and procedures
- **Annually**: Complete review and restructure

**Last Updated**: $(date)
**Version**: 1.0
**Next Review**: $(date -d "+1 month")