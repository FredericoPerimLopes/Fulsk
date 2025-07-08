import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  IconButton,
  Button,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Paper,
  InputAdornment,
  Menu,
  Badge,
  Tooltip,
  LinearProgress,
  Tabs,
  Tab,
  Stack
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Search,
  FilterList,
  MoreVert,
  Visibility,
  Power,
  PowerOff,
  Build,
  Refresh,
  Download,
  Upload,
  DeviceHub,
  LocationOn,
  Warning,
  CheckCircle,
  Info
} from '@mui/icons-material';
import { useDeviceStore } from '../stores/deviceStore';
import { DeviceStatus, DeviceType, Device, DeviceLocation, DeviceConfiguration } from '../types/api';

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

const getStatusColor = (status: DeviceStatus) => {
  switch (status) {
    case DeviceStatus.ONLINE:
      return 'success';
    case DeviceStatus.ERROR:
      return 'error';
    case DeviceStatus.MAINTENANCE:
      return 'warning';
    case DeviceStatus.OFFLINE:
      return 'default';
    default:
      return 'default';
  }
};

const getStatusIcon = (status: DeviceStatus) => {
  switch (status) {
    case DeviceStatus.ONLINE:
      return <CheckCircle color="success" />;
    case DeviceStatus.ERROR:
      return <Warning color="error" />;
    case DeviceStatus.MAINTENANCE:
      return <Build color="warning" />;
    case DeviceStatus.OFFLINE:
      return <PowerOff color="disabled" />;
    default:
      return <Info color="disabled" />;
  }
};

export const DevicesPage: React.FC = () => {
  const { devices, isLoading, error, fetchDevices } = useDeviceStore();
  const [tabValue, setTabValue] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');
  const [filteredDevices, setFilteredDevices] = useState<Device[]>([]);
  
  // Dialog states
  const [deviceDialog, setDeviceDialog] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deviceToDelete, setDeviceToDelete] = useState<Device | null>(null);
  const [deviceDetailsDialog, setDeviceDetailsDialog] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  
  // Menu state
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [menuDevice, setMenuDevice] = useState<Device | null>(null);

  // Form state
  const [deviceForm, setDeviceForm] = useState<{
    name: string;
    type: DeviceType;
    manufacturer: string;
    model: string;
    serialNumber: string;
    firmwareVersion: string;
    location: {
      address: string;
      city: string;
      state: string;
      country: string;
      zipCode: string;
      coordinates: { latitude: number; longitude: number };
      timezone: string;
    };
    configuration: {
      communicationProtocol: 'MQTT' | 'HTTP' | 'MODBUS';
      dataCollectionInterval: number;
      alertThresholds: {
        minPower: number;
        maxTemperature: number;
        minVoltage: number;
        maxVoltage: number;
      };
      notifications: {
        email: boolean;
        sms: boolean;
        push: boolean;
      };
    };
  }>({
    name: '',
    type: DeviceType.INVERTER,
    manufacturer: '',
    model: '',
    serialNumber: '',
    firmwareVersion: '',
    location: {
      address: '',
      city: '',
      state: '',
      country: 'USA',
      zipCode: '',
      coordinates: { latitude: 0, longitude: 0 },
      timezone: 'America/New_York'
    },
    configuration: {
      communicationProtocol: 'MQTT',
      dataCollectionInterval: 30,
      alertThresholds: {
        minPower: 0,
        maxTemperature: 85,
        minVoltage: 200,
        maxVoltage: 600
      },
      notifications: {
        email: true,
        sms: false,
        push: true
      }
    }
  });

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  // Filter devices
  useEffect(() => {
    let filtered = devices;

    if (searchTerm) {
      filtered = filtered.filter(device => 
        device.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        device.manufacturer.toLowerCase().includes(searchTerm.toLowerCase()) ||
        device.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
        device.serialNumber.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterStatus !== 'ALL') {
      filtered = filtered.filter(device => device.status === filterStatus);
    }

    if (filterType !== 'ALL') {
      filtered = filtered.filter(device => device.type === filterType);
    }

    setFilteredDevices(filtered);
  }, [devices, searchTerm, filterStatus, filterType]);

  const handleDeviceAction = (action: string, device: Device) => {
    switch (action) {
      case 'edit':
        setEditingDevice(device);
        setDeviceForm({
          name: device.name,
          type: device.type,
          manufacturer: device.manufacturer,
          model: device.model,
          serialNumber: device.serialNumber,
          firmwareVersion: device.firmwareVersion || '',
          location: device.location,
          configuration: device.configuration
        });
        setDeviceDialog(true);
        break;
      case 'delete':
        setDeviceToDelete(device);
        setDeleteDialog(true);
        break;
      case 'details':
        setSelectedDevice(device);
        setDeviceDetailsDialog(true);
        break;
      case 'restart':
        console.log('Restart device:', device.id);
        break;
      case 'maintenance':
        console.log('Set maintenance mode:', device.id);
        break;
    }
    setAnchorEl(null);
  };

  const handleSaveDevice = () => {
    if (editingDevice) {
      // TODO: Update device
      console.log('Updating device:', editingDevice.id, deviceForm);
    } else {
      // TODO: Create device
      console.log('Creating device:', deviceForm);
    }
    setDeviceDialog(false);
    setEditingDevice(null);
    resetForm();
  };

  const handleDeleteDevice = () => {
    if (deviceToDelete) {
      // TODO: Delete device
      console.log('Deleting device:', deviceToDelete.id);
    }
    setDeleteDialog(false);
    setDeviceToDelete(null);
  };

  const resetForm = () => {
    setDeviceForm({
      name: '',
      type: DeviceType.INVERTER,
      manufacturer: '',
      model: '',
      serialNumber: '',
      firmwareVersion: '',
      location: {
        address: '',
        city: '',
        state: '',
        country: 'USA',
        zipCode: '',
        coordinates: { latitude: 0, longitude: 0 },
        timezone: 'America/New_York'
      },
      configuration: {
        communicationProtocol: 'MQTT',
        dataCollectionInterval: 30,
        alertThresholds: {
          minPower: 0,
          maxTemperature: 85,
          minVoltage: 200,
          maxVoltage: 600
        },
        notifications: {
          email: true,
          sms: false,
          push: true
        }
      }
    });
  };

  const deviceStats = {
    total: devices.length,
    online: devices.filter(d => d.status === DeviceStatus.ONLINE).length,
    offline: devices.filter(d => d.status === DeviceStatus.OFFLINE).length,
    error: devices.filter(d => d.status === DeviceStatus.ERROR).length,
    maintenance: devices.filter(d => d.status === DeviceStatus.MAINTENANCE).length
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Device Management
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="outlined" startIcon={<Refresh />} onClick={fetchDevices}>
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setEditingDevice(null);
              resetForm();
              setDeviceDialog(true);
            }}
          >
            Add Device
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Device Statistics */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} sx={{ mb: 4 }}>
        <Box sx={{ flex: 1 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Total Devices
                  </Typography>
                  <Typography variant="h4" component="div">
                    {deviceStats.total}
                  </Typography>
                </Box>
                <DeviceHub color="primary" />
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
                    Online
                  </Typography>
                  <Typography variant="h4" component="div" color="success.main">
                    {deviceStats.online}
                  </Typography>
                </Box>
                <CheckCircle color="success" />
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
                    Offline
                  </Typography>
                  <Typography variant="h4" component="div">
                    {deviceStats.offline}
                  </Typography>
                </Box>
                <PowerOff color="disabled" />
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
                    Errors
                  </Typography>
                  <Typography variant="h4" component="div" color="error.main">
                    {deviceStats.error}
                  </Typography>
                </Box>
                <Warning color="error" />
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
                    Maintenance
                  </Typography>
                  <Typography variant="h4" component="div" color="warning.main">
                    {deviceStats.maintenance}
                  </Typography>
                </Box>
                <Build color="warning" />
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Stack>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            placeholder="Search devices..."
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
            <InputLabel>Status</InputLabel>
            <Select
              value={filterStatus}
              label="Status"
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <MenuItem value="ALL">All</MenuItem>
              <MenuItem value={DeviceStatus.ONLINE}>Online</MenuItem>
              <MenuItem value={DeviceStatus.OFFLINE}>Offline</MenuItem>
              <MenuItem value={DeviceStatus.ERROR}>Error</MenuItem>
              <MenuItem value={DeviceStatus.MAINTENANCE}>Maintenance</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Type</InputLabel>
            <Select
              value={filterType}
              label="Type"
              onChange={(e) => setFilterType(e.target.value)}
            >
              <MenuItem value="ALL">All</MenuItem>
              <MenuItem value={DeviceType.INVERTER}>Inverter</MenuItem>
              <MenuItem value={DeviceType.PANEL}>Panel</MenuItem>
              <MenuItem value={DeviceType.BATTERY}>Battery</MenuItem>
              <MenuItem value={DeviceType.METER}>Meter</MenuItem>
              <MenuItem value={DeviceType.SENSOR}>Sensor</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Paper>

      {/* Device Grid */}
      <Stack spacing={3}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          sx={{
            flexWrap: 'wrap',
            gap: 3,
            '& > *': {
              flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 12px)', md: '1 1 calc(33.333% - 16px)' }
            }
          }}
        >
          {filteredDevices.map((device) => (
            <Card 
              key={device.id}
              sx={{ 
                cursor: 'pointer',
                '&:hover': { boxShadow: 4 },
                border: device.status === DeviceStatus.ERROR ? '2px solid' : 'none',
                borderColor: device.status === DeviceStatus.ERROR ? 'error.main' : 'transparent'
              }}
              onClick={() => handleDeviceAction('details', device)}
            >
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" component="div">
                      {device.name}
                    </Typography>
                    <Typography color="text.secondary" gutterBottom>
                      {device.manufacturer} {device.model}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Tooltip title={device.status}>
                      {getStatusIcon(device.status)}
                    </Tooltip>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAnchorEl(e.currentTarget);
                        setMenuDevice(device);
                      }}
                    >
                      <MoreVert />
                    </IconButton>
                  </Box>
                </Box>

                <Chip
                  label={device.status}
                  color={getStatusColor(device.status)}
                  size="small"
                  sx={{ mb: 2 }}
                />

                <List dense>
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 20 }}>
                      <DeviceHub fontSize="small" />
                    </ListItemIcon>
                    <ListItemText 
                      primary={device.type}
                      primaryTypographyProps={{ variant: 'body2' }}
                    />
                  </ListItem>
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 20 }}>
                      <LocationOn fontSize="small" />
                    </ListItemIcon>
                    <ListItemText 
                      primary={`${device.location.city}, ${device.location.state}`}
                      primaryTypographyProps={{ variant: 'body2' }}
                    />
                  </ListItem>
                </List>

                {device.lastSeen && (
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                    Last seen: {new Date(device.lastSeen).toLocaleString()}
                  </Typography>
                )}
              </CardContent>
            </Card>
          ))}
        </Stack>

        {filteredDevices.length === 0 && !isLoading && (
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 6 }}>
              <DeviceHub sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                {devices.length === 0 ? 'No devices found' : 'No devices match your filters'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {devices.length === 0 
                  ? 'Get started by adding your first solar device to the system.'
                  : 'Try adjusting your search criteria or filters.'
                }
              </Typography>
              {devices.length === 0 && (
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => {
                    setEditingDevice(null);
                    resetForm();
                    setDeviceDialog(true);
                  }}
                >
                  Add Your First Device
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </Stack>

      {/* Device Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem onClick={() => handleDeviceAction('details', menuDevice!)}>
          <ListItemIcon>
            <Visibility fontSize="small" />
          </ListItemIcon>
          View Details
        </MenuItem>
        <MenuItem onClick={() => handleDeviceAction('edit', menuDevice!)}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          Edit Device
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => handleDeviceAction('restart', menuDevice!)}>
          <ListItemIcon>
            <Refresh fontSize="small" />
          </ListItemIcon>
          Restart Device
        </MenuItem>
        <MenuItem onClick={() => handleDeviceAction('maintenance', menuDevice!)}>
          <ListItemIcon>
            <Build fontSize="small" />
          </ListItemIcon>
          Maintenance Mode
        </MenuItem>
        <Divider />
        <MenuItem 
          onClick={() => handleDeviceAction('delete', menuDevice!)}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          Delete Device
        </MenuItem>
      </Menu>

      {/* Add/Edit Device Dialog */}
      <Dialog open={deviceDialog} onClose={() => setDeviceDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingDevice ? 'Edit Device' : 'Add New Device'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
            <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
              <Tab label="Basic Information" />
              <Tab label="Location" />
              <Tab label="Configuration" />
            </Tabs>
          </Box>

          <TabPanel value={tabValue} index={0}>
            <Stack spacing={3}>
              <TextField
                fullWidth
                label="Device Name"
                value={deviceForm.name}
                onChange={(e) => setDeviceForm(prev => ({ ...prev, name: e.target.value }))}
                required
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
                <Box sx={{ flex: 1 }}>
                  <FormControl fullWidth required>
                    <InputLabel>Device Type</InputLabel>
                    <Select
                      value={deviceForm.type}
                      label="Device Type"
                      onChange={(e) => setDeviceForm(prev => ({ ...prev, type: e.target.value as DeviceType }))}
                    >
                      <MenuItem value={DeviceType.INVERTER}>Inverter</MenuItem>
                      <MenuItem value={DeviceType.PANEL}>Solar Panel</MenuItem>
                      <MenuItem value={DeviceType.BATTERY}>Battery</MenuItem>
                      <MenuItem value={DeviceType.METER}>Meter</MenuItem>
                      <MenuItem value={DeviceType.SENSOR}>Sensor</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
                <Box sx={{ flex: 1 }}>
                <TextField
                  fullWidth
                  label="Manufacturer"
                  value={deviceForm.manufacturer}
                  onChange={(e) => setDeviceForm(prev => ({ ...prev, manufacturer: e.target.value }))}
                  required
                />
                </Box>
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
                <Box sx={{ flex: 1 }}>
                  <TextField
                    fullWidth
                    label="Model"
                    value={deviceForm.model}
                    onChange={(e) => setDeviceForm(prev => ({ ...prev, model: e.target.value }))}
                    required
                  />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <TextField
                    fullWidth
                    label="Serial Number"
                    value={deviceForm.serialNumber}
                    onChange={(e) => setDeviceForm(prev => ({ ...prev, serialNumber: e.target.value }))}
                    required
                  />
                </Box>
              </Stack>
              <TextField
                fullWidth
                label="Firmware Version"
                value={deviceForm.firmwareVersion}
                onChange={(e) => setDeviceForm(prev => ({ ...prev, firmwareVersion: e.target.value }))}
              />
            </Stack>
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <Stack spacing={3}>
                <TextField
                  fullWidth
                  label="Address"
                  value={deviceForm.location.address}
                  onChange={(e) => setDeviceForm(prev => ({ 
                    ...prev, 
                    location: { ...prev.location, address: e.target.value }
                  }))}
                  required
                />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
                <Box sx={{ flex: 1 }}>
                  <TextField
                    fullWidth
                    label="City"
                    value={deviceForm.location.city}
                    onChange={(e) => setDeviceForm(prev => ({ 
                      ...prev, 
                      location: { ...prev.location, city: e.target.value }
                    }))}
                    required
                  />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <TextField
                    fullWidth
                    label="State"
                    value={deviceForm.location.state}
                    onChange={(e) => setDeviceForm(prev => ({ 
                      ...prev, 
                      location: { ...prev.location, state: e.target.value }
                    }))}
                    required
                  />
                </Box>
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
                <Box sx={{ flex: 1 }}>
                  <TextField
                    fullWidth
                    label="Country"
                    value={deviceForm.location.country}
                    onChange={(e) => setDeviceForm(prev => ({ 
                      ...prev, 
                      location: { ...prev.location, country: e.target.value }
                    }))}
                    required
                  />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <TextField
                    fullWidth
                    label="ZIP Code"
                    value={deviceForm.location.zipCode}
                    onChange={(e) => setDeviceForm(prev => ({ 
                      ...prev, 
                      location: { ...prev.location, zipCode: e.target.value }
                    }))}
                    required
                  />
                </Box>
              </Stack>
            </Stack>
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            <Stack spacing={3}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
                <Box sx={{ flex: 1 }}>
                  <FormControl fullWidth>
                    <InputLabel>Communication Protocol</InputLabel>
                    <Select
                      value={deviceForm.configuration.communicationProtocol}
                      label="Communication Protocol"
                      onChange={(e) => setDeviceForm(prev => ({ 
                        ...prev, 
                        configuration: { 
                          ...prev.configuration, 
                          communicationProtocol: e.target.value as 'MQTT' | 'HTTP' | 'MODBUS'
                        }
                      }))}
                    >
                      <MenuItem value="MQTT">MQTT</MenuItem>
                      <MenuItem value="HTTP">HTTP</MenuItem>
                      <MenuItem value="MODBUS">MODBUS</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <TextField
                    fullWidth
                    label="Data Collection Interval (seconds)"
                    type="number"
                    value={deviceForm.configuration.dataCollectionInterval}
                    onChange={(e) => setDeviceForm(prev => ({ 
                      ...prev, 
                      configuration: { 
                        ...prev.configuration, 
                        dataCollectionInterval: Number(e.target.value)
                      }
                    }))}
                  />
                </Box>
              </Stack>
              <Typography variant="h6" gutterBottom>
                Alert Thresholds
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
                <Box sx={{ flex: 1 }}>
                  <TextField
                    fullWidth
                    label="Min Power (W)"
                    type="number"
                    value={deviceForm.configuration.alertThresholds.minPower}
                    onChange={(e) => setDeviceForm(prev => ({ 
                      ...prev, 
                      configuration: { 
                        ...prev.configuration, 
                        alertThresholds: {
                          ...prev.configuration.alertThresholds,
                          minPower: Number(e.target.value)
                        }
                      }
                    }))}
                  />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <TextField
                    fullWidth
                    label="Max Temperature (°C)"
                    type="number"
                    value={deviceForm.configuration.alertThresholds.maxTemperature}
                    onChange={(e) => setDeviceForm(prev => ({ 
                      ...prev, 
                      configuration: { 
                        ...prev.configuration, 
                        alertThresholds: {
                          ...prev.configuration.alertThresholds,
                          maxTemperature: Number(e.target.value)
                        }
                      }
                    }))}
                  />
                </Box>
              </Stack>
              <Typography variant="h6" gutterBottom>
                Notifications
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={deviceForm.configuration.notifications.email}
                    onChange={(e) => setDeviceForm(prev => ({ 
                      ...prev, 
                      configuration: { 
                        ...prev.configuration, 
                        notifications: {
                          ...prev.configuration.notifications,
                          email: e.target.checked
                        }
                      }
                    }))}
                  />
                }
                label="Email Notifications"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={deviceForm.configuration.notifications.push}
                    onChange={(e) => setDeviceForm(prev => ({ 
                      ...prev, 
                      configuration: { 
                        ...prev.configuration, 
                        notifications: {
                          ...prev.configuration.notifications,
                          push: e.target.checked
                        }
                      }
                    }))}
                  />
                }
                label="Push Notifications"
              />
            </Stack>
          </TabPanel>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeviceDialog(false)}>Cancel</Button>
          <Button onClick={handleSaveDevice} variant="contained">
            {editingDevice ? 'Update' : 'Create'} Device
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)}>
        <DialogTitle>Delete Device</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{deviceToDelete?.name}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(false)}>Cancel</Button>
          <Button onClick={handleDeleteDevice} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Device Details Dialog */}
      <Dialog open={deviceDetailsDialog} onClose={() => setDeviceDetailsDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Device Details: {selectedDevice?.name}
        </DialogTitle>
        <DialogContent>
          {selectedDevice && (
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6" gutterBottom>Device Information</Typography>
                <List>
                  <ListItem>
                    <ListItemText primary="Type" secondary={selectedDevice.type} />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="Manufacturer" secondary={selectedDevice.manufacturer} />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="Model" secondary={selectedDevice.model} />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="Serial Number" secondary={selectedDevice.serialNumber} />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="Status" secondary={
                      <Chip label={selectedDevice.status} color={getStatusColor(selectedDevice.status)} size="small" />
                    } />
                  </ListItem>
                </List>
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6" gutterBottom>Location</Typography>
                <List>
                  <ListItem>
                    <ListItemText primary="Address" secondary={selectedDevice.location.address} />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="City" secondary={selectedDevice.location.city} />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="State" secondary={selectedDevice.location.state} />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="ZIP Code" secondary={selectedDevice.location.zipCode} />
                  </ListItem>
                </List>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeviceDetailsDialog(false)}>Close</Button>
          <Button onClick={() => {
            setDeviceDetailsDialog(false);
            handleDeviceAction('edit', selectedDevice!);
          }} variant="contained">
            Edit Device
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};