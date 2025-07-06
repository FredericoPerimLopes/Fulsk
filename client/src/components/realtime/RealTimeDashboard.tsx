import React, { useEffect, useState } from 'react';
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
  useTheme
} from '@mui/material';
import {
  Refresh,
  TrendingUp,
  TrendingDown,
  Timeline,
  DevicesOther,
  Warning,
  CheckCircle,
  ElectricBolt,
  WbSunny,
  Thermostat,
  Speed
} from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { useDeviceStore } from '../../stores/deviceStore';
import { useAlertStore } from '../../stores/alertStore';
import { useRealTimeSocket } from '../../hooks/useRealTimeSocket';
import { ConnectionStatus } from './ConnectionStatus';
import { LivePowerMonitor } from './LivePowerMonitor';

interface RealTimeDashboardProps {
  autoRefresh?: boolean;
  refreshInterval?: number; // in seconds
  showConnectionDetails?: boolean;
  compactView?: boolean;
}

interface SystemMetrics {
  totalPower: number;
  averageEfficiency: number;
  totalEnergyToday: number;
  activeDevices: number;
  totalDevices: number;
  criticalAlerts: number;
  averageTemperature: number;
  trend: 'up' | 'down' | 'stable';
}

export const RealTimeDashboard: React.FC<RealTimeDashboardProps> = ({
  autoRefresh = true,
  refreshInterval = 30,
  showConnectionDetails = true,
  compactView = false
}) => {
  const theme = useTheme();
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics>({
    totalPower: 0,
    averageEfficiency: 0,
    totalEnergyToday: 0,
    activeDevices: 0,
    totalDevices: 0,
    criticalAlerts: 0,
    averageTemperature: 0,
    trend: 'stable'
  });
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [chartData, setChartData] = useState<any[]>([]);
  
  const { 
    devices, 
    deviceData, 
    realtimeMetrics, 
    connectionStatus,
    isOnline,
    fetchRealtimeMetrics 
  } = useDeviceStore();
  
  const { 
    alerts, 
    getAlertsBySeverity 
  } = useAlertStore();
  
  const { 
    isConnected, 
    connectionStats 
  } = useRealTimeSocket();

  // Calculate system metrics
  useEffect(() => {
    const calculateMetrics = () => {
      let totalPower = 0;
      let totalEfficiency = 0;
      let totalEnergyToday = 0;
      let activeDeviceCount = 0;
      let temperatureSum = 0;
      let temperatureCount = 0;

      devices.forEach(device => {
        const latestData = deviceData[device.id]?.[0];
        if (latestData) {
          totalPower += latestData.power;
          totalEnergyToday += latestData.energyToday;
          
          if (latestData.efficiency) {
            totalEfficiency += latestData.efficiency;
          }
          
          if (latestData.temperature) {
            temperatureSum += latestData.temperature;
            temperatureCount++;
          }
          
          if (latestData.status === 'ONLINE') {
            activeDeviceCount++;
          }
        }
      });

      const averageEfficiency = devices.length > 0 ? totalEfficiency / devices.length : 0;
      const averageTemperature = temperatureCount > 0 ? temperatureSum / temperatureCount : 0;
      const criticalAlertsCount = getAlertsBySeverity('CRITICAL').length;

      // Calculate trend based on recent power data
      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (chartData.length >= 2) {
        const recent = chartData.slice(-5).reduce((sum, d) => sum + d.power, 0) / Math.min(5, chartData.length);
        const older = chartData.slice(-10, -5).reduce((sum, d) => sum + d.power, 0) / Math.min(5, chartData.slice(-10, -5).length);
        
        if (recent > older * 1.05) trend = 'up';
        else if (recent < older * 0.95) trend = 'down';
      }

      setSystemMetrics({
        totalPower,
        averageEfficiency,
        totalEnergyToday,
        activeDevices: activeDeviceCount,
        totalDevices: devices.length,
        criticalAlerts: criticalAlertsCount,
        averageTemperature,
        trend
      });
    };

    calculateMetrics();
  }, [devices, deviceData, alerts, chartData, getAlertsBySeverity]);

  // Update chart data
  useEffect(() => {
    if (realtimeMetrics) {
      const newDataPoint = {
        timestamp: new Date().toISOString(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        power: realtimeMetrics.totalPower,
        efficiency: realtimeMetrics.averageEfficiency,
        activeDevices: realtimeMetrics.onlineDevices
      };

      setChartData(prev => {
        const updated = [...prev, newDataPoint];
        return updated.slice(-20); // Keep last 20 data points
      });
    }
  }, [realtimeMetrics]);

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
    if (watts >= 1000) {
      return `${(watts / 1000).toFixed(1)} kW`;
    }
    return `${watts.toFixed(0)} W`;
  };

  const getTrendIcon = () => {
    switch (systemMetrics.trend) {
      case 'up':
        return <TrendingUp color="success" />;
      case 'down':
        return <TrendingDown color="error" />;
      default:
        return <Timeline color="primary" />;
    }
  };

  const MetricCard = ({ title, value, unit, icon, color = 'primary', trend }: {
    title: string;
    value: string | number;
    unit?: string;
    icon: React.ReactNode;
    color?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
    trend?: React.ReactNode;
  }) => (
    <Card>
      <CardContent sx={{ py: compactView ? 1.5 : 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography color="textSecondary" gutterBottom variant={compactView ? "caption" : "body2"}>
              {title}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography variant={compactView ? "h6" : "h5"} component="div">
                {value}
                {unit && (
                  <Typography variant={compactView ? "body2" : "h6"} component="span" color="textSecondary">
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
              p: compactView ? 0.75 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant={compactView ? "h6" : "h5"}>
          Real-time System Overview
        </Typography>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {showConnectionDetails && (
            <ConnectionStatus variant="chip" showDetails />
          )}
          
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
              label={isOnline ? 'Online' : 'Offline'}
              color={isOnline ? 'success' : 'warning'}
              size="small"
            />
            
            {systemMetrics.criticalAlerts > 0 && (
              <Chip
                icon={<Warning />}
                label={`${systemMetrics.criticalAlerts} Critical Alert${systemMetrics.criticalAlerts > 1 ? 's' : ''}`}
                color="error"
                size="small"
              />
            )}
          </Box>
          
          <Typography variant="body2" color="textSecondary">
            {systemMetrics.activeDevices}/{systemMetrics.totalDevices} devices active
          </Typography>
        </Box>
      </Paper>

      {/* Main Metrics */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} md={3}>
          <MetricCard
            title="Total Power"
            value={formatPower(systemMetrics.totalPower)}
            icon={<ElectricBolt />}
            color="primary"
            trend={getTrendIcon()}
          />
        </Grid>
        
        <Grid item xs={6} md={3}>
          <MetricCard
            title="Energy Today"
            value={systemMetrics.totalEnergyToday.toFixed(1)}
            unit="kWh"
            icon={<WbSunny />}
            color="success"
          />
        </Grid>
        
        <Grid item xs={6} md={3}>
          <MetricCard
            title="System Efficiency"
            value={systemMetrics.averageEfficiency.toFixed(1)}
            unit="%"
            icon={<Speed />}
            color={systemMetrics.averageEfficiency >= 85 ? 'success' : systemMetrics.averageEfficiency >= 70 ? 'warning' : 'error'}
          />
        </Grid>
        
        <Grid item xs={6} md={3}>
          <MetricCard
            title="Avg Temperature"
            value={systemMetrics.averageTemperature.toFixed(1)}
            unit="°C"
            icon={<Thermostat />}
            color={systemMetrics.averageTemperature <= 35 ? 'success' : systemMetrics.averageTemperature <= 45 ? 'warning' : 'error'}
          />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        {/* Live Power Chart */}
        <Grid item xs={12} lg={8}>
          <LivePowerMonitor
            showAll
            compact={compactView}
            timeWindow={30}
          />
        </Grid>

        {/* System Performance Chart */}
        <Grid item xs={12} lg={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                System Performance
              </Typography>
              
              <Box sx={{ height: compactView ? 200 : 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="time" 
                      tick={{ fontSize: 10 }}
                      interval="preserveStartEnd"
                    />
                    <YAxis 
                      yAxisId="efficiency"
                      orientation="left"
                      domain={[0, 100]}
                      tick={{ fontSize: 10 }}
                    />
                    <YAxis 
                      yAxisId="devices"
                      orientation="right"
                      domain={[0, systemMetrics.totalDevices]}
                      tick={{ fontSize: 10 }}
                    />
                    <RechartsTooltip
                      formatter={(value: number, name: string) => {
                        if (name === 'efficiency') return [`${value.toFixed(1)}%`, 'Efficiency'];
                        if (name === 'activeDevices') return [value, 'Active Devices'];
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
                      yAxisId="devices"
                      type="monotone"
                      dataKey="activeDevices"
                      stroke={theme.palette.primary.main}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Device Status Summary */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Device Status Summary
              </Typography>
              
              <Grid container spacing={2}>
                {devices.slice(0, compactView ? 4 : 8).map((device) => {
                  const latestData = deviceData[device.id]?.[0];
                  const deviceAlerts = alerts.filter(a => a.deviceId === device.id && !a.acknowledged);
                  
                  return (
                    <Grid item xs={12} sm={6} md={compactView ? 6 : 3} key={device.id}>
                      <Paper sx={{ p: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Box
                            sx={{
                              width: 12,
                              height: 12,
                              borderRadius: '50%',
                              bgcolor: latestData?.status === 'ONLINE' ? 'success.main' : 
                                      latestData?.status === 'ERROR' ? 'error.main' : 'grey.400'
                            }}
                          />
                          <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
                            {device.name}
                          </Typography>
                          {deviceAlerts.length > 0 && (
                            <Chip
                              size="small"
                              label={deviceAlerts.length}
                              color="error"
                              sx={{ height: 18 }}
                            />
                          )}
                        </Box>
                        
                        {latestData && (
                          <Box>
                            <Typography variant="body2" color="textSecondary">
                              {formatPower(latestData.power)} • {latestData.temperature.toFixed(1)}°C
                            </Typography>
                            {latestData.efficiency && (
                              <Box sx={{ mt: 1 }}>
                                <LinearProgress
                                  variant="determinate"
                                  value={latestData.efficiency}
                                  sx={{ height: 4 }}
                                />
                                <Typography variant="caption" color="textSecondary">
                                  {latestData.efficiency.toFixed(1)}% efficiency
                                </Typography>
                              </Box>
                            )}
                          </Box>
                        )}
                      </Paper>
                    </Grid>
                  );
                })}
              </Grid>
              
              {devices.length > (compactView ? 4 : 8) && (
                <Box sx={{ mt: 2, textAlign: 'center' }}>
                  <Typography variant="body2" color="textSecondary">
                    + {devices.length - (compactView ? 4 : 8)} more devices
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