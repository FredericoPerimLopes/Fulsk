import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  Tabs,
  Tab,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  AlertTitle,
  Skeleton,
  useTheme,
  useMediaQuery,
  Fab,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon
} from '@mui/material';
import {
  Dashboard,
  Settings,
  BugReport,
  Timeline,
  Add,
  Refresh,
  Fullscreen,
  PhoneAndroid
} from '@mui/icons-material';
import { useDeviceStore } from '../../stores/deviceStore';
import { useRealTimeSocket } from '../../hooks/useRealTimeSocket';
import { InverterDashboard } from './InverterDashboard';
import { InverterConfiguration } from './InverterConfiguration';
import { InverterDiagnostics } from './InverterDiagnostics';
import { InverterCharts } from './InverterCharts';
import { Device, InverterConfiguration as InverterConfigType } from '../../types/api';

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
      id={`inverter-tabpanel-${index}`}
      aria-labelledby={`inverter-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

interface InverterManagerProps {
  defaultDeviceId?: string;
  compact?: boolean;
}

export const InverterManager: React.FC<InverterManagerProps> = ({
  defaultDeviceId,
  compact = false
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [currentTab, setCurrentTab] = useState(0);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(defaultDeviceId || null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { 
    devices, 
    isLoading, 
    error, 
    fetchDevices, 
    fetchRealtimeMetrics 
  } = useDeviceStore();
  
  const { isConnected, subscribeToDevice, unsubscribeFromDevice } = useRealTimeSocket();

  // Filter inverter devices
  const inverterDevices = devices.filter(device => device.type === 'INVERTER');
  const selectedDevice = selectedDeviceId ? inverterDevices.find(d => d.id === selectedDeviceId) : null;

  // Initialize with first inverter if no default provided
  useEffect(() => {
    if (!selectedDeviceId && inverterDevices.length > 0) {
      setSelectedDeviceId(inverterDevices[0].id);
    }
  }, [selectedDeviceId, inverterDevices]);

  // Subscribe to real-time updates for selected device
  useEffect(() => {
    if (selectedDeviceId && isConnected) {
      subscribeToDevice(selectedDeviceId);
      return () => unsubscribeFromDevice(selectedDeviceId);
    }
  }, [selectedDeviceId, isConnected, subscribeToDevice, unsubscribeFromDevice]);

  // Fetch initial data
  useEffect(() => {
    fetchDevices();
    fetchRealtimeMetrics();
  }, [fetchDevices, fetchRealtimeMetrics]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  const handleDeviceChange = (deviceId: string) => {
    if (selectedDeviceId && isConnected) {
      unsubscribeFromDevice(selectedDeviceId);
    }
    setSelectedDeviceId(deviceId);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        fetchDevices(),
        fetchRealtimeMetrics()
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleConfigurationSaved = (config: InverterConfigType) => {
    // Handle configuration save
    console.log('Configuration saved:', config);
    // You could show a success message or refresh device data
    handleRefresh();
  };

  const tabLabels = isMobile 
    ? ['Dashboard', 'Config', 'Diagnostics', 'Charts']
    : ['Dashboard', 'Configuration', 'Diagnostics', 'Analytics'];

  const speedDialActions = [
    {
      icon: <Refresh />,
      name: 'Refresh Data',
      action: handleRefresh
    },
    {
      icon: <Fullscreen />,
      name: 'Toggle Fullscreen',
      action: () => setIsFullscreen(!isFullscreen)
    },
    {
      icon: <Add />,
      name: 'Add Inverter',
      action: () => {
        // Navigate to add device or open modal
        console.log('Add inverter clicked');
      }
    }
  ];

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        <AlertTitle>Error Loading Inverter Data</AlertTitle>
        {error}
      </Alert>
    );
  }

  return (
    <Box sx={{ 
      width: '100%', 
      height: isFullscreen ? '100vh' : 'auto',
      overflow: isFullscreen ? 'hidden' : 'visible'
    }}>
      {/* Header */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        mb: 2,
        flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? 2 : 0
      }}>
        <Typography variant={isMobile ? "h6" : "h5"}>
          Inverter Management
        </Typography>
        
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 2,
          width: isMobile ? '100%' : 'auto'
        }}>
          {/* Connection Status */}
          <Chip
            icon={<Box sx={{ 
              width: 8, 
              height: 8, 
              borderRadius: '50%', 
              bgcolor: isConnected ? 'success.main' : 'error.main' 
            }} />}
            label={isConnected ? 'Live' : 'Offline'}
            color={isConnected ? 'success' : 'error'}
            size="small"
          />
          
          {/* Device Selection */}
          <FormControl size="small" sx={{ minWidth: isMobile ? 200 : 250 }}>
            <InputLabel>Select Inverter</InputLabel>
            <Select
              value={selectedDeviceId || ''}
              onChange={(e) => handleDeviceChange(e.target.value)}
              label="Select Inverter"
            >
              {isLoading ? (
                <MenuItem disabled>
                  <Skeleton width={200} />
                </MenuItem>
              ) : (
                <>
                  <MenuItem value="">
                    <em>All Inverters</em>
                  </MenuItem>
                  {inverterDevices.map((device) => (
                    <MenuItem key={device.id} value={device.id}>
                      {device.name} ({device.manufacturer} {device.model})
                    </MenuItem>
                  ))}
                </>
              )}
            </Select>
          </FormControl>
        </Box>
      </Box>

      {/* Main Content */}
      <Card sx={{ minHeight: isFullscreen ? 'calc(100vh - 100px)' : 'auto' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs 
            value={currentTab} 
            onChange={handleTabChange}
            variant={isMobile ? "scrollable" : "fullWidth"}
            scrollButtons={isMobile ? "auto" : false}
            allowScrollButtonsMobile
          >
            <Tab 
              icon={<Dashboard />} 
              label={tabLabels[0]}
              iconPosition={isMobile ? "top" : "start"}
            />
            <Tab 
              icon={<Settings />} 
              label={tabLabels[1]}
              iconPosition={isMobile ? "top" : "start"}
            />
            <Tab 
              icon={<BugReport />} 
              label={tabLabels[2]}
              iconPosition={isMobile ? "top" : "start"}
            />
            <Tab 
              icon={<Timeline />} 
              label={tabLabels[3]}
              iconPosition={isMobile ? "top" : "start"}
            />
          </Tabs>
        </Box>

        {/* Tab Panels */}
        <TabPanel value={currentTab} index={0}>
          <InverterDashboard
            deviceId={selectedDeviceId || undefined}
            showAll={!selectedDeviceId}
            compact={compact || isMobile}
            autoRefresh={true}
            refreshInterval={15}
          />
        </TabPanel>

        <TabPanel value={currentTab} index={1}>
          <InverterConfiguration
            deviceId={selectedDeviceId || undefined}
            onConfigurationSaved={handleConfigurationSaved}
          />
        </TabPanel>

        <TabPanel value={currentTab} index={2}>
          <InverterDiagnostics
            deviceId={selectedDeviceId || undefined}
          />
        </TabPanel>

        <TabPanel value={currentTab} index={3}>
          <InverterCharts
            deviceId={selectedDeviceId || undefined}
            showComparison={!selectedDeviceId}
          />
        </TabPanel>
      </Card>

      {/* Mobile Speed Dial for Quick Actions */}
      {isMobile && (
        <SpeedDial
          ariaLabel="Inverter actions"
          sx={{ position: 'fixed', bottom: 16, right: 16 }}
          icon={<SpeedDialIcon />}
        >
          {speedDialActions.map((action) => (
            <SpeedDialAction
              key={action.name}
              icon={action.icon}
              tooltipTitle={action.name}
              onClick={action.action}
            />
          ))}
        </SpeedDial>
      )}

      {/* Loading Overlay */}
      {(isLoading || refreshing) && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            bgcolor: 'rgba(255, 255, 255, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1
          }}
        >
          <Box sx={{ textAlign: 'center' }}>
            <Skeleton variant="rectangular" width={300} height={200} />
            <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
              {refreshing ? 'Refreshing data...' : 'Loading inverter data...'}
            </Typography>
          </Box>
        </Box>
      )}
    </Box>
  );
};