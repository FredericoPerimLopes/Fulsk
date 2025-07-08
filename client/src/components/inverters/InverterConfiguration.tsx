import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Chip,
  Alert,
  AlertTitle,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Tooltip,
  Divider,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  LinearProgress,
  Stack
} from '@mui/material';
import {
  Save,
  Science,
  Add,
  Delete,
  Edit,
  Refresh,
  Settings,
  NetworkCheck,
  CheckCircle,
  Error as ErrorIcon,
  Warning,
  Info,
  ContentCopy,
  Download,
  Upload
} from '@mui/icons-material';
import { useDeviceStore } from '../../stores/deviceStore';
import { InverterConfiguration as InverterConfigurationType, Device } from '../../types/api';

interface InverterConfigurationProps {
  deviceId?: string;
  onConfigurationSaved?: (config: InverterConfigurationType) => void;
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
      id={`configuration-tabpanel-${index}`}
      aria-labelledby={`configuration-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export const InverterConfiguration: React.FC<InverterConfigurationProps> = ({
  deviceId,
  onConfigurationSaved
}) => {
  const [currentTab, setCurrentTab] = useState(0);
  const [configuration, setConfiguration] = useState<InverterConfigurationType>({
    ipAddress: '',
    port: 502,
    unitId: 1,
    pollInterval: 30,
    timeout: 5000,
    sunspecDeviceId: 1,
    enabled: true,
    registerMap: {
      'AC_Power': { address: 40083, type: 'uint16', scaleFactor: -1, units: 'W' },
      'AC_Voltage_AB': { address: 40084, type: 'uint16', scaleFactor: -1, units: 'V' },
      'AC_Current_A': { address: 40085, type: 'uint16', scaleFactor: -2, units: 'A' },
      'AC_Frequency': { address: 40086, type: 'uint16', scaleFactor: -2, units: 'Hz' },
      'DC_Power': { address: 40087, type: 'uint16', scaleFactor: -1, units: 'W' },
      'DC_Voltage': { address: 40088, type: 'uint16', scaleFactor: -1, units: 'V' },
      'DC_Current': { address: 40089, type: 'uint16', scaleFactor: -2, units: 'A' },
      'Cabinet_Temperature': { address: 40090, type: 'int16', scaleFactor: -1, units: '°C' },
      'Operating_State': { address: 40091, type: 'uint16', units: 'enum' },
      'Energy_Lifetime': { address: 40092, type: 'uint32', scaleFactor: 0, units: 'Wh' }
    }
  });
  
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    details?: any;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showAddRegisterDialog, setShowAddRegisterDialog] = useState(false);
  const [newRegister, setNewRegister] = useState({
    name: '',
    address: 0,
    type: 'uint16' as const,
    scaleFactor: 0,
    units: ''
  });

  const { devices, isLoading, error } = useDeviceStore();

  const selectedDevice = deviceId ? devices.find(d => d.id === deviceId) : null;

  // Common SunSpec register presets
  const registerPresets = {
    'Inverter Model 103': {
      'AC_Power': { address: 40083, type: 'uint16', scaleFactor: -1, units: 'W' },
      'AC_VoltageAB': { address: 40084, type: 'uint16', scaleFactor: -1, units: 'V' },
      'AC_VoltageBC': { address: 40085, type: 'uint16', scaleFactor: -1, units: 'V' },
      'AC_VoltageCA': { address: 40086, type: 'uint16', scaleFactor: -1, units: 'V' },
      'AC_Current_A': { address: 40087, type: 'uint16', scaleFactor: -2, units: 'A' },
      'AC_Current_B': { address: 40088, type: 'uint16', scaleFactor: -2, units: 'A' },
      'AC_Current_C': { address: 40089, type: 'uint16', scaleFactor: -2, units: 'A' },
      'AC_Frequency': { address: 40090, type: 'uint16', scaleFactor: -2, units: 'Hz' },
      'DC_Power': { address: 40091, type: 'uint16', scaleFactor: -1, units: 'W' },
      'DC_Voltage': { address: 40092, type: 'uint16', scaleFactor: -1, units: 'V' },
      'DC_Current': { address: 40093, type: 'uint16', scaleFactor: -2, units: 'A' },
      'Cabinet_Temperature': { address: 40094, type: 'int16', scaleFactor: -1, units: '°C' },
      'Operating_State': { address: 40095, type: 'uint16', units: 'enum' },
      'Event_Flags': { address: 40096, type: 'uint32', units: 'bitfield' }
    },
    'Inverter Model 111': {
      'AC_Power': { address: 40206, type: 'int16', scaleFactor: 0, units: 'W' },
      'AC_Voltage_AB': { address: 40207, type: 'uint16', scaleFactor: -1, units: 'V' },
      'AC_Current_A': { address: 40208, type: 'int16', scaleFactor: -2, units: 'A' },
      'AC_Frequency': { address: 40209, type: 'uint16', scaleFactor: -2, units: 'Hz' },
      'DC_Power': { address: 40210, type: 'int16', scaleFactor: 0, units: 'W' },
      'DC_Voltage': { address: 40211, type: 'uint16', scaleFactor: -1, units: 'V' },
      'DC_Current': { address: 40212, type: 'int16', scaleFactor: -2, units: 'A' },
      'Cabinet_Temperature': { address: 40213, type: 'int16', scaleFactor: -1, units: '°C' },
      'Operating_State': { address: 40214, type: 'uint16', units: 'enum' },
      'Energy_Lifetime': { address: 40215, type: 'uint32', scaleFactor: 0, units: 'Wh' }
    },
    'Meter Model 201': {
      'AC_Power': { address: 40083, type: 'int16', scaleFactor: 0, units: 'W' },
      'AC_Power_A': { address: 40084, type: 'int16', scaleFactor: 0, units: 'W' },
      'AC_Power_B': { address: 40085, type: 'int16', scaleFactor: 0, units: 'W' },
      'AC_Power_C': { address: 40086, type: 'int16', scaleFactor: 0, units: 'W' },
      'AC_Voltage_AB': { address: 40087, type: 'uint16', scaleFactor: -1, units: 'V' },
      'AC_Current_A': { address: 40088, type: 'int16', scaleFactor: -2, units: 'A' },
      'AC_Frequency': { address: 40089, type: 'uint16', scaleFactor: -2, units: 'Hz' },
      'Energy_Exported': { address: 40090, type: 'uint32', scaleFactor: 0, units: 'Wh' },
      'Energy_Imported': { address: 40092, type: 'uint32', scaleFactor: 0, units: 'Wh' }
    }
  };

  const handleConfigurationChange = (field: keyof InverterConfigurationType, value: any) => {
    setConfiguration(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      // Simulate connection test
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock test result
      const mockSuccess = Math.random() > 0.3; // 70% success rate for demo
      
      if (mockSuccess) {
        setTestResult({
          success: true,
          message: 'Connection successful',
          details: {
            responseTime: Math.floor(Math.random() * 100) + 50,
            deviceInfo: {
              manufacturer: 'SolarEdge',
              model: 'SE7600H',
              serialNumber: 'SE7600H-12345678',
              firmwareVersion: 'v4.10.71',
              sunspecVersion: '1.0'
            },
            registersFound: Object.keys(configuration.registerMap).length
          }
        });
      } else {
        setTestResult({
          success: false,
          message: 'Connection failed: Timeout after 5 seconds',
          details: {
            error: 'TIMEOUT',
            lastError: 'No response from device'
          }
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Connection test failed',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveConfiguration = async () => {
    setIsSaving(true);
    
    try {
      // Simulate save
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      onConfigurationSaved?.(configuration);
      
      // Show success message
      setTestResult({
        success: true,
        message: 'Configuration saved successfully'
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Failed to save configuration',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadPreset = (presetName: string) => {
    const preset = registerPresets[presetName as keyof typeof registerPresets];
    if (preset) {
      setConfiguration(prev => ({
        ...prev,
        registerMap: preset as InverterConfigurationType['registerMap']
      }));
    }
  };

  const handleAddRegister = () => {
    if (newRegister.name && newRegister.address > 0) {
      setConfiguration(prev => ({
        ...prev,
        registerMap: {
          ...prev.registerMap,
          [newRegister.name]: {
            address: newRegister.address,
            type: newRegister.type,
            scaleFactor: newRegister.scaleFactor,
            units: newRegister.units
          }
        }
      }));
      
      setNewRegister({
        name: '',
        address: 0,
        type: 'uint16',
        scaleFactor: 0,
        units: ''
      });
      setShowAddRegisterDialog(false);
    }
  };

  const handleDeleteRegister = (registerName: string) => {
    setConfiguration(prev => {
      const newRegisterMap = { ...prev.registerMap };
      delete newRegisterMap[registerName];
      return {
        ...prev,
        registerMap: newRegisterMap
      };
    });
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Inverter Configuration
        {selectedDevice && (
          <Typography variant="subtitle1" color="textSecondary" component="span" sx={{ ml: 1 }}>
            - {selectedDevice.name}
          </Typography>
        )}
      </Typography>

      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={currentTab} onChange={(_, newValue) => setCurrentTab(newValue)}>
            <Tab label="Connection" />
            <Tab label="Register Mapping" />
            <Tab label="Advanced" />
          </Tabs>
        </Box>

        {/* Connection Tab */}
        <TabPanel value={currentTab} index={0}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
            <Box sx={{ flex: 1 }}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Modbus TCP Connection
                  </Typography>
                  
                  <Stack spacing={2}>
                    <TextField
                      fullWidth
                      label="IP Address"
                      value={configuration.ipAddress}
                      onChange={(e) => handleConfigurationChange('ipAddress', e.target.value)}
                      placeholder="192.168.1.100"
                      helperText="IP address of the inverter"
                    />
                    
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                      <Box sx={{ flex: 1 }}>
                        <TextField
                          fullWidth
                          label="Port"
                          type="number"
                          value={configuration.port}
                          onChange={(e) => handleConfigurationChange('port', parseInt(e.target.value))}
                          helperText="Default: 502"
                        />
                      </Box>
                      
                      <Box sx={{ flex: 1 }}>
                      <TextField
                        fullWidth
                        label="Unit ID"
                        type="number"
                        value={configuration.unitId}
                        onChange={(e) => handleConfigurationChange('unitId', parseInt(e.target.value))}
                        helperText="Modbus unit ID"
                      />
                      </Box>
                    </Stack>
                    
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                      <Box sx={{ flex: 1 }}>
                        <TextField
                          fullWidth
                          label="Poll Interval (seconds)"
                          type="number"
                          value={configuration.pollInterval}
                          onChange={(e) => handleConfigurationChange('pollInterval', parseInt(e.target.value))}
                          helperText="Data collection frequency"
                        />
                      </Box>
                      
                      <Box sx={{ flex: 1 }}>
                        <TextField
                          fullWidth
                          label="Timeout (ms)"
                          type="number"
                          value={configuration.timeout}
                          onChange={(e) => handleConfigurationChange('timeout', parseInt(e.target.value))}
                          helperText="Connection timeout"
                        />
                      </Box>
                    </Stack>
                    
                    <FormControlLabel
                      control={
                        <Switch
                          checked={configuration.enabled}
                          onChange={(e) => handleConfigurationChange('enabled', e.target.checked)}
                        />
                      }
                      label="Enable automatic data collection"
                    />
                  </Stack>
                </CardContent>
              </Card>
            </Box>

            <Box sx={{ flex: 1 }}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Connection Test
                  </Typography>
                  
                  <Box sx={{ mb: 2 }}>
                    <Button
                      variant="contained"
                      startIcon={isTesting ? <CircularProgress size={20} /> : <Science />}
                      onClick={handleTestConnection}
                      disabled={isTesting || !configuration.ipAddress}
                      fullWidth
                    >
                      {isTesting ? 'Testing Connection...' : 'Test Connection'}
                    </Button>
                  </Box>

                  {testResult && (
                    <Alert severity={testResult.success ? 'success' : 'error'} sx={{ mb: 2 }}>
                      <AlertTitle>
                        {testResult.success ? 'Connection Successful' : 'Connection Failed'}
                      </AlertTitle>
                      {testResult.message}
                      
                      {testResult.details && testResult.success && (
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="body2">
                            Response Time: {testResult.details.responseTime}ms
                          </Typography>
                          {testResult.details.deviceInfo && (
                            <Box sx={{ mt: 1 }}>
                              <Typography variant="body2" fontWeight="bold">Device Info:</Typography>
                              <Typography variant="body2">
                                {testResult.details.deviceInfo.manufacturer} {testResult.details.deviceInfo.model}
                              </Typography>
                              <Typography variant="body2">
                                SN: {testResult.details.deviceInfo.serialNumber}
                              </Typography>
                              <Typography variant="body2">
                                FW: {testResult.details.deviceInfo.firmwareVersion}
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      )}
                    </Alert>
                  )}

                  <Typography variant="body2" color="textSecondary">
                    Test the connection before saving configuration to ensure the inverter is reachable.
                  </Typography>
                </CardContent>
              </Card>
            </Box>
          </Stack>
        </TabPanel>

        {/* Register Mapping Tab */}
        <TabPanel value={currentTab} index={1}>
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                SunSpec Register Mapping
              </Typography>
              <Box>
                <FormControl sx={{ minWidth: 200, mr: 1 }}>
                  <InputLabel>Load Preset</InputLabel>
                  <Select
                    value=""
                    onChange={(e) => handleLoadPreset(e.target.value)}
                    displayEmpty
                  >
                    {Object.keys(registerPresets).map(preset => (
                      <MenuItem key={preset} value={preset}>
                        {preset}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Button
                  variant="outlined"
                  startIcon={<Add />}
                  onClick={() => setShowAddRegisterDialog(true)}
                >
                  Add Register
                </Button>
              </Box>
            </Box>

            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Register Name</TableCell>
                    <TableCell>Address</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Scale Factor</TableCell>
                    <TableCell>Units</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.entries(configuration.registerMap).map(([name, register]) => (
                    <TableRow key={name}>
                      <TableCell>{name}</TableCell>
                      <TableCell>{register.address}</TableCell>
                      <TableCell>
                        <Chip label={register.type} size="small" />
                      </TableCell>
                      <TableCell>{register.scaleFactor}</TableCell>
                      <TableCell>{register.units}</TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteRegister(name)}
                          color="error"
                        >
                          <Delete />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </TabPanel>

        {/* Advanced Tab */}
        <TabPanel value={currentTab} index={2}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
            <Box sx={{ flex: 1 }}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    SunSpec Configuration
                  </Typography>
                  
                  <TextField
                    fullWidth
                    label="SunSpec Device ID"
                    type="number"
                    value={configuration.sunspecDeviceId}
                    onChange={(e) => handleConfigurationChange('sunspecDeviceId', parseInt(e.target.value))}
                    helperText="SunSpec device identifier"
                    sx={{ mb: 2 }}
                  />

                  <Alert severity="info">
                    <AlertTitle>SunSpec Information</AlertTitle>
                    SunSpec is a communication standard for solar equipment. 
                    The device ID helps identify the specific inverter model and its register layout.
                  </Alert>
                </CardContent>
              </Card>
            </Box>

            <Box sx={{ flex: 1 }}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Configuration Export/Import
                  </Typography>
                  
                  <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                    <Button
                      variant="outlined"
                      startIcon={<Download />}
                      onClick={() => {
                        const dataStr = JSON.stringify(configuration, null, 2);
                        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
                        const exportFileDefaultName = `inverter-config-${selectedDevice?.name || 'default'}.json`;
                        
                        const linkElement = document.createElement('a');
                        linkElement.setAttribute('href', dataUri);
                        linkElement.setAttribute('download', exportFileDefaultName);
                        linkElement.click();
                      }}
                    >
                      Export Config
                    </Button>
                    
                    <Button
                      variant="outlined"
                      startIcon={<Upload />}
                      component="label"
                    >
                      Import Config
                      <input
                        type="file"
                        hidden
                        accept=".json"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              try {
                                const config = JSON.parse(event.target?.result as string);
                                setConfiguration(config);
                              } catch (error) {
                                console.error('Failed to parse configuration file:', error);
                              }
                            };
                            reader.readAsText(file);
                          }
                        }}
                      />
                    </Button>
                  </Box>

                  <Alert severity="warning">
                    <AlertTitle>Configuration Backup</AlertTitle>
                    Always backup your configuration before making changes. 
                    Incorrect register mappings can cause communication failures.
                  </Alert>
                </CardContent>
              </Card>
            </Box>
          </Stack>
        </TabPanel>

        {/* Action Buttons */}
        <Box sx={{ p: 3, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
          <Button variant="outlined" onClick={() => setCurrentTab(0)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            startIcon={isSaving ? <CircularProgress size={20} /> : <Save />}
            onClick={handleSaveConfiguration}
            disabled={isSaving || !configuration.ipAddress}
          >
            {isSaving ? 'Saving...' : 'Save Configuration'}
          </Button>
        </Box>
      </Card>

      {/* Add Register Dialog */}
      <Dialog open={showAddRegisterDialog} onClose={() => setShowAddRegisterDialog(false)}>
        <DialogTitle>Add New Register</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label="Register Name"
              value={newRegister.name}
              onChange={(e) => setNewRegister(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., AC_Power"
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Box sx={{ flex: 1 }}>
                <TextField
                  fullWidth
                  label="Address"
                  type="number"
                  value={newRegister.address}
                  onChange={(e) => setNewRegister(prev => ({ ...prev, address: parseInt(e.target.value) || 0 }))}
                />
              </Box>
              <Box sx={{ flex: 1 }}>
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select
                  value={newRegister.type}
                  onChange={(e) => setNewRegister(prev => ({ ...prev, type: e.target.value as any }))}
                >
                  <MenuItem value="uint16">uint16</MenuItem>
                  <MenuItem value="int16">int16</MenuItem>
                  <MenuItem value="uint32">uint32</MenuItem>
                  <MenuItem value="int32">int32</MenuItem>
                  <MenuItem value="float32">float32</MenuItem>
                  <MenuItem value="string">string</MenuItem>
                </Select>
              </FormControl>
              </Box>
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Box sx={{ flex: 1 }}>
                <TextField
                  fullWidth
                  label="Scale Factor"
                  type="number"
                  value={newRegister.scaleFactor}
                  onChange={(e) => setNewRegister(prev => ({ ...prev, scaleFactor: parseInt(e.target.value) || 0 }))}
                />
              </Box>
              <Box sx={{ flex: 1 }}>
                <TextField
                  fullWidth
                  label="Units"
                  value={newRegister.units}
                  onChange={(e) => setNewRegister(prev => ({ ...prev, units: e.target.value }))}
                  placeholder="e.g., W, V, A"
                />
              </Box>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddRegisterDialog(false)}>Cancel</Button>
          <Button onClick={handleAddRegister} variant="contained">Add Register</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};