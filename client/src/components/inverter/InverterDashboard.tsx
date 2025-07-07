import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Activity, Zap, Thermometer, Gauge, AlertTriangle, CheckCircle, WifiOff } from 'lucide-react';
import { useRealTimeSocket } from '@/hooks/useRealTimeSocket';

interface InverterData {
  deviceId: string;
  timestamp: Date;
  power: number;
  voltage: number;
  current: number;
  temperature: number;
  energyToday: number;
  energyTotal: number;
  acFrequency: number;
  powerFactor: number;
  dcVoltage: number;
  dcCurrent: number;
  efficiency: number;
  operatingState: string;
  status: 'ONLINE' | 'OFFLINE' | 'ERROR' | 'MAINTENANCE';
}

interface InverterDashboardProps {
  deviceId: string;
}

export const InverterDashboard: React.FC<InverterDashboardProps> = ({ deviceId }) => {
  const [inverterData, setInverterData] = useState<InverterData | null>(null);
  const [historicalData, setHistoricalData] = useState<InverterData[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'error'>('disconnected');
  
  const { isConnected } = useRealTimeSocket();

  useEffect(() => {
    // Subscribe to real-time inverter data
    if (isConnected) {
      // Join device-specific room
      const socket = (window as any).socket;
      socket.emit('join-device-room', deviceId);
      
      // Listen for inverter data updates
      socket.on('device-data', (data: any) => {
        if (data.deviceId === deviceId) {
          const newData: InverterData = {
            ...data,
            timestamp: new Date(data.timestamp)
          };
          
          setInverterData(newData);
          setConnectionStatus('connected');
          
          // Update historical data (keep last 50 points)
          setHistoricalData(prev => {
            const updated = [...prev, newData].slice(-50);
            return updated;
          });
        }
      });

      // Listen for connection status
      socket.on('inverter-connection-status', (data: any) => {
        if (data.deviceId === deviceId) {
          setConnectionStatus(data.status);
        }
      });

      return () => {
        socket.off('device-data');
        socket.off('inverter-connection-status');
        socket.emit('leave-device-room', deviceId);
      };
    }
  }, [deviceId, isConnected]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ONLINE': return 'bg-green-500';
      case 'ERROR': return 'bg-red-500';
      case 'MAINTENANCE': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getOperatingStateColor = (state: string) => {
    switch (state) {
      case 'MPPT': return 'text-green-600';
      case 'FAULT': return 'text-red-600';
      case 'THROTTLED': return 'text-yellow-600';
      case 'STARTING': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  const formatPower = (power: number) => {
    if (power >= 1000) {
      return `${(power / 1000).toFixed(1)} kW`;
    }
    return `${power.toFixed(0)} W`;
  };

  const formatEnergy = (energy: number) => {
    return `${energy.toFixed(1)} kWh`;
  };

  if (!inverterData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <WifiOff className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Waiting for inverter data...</p>
          <p className="text-sm text-gray-400">Device ID: {deviceId}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with connection status */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Solar Inverter Dashboard</h2>
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500' : connectionStatus === 'error' ? 'bg-red-500' : 'bg-yellow-500'}`} />
          <span className="text-sm text-gray-600">
            {connectionStatus === 'connected' ? 'Connected' : connectionStatus === 'error' ? 'Connection Error' : 'Connecting...'}
          </span>
        </div>
      </div>

      {/* Key Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Zap className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-gray-600">Current Power</p>
                <p className="text-2xl font-bold">{formatPower(inverterData.power)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Activity className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-gray-600">Today's Energy</p>
                <p className="text-2xl font-bold">{formatEnergy(inverterData.energyToday)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Thermometer className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-sm text-gray-600">Temperature</p>
                <p className="text-2xl font-bold">{inverterData.temperature.toFixed(1)}°C</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Gauge className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-sm text-gray-600">Efficiency</p>
                <p className="text-2xl font-bold">{inverterData.efficiency?.toFixed(1) || 'N/A'}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status and Operating State */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${getStatusColor(inverterData.status)}`} />
              <span>Device Status</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Status:</span>
                <Badge variant={inverterData.status === 'ONLINE' ? 'success' : inverterData.status === 'ERROR' ? 'destructive' : 'secondary'}>
                  {inverterData.status}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Operating State:</span>
                <span className={`font-medium ${getOperatingStateColor(inverterData.operatingState)}`}>
                  {inverterData.operatingState}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Last Update:</span>
                <span className="text-sm text-gray-600">
                  {inverterData.timestamp.toLocaleTimeString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AC Output</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span>Voltage:</span>
                <span className="font-medium">{inverterData.voltage.toFixed(1)} V</span>
              </div>
              <div className="flex justify-between">
                <span>Current:</span>
                <span className="font-medium">{inverterData.current.toFixed(1)} A</span>
              </div>
              <div className="flex justify-between">
                <span>Frequency:</span>
                <span className="font-medium">{inverterData.acFrequency?.toFixed(1) || 'N/A'} Hz</span>
              </div>
              <div className="flex justify-between">
                <span>Power Factor:</span>
                <span className="font-medium">{inverterData.powerFactor?.toFixed(3) || 'N/A'}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="power" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="power">Power Output</TabsTrigger>
          <TabsTrigger value="voltage">Voltage & Current</TabsTrigger>
          <TabsTrigger value="temperature">Temperature</TabsTrigger>
        </TabsList>

        <TabsContent value="power" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Power Output (Last Hour)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={historicalData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="timestamp" 
                    tickFormatter={(time) => new Date(time).toLocaleTimeString()}
                  />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(time) => new Date(time).toLocaleString()}
                    formatter={(value) => [formatPower(value as number), 'Power']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="power" 
                    stroke="#3b82f6" 
                    fill="#3b82f6" 
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="voltage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AC Voltage & Current</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={historicalData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="timestamp" 
                    tickFormatter={(time) => new Date(time).toLocaleTimeString()}
                  />
                  <YAxis yAxisId="voltage" orientation="left" />
                  <YAxis yAxisId="current" orientation="right" />
                  <Tooltip 
                    labelFormatter={(time) => new Date(time).toLocaleString()}
                  />
                  <Line 
                    yAxisId="voltage"
                    type="monotone" 
                    dataKey="voltage" 
                    stroke="#10b981" 
                    name="Voltage (V)"
                  />
                  <Line 
                    yAxisId="current"
                    type="monotone" 
                    dataKey="current" 
                    stroke="#f59e0b" 
                    name="Current (A)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="temperature" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Inverter Temperature</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={historicalData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="timestamp" 
                    tickFormatter={(time) => new Date(time).toLocaleTimeString()}
                  />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(time) => new Date(time).toLocaleString()}
                    formatter={(value) => [`${value}°C`, 'Temperature']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="temperature" 
                    stroke="#ef4444" 
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* DC Input Data */}
      <Card>
        <CardHeader>
          <CardTitle>DC Input</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-sm text-gray-600">DC Voltage</p>
              <p className="text-2xl font-bold">{inverterData.dcVoltage?.toFixed(1) || 'N/A'} V</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">DC Current</p>
              <p className="text-2xl font-bold">{inverterData.dcCurrent?.toFixed(1) || 'N/A'} A</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">DC Power</p>
              <p className="text-2xl font-bold">
                {inverterData.dcVoltage && inverterData.dcCurrent 
                  ? formatPower(inverterData.dcVoltage * inverterData.dcCurrent)
                  : 'N/A'
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Energy Production */}
      <Card>
        <CardHeader>
          <CardTitle>Energy Production</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Today's Production:</span>
                <span className="font-bold text-green-600">{formatEnergy(inverterData.energyToday)}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Production:</span>
                <span className="font-bold">{formatEnergy(inverterData.energyTotal)}</span>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-gray-600">Daily Production Progress</p>
              <Progress 
                value={Math.min((inverterData.energyToday / 30) * 100, 100)} 
                className="w-full"
              />
              <p className="text-xs text-gray-500">Target: 30 kWh/day</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};