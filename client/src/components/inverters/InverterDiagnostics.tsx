import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  LinearProgress,
  Alert,
  AlertTitle,
  TextField,
  IconButton,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  useTheme
} from '@mui/material';
import {
  Refresh,
  NetworkCheck,
  BugReport,
  Timeline,
  ExpandMore,
  CheckCircle,
  Error as ErrorIcon,
  Warning,
  Info,
  PlayArrow,
  Stop,
  Download,
  Clear,
  Settings,
  Memory,
  Speed,
  ElectricBolt,
  TrendingUp,
  TrendingDown
} from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { useDeviceStore } from '../../stores/deviceStore';
import { InverterDiagnosticData, Device } from '../../types/api';

interface InverterDiagnosticsProps {
  deviceId?: string;
}

interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'WARNING' | 'ERROR';
  message: string;
  details?: any;
}

interface RegisterTestResult {
  address: number;
  name: string;
  success: boolean;
  value?: number | string;
  error?: string;
  responseTime: number;
}

export const InverterDiagnostics: React.FC<InverterDiagnosticsProps> = ({
  deviceId
}) => {
  const theme = useTheme();
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [diagnosticData, setDiagnosticData] = useState<InverterDiagnosticData | null>(null);
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);
  const [communicationLogs, setCommunicationLogs] = useState<LogEntry[]>([]);
  const [registerTestResults, setRegisterTestResults] = useState<RegisterTestResult[]>([]);
  const [isLiveMonitoring, setIsLiveMonitoring] = useState(false);
  const [selectedRegisterAddress, setSelectedRegisterAddress] = useState<number>(40083);
  const [showRegisterDialog, setShowRegisterDialog] = useState(false);
  const [connectionHistory, setConnectionHistory] = useState<any[]>([]);

  const { devices, isLoading } = useDeviceStore();

  const inverterDevices = devices.filter(device => device.type === 'INVERTER');

  useEffect(() => {
    if (deviceId) {
      const device = devices.find(d => d.id === deviceId);
      setSelectedDevice(device || null);
    } else if (inverterDevices.length > 0) {
      setSelectedDevice(inverterDevices[0]);
    }
  }, [deviceId, devices, inverterDevices]);

  // Mock diagnostic data
  const generateMockDiagnosticData = (): InverterDiagnosticData => ({
    deviceId: selectedDevice?.id || '',
    timestamp: new Date().toISOString(),
    connectionTest: {
      success: Math.random() > 0.2,
      responseTime: Math.floor(Math.random() * 200) + 50,
      error: Math.random() > 0.2 ? undefined : 'Connection timeout'
    },
    registerReads: {
      40083: { success: true, value: 5420, timestamp: new Date().toISOString() },
      40084: { success: true, value: 240.5, timestamp: new Date().toISOString() },
      40085: { success: true, value: 22.6, timestamp: new Date().toISOString() },
      40086: { success: true, value: 50.02, timestamp: new Date().toISOString() },
      40087: { success: false, error: 'Read timeout', timestamp: new Date().toISOString() },
      40088: { success: true, value: 620.1, timestamp: new Date().toISOString() },
      40089: { success: true, value: 8.9, timestamp: new Date().toISOString() },
      40090: { success: true, value: 35.2, timestamp: new Date().toISOString() },
      40091: { success: true, value: 4, timestamp: new Date().toISOString() },
      40092: { success: true, value: 1502350, timestamp: new Date().toISOString() }
    },
    communicationStats: {
      totalRequests: 1247,
      successfulRequests: 1180,
      failedRequests: 67,
      averageResponseTime: 89,
      lastSuccessfulRead: new Date(Date.now() - 15000).toISOString(),
      errorRate: 5.4
    },
    deviceInfo: {
      manufacturer: 'SolarEdge',
      model: 'SE7600H',
      serialNumber: 'SE7600H-12345678',
      firmwareVersion: 'v4.10.71',
      sunspecVersion: '1.0',
      supportedModels: [1, 103, 111, 112, 113]
    }
  });

  const runDiagnostics = async () => {
    setIsRunningDiagnostics(true);
    
    try {
      // Simulate diagnostic run
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const mockData = generateMockDiagnosticData();
      setDiagnosticData(mockData);
      
      // Add log entry
      addLogEntry('INFO', 'Diagnostic scan completed successfully', mockData);
      
    } catch (error) {
      addLogEntry('ERROR', 'Diagnostic scan failed', { error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setIsRunningDiagnostics(false);
    }
  };

  const testSingleRegister = async (address: number) => {
    try {
      // Simulate register read
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const success = Math.random() > 0.15;
      const result: RegisterTestResult = {
        address,
        name: getRegisterName(address),
        success,
        responseTime: Math.floor(Math.random() * 100) + 30,
        ...(success 
          ? { value: Math.floor(Math.random() * 10000) + 100 }
          : { error: 'Read timeout or invalid response' }
        )
      };
      
      setRegisterTestResults(prev => [result, ...prev.slice(0, 9)]);
      addLogEntry(success ? 'INFO' : 'ERROR', 
        `Register ${address} ${success ? 'read successfully' : 'read failed'}`, 
        result);
        
    } catch (error) {
      addLogEntry('ERROR', `Failed to test register ${address}`, { error });
    }
  };

  const addLogEntry = (level: LogEntry['level'], message: string, details?: any) => {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      details
    };
    
    setCommunicationLogs(prev => [entry, ...prev.slice(0, 99)]);
  };

  const clearLogs = () => {
    setCommunicationLogs([]);
  };

  const exportLogs = () => {
    const logsText = communicationLogs.map(log => 
      `${log.timestamp} [${log.level}] ${log.message}${log.details ? ` - ${JSON.stringify(log.details)}` : ''}`
    ).join('\n');
    
    const blob = new Blob([logsText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `inverter-diagnostics-${selectedDevice?.name || 'unknown'}-${new Date().toISOString().split('T')[0]}.log`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getRegisterName = (address: number): string => {
    const registerNames: { [key: number]: string } = {
      40083: 'AC Power',
      40084: 'AC Voltage AB',
      40085: 'AC Current A',
      40086: 'AC Frequency',
      40087: 'DC Power',
      40088: 'DC Voltage',
      40089: 'DC Current',
      40090: 'Cabinet Temperature',
      40091: 'Operating State',
      40092: 'Energy Lifetime'
    };
    return registerNames[address] || `Register ${address}`;
  };

  const getHealthColor = (percentage: number) => {
    if (percentage >= 90) return 'success';
    if (percentage >= 70) return 'warning';
    return 'error';
  };

  const getLogLevelColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'ERROR': return 'error';
      case 'WARNING': return 'warning';
      case 'INFO': return 'info';
      default: return 'default';
    }
  };

  const getLogLevelIcon = (level: LogEntry['level']) => {
    switch (level) {
      case 'ERROR': return <ErrorIcon />;
      case 'WARNING': return <Warning />;
      case 'INFO': return <Info />;
      default: return <Info />;
    }
  };

  // Update connection history for chart
  useEffect(() => {
    if (diagnosticData) {
      const newPoint = {
        timestamp: new Date().toISOString(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        responseTime: diagnosticData.connectionTest.responseTime,
        errorRate: diagnosticData.communicationStats.errorRate,
        successRate: 100 - diagnosticData.communicationStats.errorRate
      };
      
      setConnectionHistory(prev => [...prev, newPoint].slice(-20));
    }
  }, [diagnosticData]);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5">
          Inverter Diagnostics
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Select Inverter</InputLabel>
            <Select
              value={selectedDevice?.id || ''}
              onChange={(e) => {
                const device = devices.find(d => d.id === e.target.value);
                setSelectedDevice(device || null);
              }}
            >
              {inverterDevices.map(device => (
                <MenuItem key={device.id} value={device.id}>
                  {device.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <Button
            variant="contained"
            startIcon={isRunningDiagnostics ? <CircularProgress size={20} /> : <BugReport />}
            onClick={runDiagnostics}
            disabled={isRunningDiagnostics || !selectedDevice}
          >
            {isRunningDiagnostics ? 'Running...' : 'Run Diagnostics'}
          </Button>
        </Box>
      </Box>

      {isRunningDiagnostics && (
        <Box sx={{ mb: 3 }}>
          <LinearProgress />
          <Typography variant="body2" color="textSecondary" sx={{ mt: 1, textAlign: 'center' }}>
            Running comprehensive diagnostic scan...
          </Typography>
        </Box>
      )}

      <Grid container spacing={3}>
        {/* Connection Status */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Connection Status
              </Typography>
              
              {diagnosticData ? (
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    {diagnosticData.connectionTest.success ? (
                      <CheckCircle color="success" sx={{ mr: 1 }} />
                    ) : (
                      <ErrorIcon color="error" sx={{ mr: 1 }} />
                    )}
                    <Typography variant="body1">
                      {diagnosticData.connectionTest.success ? 'Connected' : 'Connection Failed'}
                    </Typography>
                  </Box>
                  
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">
                        Response Time
                      </Typography>
                      <Typography variant="h6">
                        {diagnosticData.connectionTest.responseTime}ms
                      </Typography>
                    </Grid>
                    
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">
                        Success Rate
                      </Typography>
                      <Typography variant="h6" color={getHealthColor(100 - diagnosticData.communicationStats.errorRate)}>
                        {(100 - diagnosticData.communicationStats.errorRate).toFixed(1)}%
                      </Typography>
                    </Grid>
                    
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">
                        Total Requests
                      </Typography>
                      <Typography variant="h6">
                        {diagnosticData.communicationStats.totalRequests.toLocaleString()}
                      </Typography>
                    </Grid>
                    
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">
                        Failed Requests
                      </Typography>
                      <Typography variant="h6" color="error">
                        {diagnosticData.communicationStats.failedRequests}
                      </Typography>
                    </Grid>
                  </Grid>
                  
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" color="textSecondary" gutterBottom>
                      Communication Health
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={100 - diagnosticData.communicationStats.errorRate}
                      color={getHealthColor(100 - diagnosticData.communicationStats.errorRate)}
                      sx={{ height: 8 }}
                    />
                  </Box>
                </Box>
              ) : (
                <Typography color="textSecondary">
                  Run diagnostics to check connection status
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Device Information */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Device Information
              </Typography>
              
              {diagnosticData?.deviceInfo ? (
                <Box>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">
                        Manufacturer
                      </Typography>
                      <Typography variant="body1">
                        {diagnosticData.deviceInfo.manufacturer}
                      </Typography>
                    </Grid>
                    
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">
                        Model
                      </Typography>
                      <Typography variant="body1">
                        {diagnosticData.deviceInfo.model}
                      </Typography>
                    </Grid>
                    
                    <Grid item xs={12}>
                      <Typography variant="body2" color="textSecondary">
                        Serial Number
                      </Typography>
                      <Typography variant="body1">
                        {diagnosticData.deviceInfo.serialNumber}
                      </Typography>
                    </Grid>
                    
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">
                        Firmware Version
                      </Typography>
                      <Typography variant="body1">
                        {diagnosticData.deviceInfo.firmwareVersion}
                      </Typography>
                    </Grid>
                    
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">
                        SunSpec Version
                      </Typography>
                      <Typography variant="body1">
                        {diagnosticData.deviceInfo.sunspecVersion}
                      </Typography>
                    </Grid>
                  </Grid>
                  
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" color="textSecondary" gutterBottom>
                      Supported Models
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {diagnosticData.deviceInfo.supportedModels?.map(model => (
                        <Chip key={model} label={`Model ${model}`} size="small" />
                      ))}
                    </Box>
                  </Box>
                </Box>
              ) : (
                <Typography color="textSecondary">
                  Run diagnostics to retrieve device information
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Communication Chart */}
        <Grid item xs={12} lg={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Communication Performance
              </Typography>
              
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={connectionHistory}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="time" 
                      tick={{ fontSize: 10 }}
                      interval="preserveStartEnd"
                    />
                    <YAxis 
                      yAxisId="responseTime"
                      orientation="left"
                      tick={{ fontSize: 10 }}
                    />
                    <YAxis 
                      yAxisId="successRate"
                      orientation="right"
                      domain={[0, 100]}
                      tick={{ fontSize: 10 }}
                    />
                    <RechartsTooltip
                      formatter={(value: number, name: string) => {
                        if (name === 'responseTime') return [`${value}ms`, 'Response Time'];
                        if (name === 'successRate') return [`${value.toFixed(1)}%`, 'Success Rate'];
                        return [value, name];
                      }}
                    />
                    <Line
                      yAxisId="responseTime"
                      type="monotone"
                      dataKey="responseTime"
                      stroke={theme.palette.primary.main}
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      yAxisId="successRate"
                      type="monotone"
                      dataKey="successRate"
                      stroke={theme.palette.success.main}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Register Testing */}
        <Grid item xs={12} lg={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Register Testing
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <TextField
                  size="small"
                  label="Register Address"
                  type="number"
                  value={selectedRegisterAddress}
                  onChange={(e) => setSelectedRegisterAddress(parseInt(e.target.value) || 0)}
                  sx={{ flexGrow: 1 }}
                />
                <Button
                  variant="outlined"
                  onClick={() => testSingleRegister(selectedRegisterAddress)}
                  disabled={!selectedRegisterAddress}
                >
                  Test
                </Button>
              </Box>
              
              <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                {registerTestResults.map((result, index) => (
                  <Box key={index} sx={{ mb: 1, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Typography variant="body2" fontWeight="bold">
                        {result.name}
                      </Typography>
                      <Chip
                        size="small"
                        label={result.success ? 'Success' : 'Failed'}
                        color={result.success ? 'success' : 'error'}
                      />
                    </Box>
                    <Typography variant="caption" color="textSecondary">
                      Address: {result.address} | {result.responseTime}ms
                    </Typography>
                    {result.success && result.value !== undefined && (
                      <Typography variant="body2">
                        Value: {result.value}
                      </Typography>
                    )}
                    {!result.success && result.error && (
                      <Typography variant="body2" color="error">
                        Error: {result.error}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Register Status Table */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Register Status
              </Typography>
              
              {diagnosticData ? (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Address</TableCell>
                        <TableCell>Register Name</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Value</TableCell>
                        <TableCell>Last Read</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Object.entries(diagnosticData.registerReads).map(([address, data]) => (
                        <TableRow key={address}>
                          <TableCell>{address}</TableCell>
                          <TableCell>{getRegisterName(parseInt(address))}</TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={data.success ? 'OK' : 'Error'}
                              color={data.success ? 'success' : 'error'}
                              icon={data.success ? <CheckCircle /> : <ErrorIcon />}
                            />
                          </TableCell>
                          <TableCell>
                            {data.success ? data.value : data.error}
                          </TableCell>
                          <TableCell>
                            {new Date(data.timestamp).toLocaleTimeString()}
                          </TableCell>
                          <TableCell>
                            <Tooltip title="Test Register">
                              <IconButton
                                size="small"
                                onClick={() => testSingleRegister(parseInt(address))}
                              >
                                <PlayArrow />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography color="textSecondary" sx={{ textAlign: 'center', py: 4 }}>
                  Run diagnostics to view register status
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Communication Logs */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  Communication Logs
                </Typography>
                <Box>
                  <Button
                    size="small"
                    startIcon={<Download />}
                    onClick={exportLogs}
                    disabled={communicationLogs.length === 0}
                    sx={{ mr: 1 }}
                  >
                    Export
                  </Button>
                  <Button
                    size="small"
                    startIcon={<Clear />}
                    onClick={clearLogs}
                    disabled={communicationLogs.length === 0}
                  >
                    Clear
                  </Button>
                </Box>
              </Box>
              
              <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
                {communicationLogs.length > 0 ? (
                  <List dense>
                    {communicationLogs.map((log, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          {getLogLevelIcon(log.level)}
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Chip size="small" label={log.level} color={getLogLevelColor(log.level)} />
                              <Typography variant="body2">
                                {log.message}
                              </Typography>
                            </Box>
                          }
                          secondary={new Date(log.timestamp).toLocaleString()}
                        />
                      </ListItem>
                    ))}
                  </List>
                ) : (
                  <Typography color="textSecondary" sx={{ textAlign: 'center', py: 4 }}>
                    No communication logs available
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};