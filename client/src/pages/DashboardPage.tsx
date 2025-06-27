import React, { useEffect, useState } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Paper,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  ElectricBolt,
  DevicesOther,
  Warning,
  CheckCircle
} from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useDeviceStore } from '../stores/deviceStore';
import { useRealTimeSocket } from '../hooks/useRealTimeSocket';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon: React.ReactNode;
  color?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, unit, icon, color = 'primary' }) => (
  <Card>
    <CardContent>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography color="textSecondary" gutterBottom variant="body2">
            {title}
          </Typography>
          <Typography variant="h4" component="div">
            {value}
            {unit && (
              <Typography variant="h6" component="span" color="textSecondary">
                {' '}{unit}
              </Typography>
            )}
          </Typography>
        </Box>
        <Box
          sx={{
            color: `${color}.main`,
            bgcolor: `${color}.light`,
            borderRadius: '50%',
            p: 1,
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

export const DashboardPage: React.FC = () => {
  const {
    devices,
    realtimeMetrics,
    isLoading,
    error,
    fetchDevices,
    fetchRealtimeMetrics
  } = useDeviceStore();
  
  const [powerData, setPowerData] = useState<any[]>([]);
  
  // Set up real-time WebSocket connection
  useRealTimeSocket();

  useEffect(() => {
    fetchDevices();
    fetchRealtimeMetrics();
    
    // Set up polling for metrics every 30 seconds
    const interval = setInterval(() => {
      fetchRealtimeMetrics();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [fetchDevices, fetchRealtimeMetrics]);

  // Generate sample power data for chart
  useEffect(() => {
    const generatePowerData = () => {
      const now = new Date();
      const data = [];
      
      for (let i = 23; i >= 0; i--) {
        const time = new Date(now.getTime() - i * 60 * 60 * 1000);
        const hour = time.getHours();
        
        // Simulate solar power curve (higher during day)
        let power = 0;
        if (hour >= 6 && hour <= 18) {
          const midday = 12;
          const distanceFromMidday = Math.abs(hour - midday);
          power = Math.max(0, (6 - distanceFromMidday) * 800 + Math.random() * 200);
        }
        
        data.push({
          time: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          power: Math.round(power)
        });
      }
      
      return data;
    };

    setPowerData(generatePowerData());
  }, []);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Metrics Cards */}
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Total Power"
            value={realtimeMetrics?.totalPower?.toFixed(1) || '0'}
            unit="kW"
            icon={<ElectricBolt />}
            color="primary"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Energy Today"
            value={realtimeMetrics?.totalEnergyToday?.toFixed(1) || '0'}
            unit="kWh"
            icon={<ElectricBolt />}
            color="success"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Online Devices"
            value={`${realtimeMetrics?.onlineDevices || 0}/${realtimeMetrics?.totalDevices || 0}`}
            icon={<CheckCircle />}
            color="success"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Alerts"
            value={realtimeMetrics?.errorDevices || 0}
            icon={<Warning />}
            color="error"
          />
        </Grid>

        {/* Power Chart */}
        <Grid item xs={12} lg={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Power Output (24 Hours)
            </Typography>
            <Box sx={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={powerData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="time" 
                    tick={{ fontSize: 12 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    label={{ value: 'Power (W)', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip 
                    formatter={(value: number) => [`${value} W`, 'Power']}
                    labelFormatter={(label) => `Time: ${label}`}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="power" 
                    stroke="#1976d2" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>

        {/* Device Status */}
        <Grid item xs={12} lg={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Device Status
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {devices.slice(0, 5).map((device) => (
                <Box key={device.id} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box
                    sx={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      bgcolor: device.status === 'ONLINE' ? 'success.main' : 
                              device.status === 'ERROR' ? 'error.main' : 'grey.400'
                    }}
                  />
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="body2" fontWeight="medium">
                      {device.name}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {device.type} • {device.manufacturer}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="textSecondary">
                    {device.status}
                  </Typography>
                </Box>
              ))}
              
              {devices.length === 0 && (
                <Typography variant="body2" color="textSecondary" textAlign="center">
                  No devices configured yet
                </Typography>
              )}
            </Box>
          </Paper>
        </Grid>

        {/* Quick Stats */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              System Overview
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <Box textAlign="center">
                  <Typography variant="h4" color="primary">
                    {devices.length}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Total Devices
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box textAlign="center">
                  <Typography variant="h4" color="success.main">
                    {realtimeMetrics?.averageEfficiency?.toFixed(1) || '0'}%
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    System Efficiency
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box textAlign="center">
                  <Typography variant="h4" color="info.main">
                    {((realtimeMetrics?.totalEnergyToday || 0) * 0.5).toFixed(1)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    CO₂ Saved (kg)
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box textAlign="center">
                  <Typography variant="h4" color="warning.main">
                    ${((realtimeMetrics?.totalEnergyToday || 0) * 0.12).toFixed(2)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Savings Today
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};