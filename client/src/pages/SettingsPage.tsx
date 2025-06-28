import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CardHeader,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Tabs,
  Tab,
  Chip,
  Avatar,
  Badge
} from '@mui/material';
import {
  Person,
  Notifications,
  Dashboard,
  Download,
  Settings as SettingsIcon,
  VpnKey,
  Security,
  CloudSync,
  Edit,
  Delete,
  Add,
  Visibility,
  VisibilityOff,
  Save,
  Refresh,
  Email,
  Sms,
  PhonePaused,
  Schedule,
  Palette,
  Language,
  Storage,
  Api,
  Lock,
  Shield
} from '@mui/icons-material';
import { useAuthStore } from '../stores/authStore';

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

export const SettingsPage: React.FC = () => {
  const { user } = useAuthStore();
  const [tabValue, setTabValue] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [apiKeyDialog, setApiKeyDialog] = useState(false);
  const [newApiKey, setNewApiKey] = useState('');
  
  // User Profile Settings
  const [profile, setProfile] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    timezone: 'America/New_York',
    language: 'en',
    company: '',
    phone: ''
  });

  // Notification Settings
  const [notifications, setNotifications] = useState({
    emailAlerts: true,
    smsAlerts: false,
    pushNotifications: true,
    weeklyReports: true,
    monthlyReports: true,
    systemUpdates: true,
    maintenanceAlerts: true,
    criticalOnly: false,
    quietHours: true,
    quietStart: '22:00',
    quietEnd: '07:00'
  });

  // Dashboard Settings
  const [dashboard, setDashboard] = useState({
    theme: 'light',
    density: 'comfortable',
    defaultView: 'dashboard',
    refreshInterval: 30,
    showGrid: true,
    compactMode: false,
    animationsEnabled: true,
    autoRefresh: true
  });

  // Data Export Settings
  const [dataExport, setDataExport] = useState({
    format: 'csv',
    compression: true,
    includeMetadata: true,
    dateRange: '30days',
    schedule: 'manual',
    email: user?.email || ''
  });

  // API Keys
  const [apiKeys, setApiKeys] = useState([
    { id: '1', name: 'Mobile App', key: 'sk-1234...abcd', created: '2024-01-15', lastUsed: '2024-06-27' },
    { id: '2', name: 'Third-party Integration', key: 'sk-5678...efgh', created: '2024-03-20', lastUsed: '2024-06-26' }
  ]);

  // System Settings
  const [system, setSystem] = useState({
    dataRetention: '2years',
    backupEnabled: true,
    backupFrequency: 'daily',
    logLevel: 'info',
    cacheEnabled: true,
    compressionEnabled: true,
    rateLimiting: true
  });

  const handleSaveProfile = () => {
    // TODO: Implement profile update
    console.log('Saving profile:', profile);
  };

  const handleGenerateApiKey = () => {
    const newKey = `sk-${Date.now()}${Math.random().toString(36).substring(2, 15)}`;
    setApiKeys(prev => [...prev, {
      id: Date.now().toString(),
      name: newApiKey,
      key: newKey,
      created: new Date().toISOString().split('T')[0],
      lastUsed: 'Never'
    }]);
    setNewApiKey('');
    setApiKeyDialog(false);
  };

  const handleDeleteApiKey = (id: string) => {
    setApiKeys(prev => prev.filter(key => key.id !== id));
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)} variant="scrollable">
          <Tab icon={<Person />} label="Profile" />
          <Tab icon={<Notifications />} label="Notifications" />
          <Tab icon={<Dashboard />} label="Dashboard" />
          <Tab icon={<Download />} label="Data Export" />
          <Tab icon={<SettingsIcon />} label="System" />
          <Tab icon={<VpnKey />} label="API Keys" />
          <Tab icon={<Security />} label="Security" />
          <Tab icon={<CloudSync />} label="Integrations" />
        </Tabs>
      </Box>

      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Personal Information
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="First Name"
                    value={profile.firstName}
                    onChange={(e) => setProfile(prev => ({ ...prev, firstName: e.target.value }))}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Last Name"
                    value={profile.lastName}
                    onChange={(e) => setProfile(prev => ({ ...prev, lastName: e.target.value }))}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Email"
                    type="email"
                    value={profile.email}
                    onChange={(e) => setProfile(prev => ({ ...prev, email: e.target.value }))}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Company"
                    value={profile.company}
                    onChange={(e) => setProfile(prev => ({ ...prev, company: e.target.value }))}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Phone"
                    value={profile.phone}
                    onChange={(e) => setProfile(prev => ({ ...prev, phone: e.target.value }))}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Timezone</InputLabel>
                    <Select
                      value={profile.timezone}
                      label="Timezone"
                      onChange={(e) => setProfile(prev => ({ ...prev, timezone: e.target.value }))}
                    >
                      <MenuItem value="America/New_York">Eastern Time</MenuItem>
                      <MenuItem value="America/Chicago">Central Time</MenuItem>
                      <MenuItem value="America/Denver">Mountain Time</MenuItem>
                      <MenuItem value="America/Los_Angeles">Pacific Time</MenuItem>
                      <MenuItem value="UTC">UTC</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Language</InputLabel>
                    <Select
                      value={profile.language}
                      label="Language"
                      onChange={(e) => setProfile(prev => ({ ...prev, language: e.target.value }))}
                    >
                      <MenuItem value="en">English</MenuItem>
                      <MenuItem value="es">Spanish</MenuItem>
                      <MenuItem value="fr">French</MenuItem>
                      <MenuItem value="de">German</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <Button variant="contained" onClick={handleSaveProfile} startIcon={<Save />}>
                    Save Changes
                  </Button>
                </Grid>
              </Grid>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Profile Picture
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ width: 100, height: 100 }}>
                  {profile.firstName.charAt(0)}{profile.lastName.charAt(0)}
                </Avatar>
                <Button variant="outlined" startIcon={<Edit />}>
                  Change Picture
                </Button>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Alert Notifications
              </Typography>
              <List>
                <ListItem>
                  <ListItemIcon>
                    <Email />
                  </ListItemIcon>
                  <ListItemText primary="Email Alerts" secondary="Receive alerts via email" />
                  <ListItemSecondaryAction>
                    <Switch
                      checked={notifications.emailAlerts}
                      onChange={(e) => setNotifications(prev => ({ ...prev, emailAlerts: e.target.checked }))}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <Sms />
                  </ListItemIcon>
                  <ListItemText primary="SMS Alerts" secondary="Receive critical alerts via SMS" />
                  <ListItemSecondaryAction>
                    <Switch
                      checked={notifications.smsAlerts}
                      onChange={(e) => setNotifications(prev => ({ ...prev, smsAlerts: e.target.checked }))}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <Notifications />
                  </ListItemIcon>
                  <ListItemText primary="Push Notifications" secondary="Browser push notifications" />
                  <ListItemSecondaryAction>
                    <Switch
                      checked={notifications.pushNotifications}
                      onChange={(e) => setNotifications(prev => ({ ...prev, pushNotifications: e.target.checked }))}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <PhonePaused />
                  </ListItemIcon>
                  <ListItemText primary="Critical Alerts Only" secondary="Only receive critical severity alerts" />
                  <ListItemSecondaryAction>
                    <Switch
                      checked={notifications.criticalOnly}
                      onChange={(e) => setNotifications(prev => ({ ...prev, criticalOnly: e.target.checked }))}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
              </List>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Reports & Updates
              </Typography>
              <List>
                <ListItem>
                  <ListItemText primary="Weekly Reports" secondary="System performance summaries" />
                  <ListItemSecondaryAction>
                    <Switch
                      checked={notifications.weeklyReports}
                      onChange={(e) => setNotifications(prev => ({ ...prev, weeklyReports: e.target.checked }))}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
                <ListItem>
                  <ListItemText primary="Monthly Reports" secondary="Detailed analytics reports" />
                  <ListItemSecondaryAction>
                    <Switch
                      checked={notifications.monthlyReports}
                      onChange={(e) => setNotifications(prev => ({ ...prev, monthlyReports: e.target.checked }))}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
                <ListItem>
                  <ListItemText primary="System Updates" secondary="Software update notifications" />
                  <ListItemSecondaryAction>
                    <Switch
                      checked={notifications.systemUpdates}
                      onChange={(e) => setNotifications(prev => ({ ...prev, systemUpdates: e.target.checked }))}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
                <ListItem>
                  <ListItemText primary="Maintenance Alerts" secondary="Scheduled maintenance notifications" />
                  <ListItemSecondaryAction>
                    <Switch
                      checked={notifications.maintenanceAlerts}
                      onChange={(e) => setNotifications(prev => ({ ...prev, maintenanceAlerts: e.target.checked }))}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
              </List>
              
              <Divider sx={{ my: 2 }} />
              
              <Typography variant="subtitle1" gutterBottom>
                Quiet Hours
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={notifications.quietHours}
                    onChange={(e) => setNotifications(prev => ({ ...prev, quietHours: e.target.checked }))}
                  />
                }
                label="Enable quiet hours"
              />
              {notifications.quietHours && (
                <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                  <TextField
                    label="Start Time"
                    type="time"
                    value={notifications.quietStart}
                    onChange={(e) => setNotifications(prev => ({ ...prev, quietStart: e.target.value }))}
                    InputLabelProps={{ shrink: true }}
                    size="small"
                  />
                  <TextField
                    label="End Time"
                    type="time"
                    value={notifications.quietEnd}
                    onChange={(e) => setNotifications(prev => ({ ...prev, quietEnd: e.target.value }))}
                    InputLabelProps={{ shrink: true }}
                    size="small"
                  />
                </Box>
              )}
            </Paper>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Appearance
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Theme</InputLabel>
                    <Select
                      value={dashboard.theme}
                      label="Theme"
                      onChange={(e) => setDashboard(prev => ({ ...prev, theme: e.target.value }))}
                    >
                      <MenuItem value="light">Light</MenuItem>
                      <MenuItem value="dark">Dark</MenuItem>
                      <MenuItem value="auto">Auto (System)</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Density</InputLabel>
                    <Select
                      value={dashboard.density}
                      label="Density"
                      onChange={(e) => setDashboard(prev => ({ ...prev, density: e.target.value }))}
                    >
                      <MenuItem value="compact">Compact</MenuItem>
                      <MenuItem value="comfortable">Comfortable</MenuItem>
                      <MenuItem value="spacious">Spacious</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Default Page</InputLabel>
                    <Select
                      value={dashboard.defaultView}
                      label="Default Page"
                      onChange={(e) => setDashboard(prev => ({ ...prev, defaultView: e.target.value }))}
                    >
                      <MenuItem value="dashboard">Dashboard</MenuItem>
                      <MenuItem value="analytics">Analytics</MenuItem>
                      <MenuItem value="devices">Devices</MenuItem>
                      <MenuItem value="alerts">Alerts</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Behavior
              </Typography>
              <List>
                <ListItem>
                  <ListItemText primary="Show Grid Lines" secondary="Display grid lines on charts" />
                  <ListItemSecondaryAction>
                    <Switch
                      checked={dashboard.showGrid}
                      onChange={(e) => setDashboard(prev => ({ ...prev, showGrid: e.target.checked }))}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
                <ListItem>
                  <ListItemText primary="Animations" secondary="Enable UI animations" />
                  <ListItemSecondaryAction>
                    <Switch
                      checked={dashboard.animationsEnabled}
                      onChange={(e) => setDashboard(prev => ({ ...prev, animationsEnabled: e.target.checked }))}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
                <ListItem>
                  <ListItemText primary="Auto Refresh" secondary="Automatically refresh data" />
                  <ListItemSecondaryAction>
                    <Switch
                      checked={dashboard.autoRefresh}
                      onChange={(e) => setDashboard(prev => ({ ...prev, autoRefresh: e.target.checked }))}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
              </List>
              
              <Divider sx={{ my: 2 }} />
              
              <Typography variant="subtitle1" gutterBottom>
                Refresh Interval
              </Typography>
              <FormControl fullWidth>
                <Select
                  value={dashboard.refreshInterval}
                  onChange={(e) => setDashboard(prev => ({ ...prev, refreshInterval: Number(e.target.value) }))}
                >
                  <MenuItem value={10}>10 seconds</MenuItem>
                  <MenuItem value={30}>30 seconds</MenuItem>
                  <MenuItem value={60}>1 minute</MenuItem>
                  <MenuItem value={300}>5 minutes</MenuItem>
                </Select>
              </FormControl>
            </Paper>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={3}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Data Export Settings
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Export Format</InputLabel>
                <Select
                  value={dataExport.format}
                  label="Export Format"
                  onChange={(e) => setDataExport(prev => ({ ...prev, format: e.target.value }))}
                >
                  <MenuItem value="csv">CSV</MenuItem>
                  <MenuItem value="json">JSON</MenuItem>
                  <MenuItem value="xlsx">Excel</MenuItem>
                  <MenuItem value="pdf">PDF Report</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Date Range</InputLabel>
                <Select
                  value={dataExport.dateRange}
                  label="Date Range"
                  onChange={(e) => setDataExport(prev => ({ ...prev, dateRange: e.target.value }))}
                >
                  <MenuItem value="7days">Last 7 days</MenuItem>
                  <MenuItem value="30days">Last 30 days</MenuItem>
                  <MenuItem value="90days">Last 90 days</MenuItem>
                  <MenuItem value="1year">Last year</MenuItem>
                  <MenuItem value="all">All data</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={dataExport.compression}
                    onChange={(e) => setDataExport(prev => ({ ...prev, compression: e.target.checked }))}
                  />
                }
                label="Enable compression for large exports"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={dataExport.includeMetadata}
                    onChange={(e) => setDataExport(prev => ({ ...prev, includeMetadata: e.target.checked }))}
                  />
                }
                label="Include metadata and device information"
              />
            </Grid>
            <Grid item xs={12}>
              <Button variant="contained" startIcon={<Download />}>
                Export Data Now
              </Button>
            </Grid>
          </Grid>
        </Paper>
      </TabPanel>

      <TabPanel value={tabValue} index={4}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Data Management
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Data Retention</InputLabel>
                    <Select
                      value={system.dataRetention}
                      label="Data Retention"
                      onChange={(e) => setSystem(prev => ({ ...prev, dataRetention: e.target.value }))}
                    >
                      <MenuItem value="6months">6 months</MenuItem>
                      <MenuItem value="1year">1 year</MenuItem>
                      <MenuItem value="2years">2 years</MenuItem>
                      <MenuItem value="5years">5 years</MenuItem>
                      <MenuItem value="forever">Forever</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={system.backupEnabled}
                        onChange={(e) => setSystem(prev => ({ ...prev, backupEnabled: e.target.checked }))}
                      />
                    }
                    label="Enable automated backups"
                  />
                </Grid>
                {system.backupEnabled && (
                  <Grid item xs={12}>
                    <FormControl fullWidth>
                      <InputLabel>Backup Frequency</InputLabel>
                      <Select
                        value={system.backupFrequency}
                        label="Backup Frequency"
                        onChange={(e) => setSystem(prev => ({ ...prev, backupFrequency: e.target.value }))}
                      >
                        <MenuItem value="hourly">Hourly</MenuItem>
                        <MenuItem value="daily">Daily</MenuItem>
                        <MenuItem value="weekly">Weekly</MenuItem>
                        <MenuItem value="monthly">Monthly</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                )}
              </Grid>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Performance
              </Typography>
              <List>
                <ListItem>
                  <ListItemText primary="Enable Caching" secondary="Improves response times" />
                  <ListItemSecondaryAction>
                    <Switch
                      checked={system.cacheEnabled}
                      onChange={(e) => setSystem(prev => ({ ...prev, cacheEnabled: e.target.checked }))}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
                <ListItem>
                  <ListItemText primary="Data Compression" secondary="Reduces storage usage" />
                  <ListItemSecondaryAction>
                    <Switch
                      checked={system.compressionEnabled}
                      onChange={(e) => setSystem(prev => ({ ...prev, compressionEnabled: e.target.checked }))}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
                <ListItem>
                  <ListItemText primary="Rate Limiting" secondary="Protects against abuse" />
                  <ListItemSecondaryAction>
                    <Switch
                      checked={system.rateLimiting}
                      onChange={(e) => setSystem(prev => ({ ...prev, rateLimiting: e.target.checked }))}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
              </List>
            </Paper>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={5}>
        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6">
              API Keys
            </Typography>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setApiKeyDialog(true)}
            >
              Generate New Key
            </Button>
          </Box>
          
          <List>
            {apiKeys.map((key) => (
              <ListItem key={key.id}>
                <ListItemIcon>
                  <VpnKey />
                </ListItemIcon>
                <ListItemText
                  primary={key.name}
                  secondary={
                    <Box>
                      <Typography variant="body2" color="textSecondary">
                        {key.key}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        Created: {key.created} • Last used: {key.lastUsed}
                      </Typography>
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    color="error"
                    onClick={() => handleDeleteApiKey(key.id)}
                  >
                    <Delete />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </Paper>
      </TabPanel>

      <TabPanel value={tabValue} index={6}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Password Security
              </Typography>
              <Alert severity="info" sx={{ mb: 2 }}>
                Change your password regularly to maintain account security.
              </Alert>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Current Password"
                    type={showPassword ? 'text' : 'password'}
                    InputProps={{
                      endAdornment: (
                        <IconButton onClick={() => setShowPassword(!showPassword)}>
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      )
                    }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="New Password"
                    type="password"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Confirm New Password"
                    type="password"
                  />
                </Grid>
                <Grid item xs={12}>
                  <Button variant="contained" startIcon={<Lock />}>
                    Update Password
                  </Button>
                </Grid>
              </Grid>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Two-Factor Authentication
              </Typography>
              <Alert severity="warning" sx={{ mb: 2 }}>
                Two-factor authentication is not enabled. Enable it for better security.
              </Alert>
              <Button variant="outlined" startIcon={<Shield />}>
                Enable 2FA
              </Button>
            </Paper>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={7}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Third-party Integrations
          </Typography>
          <Alert severity="info" sx={{ mb: 3 }}>
            Integration management coming soon! This will include connections to cloud services,
            IoT platforms, and external monitoring systems.
          </Alert>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6">AWS IoT</Typography>
                  <Typography variant="body2" color="textSecondary">
                    Connect to AWS IoT Core
                  </Typography>
                  <Chip label="Not Connected" color="default" size="small" sx={{ mt: 1 }} />
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6">Google Cloud</Typography>
                  <Typography variant="body2" color="textSecondary">
                    Sync with Google Cloud IoT
                  </Typography>
                  <Chip label="Not Connected" color="default" size="small" sx={{ mt: 1 }} />
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6">Microsoft Azure</Typography>
                  <Typography variant="body2" color="textSecondary">
                    Connect to Azure IoT Hub
                  </Typography>
                  <Chip label="Not Connected" color="default" size="small" sx={{ mt: 1 }} />
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Paper>
      </TabPanel>

      {/* API Key Generation Dialog */}
      <Dialog open={apiKeyDialog} onClose={() => setApiKeyDialog(false)}>
        <DialogTitle>Generate New API Key</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="API Key Name"
            fullWidth
            value={newApiKey}
            onChange={(e) => setNewApiKey(e.target.value)}
            placeholder="e.g., Mobile App, Third-party Integration"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApiKeyDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleGenerateApiKey} 
            variant="contained"
            disabled={!newApiKey.trim()}
          >
            Generate
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};