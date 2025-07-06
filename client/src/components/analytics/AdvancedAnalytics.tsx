import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  Paper,
  Chip,
  Switch,
  FormControlLabel,
  Alert,
  useTheme
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  BarChart,
  Timeline,
  Download,
  Refresh,
  FilterList,
  CompareArrows,
  Assessment,
  WbSunny,
  BatteryChargingFull,
  ElectricBolt,
  Thermostat
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  ReferenceLine
} from 'recharts';
import { useDeviceStore } from '../../stores/deviceStore';
import { useRealTimeSocket } from '../../hooks/useRealTimeSocket';
import { Device, DeviceData } from '../../types/api';

interface AnalyticsData {
  timestamp: string;
  time: string;
  hour: number;
  day: string;
  totalPower: number;
  totalEnergy: number;
  averageEfficiency: number;
  peakPower: number;
  averageTemperature: number;
  onlineDevices: number;
  totalDevices: number;
  weatherScore: number; // Simulated weather impact
  performanceScore: number;
}

interface PerformanceMetrics {
  energyToday: number;
  energyWeek: number;
  energyMonth: number;
  energyYear: number;
  co2Saved: number;
  costSavings: number;
  avgEfficiency: number;
  peakEfficiency: number;
  uptimePercentage: number;
  totalAlerts: number;
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
      id={`analytics-tabpanel-${index}`}
      aria-labelledby={`analytics-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

interface AdvancedAnalyticsProps {
  deviceId?: string;
  timeRange?: 'day' | 'week' | 'month' | 'year';
  showExport?: boolean;
  autoRefresh?: boolean;
}

export const AdvancedAnalytics: React.FC<AdvancedAnalyticsProps> = ({
  deviceId,
  timeRange = 'day',
  showExport = true,
  autoRefresh = true
}) => {
  const theme = useTheme();
  const [tabValue, setTabValue] = useState(0);
  const [selectedTimeRange, setSelectedTimeRange] = useState(timeRange);
  const [compareMode, setCompareMode] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(false);

  const { devices, deviceData, realtimeMetrics } = useDeviceStore();
  const { isConnected } = useRealTimeSocket();

  // Filter devices if deviceId is specified
  const targetDevices = useMemo(() => {
    if (deviceId) {
      return devices.filter(d => d.id === deviceId);
    }
    return devices;
  }, [devices, deviceId]);

  // Generate analytics data based on time range
  const generateAnalyticsData = () => {
    setLoading(true);
    
    try {
      const now = new Date();
      let dataPoints = 24; // Default for day view
      let intervalHours = 1;
      
      switch (selectedTimeRange) {
        case 'week':
          dataPoints = 7;
          intervalHours = 24;
          break;
        case 'month':
          dataPoints = 30;
          intervalHours = 24;
          break;
        case 'year':
          dataPoints = 12;
          intervalHours = 24 * 30;
          break;
      }

      const data: AnalyticsData[] = [];
      
      for (let i = dataPoints - 1; i >= 0; i--) {
        const timestamp = new Date(now.getTime() - i * intervalHours * 60 * 60 * 1000);
        const hour = timestamp.getHours();
        const dayOfWeek = timestamp.toLocaleDateString('en-US', { weekday: 'short' });
        
        // Simulate solar power curve based on time of day for day view
        let basePower = 0;
        if (selectedTimeRange === 'day') {
          if (hour >= 6 && hour <= 18) {
            const midday = 12;
            const distanceFromMidday = Math.abs(hour - midday);
            basePower = Math.max(0, (6 - distanceFromMidday) * 1000 + Math.random() * 300);
          }
        } else {
          // For longer periods, simulate seasonal and daily variations
          basePower = 3000 + Math.random() * 2000 + Math.sin(i / dataPoints * Math.PI * 2) * 1000;
        }

        // Calculate derived metrics
        const totalPower = basePower * targetDevices.length;
        const efficiency = 88 + Math.random() * 10; // 88-98%
        const temperature = 25 + Math.random() * 20 + (hour >= 12 && hour <= 16 ? 10 : 0);
        const weatherScore = 70 + Math.random() * 30; // Weather impact simulation
        const performanceScore = (efficiency / 100) * (weatherScore / 100) * 100;

        data.push({
          timestamp: timestamp.toISOString(),
          time: selectedTimeRange === 'day' 
            ? timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : selectedTimeRange === 'week'
            ? dayOfWeek
            : selectedTimeRange === 'month'
            ? timestamp.getDate().toString()
            : timestamp.toLocaleDateString('en-US', { month: 'short' }),
          hour,
          day: dayOfWeek,
          totalPower,
          totalEnergy: totalPower * intervalHours / 1000, // Convert to kWh
          averageEfficiency: efficiency,
          peakPower: totalPower * (1 + Math.random() * 0.2),
          averageTemperature: temperature,
          onlineDevices: Math.max(1, targetDevices.length - Math.floor(Math.random() * 2)),
          totalDevices: targetDevices.length,
          weatherScore,
          performanceScore
        });
      }

      setAnalyticsData(data);
      
      // Calculate performance metrics
      const totalEnergyToday = data.reduce((sum, d) => sum + d.totalEnergy, 0);
      const totalEnergyWeek = totalEnergyToday * 7; // Simplified
      const totalEnergyMonth = totalEnergyToday * 30;
      const totalEnergyYear = totalEnergyToday * 365;
      
      setPerformanceMetrics({
        energyToday: totalEnergyToday,
        energyWeek: totalEnergyWeek,
        energyMonth: totalEnergyMonth,
        energyYear: totalEnergyYear,
        co2Saved: totalEnergyToday * 0.5, // kg CO2 per kWh
        costSavings: totalEnergyToday * 0.12, // $0.12 per kWh
        avgEfficiency: data.reduce((sum, d) => sum + d.averageEfficiency, 0) / data.length,
        peakEfficiency: Math.max(...data.map(d => d.averageEfficiency)),
        uptimePercentage: (data.reduce((sum, d) => sum + d.onlineDevices, 0) / data.reduce((sum, d) => sum + d.totalDevices, 0)) * 100,
        totalAlerts: Math.floor(Math.random() * 5) // Simulated
      });
      
    } catch (error) {
      console.error('Error generating analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    generateAnalyticsData();
  }, [selectedTimeRange, targetDevices]);

  // Auto refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      generateAnalyticsData();
    }, 60000); // Refresh every minute

    return () => clearInterval(interval);
  }, [autoRefresh, selectedTimeRange]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(analyticsData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `solar-analytics-${selectedTimeRange}-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

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

  const getEfficiencyColor = (efficiency: number) => {
    if (efficiency >= 90) return theme.palette.success.main;
    if (efficiency >= 80) return theme.palette.warning.main;
    return theme.palette.error.main;
  };

  const pieData = [
    { name: 'Optimal Performance', value: 70, color: theme.palette.success.main },
    { name: 'Good Performance', value: 25, color: theme.palette.warning.main },
    { name: 'Needs Attention', value: 5, color: theme.palette.error.main }
  ];

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5">
          Advanced Analytics
        </Typography>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Time Range</InputLabel>
            <Select
              value={selectedTimeRange}
              label="Time Range"
              onChange={(e) => setSelectedTimeRange(e.target.value as any)}
            >
              <MenuItem value="day">Last 24 Hours</MenuItem>
              <MenuItem value="week">Last 7 Days</MenuItem>
              <MenuItem value="month">Last 30 Days</MenuItem>
              <MenuItem value="year">Last 12 Months</MenuItem>
            </Select>
          </FormControl>
          
          <FormControlLabel
            control={
              <Switch
                checked={compareMode}
                onChange={(e) => setCompareMode(e.target.checked)}
                size="small"
              />
            }
            label="Compare"
          />
          
          <Tooltip title="Refresh Data">
            <IconButton onClick={generateAnalyticsData} disabled={loading}>
              <Refresh />
            </IconButton>
          </Tooltip>
          
          {showExport && (
            <Tooltip title="Export Data">
              <IconButton onClick={handleExport}>
                <Download />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Connection Status Alert */}
      {!isConnected && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          Real-time connection is offline. Analytics data may not be current.
        </Alert>
      )}

      {/* Key Metrics Summary */}
      {performanceMetrics && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={6} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <WbSunny color="warning" sx={{ fontSize: 32, mb: 1 }} />
                <Typography variant="h4" color="primary">
                  {formatEnergy(performanceMetrics.energyToday)}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Energy Today
                </Typography>
                <Chip
                  size="small"
                  label={`${((performanceMetrics.energyToday / performanceMetrics.energyWeek * 7) * 100).toFixed(0)}% of avg`}
                  color="info"
                  sx={{ mt: 1 }}
                />
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={6} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Assessment color="success" sx={{ fontSize: 32, mb: 1 }} />
                <Typography variant="h4" color="success.main">
                  {performanceMetrics.avgEfficiency.toFixed(1)}%
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Avg Efficiency
                </Typography>
                <Chip
                  size="small"
                  label={`Peak: ${performanceMetrics.peakEfficiency.toFixed(1)}%`}
                  color="success"
                  sx={{ mt: 1 }}
                />
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={6} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <BatteryChargingFull color="info" sx={{ fontSize: 32, mb: 1 }} />
                <Typography variant="h4" color="info.main">
                  {performanceMetrics.uptimePercentage.toFixed(1)}%
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  System Uptime
                </Typography>
                <Chip
                  size="small"
                  label={`${performanceMetrics.totalAlerts} alerts`}
                  color={performanceMetrics.totalAlerts > 0 ? "error" : "success"}
                  sx={{ mt: 1 }}
                />
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={6} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <ElectricBolt color="warning" sx={{ fontSize: 32, mb: 1 }} />
                <Typography variant="h4" color="warning.main">
                  ${performanceMetrics.costSavings.toFixed(0)}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Cost Savings
                </Typography>
                <Chip
                  size="small"
                  label={`${performanceMetrics.co2Saved.toFixed(1)} kg CO₂`}
                  color="success"
                  sx={{ mt: 1 }}
                />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Tabs for different analytics views */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab icon={<Timeline />} label="Power Trends" />
          <Tab icon={<BarChart />} label="Production Analysis" />
          <Tab icon={<Assessment />} label="Performance" />
          <Tab icon={<CompareArrows />} label="Comparison" />
        </Tabs>
      </Box>

      <TabPanel value={tabValue} index={0}>
        {/* Power Trends */}
        <Grid container spacing={3}>
          <Grid item xs={12} lg={8}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Power Output Trends
                </Typography>
                <Box sx={{ height: 400 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={analyticsData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis yAxisId="power" orientation="left" tickFormatter={formatPower} />
                      <YAxis yAxisId="efficiency" orientation="right" domain={[0, 100]} />
                      <RechartsTooltip
                        formatter={(value: number, name: string) => {
                          if (name === 'totalPower') return [formatPower(value), 'Power'];
                          if (name === 'averageEfficiency') return [`${value.toFixed(1)}%`, 'Efficiency'];
                          if (name === 'averageTemperature') return [`${value.toFixed(1)}°C`, 'Temperature'];
                          return [value, name];
                        }}
                      />
                      <Legend />
                      <Area
                        yAxisId="power"
                        type="monotone"
                        dataKey="totalPower"
                        fill={theme.palette.primary.light}
                        stroke={theme.palette.primary.main}
                        fillOpacity={0.3}
                        name="Total Power"
                      />
                      <Line
                        yAxisId="efficiency"
                        type="monotone"
                        dataKey="averageEfficiency"
                        stroke={theme.palette.success.main}
                        strokeWidth={2}
                        dot={false}
                        name="Efficiency %"
                      />
                      <Line
                        yAxisId="efficiency"
                        type="monotone"
                        dataKey="performanceScore"
                        stroke={theme.palette.warning.main}
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={false}
                        name="Performance Score"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} lg={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Performance Distribution
                </Typography>
                <Box sx={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        dataKey="value"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        {/* Production Analysis */}
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Energy Production Analysis
                </Typography>
                <Box sx={{ height: 400 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart data={analyticsData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis tickFormatter={formatEnergy} />
                      <RechartsTooltip
                        formatter={(value: number) => [formatEnergy(value), 'Energy']}
                      />
                      <Legend />
                      <Bar
                        dataKey="totalEnergy"
                        fill={theme.palette.primary.main}
                        name="Energy Production"
                      />
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        {/* Performance */}
        <Grid container spacing={3}>
          <Grid item xs={12} lg={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Efficiency vs Temperature
                </Typography>
                <Box sx={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analyticsData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis yAxisId="efficiency" orientation="left" domain={[0, 100]} />
                      <YAxis yAxisId="temperature" orientation="right" />
                      <RechartsTooltip />
                      <Legend />
                      <Line
                        yAxisId="efficiency"
                        type="monotone"
                        dataKey="averageEfficiency"
                        stroke={theme.palette.success.main}
                        strokeWidth={2}
                        name="Efficiency %"
                      />
                      <Line
                        yAxisId="temperature"
                        type="monotone"
                        dataKey="averageTemperature"
                        stroke={theme.palette.error.main}
                        strokeWidth={2}
                        name="Temperature °C"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} lg={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Weather Impact Analysis
                </Typography>
                <Box sx={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analyticsData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis />
                      <RechartsTooltip />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="weatherScore"
                        stackId="1"
                        stroke={theme.palette.info.main}
                        fill={theme.palette.info.light}
                        name="Weather Score"
                      />
                      <Area
                        type="monotone"
                        dataKey="performanceScore"
                        stackId="2"
                        stroke={theme.palette.secondary.main}
                        fill={theme.palette.secondary.light}
                        name="Performance Score"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={3}>
        {/* Comparison */}
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Assessment sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="textSecondary">
            Comparison View
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
            Compare performance across different time periods, devices, or conditions.
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
            This feature will be available in the full implementation.
          </Typography>
        </Box>
      </TabPanel>
    </Box>
  );
};