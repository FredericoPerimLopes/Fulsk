import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  Chip,
  IconButton,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Switch,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Badge,
  Tabs,
  Tab,
  Alert as MuiAlert,
  AlertTitle,
  TextField,
  InputAdornment,
  Stack
} from '@mui/material';
import {
  Warning,
  Error,
  Info,
  CheckCircle,
  Notifications,
  NotificationsOff,
  FilterList,
  Search,
  Settings as SettingsIcon,
  Delete,
  MarkEmailRead,
  Schedule,
  DeviceHub,
  BatteryAlert,
  ThermostatAuto,
  PowerOff
} from '@mui/icons-material';
import { useDeviceStore } from '../stores/deviceStore';
import { Alert } from '../types/api';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div hidden={value !== index}>
    {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
  </div>
);

const getSeverityIcon = (severity: string) => {
  switch (severity) {
    case 'CRITICAL':
      return <Error color="error" />;
    case 'WARNING':
      return <Warning color="warning" />;
    case 'INFO':
      return <Info color="info" />;
    default:
      return <Info color="info" />;
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

const getAlertTypeIcon = (type: string) => {
  switch (type.toLowerCase()) {
    case 'device_offline':
      return <PowerOff />;
    case 'low_power':
      return <BatteryAlert />;
    case 'high_temperature':
      return <ThermostatAuto />;
    case 'connection_lost':
      return <DeviceHub />;
    default:
      return <Warning />;
  }
};

export const AlertsPage: React.FC = () => {
  const { devices } = useDeviceStore();
  const [tabValue, setTabValue] = useState(0);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filteredAlerts, setFilteredAlerts] = useState<Alert[]>([]);
  const [filterSeverity, setFilterSeverity] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState({
    emailEnabled: true,
    smsEnabled: false,
    pushEnabled: true,
    criticalOnly: false,
    quietHours: false,
    quietStart: '22:00',
    quietEnd: '07:00'
  });

  // Generate sample alerts
  useEffect(() => {
    const generateAlerts = () => {
      const alertTypes = [
        { type: 'device_offline', severity: 'CRITICAL', message: 'Device has gone offline unexpectedly' },
        { type: 'low_power', severity: 'WARNING', message: 'Power output below expected threshold' },
        { type: 'high_temperature', severity: 'WARNING', message: 'Operating temperature exceeds normal range' },
        { type: 'connection_lost', severity: 'CRITICAL', message: 'Communication with device lost' },
        { type: 'maintenance_due', severity: 'INFO', message: 'Scheduled maintenance is due' },
        { type: 'efficiency_drop', severity: 'WARNING', message: 'Efficiency has dropped below 85%' }
      ];

      const sampleAlerts: Alert[] = [];
      
      // Generate recent alerts
      for (let i = 0; i < 25; i++) {
        const deviceIndex = Math.floor(Math.random() * Math.max(1, devices.length));
        const alertType = alertTypes[Math.floor(Math.random() * alertTypes.length)];
        const device = devices[deviceIndex] || { id: 'demo-device', name: 'Solar Panel Array 1' };
        
        const hoursAgo = Math.floor(Math.random() * 72); // Last 3 days
        const timestamp = new Date();
        timestamp.setHours(timestamp.getHours() - hoursAgo);

        sampleAlerts.push({
          id: `alert-${i + 1}`,
          deviceId: device.id,
          deviceName: device.name,
          type: alertType.type,
          severity: alertType.severity as 'INFO' | 'WARNING' | 'CRITICAL',
          message: alertType.message,
          timestamp: timestamp.toISOString(),
          acknowledged: Math.random() > 0.6
        });
      }

      // Sort by timestamp (newest first)
      sampleAlerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      setAlerts(sampleAlerts);
    };

    generateAlerts();
  }, [devices]);

  // Filter alerts based on criteria
  useEffect(() => {
    let filtered = alerts;

    if (filterSeverity !== 'ALL') {
      filtered = filtered.filter(alert => alert.severity === filterSeverity);
    }

    if (filterStatus !== 'ALL') {
      if (filterStatus === 'ACKNOWLEDGED') {
        filtered = filtered.filter(alert => alert.acknowledged);
      } else if (filterStatus === 'UNACKNOWLEDGED') {
        filtered = filtered.filter(alert => !alert.acknowledged);
      }
    }

    if (searchTerm) {
      filtered = filtered.filter(alert => 
        alert.deviceName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        alert.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        alert.type.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredAlerts(filtered);
  }, [alerts, filterSeverity, filterStatus, searchTerm]);

  const handleAcknowledgeAlert = (alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId ? { ...alert, acknowledged: true } : alert
    ));
  };

  const handleDeleteAlert = (alertId: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
  };

  const unacknowledgedCount = alerts.filter(alert => !alert.acknowledged).length;
  const criticalCount = alerts.filter(alert => alert.severity === 'CRITICAL' && !alert.acknowledged).length;
  const warningCount = alerts.filter(alert => alert.severity === 'WARNING' && !alert.acknowledged).length;

  const alertStats = {
    total: alerts.length,
    unacknowledged: unacknowledgedCount,
    critical: criticalCount,
    warning: warningCount,
    info: alerts.filter(alert => alert.severity === 'INFO' && !alert.acknowledged).length
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Alert Management
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Badge badgeContent={unacknowledgedCount} color="error">
            <IconButton color="primary">
              <Notifications />
            </IconButton>
          </Badge>
          <IconButton onClick={() => setSettingsOpen(true)}>
            <SettingsIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Alert Statistics */}
      <Stack direction="row" spacing={3} sx={{ mb: 4 }}>
        <Box sx={{ flex: 1 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Total Alerts
                  </Typography>
                  <Typography variant="h4" component="div">
                    {alertStats.total}
                  </Typography>
                </Box>
                <Notifications color="primary" />
              </Box>
            </CardContent>
          </Card>
        </Box>
        <Box sx={{ flex: 1 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Critical Alerts
                  </Typography>
                  <Typography variant="h4" component="div" color="error.main">
                    {alertStats.critical}
                  </Typography>
                </Box>
                <Error color="error" />
              </Box>
            </CardContent>
          </Card>
        </Box>
        <Box sx={{ flex: 1 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Warnings
                  </Typography>
                  <Typography variant="h4" component="div" color="warning.main">
                    {alertStats.warning}
                  </Typography>
                </Box>
                <Warning color="warning" />
              </Box>
            </CardContent>
          </Card>
        </Box>
        <Box sx={{ flex: 1 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Unacknowledged
                  </Typography>
                  <Typography variant="h4" component="div">
                    {alertStats.unacknowledged}
                  </Typography>
                </Box>
                <MarkEmailRead color="action" />
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Stack>

      {/* Current Critical Alerts */}
      {criticalCount > 0 && (
        <MuiAlert severity="error" sx={{ mb: 3 }}>
          <AlertTitle>Critical Alerts Require Attention</AlertTitle>
          You have {criticalCount} critical alert{criticalCount > 1 ? 's' : ''} that need immediate attention.
        </MuiAlert>
      )}

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
          <Tab 
            label={
              <Badge badgeContent={unacknowledgedCount} color="error">
                Active Alerts
              </Badge>
            } 
          />
          <Tab label="Alert History" />
          <Tab label="Alert Rules" />
        </Tabs>
      </Box>

      <TabPanel value={tabValue} index={0}>
        {/* Filters */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          <TextField
            placeholder="Search alerts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
            sx={{ minWidth: 200 }}
          />
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Severity</InputLabel>
            <Select
              value={filterSeverity}
              label="Severity"
              onChange={(e) => setFilterSeverity(e.target.value)}
            >
              <MenuItem value="ALL">All</MenuItem>
              <MenuItem value="CRITICAL">Critical</MenuItem>
              <MenuItem value="WARNING">Warning</MenuItem>
              <MenuItem value="INFO">Info</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={filterStatus}
              label="Status"
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <MenuItem value="ALL">All</MenuItem>
              <MenuItem value="ACKNOWLEDGED">Acknowledged</MenuItem>
              <MenuItem value="UNACKNOWLEDGED">Unacknowledged</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {/* Alert List */}
        <Paper>
          <List>
            {filteredAlerts.length === 0 ? (
              <ListItem>
                <ListItemText
                  primary="No alerts found"
                  secondary="No alerts match your current filter criteria."
                />
              </ListItem>
            ) : (
              filteredAlerts.map((alert, index) => (
                <React.Fragment key={alert.id}>
                  <ListItem
                    sx={{
                      bgcolor: alert.acknowledged ? 'transparent' : 'action.hover',
                      opacity: alert.acknowledged ? 0.7 : 1
                    }}
                  >
                    <ListItemIcon>
                      {getAlertTypeIcon(alert.type)}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Typography variant="body1" fontWeight={alert.acknowledged ? 'normal' : 'bold'}>
                            {alert.deviceName}
                          </Typography>
                          <Chip
                            label={alert.severity}
                            color={getSeverityColor(alert.severity) as any}
                            size="small"
                          />
                          {alert.acknowledged && (
                            <Chip label="Acknowledged" size="small" variant="outlined" />
                          )}
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" color="textSecondary">
                            {alert.message}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            {new Date(alert.timestamp).toLocaleString()}
                          </Typography>
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        {!alert.acknowledged && (
                          <IconButton
                            size="small"
                            onClick={() => handleAcknowledgeAlert(alert.id)}
                            title="Acknowledge"
                          >
                            <CheckCircle />
                          </IconButton>
                        )}
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteAlert(alert.id)}
                          title="Delete"
                        >
                          <Delete />
                        </IconButton>
                      </Box>
                    </ListItemSecondaryAction>
                  </ListItem>
                  {index < filteredAlerts.length - 1 && <Divider />}
                </React.Fragment>
              ))
            )}
          </List>
        </Paper>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Alert History & Analytics
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Historical alert trends and patterns analysis will be displayed here.
          </Typography>
          <MuiAlert severity="info">
            Alert history analytics coming soon! This will include alert frequency trends, 
            device reliability metrics, and predictive maintenance insights.
          </MuiAlert>
        </Paper>
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Alert Rules & Thresholds
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Configure custom alert rules and thresholds for different device types.
          </Typography>
          <MuiAlert severity="info">
            Custom alert rules configuration coming soon! This will allow you to set 
            device-specific thresholds, escalation rules, and automated responses.
          </MuiAlert>
        </Paper>
      </TabPanel>

      {/* Notification Settings Dialog */}
      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Notification Settings</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={notificationSettings.emailEnabled}
                  onChange={(e) => setNotificationSettings(prev => ({
                    ...prev,
                    emailEnabled: e.target.checked
                  }))}
                />
              }
              label="Email Notifications"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={notificationSettings.smsEnabled}
                  onChange={(e) => setNotificationSettings(prev => ({
                    ...prev,
                    smsEnabled: e.target.checked
                  }))}
                />
              }
              label="SMS Notifications"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={notificationSettings.pushEnabled}
                  onChange={(e) => setNotificationSettings(prev => ({
                    ...prev,
                    pushEnabled: e.target.checked
                  }))}
                />
              }
              label="Push Notifications"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={notificationSettings.criticalOnly}
                  onChange={(e) => setNotificationSettings(prev => ({
                    ...prev,
                    criticalOnly: e.target.checked
                  }))}
                />
              }
              label="Critical Alerts Only"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={notificationSettings.quietHours}
                  onChange={(e) => setNotificationSettings(prev => ({
                    ...prev,
                    quietHours: e.target.checked
                  }))}
                />
              }
              label="Enable Quiet Hours"
            />
            {notificationSettings.quietHours && (
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="Quiet Start"
                  type="time"
                  value={notificationSettings.quietStart}
                  onChange={(e) => setNotificationSettings(prev => ({
                    ...prev,
                    quietStart: e.target.value
                  }))}
                  InputLabelProps={{ shrink: true }}
                  size="small"
                />
                <TextField
                  label="Quiet End"
                  type="time"
                  value={notificationSettings.quietEnd}
                  onChange={(e) => setNotificationSettings(prev => ({
                    ...prev,
                    quietEnd: e.target.value
                  }))}
                  InputLabelProps={{ shrink: true }}
                  size="small"
                />
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsOpen(false)}>Cancel</Button>
          <Button onClick={() => setSettingsOpen(false)} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};