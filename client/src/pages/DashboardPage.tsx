import React, { useEffect, useState } from 'react';
import {
  Box,
  Grid2 as Grid,
  Card,
  CardContent,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Switch,
  FormControlLabel,
  Chip
} from '@mui/material';
import {
  ElectricBolt,
  Warning,
  CheckCircle,
  Dashboard,
  Timeline,
  DevicesOther
} from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useDeviceStore } from '../stores/deviceStore';
import { useRealTimeSocket } from '../hooks/useRealTimeSocket';
import { RealTimeDashboard, ConnectionStatus, LivePowerMonitor, NotificationSystem } from '../components/realtime';

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
      id={`dashboard-tabpanel-${index}`}
      aria-labelledby={`dashboard-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ py: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

export const DashboardPage: React.FC = () => {
  const {
    devices,
    realtimeMetrics,
    isLoading,
    error,
    fetchDevices,
    fetchRealtimeMetrics,
    connectionStatus,
    isOnline
  } = useDeviceStore();
  
  const [powerData, setPowerData] = useState<any[]>([]);
  const [tabValue, setTabValue] = useState(0);
  const [useRealTimeView, setUseRealTimeView] = useState(true);
  
  // Set up real-time WebSocket connection
  const { isConnected, connectionStats } = useRealTimeSocket();

  useEffect(() => {
    fetchDevices();
    fetchRealtimeMetrics();
    
    // Set up polling for metrics every 30 seconds (fallback for when WebSocket is not available)
    const interval = setInterval(() => {
      if (!isConnected) {
        fetchRealtimeMetrics();
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, [fetchDevices, fetchRealtimeMetrics, isConnected]);

  // Generate sample power data for chart (fallback when real-time is not available)
  useEffect(() => {
    if (!isConnected || !useRealTimeView) {
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
    }
  }, [isConnected, useRealTimeView]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">
          Dashboard
        </Typography>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <ConnectionStatus variant="chip" showDetails />
          <NotificationSystem />
        </Box>
      </Box>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Connection Status Banner */}
      {(!isOnline || !isConnected) && (
        <Alert 
          severity={!isOnline ? "error" : "warning"} 
          sx={{ mb: 3 }}
          action={
            <Chip
              size="small"
              label={!isOnline ? "Offline Mode" : "Real-time Disconnected"}
              color={!isOnline ? "error" : "warning"}
            />
          }
        >
          {!isOnline 
            ? "You are currently offline. Data may not be up to date."
            : "Real-time connection lost. Using cached data and polling for updates."
          }
        </Alert>
      )}

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="dashboard tabs">
          <Tab
            icon={<Timeline />}
            label={`Real-time ${isConnected ? '(Live)' : '(Offline)'}`}
            id="dashboard-tab-0"
            aria-controls="dashboard-tabpanel-0"
          />
          <Tab
            icon={<Dashboard />}
            label="Overview"
            id="dashboard-tab-1"
            aria-controls="dashboard-tabpanel-1"
          />
        </Tabs>
      </Box>

      <TabPanel value={tabValue} index={0}>
        {/* Real-time Dashboard */}
        <RealTimeDashboard
          autoRefresh={true}
          refreshInterval={30}
          showConnectionDetails={false}
          compactView={false}
        />
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        {/* Traditional Overview Dashboard */}
        <Grid container spacing={3}>
          {/* Metrics Cards */}
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <MetricCard
              title="Total Power"
              value={realtimeMetrics?.totalPower?.toFixed(1) || '0'}
              unit="kW"
              icon={<ElectricBolt />}
              color="primary"
            />
          </Grid>
          
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <MetricCard
              title="Energy Today"
              value={realtimeMetrics?.totalEnergyToday?.toFixed(1) || '0'}
              unit="kWh"
              icon={<ElectricBolt />}
              color="success"
            />
          </Grid>
          
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <MetricCard
              title="Online Devices"
              value={`${realtimeMetrics?.onlineDevices || 0}/${realtimeMetrics?.totalDevices || 0}`}
              icon={<CheckCircle />}
              color="success"
            />
          </Grid>
          
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <MetricCard
              title="Alerts"
              value={realtimeMetrics?.errorDevices || 0}
              icon={<Warning />}
              color="error"
            />
          </Grid>

          {/* Power Chart */}
          <Grid size={{ xs: 12, lg: 8 }}>
            {useRealTimeView && isConnected ? (
              <LivePowerMonitor
                showAll
                timeWindow={60}
                compact={false}
                autoScale
              />
            ) : (
              <Paper sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="h6">
                    Power Output (24 Hours)
                  </Typography>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={useRealTimeView}
                        onChange={(e) => setUseRealTimeView(e.target.checked)}
                        size="small"
                        disabled={!isConnected}
                      />
                    }
                    label="Real-time"
                  />
                </Box>
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
            )}
          </Grid>

          {/* Device Status */}
          <Grid size={{ xs: 12, lg: 4 }}>
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
          <Grid size={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                System Overview
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="primary">
                      {devices.length}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Total Devices
                    </Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="success.main">
                      {realtimeMetrics?.averageEfficiency?.toFixed(1) || '0'}%
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      System Efficiency
                    </Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="info.main">
                      {((realtimeMetrics?.totalEnergyToday || 0) * 0.5).toFixed(1)}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      CO₂ Saved (kg)
                    </Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
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
      </TabPanel>
    </Box>
  );
};