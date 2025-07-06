import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Badge,
  Tooltip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab,
  Paper,
  Divider,
  Snackbar,
  Alert as MuiAlert,
  Switch,
  FormControlLabel,
  Collapse,
  useTheme
} from '@mui/material';
import {
  Warning,
  Error as ErrorIcon,
  Info,
  CheckCircle,
  Close,
  ExpandMore,
  ExpandLess,
  FilterList,
  Search,
  Add,
  NotificationsActive,
  NotificationsOff,
  Delete,
  Archive,
  Refresh,
  Settings,
  Timeline,
  DeviceHub,
  BatteryAlert,
  ThermostatAuto,
  ElectricBolt
} from '@mui/icons-material';
import { useAlertStore } from '../../stores/alertStore';
import { useDeviceStore } from '../../stores/deviceStore';
import { useRealTimeSocket } from '../../hooks/useRealTimeSocket';
import { Alert, Device } from '../../types/api';

interface AlertRule {
  id: string;
  name: string;
  deviceId?: string;
  deviceType?: string;
  condition: 'greater_than' | 'less_than' | 'equals' | 'not_equals';
  metric: 'power' | 'temperature' | 'efficiency' | 'voltage' | 'current';
  threshold: number;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  enabled: boolean;
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`alert-tabpanel-${index}`}
      aria-labelledby={`alert-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

interface AlertManagementProps {
  compact?: boolean;
  showRules?: boolean;
  autoRefresh?: boolean;
}

export const AlertManagement: React.FC<AlertManagementProps> = ({
  compact = false,
  showRules = true,
  autoRefresh = true
}) => {
  const theme = useTheme();
  const [tabValue, setTabValue] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [deviceFilter, setDeviceFilter] = useState<string>('all');
  const [showAcknowledged, setShowAcknowledged] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [alertDetailOpen, setAlertDetailOpen] = useState(false);
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [newRule, setNewRule] = useState<Partial<AlertRule>>({
    name: '',
    condition: 'greater_than',
    metric: 'temperature',
    threshold: 0,
    severity: 'WARNING',
    enabled: true,
    notifications: { email: true, push: true, sms: false }
  });

  const {
    alerts,
    acknowledgeAlert,
    deleteAlert,
    markAsRead,
    getAlertsBySeverity,
    addAlert
  } = useAlertStore();

  const { devices } = useDeviceStore();
  const { isConnected } = useRealTimeSocket();

  // Filter alerts based on current filters
  const filteredAlerts = useMemo(() => {
    let filtered = alerts;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(alert =>
        alert.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        alert.deviceName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Severity filter
    if (severityFilter !== 'all') {
      filtered = filtered.filter(alert => alert.severity === severityFilter);
    }

    // Device filter
    if (deviceFilter !== 'all') {
      filtered = filtered.filter(alert => alert.deviceId === deviceFilter);
    }

    // Acknowledged filter
    if (!showAcknowledged) {
      filtered = filtered.filter(alert => !alert.acknowledged);
    }

    // Sort by timestamp (newest first)
    return filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [alerts, searchTerm, severityFilter, deviceFilter, showAcknowledged]);

  // Alert statistics
  const alertStats = useMemo(() => {
    const critical = getAlertsBySeverity('CRITICAL').filter(a => !a.acknowledged).length;
    const warning = getAlertsBySeverity('WARNING').filter(a => !a.acknowledged).length;
    const info = getAlertsBySeverity('INFO').filter(a => !a.acknowledged).length;
    const total = critical + warning + info;
    const acknowledged = alerts.filter(a => a.acknowledged).length;

    return { critical, warning, info, total, acknowledged };
  }, [alerts, getAlertsBySeverity]);

  // Initialize default alert rules
  useEffect(() => {
    const defaultRules: AlertRule[] = [
      {
        id: 'temp-high',
        name: 'High Temperature Alert',
        condition: 'greater_than',
        metric: 'temperature',
        threshold: 70,
        severity: 'CRITICAL',
        enabled: true,
        notifications: { email: true, push: true, sms: true }
      },
      {
        id: 'efficiency-low',
        name: 'Low Efficiency Alert',
        condition: 'less_than',
        metric: 'efficiency',
        threshold: 80,
        severity: 'WARNING',
        enabled: true,
        notifications: { email: true, push: true, sms: false }
      },
      {
        id: 'power-low',
        name: 'Low Power Output',
        condition: 'less_than',
        metric: 'power',
        threshold: 1000,
        severity: 'INFO',
        enabled: false,
        notifications: { email: false, push: true, sms: false }
      }
    ];

    setAlertRules(defaultRules);
  }, []);

  // Simulate alert generation based on rules
  useEffect(() => {
    if (!autoRefresh || !isConnected) return;

    const interval = setInterval(() => {
      // Simulate checking alert conditions
      const shouldGenerateAlert = Math.random() < 0.1; // 10% chance every interval

      if (shouldGenerateAlert) {
        const activeRules = alertRules.filter(rule => rule.enabled);
        if (activeRules.length > 0) {
          const randomRule = activeRules[Math.floor(Math.random() * activeRules.length)];
          const randomDevice = devices[Math.floor(Math.random() * devices.length)];

          if (randomDevice) {
            const newAlert: Alert = {
              id: `alert-${Date.now()}`,
              deviceId: randomDevice.id,
              deviceName: randomDevice.name,
              type: randomRule.metric,
              severity: randomRule.severity,
              message: `${randomRule.name}: ${randomRule.metric} ${randomRule.condition.replace('_', ' ')} ${randomRule.threshold}`,
              timestamp: new Date().toISOString(),
              acknowledged: false,
              read: false,
              isNew: true
            };

            addAlert(newAlert);
            setSnackbarMessage(`New ${randomRule.severity.toLowerCase()} alert: ${randomRule.name}`);
            setSnackbarOpen(true);
          }
        }
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, isConnected, alertRules, devices, addAlert]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleAlertClick = (alert: Alert) => {
    setSelectedAlert(alert);
    setAlertDetailOpen(true);
    
    if (!alert.read) {
      markAsRead(alert.id);
    }
  };

  const handleAcknowledgeAlert = (alertId: string) => {
    acknowledgeAlert(alertId);
    setSnackbarMessage('Alert acknowledged');
    setSnackbarOpen(true);
  };

  const handleDeleteAlert = (alertId: string) => {
    deleteAlert(alertId);
    setSnackbarMessage('Alert deleted');
    setSnackbarOpen(true);
  };

  const handleExpandClick = (alertId: string) => {
    const newExpanded = new Set(expandedItems);
    if (expandedItems.has(alertId)) {
      newExpanded.delete(alertId);
    } else {
      newExpanded.add(alertId);
    }
    setExpandedItems(newExpanded);
  };

  const handleCreateRule = () => {
    if (newRule.name && newRule.threshold !== undefined) {
      const rule: AlertRule = {
        id: `rule-${Date.now()}`,
        name: newRule.name,
        deviceId: newRule.deviceId,
        condition: newRule.condition || 'greater_than',
        metric: newRule.metric || 'temperature',
        threshold: newRule.threshold,
        severity: newRule.severity || 'WARNING',
        enabled: newRule.enabled !== undefined ? newRule.enabled : true,
        notifications: newRule.notifications || { email: true, push: true, sms: false }
      };

      setAlertRules(prev => [...prev, rule]);
      setRuleDialogOpen(false);
      setNewRule({
        name: '',
        condition: 'greater_than',
        metric: 'temperature',
        threshold: 0,
        severity: 'WARNING',
        enabled: true,
        notifications: { email: true, push: true, sms: false }
      });
      setSnackbarMessage('Alert rule created');
      setSnackbarOpen(true);
    }
  };

  const toggleRuleEnabled = (ruleId: string) => {
    setAlertRules(prev =>
      prev.map(rule =>
        rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule
      )
    );
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return <ErrorIcon color="error" />;
      case 'WARNING':
        return <Warning color="warning" />;
      case 'INFO':
        return <Info color="info" />;
      default:
        return <Info />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'error';
      case 'WARNING':
        return 'warning';
      case 'INFO':
        return 'info';
      default:
        return 'default';
    }
  };

  const getMetricIcon = (metric: string) => {
    switch (metric) {
      case 'temperature':
        return <ThermostatAuto />;
      case 'power':
        return <ElectricBolt />;
      case 'efficiency':
        return <Timeline />;
      case 'voltage':
      case 'current':
        return <BatteryAlert />;
      default:
        return <DeviceHub />;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant={compact ? "h6" : "h5"}>
          Alert Management
        </Typography>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Badge badgeContent={alertStats.total} color="error">
            <NotificationsActive color={isConnected ? 'primary' : 'disabled'} />
          </Badge>
          
          <Tooltip title="Refresh Alerts">
            <IconButton size="small">
              <Refresh />
            </IconButton>
          </Tooltip>
          
          {showRules && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<Add />}
              onClick={() => setRuleDialogOpen(true)}
            >
              New Rule
            </Button>
          )}
        </Box>
      </Box>

      {/* Alert Statistics */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <ErrorIcon color="error" sx={{ fontSize: 24, mb: 1 }} />
              <Typography variant="h4" color="error">
                {alertStats.critical}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Critical
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Warning color="warning" sx={{ fontSize: 24, mb: 1 }} />
              <Typography variant="h4" color="warning.main">
                {alertStats.warning}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Warning
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Info color="info" sx={{ fontSize: 24, mb: 1 }} />
              <Typography variant="h4" color="info.main">
                {alertStats.info}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Info
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <CheckCircle color="success" sx={{ fontSize: 24, mb: 1 }} />
              <Typography variant="h4" color="success.main">
                {alertStats.acknowledged}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Resolved
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab icon={<NotificationsActive />} label="Active Alerts" />
          {showRules && <Tab icon={<Settings />} label="Alert Rules" />}
        </Tabs>
      </Box>

      <TabPanel value={tabValue} index={0}>
        {/* Filters */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search alerts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />
                }}
              />
            </Grid>
            
            <Grid item xs={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Severity</InputLabel>
                <Select
                  value={severityFilter}
                  label="Severity"
                  onChange={(e) => setSeverityFilter(e.target.value)}
                >
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="CRITICAL">Critical</MenuItem>
                  <MenuItem value="WARNING">Warning</MenuItem>
                  <MenuItem value="INFO">Info</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Device</InputLabel>
                <Select
                  value={deviceFilter}
                  label="Device"
                  onChange={(e) => setDeviceFilter(e.target.value)}
                >
                  <MenuItem value="all">All Devices</MenuItem>
                  {devices.map((device) => (
                    <MenuItem key={device.id} value={device.id}>
                      {device.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <FormControlLabel
                control={
                  <Switch
                    checked={showAcknowledged}
                    onChange={(e) => setShowAcknowledged(e.target.checked)}
                    size="small"
                  />
                }
                label="Show acknowledged"
              />
            </Grid>
          </Grid>
        </Paper>

        {/* Alerts List */}
        <Card>
          <CardContent>
            {filteredAlerts.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <CheckCircle sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
                <Typography variant="h6" color="success.main">
                  No alerts found
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  {alerts.length === 0 
                    ? "Your system is running smoothly with no alerts."
                    : "All alerts have been filtered out based on your current criteria."
                  }
                </Typography>
              </Box>
            ) : (
              <List>
                {filteredAlerts.map((alert, index) => (
                  <React.Fragment key={alert.id}>
                    <ListItem
                      sx={{
                        bgcolor: alert.acknowledged ? 'action.hover' : alert.isNew ? 'primary.light' : 'transparent',
                        borderRadius: 1,
                        mb: 1,
                        cursor: 'pointer'
                      }}
                      onClick={() => handleAlertClick(alert)}
                    >
                      <ListItemIcon>
                        <Badge
                          variant="dot"
                          color={getSeverityColor(alert.severity)}
                          invisible={alert.read}
                        >
                          {getSeverityIcon(alert.severity)}
                        </Badge>
                      </ListItemIcon>
                      
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography
                              variant="subtitle2"
                              sx={{
                                textDecoration: alert.acknowledged ? 'line-through' : 'none',
                                opacity: alert.acknowledged ? 0.7 : 1
                              }}
                            >
                              {alert.message}
                            </Typography>
                            <Chip
                              size="small"
                              label={alert.severity}
                              color={getSeverityColor(alert.severity)}
                            />
                          </Box>
                        }
                        secondary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.5 }}>
                            <Typography variant="body2" color="textSecondary">
                              {alert.deviceName}
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                              {formatTimestamp(alert.timestamp)}
                            </Typography>
                          </Box>
                        }
                      />
                      
                      <ListItemSecondaryAction>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {!alert.acknowledged && (
                            <Tooltip title="Acknowledge">
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAcknowledgeAlert(alert.id);
                                }}
                              >
                                <CheckCircle />
                              </IconButton>
                            </Tooltip>
                          )}
                          
                          <Tooltip title="Delete">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteAlert(alert.id);
                              }}
                            >
                              <Delete />
                            </IconButton>
                          </Tooltip>
                          
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleExpandClick(alert.id);
                            }}
                          >
                            {expandedItems.has(alert.id) ? <ExpandLess /> : <ExpandMore />}
                          </IconButton>
                        </Box>
                      </ListItemSecondaryAction>
                    </ListItem>
                    
                    <Collapse in={expandedItems.has(alert.id)} timeout="auto" unmountOnExit>
                      <Box sx={{ pl: 7, pr: 2, pb: 2 }}>
                        <Typography variant="body2" color="textSecondary" gutterBottom>
                          Alert Details:
                        </Typography>
                        <Typography variant="body2">
                          Device: {alert.deviceName} ({alert.deviceId})
                        </Typography>
                        <Typography variant="body2">
                          Type: {alert.type}
                        </Typography>
                        <Typography variant="body2">
                          Time: {new Date(alert.timestamp).toLocaleString()}
                        </Typography>
                        <Typography variant="body2">
                          Status: {alert.acknowledged ? 'Acknowledged' : 'Active'}
                        </Typography>
                      </Box>
                    </Collapse>
                    
                    {index < filteredAlerts.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            )}
          </CardContent>
        </Card>
      </TabPanel>

      {showRules && (
        <TabPanel value={tabValue} index={1}>
          {/* Alert Rules */}
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Alert Rules Configuration
                  </Typography>
                  
                  {alertRules.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <Settings sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                      <Typography variant="h6" color="textSecondary">
                        No Alert Rules Configured
                      </Typography>
                      <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                        Create alert rules to automatically monitor your devices.
                      </Typography>
                      <Button
                        variant="contained"
                        startIcon={<Add />}
                        onClick={() => setRuleDialogOpen(true)}
                      >
                        Create First Rule
                      </Button>
                    </Box>
                  ) : (
                    <List>
                      {alertRules.map((rule, index) => (
                        <React.Fragment key={rule.id}>
                          <ListItem>
                            <ListItemIcon>
                              {getMetricIcon(rule.metric)}
                            </ListItemIcon>
                            
                            <ListItemText
                              primary={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Typography variant="subtitle1">
                                    {rule.name}
                                  </Typography>
                                  <Chip
                                    size="small"
                                    label={rule.severity}
                                    color={getSeverityColor(rule.severity)}
                                  />
                                  {!rule.enabled && (
                                    <Chip size="small" label="Disabled" color="default" />
                                  )}
                                </Box>
                              }
                              secondary={
                                <Typography variant="body2" color="textSecondary">
                                  {rule.metric} {rule.condition.replace('_', ' ')} {rule.threshold}
                                  {rule.deviceId && ` • Device: ${devices.find(d => d.id === rule.deviceId)?.name || 'Unknown'}`}
                                </Typography>
                              }
                            />
                            
                            <ListItemSecondaryAction>
                              <Switch
                                checked={rule.enabled}
                                onChange={() => toggleRuleEnabled(rule.id)}
                                size="small"
                              />
                            </ListItemSecondaryAction>
                          </ListItem>
                          
                          {index < alertRules.length - 1 && <Divider />}
                        </React.Fragment>
                      ))}
                    </List>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>
      )}

      {/* Alert Detail Dialog */}
      <Dialog
        open={alertDetailOpen}
        onClose={() => setAlertDetailOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Alert Details
        </DialogTitle>
        <DialogContent>
          {selectedAlert && (
            <Box>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    {getSeverityIcon(selectedAlert.severity)}
                    <Typography variant="h6">
                      {selectedAlert.message}
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">
                    Device
                  </Typography>
                  <Typography variant="body1">
                    {selectedAlert.deviceName}
                  </Typography>
                </Grid>
                
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">
                    Severity
                  </Typography>
                  <Chip
                    label={selectedAlert.severity}
                    color={getSeverityColor(selectedAlert.severity)}
                    size="small"
                  />
                </Grid>
                
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">
                    Type
                  </Typography>
                  <Typography variant="body1">
                    {selectedAlert.type}
                  </Typography>
                </Grid>
                
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">
                    Status
                  </Typography>
                  <Typography variant="body1">
                    {selectedAlert.acknowledged ? 'Acknowledged' : 'Active'}
                  </Typography>
                </Grid>
                
                <Grid item xs={12}>
                  <Typography variant="body2" color="textSecondary">
                    Timestamp
                  </Typography>
                  <Typography variant="body1">
                    {new Date(selectedAlert.timestamp).toLocaleString()}
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {selectedAlert && !selectedAlert.acknowledged && (
            <Button
              onClick={() => {
                handleAcknowledgeAlert(selectedAlert.id);
                setAlertDetailOpen(false);
              }}
              color="primary"
            >
              Acknowledge
            </Button>
          )}
          <Button onClick={() => setAlertDetailOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Rule Dialog */}
      <Dialog
        open={ruleDialogOpen}
        onClose={() => setRuleDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Create Alert Rule
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Rule Name"
                value={newRule.name}
                onChange={(e) => setNewRule(prev => ({ ...prev, name: e.target.value }))}
              />
            </Grid>
            
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Metric</InputLabel>
                <Select
                  value={newRule.metric}
                  label="Metric"
                  onChange={(e) => setNewRule(prev => ({ ...prev, metric: e.target.value as any }))}
                >
                  <MenuItem value="temperature">Temperature</MenuItem>
                  <MenuItem value="power">Power</MenuItem>
                  <MenuItem value="efficiency">Efficiency</MenuItem>
                  <MenuItem value="voltage">Voltage</MenuItem>
                  <MenuItem value="current">Current</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Condition</InputLabel>
                <Select
                  value={newRule.condition}
                  label="Condition"
                  onChange={(e) => setNewRule(prev => ({ ...prev, condition: e.target.value as any }))}
                >
                  <MenuItem value="greater_than">Greater than</MenuItem>
                  <MenuItem value="less_than">Less than</MenuItem>
                  <MenuItem value="equals">Equals</MenuItem>
                  <MenuItem value="not_equals">Not equals</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Threshold"
                type="number"
                value={newRule.threshold}
                onChange={(e) => setNewRule(prev => ({ ...prev, threshold: parseFloat(e.target.value) }))}
              />
            </Grid>
            
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Severity</InputLabel>
                <Select
                  value={newRule.severity}
                  label="Severity"
                  onChange={(e) => setNewRule(prev => ({ ...prev, severity: e.target.value as any }))}
                >
                  <MenuItem value="INFO">Info</MenuItem>
                  <MenuItem value="WARNING">Warning</MenuItem>
                  <MenuItem value="CRITICAL">Critical</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Notifications
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={newRule.notifications?.email}
                    onChange={(e) => setNewRule(prev => ({
                      ...prev,
                      notifications: { ...prev.notifications!, email: e.target.checked }
                    }))}
                  />
                }
                label="Email"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={newRule.notifications?.push}
                    onChange={(e) => setNewRule(prev => ({
                      ...prev,
                      notifications: { ...prev.notifications!, push: e.target.checked }
                    }))}
                  />
                }
                label="Push"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={newRule.notifications?.sms}
                    onChange={(e) => setNewRule(prev => ({
                      ...prev,
                      notifications: { ...prev.notifications!, sms: e.target.checked }
                    }))}
                  />
                }
                label="SMS"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRuleDialogOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreateRule} variant="contained">
            Create Rule
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <MuiAlert
          onClose={() => setSnackbarOpen(false)}
          severity="success"
          variant="filled"
        >
          {snackbarMessage}
        </MuiAlert>
      </Snackbar>
    </Box>
  );
};