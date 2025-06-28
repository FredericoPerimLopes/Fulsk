import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Card,
  CardContent,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Tabs,
  Tab,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  BatteryChargingFull,
  Eco,
  AttachMoney,
  Speed
} from '@mui/icons-material';
import {
  AreaChart,
  Area,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ComposedChart
} from 'recharts';
import { useDeviceStore } from '../stores/deviceStore';

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

const MetricCard: React.FC<{
  title: string;
  value: string | number;
  unit?: string;
  change?: number;
  icon: React.ReactNode;
  color?: string;
}> = ({ title, value, unit, change, icon, color = '#1976d2' }) => (
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
          {change !== undefined && (
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
              {change > 0 ? (
                <TrendingUp sx={{ color: 'success.main', mr: 0.5 }} />
              ) : (
                <TrendingDown sx={{ color: 'error.main', mr: 0.5 }} />
              )}
              <Typography
                variant="body2"
                color={change > 0 ? 'success.main' : 'error.main'}
              >
                {Math.abs(change).toFixed(1)}%
              </Typography>
            </Box>
          )}
        </Box>
        <Box
          sx={{
            color: color,
            bgcolor: `${color}20`,
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

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export const AnalyticsPage: React.FC = () => {
  const { devices, fetchDevices, fetchRealtimeMetrics } = useDeviceStore();
  const [tabValue, setTabValue] = useState(0);
  const [timeRange, setTimeRange] = useState('7d');
  const [isLoading, setIsLoading] = useState(false);
  
  // Generate sample analytics data
  const [energyData, setEnergyData] = useState<any[]>([]);
  const [efficiencyData, setEfficiencyData] = useState<any[]>([]);
  const [devicePerformance, setDevicePerformance] = useState<any[]>([]);
  const [weatherCorrelation, setWeatherCorrelation] = useState<any[]>([]);
  const [costSavings, setCostSavings] = useState<any[]>([]);

  useEffect(() => {
    fetchDevices();
    fetchRealtimeMetrics();
    generateAnalyticsData();
  }, [fetchDevices, fetchRealtimeMetrics, timeRange]);

  const generateAnalyticsData = () => {
    setIsLoading(true);
    
    // Generate energy production data
    const energyChartData = [];
    const efficiencyChartData = [];
    const weatherData = [];
    const costData = [];
    
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      // Simulate seasonal and daily patterns
      const dayOfYear = date.getDate() + date.getMonth() * 30;
      const seasonFactor = 0.8 + 0.4 * Math.sin((dayOfYear / 365) * 2 * Math.PI);
      
      const baseEnergy = 45 + Math.random() * 20;
      const energy = baseEnergy * seasonFactor;
      const efficiency = 85 + Math.random() * 10;
      const irradiance = 400 + Math.random() * 600;
      const temperature = 20 + Math.random() * 15;
      const savings = energy * 0.12; // $0.12 per kWh
      
      energyChartData.push({
        date: date.toLocaleDateString(),
        energy: Math.round(energy * 10) / 10,
        target: 50,
        cumulative: energyChartData.length > 0 ? 
          energyChartData[energyChartData.length - 1].cumulative + energy : energy
      });
      
      efficiencyChartData.push({
        date: date.toLocaleDateString(),
        efficiency: Math.round(efficiency * 10) / 10,
        temperature: Math.round(temperature * 10) / 10
      });
      
      weatherData.push({
        date: date.toLocaleDateString(),
        energy: Math.round(energy * 10) / 10,
        irradiance: Math.round(irradiance),
        temperature: Math.round(temperature * 10) / 10,
        cloudCover: Math.random() * 100
      });
      
      costData.push({
        date: date.toLocaleDateString(),
        savings: Math.round(savings * 100) / 100,
        co2Saved: Math.round(energy * 0.5 * 100) / 100
      });
    }
    
    // Generate device performance comparison
    const devicePerf = devices.map((device, index) => ({
      id: device.id,
      name: device.name,
      type: device.type,
      efficiency: 80 + Math.random() * 15,
      energyToday: 20 + Math.random() * 30,
      uptime: 95 + Math.random() * 5,
      lastMaintenance: Math.floor(Math.random() * 180),
      status: device.status,
      performance: Math.random() > 0.8 ? 'Excellent' : Math.random() > 0.5 ? 'Good' : 'Fair'
    }));
    
    setEnergyData(energyChartData);
    setEfficiencyData(efficiencyChartData);
    setDevicePerformance(devicePerf);
    setWeatherCorrelation(weatherData);
    setCostSavings(costData);
    setIsLoading(false);
  };

  const totalEnergyPeriod = energyData.reduce((sum, item) => sum + item.energy, 0);
  const avgEfficiency = efficiencyData.reduce((sum, item) => sum + item.efficiency, 0) / efficiencyData.length || 0;
  const totalSavings = costSavings.reduce((sum, item) => sum + item.savings, 0);
  const totalCO2Saved = costSavings.reduce((sum, item) => sum + item.co2Saved, 0);

  const performanceDistribution = [
    { name: 'Excellent', value: devicePerformance.filter(d => d.performance === 'Excellent').length },
    { name: 'Good', value: devicePerformance.filter(d => d.performance === 'Good').length },
    { name: 'Fair', value: devicePerformance.filter(d => d.performance === 'Fair').length }
  ];

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Analytics Dashboard
        </Typography>
        <FormControl sx={{ minWidth: 120 }}>
          <InputLabel>Time Range</InputLabel>
          <Select
            value={timeRange}
            label="Time Range"
            onChange={(e) => setTimeRange(e.target.value)}
          >
            <MenuItem value="7d">Last 7 Days</MenuItem>
            <MenuItem value="30d">Last 30 Days</MenuItem>
            <MenuItem value="90d">Last 90 Days</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Key Metrics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid xs={12} sm={6} md={3}>
          <MetricCard
            title="Total Energy"
            value={totalEnergyPeriod.toFixed(1)}
            unit="kWh"
            change={12.5}
            icon={<Energy />}
            color="#1976d2"
          />
        </Grid>
        <Grid xs={12} sm={6} md={3}>
          <MetricCard
            title="Avg Efficiency"
            value={avgEfficiency.toFixed(1)}
            unit="%"
            change={2.1}
            icon={<Speed />}
            color="#2e7d32"
          />
        </Grid>
        <Grid xs={12} sm={6} md={3}>
          <MetricCard
            title="Cost Savings"
            value={`$${totalSavings.toFixed(2)}`}
            change={8.3}
            icon={<AttachMoney />}
            color="#ed6c02"
          />
        </Grid>
        <Grid xs={12} sm={6} md={3}>
          <MetricCard
            title="CO₂ Saved"
            value={totalCO2Saved.toFixed(1)}
            unit="kg"
            change={15.7}
            icon={<Eco />}
            color="#2e7d32"
          />
        </Grid>
      </Grid>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
          <Tab label="Energy Production" />
          <Tab label="Performance Analysis" />
          <Tab label="Weather Correlation" />
          <Tab label="Financial Impact" />
        </Tabs>
      </Box>

      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={3}>
          <Grid xs={12} lg={8}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Energy Production Over Time
              </Typography>
              <Box sx={{ height: 400 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={energyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="energy" fill="#1976d2" name="Daily Energy (kWh)" />
                    <Line yAxisId="left" type="monotone" dataKey="target" stroke="#ff7300" strokeDasharray="5 5" name="Target" />
                    <Area yAxisId="right" type="monotone" dataKey="cumulative" fill="#82ca9d" fillOpacity={0.3} stroke="#82ca9d" name="Cumulative (kWh)" />
                  </ComposedChart>
                </ResponsiveContainer>
              </Box>
            </Paper>
          </Grid>
          <Grid xs={12} lg={4}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Efficiency Trends
              </Typography>
              <Box sx={{ height: 400 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={efficiencyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis domain={[70, 100]} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="efficiency" stroke="#2e7d32" strokeWidth={2} name="Efficiency %" />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <Grid container spacing={3}>
          <Grid xs={12} lg={8}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Device Performance Comparison
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Device Name</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell align="right">Efficiency (%)</TableCell>
                      <TableCell align="right">Energy Today (kWh)</TableCell>
                      <TableCell align="right">Uptime (%)</TableCell>
                      <TableCell>Performance</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {devicePerformance.map((device) => (
                      <TableRow key={device.id}>
                        <TableCell>{device.name}</TableCell>
                        <TableCell>{device.type}</TableCell>
                        <TableCell align="right">{device.efficiency.toFixed(1)}</TableCell>
                        <TableCell align="right">{device.energyToday.toFixed(1)}</TableCell>
                        <TableCell align="right">{device.uptime.toFixed(1)}</TableCell>
                        <TableCell>
                          <Chip
                            label={device.performance}
                            color={
                              device.performance === 'Excellent' ? 'success' :
                              device.performance === 'Good' ? 'primary' : 'warning'
                            }
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
          <Grid xs={12} lg={4}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Performance Distribution
              </Typography>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={performanceDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {performanceDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <Grid container spacing={3}>
          <Grid xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Weather Impact on Energy Production
              </Typography>
              <Box sx={{ height: 400 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={weatherCorrelation}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="energy" fill="#1976d2" name="Energy Production (kWh)" />
                    <Line yAxisId="right" type="monotone" dataKey="irradiance" stroke="#ff7300" name="Solar Irradiance (W/m²)" />
                    <Line yAxisId="right" type="monotone" dataKey="temperature" stroke="#82ca9d" name="Temperature (°C)" />
                  </ComposedChart>
                </ResponsiveContainer>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={3}>
        <Grid container spacing={3}>
          <Grid xs={12} lg={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Daily Cost Savings
              </Typography>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={costSavings}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, 'Savings']} />
                    <Area type="monotone" dataKey="savings" stroke="#ed6c02" fill="#ed6c02" fillOpacity={0.3} />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
            </Paper>
          </Grid>
          <Grid xs={12} lg={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                CO₂ Emissions Saved
              </Typography>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={costSavings}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value: number) => [`${value.toFixed(1)} kg`, 'CO₂ Saved']} />
                    <Area type="monotone" dataKey="co2Saved" stroke="#2e7d32" fill="#2e7d32" fillOpacity={0.3} />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
            </Paper>
          </Grid>
          <Grid xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Financial Summary
              </Typography>
              <Grid container spacing={3}>
                <Grid xs={12} sm={6} md={3}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="primary">
                      ${(totalSavings * 365 / (timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90)).toFixed(0)}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Projected Annual Savings
                    </Typography>
                  </Box>
                </Grid>
                <Grid xs={12} sm={6} md={3}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="success.main">
                      ${(totalSavings * 25).toFixed(0)}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      25-Year Lifetime Savings
                    </Typography>
                  </Box>
                </Grid>
                <Grid xs={12} sm={6} md={3}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="info.main">
                      {(totalEnergyPeriod * 0.12).toFixed(1)}¢
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Cost per kWh Saved
                    </Typography>
                  </Box>
                </Grid>
                <Grid xs={12} sm={6} md={3}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="warning.main">
                      {((totalSavings * 365 / (timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90)) / 20000 * 100).toFixed(1)}%
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      ROI (Assuming $20k Investment)
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