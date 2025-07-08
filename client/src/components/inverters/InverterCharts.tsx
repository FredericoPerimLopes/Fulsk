import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  ButtonGroup,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Paper,
  useTheme,
  ToggleButton,
  ToggleButtonGroup,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Slider,
  Switch,
  FormControlLabel,
  Stack
} from '@mui/material';
import {
  Timeline,
  TrendingUp,
  TrendingDown,
  ElectricBolt,
  WbSunny,
  Thermostat,
  Speed,
  Battery4Bar,
  Fullscreen,
  Download,
  Settings,
  ZoomIn,
  ZoomOut,
  CompareArrows
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceLine,
  Brush,
  ComposedChart,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { useDeviceStore } from '../../stores/deviceStore';
import { InverterPerformanceMetrics, Device } from '../../types/api';

interface InverterChartsProps {
  deviceId?: string;
  showComparison?: boolean;
}

type ChartType = 'line' | 'area' | 'bar' | 'composed';
type TimeRange = 'hour' | 'day' | 'week' | 'month' | 'year';
type MetricType = 'power' | 'energy' | 'efficiency' | 'temperature' | 'voltage' | 'current';

interface ChartData {
  timestamp: string;
  time: string;
  power: number;
  energy: number;
  efficiency: number;
  temperature: number;
  voltage: number;
  current: number;
  irradiance?: number;
}

export const InverterCharts: React.FC<InverterChartsProps> = ({
  deviceId,
  showComparison = false
}) => {
  const theme = useTheme();
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>('day');
  const [selectedMetrics, setSelectedMetrics] = useState<MetricType[]>(['power', 'efficiency']);
  const [chartType, setChartType] = useState<ChartType>('area');
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [smoothData, setSmoothData] = useState(true);
  const [showPrediction, setShowPrediction] = useState(false);

  const { devices, deviceData } = useDeviceStore();

  const inverterDevices = devices.filter(device => device.type === 'INVERTER');

  // Initialize selected devices
  useEffect(() => {
    if (deviceId) {
      setSelectedDevices([deviceId]);
    } else if (inverterDevices.length > 0) {
      setSelectedDevices([inverterDevices[0].id]);
    }
  }, [deviceId, inverterDevices]);

  // Generate mock historical data
  const generateHistoricalData = (timeRange: TimeRange): ChartData[] => {
    const now = new Date();
    const dataPoints: ChartData[] = [];
    
    let intervals: number;
    let intervalMs: number;
    
    switch (timeRange) {
      case 'hour':
        intervals = 60; // 1 minute intervals
        intervalMs = 60 * 1000;
        break;
      case 'day':
        intervals = 96; // 15 minute intervals
        intervalMs = 15 * 60 * 1000;
        break;
      case 'week':
        intervals = 168; // 1 hour intervals
        intervalMs = 60 * 60 * 1000;
        break;
      case 'month':
        intervals = 120; // 6 hour intervals
        intervalMs = 6 * 60 * 60 * 1000;
        break;
      case 'year':
        intervals = 365; // 1 day intervals
        intervalMs = 24 * 60 * 60 * 1000;
        break;
    }
    
    for (let i = intervals; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - i * intervalMs);
      const hour = timestamp.getHours();
      
      // Simulate solar production curve
      const solarFactor = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI));
      const randomFactor = 0.8 + Math.random() * 0.4;
      const weatherFactor = 0.7 + Math.random() * 0.3;
      
      const basePower = 5000 * solarFactor * randomFactor * weatherFactor;
      const baseEfficiency = 88 + Math.random() * 8;
      const baseTemperature = 25 + solarFactor * 20 + Math.random() * 10;
      const baseVoltage = 240 + Math.random() * 20 - 10;
      const baseCurrent = basePower / baseVoltage;
      const baseEnergy = basePower * (intervalMs / (1000 * 60 * 60)); // Wh
      
      dataPoints.push({
        timestamp: timestamp.toISOString(),
        time: timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        power: Math.max(0, basePower),
        energy: Math.max(0, baseEnergy),
        efficiency: Math.max(0, Math.min(100, baseEfficiency)),
        temperature: Math.max(0, baseTemperature),
        voltage: Math.max(0, baseVoltage),
        current: Math.max(0, baseCurrent),
        irradiance: solarFactor * 1000 * weatherFactor
      });
    }
    
    return dataPoints;
  };

  // Update chart data when time range changes
  useEffect(() => {
    const data = generateHistoricalData(selectedTimeRange);
    setChartData(data);
  }, [selectedTimeRange]);

  const formatValue = (value: number, metric: MetricType): string => {
    switch (metric) {
      case 'power':
        return value >= 1000 ? `${(value / 1000).toFixed(1)}kW` : `${value.toFixed(0)}W`;
      case 'energy':
        return value >= 1000 ? `${(value / 1000).toFixed(1)}kWh` : `${value.toFixed(1)}Wh`;
      case 'efficiency':
        return `${value.toFixed(1)}%`;
      case 'temperature':
        return `${value.toFixed(1)}°C`;
      case 'voltage':
        return `${value.toFixed(1)}V`;
      case 'current':
        return `${value.toFixed(1)}A`;
      default:
        return value.toFixed(1);
    }
  };

  const getMetricColor = (metric: MetricType): string => {
    const colors = {
      power: theme.palette.primary.main,
      energy: theme.palette.success.main,
      efficiency: theme.palette.info.main,
      temperature: theme.palette.warning.main,
      voltage: theme.palette.secondary.main,
      current: theme.palette.error.main
    };
    return colors[metric];
  };

  const getMetricIcon = (metric: MetricType) => {
    const icons = {
      power: <ElectricBolt />,
      energy: <WbSunny />,
      efficiency: <Speed />,
      temperature: <Thermostat />,
      voltage: <Battery4Bar />,
      current: <Timeline />
    };
    return icons[metric];
  };

  const calculateStats = (data: ChartData[], metric: MetricType) => {
    const values = data.map(d => d[metric]);
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    const max = Math.max(...values);
    const min = Math.min(...values);
    
    return { avg, max, min, total: sum };
  };

  const renderChart = () => {
    const ChartComponent = chartType === 'line' ? LineChart : 
                          chartType === 'area' ? AreaChart :
                          chartType === 'bar' ? BarChart : ComposedChart;

    return (
      <Box sx={{ height: isFullscreen ? '80vh' : 400 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ChartComponent data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="time" 
              tick={{ fontSize: 10 }}
              interval="preserveStartEnd"
            />
            <YAxis 
              tick={{ fontSize: 10 }}
              tickFormatter={(value) => formatValue(value, selectedMetrics[0])}
            />
            <RechartsTooltip
              formatter={(value: number, name: string) => {
                const metric = name as MetricType;
                return [formatValue(value, metric), metric.charAt(0).toUpperCase() + metric.slice(1)];
              }}
              labelFormatter={(label) => `Time: ${label}`}
            />
            
            {selectedMetrics.map((metric, index) => {
              if (chartType === 'line') {
                return (
                  <Line
                    key={metric}
                    type={smoothData ? "monotone" : "linear"}
                    dataKey={metric}
                    stroke={getMetricColor(metric)}
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                  />
                );
              } else if (chartType === 'area') {
                return (
                  <Area
                    key={metric}
                    type={smoothData ? "monotone" : "linear"}
                    dataKey={metric}
                    stackId={index}
                    stroke={getMetricColor(metric)}
                    fill={getMetricColor(metric)}
                    fillOpacity={0.3}
                    strokeWidth={2}
                  />
                );
              } else if (chartType === 'bar') {
                return (
                  <Bar
                    key={metric}
                    dataKey={metric}
                    fill={getMetricColor(metric)}
                    opacity={0.8}
                  />
                );
              }
              return null;
            })}
            
            {selectedTimeRange === 'day' && (
              <Brush dataKey="time" height={30} />
            )}
          </ChartComponent>
        </ResponsiveContainer>
      </Box>
    );
  };

  const renderPieChart = () => {
    const totalEnergy = chartData.reduce((sum, d) => sum + d.energy, 0);
    const energyByHour = [];
    
    for (let hour = 6; hour <= 18; hour++) {
      const hourData = chartData.filter(d => new Date(d.timestamp).getHours() === hour);
      const hourEnergy = hourData.reduce((sum, d) => sum + d.energy, 0);
      if (hourEnergy > 0) {
        energyByHour.push({
          name: `${hour}:00`,
          value: hourEnergy,
          percentage: (hourEnergy / totalEnergy) * 100
        });
      }
    }

    const COLORS = [
      theme.palette.primary.main,
      theme.palette.secondary.main,
      theme.palette.success.main,
      theme.palette.warning.main,
      theme.palette.info.main,
      theme.palette.error.main
    ];

    return (
      <Box sx={{ height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={energyByHour.slice(0, 6)}
              cx="50%"
              cy="50%"
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
              label={({ name, percentage }) => `${name}: ${percentage.toFixed(1)}%`}
            >
              {energyByHour.slice(0, 6).map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <RechartsTooltip
              formatter={(value: number) => [formatValue(value, 'energy'), 'Energy']}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </Box>
    );
  };

  const renderStatCards = () => {
    return (
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
        {selectedMetrics.map((metric) => {
          const stats = calculateStats(chartData, metric);
          const icon = getMetricIcon(metric);
          
          return (
            <Box key={metric} sx={{ flex: 1 }}>
              <Paper sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  {icon}
                  <Typography variant="subtitle2" sx={{ ml: 1, textTransform: 'capitalize' }}>
                    {metric}
                  </Typography>
                </Box>
                <Typography variant="h6" color="primary">
                  {formatValue(stats.avg, metric)}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  Avg | Max: {formatValue(stats.max, metric)}
                </Typography>
              </Paper>
            </Box>
          );
        })}
      </Stack>
    );
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5">
          Performance Analytics
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <ButtonGroup size="small">
            <Button
              variant={selectedTimeRange === 'hour' ? 'contained' : 'outlined'}
              onClick={() => setSelectedTimeRange('hour')}
            >
              1H
            </Button>
            <Button
              variant={selectedTimeRange === 'day' ? 'contained' : 'outlined'}
              onClick={() => setSelectedTimeRange('day')}
            >
              24H
            </Button>
            <Button
              variant={selectedTimeRange === 'week' ? 'contained' : 'outlined'}
              onClick={() => setSelectedTimeRange('week')}
            >
              7D
            </Button>
            <Button
              variant={selectedTimeRange === 'month' ? 'contained' : 'outlined'}
              onClick={() => setSelectedTimeRange('month')}
            >
              30D
            </Button>
            <Button
              variant={selectedTimeRange === 'year' ? 'contained' : 'outlined'}
              onClick={() => setSelectedTimeRange('year')}
            >
              1Y
            </Button>
          </ButtonGroup>
          
          <ToggleButtonGroup
            size="small"
            value={chartType}
            exclusive
            onChange={(_, newType) => newType && setChartType(newType)}
          >
            <ToggleButton value="line">
              <Timeline />
            </ToggleButton>
            <ToggleButton value="area">
              <WbSunny />
            </ToggleButton>
            <ToggleButton value="bar">
              <ElectricBolt />
            </ToggleButton>
          </ToggleButtonGroup>
          
          <Tooltip title="Settings">
            <IconButton onClick={() => setShowSettings(true)}>
              <Settings />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Fullscreen">
            <IconButton onClick={() => setIsFullscreen(!isFullscreen)}>
              <Fullscreen />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Metric Selection */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          Select Metrics to Display
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {(['power', 'energy', 'efficiency', 'temperature', 'voltage', 'current'] as MetricType[]).map((metric) => (
            <Chip
              key={metric}
              label={metric.charAt(0).toUpperCase() + metric.slice(1)}
              icon={getMetricIcon(metric)}
              variant={selectedMetrics.includes(metric) ? 'filled' : 'outlined'}
              onClick={() => {
                setSelectedMetrics(prev => 
                  prev.includes(metric) 
                    ? prev.filter(m => m !== metric)
                    : [...prev, metric]
                );
              }}
              sx={{ 
                bgcolor: selectedMetrics.includes(metric) ? getMetricColor(metric) : 'transparent',
                color: selectedMetrics.includes(metric) ? 'white' : 'inherit'
              }}
            />
          ))}
        </Box>
      </Paper>

      {/* Statistics Cards */}
      {renderStatCards()}

      <Stack spacing={3}>
        {/* Main Chart */}
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3}>
          <Box sx={{ flex: showComparison ? { lg: 2 } : 1 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  {selectedMetrics.map(m => m.charAt(0).toUpperCase() + m.slice(1)).join(' & ')} Trends
                </Typography>
                <Button
                  size="small"
                  startIcon={<Download />}
                  onClick={() => {
                    // Export chart data
                    const csvContent = "data:text/csv;charset=utf-8," 
                      + "Timestamp," + selectedMetrics.join(",") + "\n"
                      + chartData.map(row => 
                          row.timestamp + "," + selectedMetrics.map(m => row[m]).join(",")
                        ).join("\n");
                    
                    const encodedUri = encodeURI(csvContent);
                    const link = document.createElement("a");
                    link.setAttribute("href", encodedUri);
                    link.setAttribute("download", `inverter-data-${selectedTimeRange}.csv`);
                    link.click();
                  }}
                >
                  Export
                </Button>
              </Box>
              {renderChart()}
            </CardContent>
          </Card>
          </Box>

          {/* Energy Distribution */}
          {showComparison && (
            <Box sx={{ flex: { lg: 1 } }}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Energy Distribution
                </Typography>
                {renderPieChart()}
              </CardContent>
            </Card>
            </Box>
          )}
        </Stack>

        {/* Device Comparison */}
        {showComparison && (
          <Box>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Device Comparison
                </Typography>
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Select Devices to Compare</InputLabel>
                  <Select
                    multiple
                    value={selectedDevices}
                    onChange={(e) => setSelectedDevices(e.target.value as string[])}
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map((value) => {
                          const device = devices.find(d => d.id === value);
                          return (
                            <Chip key={value} label={device?.name || value} size="small" />
                          );
                        })}
                      </Box>
                    )}
                  >
                    {inverterDevices.map((device) => (
                      <MenuItem key={device.id} value={device.id}>
                        {device.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                
                {/* Comparison chart would go here */}
                <Typography color="textSecondary" sx={{ textAlign: 'center', py: 4 }}>
                  Select multiple devices to view comparison charts
                </Typography>
              </CardContent>
            </Card>
          </Box>
        )}
      </Stack>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onClose={() => setShowSettings(false)}>
        <DialogTitle>Chart Settings</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={smoothData}
                  onChange={(e) => setSmoothData(e.target.checked)}
                />
              }
              label="Smooth data curves"
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={showPrediction}
                  onChange={(e) => setShowPrediction(e.target.checked)}
                />
              }
              label="Show prediction trends"
            />
            
            <Typography gutterBottom sx={{ mt: 2 }}>
              Data refresh interval (seconds)
            </Typography>
            <Slider
              defaultValue={30}
              min={5}
              max={300}
              step={5}
              marks
              valueLabelDisplay="auto"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSettings(false)}>Cancel</Button>
          <Button onClick={() => setShowSettings(false)} variant="contained">
            Apply
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};