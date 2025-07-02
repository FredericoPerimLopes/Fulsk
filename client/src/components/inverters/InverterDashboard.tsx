import React, { useEffect, useState, useMemo } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  IconButton,
  Tooltip,
  Paper,
  Divider,
  LinearProgress,
  useTheme,
  Alert,
  AlertTitle,
  Skeleton
} from '@mui/material';
import {
  ElectricBolt,
  BatteryChargingFull,
  Thermostat,
  Speed,
  TrendingUp,
  TrendingDown,
  Timeline,
  Refresh,
  Settings,
  Warning,
  CheckCircle,
  Error as ErrorIcon,
  PowerSettingsNew,
  DeviceHub,
  FlashOn,
  WbSunny,
  Info
} from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { useDeviceStore } from '../../stores/deviceStore';
import { useRealTimeSocket } from '../../hooks/useRealTimeSocket';
import { ConnectionStatus } from '../realtime/ConnectionStatus';
import { InverterData, InverterOperatingState, Device } from '../../types/api';

interface InverterDashboardProps {
  deviceId?: string;
  showAll?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
  compact?: boolean;
}

interface InverterMetrics {
  totalPower: number;
  totalEnergyDaily: number;
  totalEnergyLifetime: number;
  averageEfficiency: number;
  averageTemperature: number;
  operatingDevices: number;
  totalDevices: number;
  criticalAlerts: number;
  communicationHealth: number;
}

export const InverterDashboard: React.FC<InverterDashboardProps> = ({
  deviceId,
  showAll = false,
  autoRefresh = true,
  refreshInterval = 15,
  compact = false
}) => {
  const theme = useTheme();
  const [inverterMetrics, setInverterMetrics] = useState<InverterMetrics>({
    totalPower: 0,
    totalEnergyDaily: 0,
    totalEnergyLifetime: 0,
    averageEfficiency: 0,
    averageTemperature: 0,
    operatingDevices: 0,
    totalDevices: 0,
    criticalAlerts: 0,
    communicationHealth: 0
  });
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [powerTrendData, setPowerTrendData] = useState<any[]>([]);
  const [selectedInverter, setSelectedInverter] = useState<Device | null>(null);

  const { 
    devices, 
    deviceData, 
    realtimeMetrics, 
    isOnline,
    isLoading,
    error,
    fetchRealtimeMetrics 
  } = useDeviceStore();

  const { isConnected } = useRealTimeSocket();

  // Filter inverter devices
  const inverterDevices = useMemo(() => {
    const inverters = devices.filter(device => device.type === 'INVERTER');
    if (deviceId) {
      return inverters.filter(device => device.id === deviceId);
    }
    return inverters;
  }, [devices, deviceId]);

  // Mock inverter data - in production this would come from the backend
  const getInverterData = (device: Device): InverterData | null => {
    const latestData = deviceData.find((data: any) => data.deviceId === device.id);
    if (!latestData) return null;

    // Transform regular device data to inverter data with SunSpec fields
    const inverterData: InverterData = {
      ...latestData,
      acPowerTotal: latestData.power,
      acFrequency: 50.0 + Math.random() * 2 - 1, // 49-51 Hz
      dcPower: latestData.power * 1.05, // DC typically higher than AC
      dcVoltage: 600 + Math.random() * 100 - 50, // 550-650V
      dcCurrent: (latestData.power * 1.05) / (600 + Math.random() * 100 - 50),
      cabinetTemperature: latestData.temperature,
      operatingState: latestData.status === 'ONLINE' ? 'MPPT' : 'OFF' as InverterOperatingState,
      eventFlags: 0,
      energyLifetime: 150000 + Math.random() * 50000, // kWh
      energyDaily: latestData.energyToday,
      energyMonthly: latestData.energyToday * 30,
      energyYearly: latestData.energyToday * 365,
      systemEfficiency: latestData.efficiency || 92 + Math.random() * 6,
      dcToAcEfficiency: 96 + Math.random() * 3,
      connectionQuality: 85 + Math.random() * 15,
      communicationErrors: Math.floor(Math.random() * 5),
      lastSuccessfulRead: new Date().toISOString(),
      registerErrors: []
    };

    return inverterData;
  };

  // Calculate metrics
  useEffect(() => {
    const calculateMetrics = () => {
      let totalPower = 0;
      let totalEnergyDaily = 0;
      let totalEnergyLifetime = 0;
      let totalEfficiency = 0;
      let totalTemperature = 0;
      let operatingCount = 0;
      let communicationSum = 0;
      let validDevices = 0;

      inverterDevices.forEach(device => {
        const inverterData = getInverterData(device);
        if (inverterData) {
          totalPower += inverterData.acPowerTotal;
          totalEnergyDaily += inverterData.energyDaily;
          totalEnergyLifetime += inverterData.energyLifetime;
          totalEfficiency += inverterData.systemEfficiency;
          totalTemperature += inverterData.cabinetTemperature;
          communicationSum += inverterData.connectionQuality;
          
          if (inverterData.operatingState === 'MPPT' || inverterData.operatingState === 'THROTTLED') {
            operatingCount++;
          }
          validDevices++;
        }
      });

      setInverterMetrics({
        totalPower,
        totalEnergyDaily,
        totalEnergyLifetime,
        averageEfficiency: validDevices > 0 ? totalEfficiency / validDevices : 0,
        averageTemperature: validDevices > 0 ? totalTemperature / validDevices : 0,
        operatingDevices: operatingCount,
        totalDevices: inverterDevices.length,
        criticalAlerts: 0, // Would come from alerts store
        communicationHealth: validDevices > 0 ? communicationSum / validDevices : 0
      });
    };

    calculateMetrics();
  }, [inverterDevices, deviceData]);

  // Update power trend data
  useEffect(() => {
    if (inverterMetrics.totalPower > 0) {
      const newDataPoint = {
        timestamp: new Date().toISOString(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        power: inverterMetrics.totalPower,
        efficiency: inverterMetrics.averageEfficiency,
        temperature: inverterMetrics.averageTemperature
      };

      setPowerTrendData(prev => {
        const updated = [...prev, newDataPoint];
        return updated.slice(-30); // Keep last 30 data points
      });
    }
  }, [inverterMetrics]);

  // Auto refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchRealtimeMetrics();
      setLastRefresh(new Date());
    }, refreshInterval * 1000);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchRealtimeMetrics]);

  const formatPower = (watts: number) => {
    if (watts >= 1000000) {
      return `${(watts / 1000000).toFixed(1)} MW`;
    } else if (watts >= 1000) {
      return `${(watts / 1000).toFixed(1)} kW`;
    }
    return `${watts.toFixed(0)} W`;
  };

  const formatEnergy = (wh: number) => {
    if (wh >= 1000000) {
      return `${(wh / 1000000).toFixed(1)} MWh`;
    } else if (wh >= 1000) {
      return `${(wh / 1000).toFixed(1)} kWh`;
    }
    return `${wh.toFixed(1)} Wh`;
  };

  const getOperatingStateColor = (state: InverterOperatingState) => {
    switch (state) {
      case 'MPPT': return 'success';
      case 'THROTTLED': return 'warning';
      case 'FAULT': return 'error';
      case 'OFF': return 'default';
      case 'STARTING': return 'info';
      default: return 'default';
    }
  };

  const getOperatingStateIcon = (state: InverterOperatingState) => {
    switch (state) {
      case 'MPPT': return <FlashOn />;
      case 'THROTTLED': return <Warning />;
      case 'FAULT': return <ErrorIcon />;
      case 'OFF': return <PowerSettingsNew />;
      case 'STARTING': return <Timeline />;
      default: return <DeviceHub />;
    }
  };

  const getPowerTrend = () => {
    if (powerTrendData.length < 5) return 'stable';
    const recent = powerTrendData.slice(-5);
    const older = powerTrendData.slice(-10, -5);
    const recentAvg = recent.reduce((sum, d) => sum + d.power, 0) / recent.length;
    const olderAvg = older.reduce((sum, d) => sum + d.power, 0) / older.length;
    
    if (recentAvg > olderAvg * 1.05) return 'up';
    if (recentAvg < olderAvg * 0.95) return 'down';
    return 'stable';
  };

  const getTrendIcon = () => {
    const trend = getPowerTrend();
    switch (trend) {
      case 'up': return <TrendingUp color="success" />;
      case 'down': return <TrendingDown color="error" />;
      default: return <Timeline color="primary" />;
    }
  };

  const MetricCard = ({ title, value, unit, icon, color = 'primary', trend, loading = false }: {
    title: string;
    value: string | number;
    unit?: string;
    icon: React.ReactNode;
    color?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
    trend?: React.ReactNode;
    loading?: boolean;
  }) => (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ py: compact ? 1.5 : 2 }}>
        {loading ? (
          <Box>
            <Skeleton variant="text" width="60%" />
            <Skeleton variant="text" width="40%" height={compact ? 32 : 40} />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography color="textSecondary" gutterBottom variant={compact ? "caption" : "body2"}>
                {title}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography variant={compact ? "h6" : "h5"} component="div">
                  {value}
                  {unit && (
                    <Typography variant={compact ? "body2" : "h6"} component="span" color="textSecondary">
                      {' '}{unit}
                    </Typography>
                  )}
                </Typography>
                {trend && <Box sx={{ ml: 1 }}>{trend}</Box>}
              </Box>
            </Box>
            <Box
              sx={{
                color: `${color}.main`,
                bgcolor: `${color}.light`,
                borderRadius: '50%',
                p: compact ? 0.75 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {icon}
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  );

  if (error) {
    return (
      <Alert severity="error">
        <AlertTitle>Error Loading Inverter Data</AlertTitle>
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant={compact ? "h6" : "h5"}>
          {showAll ? 'Inverter System Overview' : `${selectedInverter?.name || 'Inverter'} Dashboard`}
        </Typography>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ConnectionStatus variant="chip" showDetails />
          
          <Tooltip title="Last updated">
            <Typography variant="caption" color="textSecondary">
              {lastRefresh.toLocaleTimeString()}
            </Typography>
          </Tooltip>
          
          <Tooltip title="Refresh">
            <IconButton size="small" onClick={() => fetchRealtimeMetrics()}>
              <Refresh />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Settings">
            <IconButton size="small">
              <Settings />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* System Status */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Chip
              icon={<Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: isConnected ? 'success.main' : 'error.main' }} />}
              label={isConnected ? 'Real-time Active' : 'Real-time Inactive'}
              color={isConnected ? 'success' : 'error'}
              size="small"
            />
            
            <Chip
              icon={isOnline ? <CheckCircle /> : <Warning />}
              label={`${inverterMetrics.operatingDevices}/${inverterMetrics.totalDevices} Operating`}
              color={inverterMetrics.operatingDevices === inverterMetrics.totalDevices ? 'success' : 'warning'}
              size="small"
            />
            
            <Chip
              icon={<DeviceHub />}
              label={`${inverterMetrics.communicationHealth.toFixed(0)}% Comm Health`}
              color={inverterMetrics.communicationHealth >= 90 ? 'success' : inverterMetrics.communicationHealth >= 70 ? 'warning' : 'error'}
              size="small"
            />
          </Box>
          
          <Typography variant="body2" color="textSecondary">
            {inverterDevices.length} inverter{inverterDevices.length !== 1 ? 's' : ''} monitored
          </Typography>
        </Box>
      </Paper>

      {/* Main Metrics */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} md={3}>
          <MetricCard
            title="Total AC Power"
            value={formatPower(inverterMetrics.totalPower)}
            icon={<ElectricBolt />}
            color="primary"
            trend={getTrendIcon()}
            loading={isLoading}
          />
        </Grid>
        
        <Grid item xs={6} md={3}>
          <MetricCard
            title="Energy Today"
            value={formatEnergy(inverterMetrics.totalEnergyDaily)}
            icon={<WbSunny />}
            color="success"
            loading={isLoading}
          />
        </Grid>
        
        <Grid item xs={6} md={3}>
          <MetricCard
            title="System Efficiency"
            value={inverterMetrics.averageEfficiency.toFixed(1)}
            unit="%"
            icon={<Speed />}
            color={inverterMetrics.averageEfficiency >= 90 ? 'success' : inverterMetrics.averageEfficiency >= 80 ? 'warning' : 'error'}
            loading={isLoading}
          />
        </Grid>
        
        <Grid item xs={6} md={3}>
          <MetricCard
            title="Avg Temperature"
            value={inverterMetrics.averageTemperature.toFixed(1)}
            unit="°C"
            icon={<Thermostat />}
            color={inverterMetrics.averageTemperature <= 45 ? 'success' : inverterMetrics.averageTemperature <= 60 ? 'warning' : 'error'}
            loading={isLoading}
          />
        </Grid>
      </Grid>

      {/* Charts and Details */}
      <Grid container spacing={2}>
        {/* Power Trend Chart */}
        <Grid item xs={12} lg={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Power Output Trend
              </Typography>
              
              <Box sx={{ height: compact ? 250 : 350 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={powerTrendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="time" 
                      tick={{ fontSize: 10 }}
                      interval="preserveStartEnd"
                    />
                    <YAxis 
                      tick={{ fontSize: 10 }}
                      tickFormatter={formatPower}
                    />
                    <RechartsTooltip
                      formatter={(value: number, name: string) => {
                        if (name === 'power') return [formatPower(value), 'AC Power'];
                        if (name === 'efficiency') return [`${value.toFixed(1)}%`, 'Efficiency'];
                        if (name === 'temperature') return [`${value.toFixed(1)}°C`, 'Temperature'];
                        return [value, name];
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="power"
                      stroke={theme.palette.primary.main}
                      fill={theme.palette.primary.light}
                      fillOpacity={0.3}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Efficiency and Temperature */}
        <Grid item xs={12} lg={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Performance Metrics
              </Typography>
              
              <Box sx={{ height: compact ? 250 : 350 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={powerTrendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="time" 
                      tick={{ fontSize: 10 }}
                      interval="preserveStartEnd"
                    />
                    <YAxis 
                      yAxisId="efficiency"
                      orientation="left"
                      domain={[80, 100]}
                      tick={{ fontSize: 10 }}
                    />
                    <YAxis 
                      yAxisId="temperature"
                      orientation="right"
                      domain={[0, 80]}
                      tick={{ fontSize: 10 }}
                    />
                    <RechartsTooltip
                      formatter={(value: number, name: string) => {
                        if (name === 'efficiency') return [`${value.toFixed(1)}%`, 'Efficiency'];
                        if (name === 'temperature') return [`${value.toFixed(1)}°C`, 'Temperature'];
                        return [value, name];
                      }}
                    />
                    <Line
                      yAxisId="efficiency"
                      type="monotone"
                      dataKey="efficiency"
                      stroke={theme.palette.success.main}
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      yAxisId="temperature"
                      type="monotone"
                      dataKey="temperature"
                      stroke={theme.palette.warning.main}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Individual Inverter Status */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Individual Inverter Status
              </Typography>
              
              <Grid container spacing={2}>
                {inverterDevices.slice(0, compact ? 4 : 8).map((device) => {
                  const inverterData = getInverterData(device);
                  
                  return (
                    <Grid item xs={12} sm={6} md={compact ? 6 : 3} key={device.id}>
                      <Paper 
                        sx={{ 
                          p: 2, 
                          cursor: 'pointer',
                          '&:hover': { bgcolor: 'action.hover' }
                        }}
                        onClick={() => setSelectedInverter(device)}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          {inverterData && getOperatingStateIcon(inverterData.operatingState)}
                          <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
                            {device.name}
                          </Typography>
                          <Chip
                            size="small"
                            label={inverterData?.operatingState || 'UNKNOWN'}
                            color={getOperatingStateColor(inverterData?.operatingState || 'UNKNOWN')}
                          />
                        </Box>
                        
                        {inverterData && (
                          <Box>
                            <Typography variant="body2" color="textSecondary">
                              {formatPower(inverterData.acPowerTotal)} • {inverterData.cabinetTemperature.toFixed(1)}°C
                            </Typography>
                            <Box sx={{ mt: 1 }}>
                              <LinearProgress
                                variant="determinate"
                                value={inverterData.systemEfficiency}
                                sx={{ height: 4 }}
                              />
                              <Typography variant="caption" color="textSecondary">
                                {inverterData.systemEfficiency.toFixed(1)}% efficiency
                              </Typography>
                            </Box>
                            <Box sx={{ mt: 1 }}>
                              <LinearProgress
                                variant="determinate"
                                value={inverterData.connectionQuality}
                                color="info"
                                sx={{ height: 4 }}
                              />
                              <Typography variant="caption" color="textSecondary">
                                {inverterData.connectionQuality.toFixed(0)}% comm quality
                              </Typography>
                            </Box>
                          </Box>
                        )}
                      </Paper>
                    </Grid>
                  );
                })}
              </Grid>
              
              {inverterDevices.length > (compact ? 4 : 8) && (
                <Box sx={{ mt: 2, textAlign: 'center' }}>
                  <Typography variant="body2" color="textSecondary">
                    + {inverterDevices.length - (compact ? 4 : 8)} more inverters
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};