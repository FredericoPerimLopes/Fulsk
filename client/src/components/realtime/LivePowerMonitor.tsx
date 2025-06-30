import React, { useEffect, useState, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  LinearProgress,
  Chip,
  IconButton,
  Tooltip,
  useTheme
} from '@mui/material';
import {
  ElectricBolt,
  TrendingUp,
  TrendingDown,
  Battery4Bar,
  WbSunny,
  Pause,
  PlayArrow,
  Fullscreen
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  ReferenceLine
} from 'recharts';
import { useDeviceStore } from '../../stores/deviceStore';
import { useRealTimeSocket } from '../../hooks/useRealTimeSocket';
import { DeviceData, Device } from '../../types/api';

interface PowerDataPoint {
  timestamp: string;
  time: string;
  power: number;
  voltage: number;
  current: number;
  temperature: number;
  efficiency?: number;
}

interface LivePowerMonitorProps {
  deviceId?: string;
  timeWindow?: number; // in minutes
  showAll?: boolean;
  compact?: boolean;
  autoScale?: boolean;
}

export const LivePowerMonitor: React.FC<LivePowerMonitorProps> = ({
  deviceId,
  timeWindow = 60,
  showAll = false,
  compact = false,
  autoScale = true
}) => {
  const theme = useTheme();
  const [isPaused, setIsPaused] = useState(false);
  const [powerHistory, setPowerHistory] = useState<PowerDataPoint[]>([]);
  const [maxPower, setMaxPower] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const { devices, deviceData, realtimeMetrics } = useDeviceStore();
  const { isConnected } = useRealTimeSocket();

  // Filter devices or use selected device
  const targetDevices = useMemo(() => {
    if (deviceId) {
      return devices.filter(d => d.id === deviceId);
    }
    return showAll ? devices : devices.slice(0, 1);
  }, [devices, deviceId, showAll]);

  // Calculate aggregate power data
  const aggregatedData = useMemo(() => {
    if (showAll && !deviceId) {
      // Aggregate all devices
      const totalPower = realtimeMetrics?.totalPower || 0;
      const now = new Date();
      
      return {
        currentPower: totalPower,
        peakPower: maxPower,
        averagePower: powerHistory.length > 0 
          ? powerHistory.reduce((sum, p) => sum + p.power, 0) / powerHistory.length 
          : 0,
        efficiency: realtimeMetrics?.averageEfficiency || 0,
        status: realtimeMetrics?.onlineDevices === realtimeMetrics?.totalDevices ? 'optimal' : 'suboptimal',
        lastUpdate: now
      };
    } else {
      // Single device data
      const device = targetDevices[0];
      if (!device) return null;
      
      const latestData = deviceData[device.id]?.[0];
      if (!latestData) return null;
      
      return {
        currentPower: latestData.power,
        peakPower: Math.max(...(deviceData[device.id]?.slice(0, 60).map(d => d.power) || [0])),
        averagePower: deviceData[device.id]?.slice(0, 60).reduce((sum, d) => sum + d.power, 0) / Math.min(60, deviceData[device.id]?.length || 1) || 0,
        efficiency: latestData.efficiency || 0,
        voltage: latestData.voltage,
        current: latestData.current,
        temperature: latestData.temperature,
        status: latestData.status,
        lastUpdate: new Date(latestData.timestamp)
      };
    }
  }, [targetDevices, deviceData, realtimeMetrics, maxPower, powerHistory, deviceId, showAll]);

  // Update power history for charts
  useEffect(() => {
    if (isPaused || !aggregatedData) return;

    const newDataPoint: PowerDataPoint = {
      timestamp: new Date().toISOString(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      power: aggregatedData.currentPower,
      voltage: aggregatedData.voltage || 0,
      current: aggregatedData.current || 0,
      temperature: aggregatedData.temperature || 0,
      efficiency: aggregatedData.efficiency
    };

    setPowerHistory(prev => {
      const updated = [newDataPoint, ...prev];
      // Keep data points for the specified time window
      const cutoffTime = new Date(Date.now() - timeWindow * 60 * 1000);
      return updated.filter(point => new Date(point.timestamp) > cutoffTime).slice(0, 200);
    });

    // Update max power for scaling
    if (autoScale) {
      setMaxPower(prev => Math.max(prev, aggregatedData.currentPower));
    }
  }, [aggregatedData, isPaused, timeWindow, autoScale]);

  const getPowerTrend = () => {
    if (powerHistory.length < 2) return 'stable';
    const recent = powerHistory.slice(0, 5);
    const older = powerHistory.slice(5, 10);
    const recentAvg = recent.reduce((sum, p) => sum + p.power, 0) / recent.length;
    const olderAvg = older.reduce((sum, p) => sum + p.power, 0) / older.length;
    
    const change = ((recentAvg - olderAvg) / olderAvg) * 100;
    if (change > 5) return 'increasing';
    if (change < -5) return 'decreasing';
    return 'stable';
  };

  const getTrendIcon = () => {
    const trend = getPowerTrend();
    if (trend === 'increasing') return <TrendingUp color="success" />;
    if (trend === 'decreasing') return <TrendingDown color="error" />;
    return <ElectricBolt color="primary" />;
  };

  const getEfficiencyColor = (efficiency: number) => {
    if (efficiency >= 90) return theme.palette.success.main;
    if (efficiency >= 80) return theme.palette.warning.main;
    return theme.palette.error.main;
  };

  const formatPower = (watts: number) => {
    if (watts >= 1000) {
      return `${(watts / 1000).toFixed(1)} kW`;
    }
    return `${watts.toFixed(0)} W`;
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  if (!aggregatedData) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4 }}>
            <Typography color="textSecondary">
              No device data available
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  const chartHeight = isFullscreen ? 500 : compact ? 200 : 300;

  return (
    <Card sx={{ height: isFullscreen ? '90vh' : 'auto' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <WbSunny color="warning" sx={{ mr: 1 }} />
          <Typography variant={compact ? "subtitle1" : "h6"}>
            {showAll ? 'System Power' : `${targetDevices[0]?.name || 'Device'} Power`}
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          
          <Chip
            icon={<Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: isConnected ? 'success.main' : 'error.main' }} />}
            label={isConnected ? 'Live' : 'Offline'}
            size="small"
            color={isConnected ? 'success' : 'error'}
            sx={{ mr: 1 }}
          />
          
          <Tooltip title={isPaused ? 'Resume' : 'Pause'}>
            <IconButton size="small" onClick={() => setIsPaused(!isPaused)}>
              {isPaused ? <PlayArrow /> : <Pause />}
            </IconButton>
          </Tooltip>
          
          <Tooltip title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}>
            <IconButton size="small" onClick={toggleFullscreen}>
              <Fullscreen />
            </IconButton>
          </Tooltip>
        </Box>

        <Grid container spacing={2} sx={{ mb: 2 }}>
          {/* Current Power */}
          <Grid item xs={6} md={3}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="body2" color="textSecondary">
                Current Power
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {getTrendIcon()}
                <Typography variant={compact ? "h6" : "h5"} sx={{ ml: 1 }}>
                  {formatPower(aggregatedData.currentPower)}
                </Typography>
              </Box>
            </Box>
          </Grid>

          {/* Peak Power */}
          <Grid item xs={6} md={3}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="body2" color="textSecondary">
                Peak Power
              </Typography>
              <Typography variant={compact ? "h6" : "h5"} color="primary">
                {formatPower(aggregatedData.peakPower)}
              </Typography>
            </Box>
          </Grid>

          {/* Efficiency */}
          <Grid item xs={6} md={3}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="body2" color="textSecondary">
                Efficiency
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                <Typography 
                  variant={compact ? "h6" : "h5"}
                  sx={{ color: getEfficiencyColor(aggregatedData.efficiency) }}
                >
                  {aggregatedData.efficiency.toFixed(1)}%
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={aggregatedData.efficiency}
                  sx={{ 
                    width: '100%', 
                    mt: 0.5,
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: getEfficiencyColor(aggregatedData.efficiency)
                    }
                  }}
                />
              </Box>
            </Box>
          </Grid>

          {/* Status */}
          <Grid item xs={6} md={3}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="body2" color="textSecondary">
                Status
              </Typography>
              <Chip
                icon={<Battery4Bar />}
                label={aggregatedData.status}
                color={aggregatedData.status === 'ONLINE' || aggregatedData.status === 'optimal' ? 'success' : 'warning'}
                size="small"
              />
            </Box>
          </Grid>
        </Grid>

        {/* Power Chart */}
        <Box sx={{ height: chartHeight, mt: 2 }}>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            Power Output ({timeWindow} min window)
          </Typography>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={powerHistory.slice().reverse()}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="time"
                tick={{ fontSize: 10 }}
                interval="preserveStartEnd"
              />
              <YAxis 
                tick={{ fontSize: 10 }}
                domain={autoScale ? ['dataMin - 100', 'dataMax + 100'] : [0, 'dataMax']}
                tickFormatter={formatPower}
              />
              <RechartsTooltip
                formatter={(value: number) => [formatPower(value), 'Power']}
                labelFormatter={(label) => `Time: ${label}`}
              />
              <Area
                type="monotone"
                dataKey="power"
                stroke={theme.palette.primary.main}
                fill={theme.palette.primary.light}
                fillOpacity={0.3}
                strokeWidth={2}
              />
              {aggregatedData.peakPower > 0 && (
                <ReferenceLine 
                  y={aggregatedData.peakPower} 
                  stroke={theme.palette.secondary.main} 
                  strokeDasharray="5 5"
                  label="Peak"
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </Box>

        {/* Additional metrics for non-compact view */}
        {!compact && aggregatedData.voltage && (
          <Grid container spacing={2} sx={{ mt: 2 }}>
            <Grid item xs={4}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="body2" color="textSecondary">
                  Voltage
                </Typography>
                <Typography variant="h6">
                  {aggregatedData.voltage.toFixed(1)} V
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={4}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="body2" color="textSecondary">
                  Current
                </Typography>
                <Typography variant="h6">
                  {aggregatedData.current?.toFixed(1)} A
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={4}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="body2" color="textSecondary">
                  Temperature
                </Typography>
                <Typography variant="h6">
                  {aggregatedData.temperature?.toFixed(1)}°C
                </Typography>
              </Box>
            </Grid>
          </Grid>
        )}

        {/* Last update time */}
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Typography variant="caption" color="textSecondary">
            Last updated: {aggregatedData.lastUpdate.toLocaleTimeString()}
            {isPaused && ' (Paused)'}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};