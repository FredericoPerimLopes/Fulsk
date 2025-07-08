import React from 'react';
import {
  Box,
  Chip,
  Tooltip,
  IconButton,
  Typography,
  Popover,
  Card,
  CardContent,
  LinearProgress,
  Stack
} from '@mui/material';
import Grid from '@mui/system/Grid';
import {
  Wifi,
  WifiOff,
  Sync,
  Error,
  SignalWifi4Bar,
  SignalWifi2Bar,
  SignalWifi0Bar,
  Refresh
} from '@mui/icons-material';
import { useRealTimeSocket } from '../../hooks/useRealTimeSocket';
import { useDeviceStore } from '../../stores/deviceStore';

interface ConnectionStatusProps {
  showDetails?: boolean;
  variant?: 'chip' | 'indicator' | 'detailed';
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ 
  showDetails = false, 
  variant = 'chip' 
}) => {
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);
  const { 
    isConnected, 
    isConnecting, 
    connectionStats, 
    forceReconnect 
  } = useRealTimeSocket();
  const { connectionStatus, isOnline, lastSync } = useDeviceStore();

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    if (variant === 'detailed' || showDetails) {
      setAnchorEl(event.currentTarget);
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const getStatusColor = () => {
    if (!isOnline) return 'error';
    if (isConnected) return 'success';
    if (isConnecting) return 'warning';
    return 'error';
  };

  const getStatusIcon = () => {
    if (!isOnline) return <WifiOff />;
    if (isConnected) {
      // Show signal strength based on latency
      if (connectionStats.averageLatency < 100) return <SignalWifi4Bar />;
      if (connectionStats.averageLatency < 300) return <SignalWifi2Bar />;
      return <SignalWifi0Bar />;
    }
    if (isConnecting) return <Sync className="spinning" />;
    return <Error />;
  };

  const getStatusText = () => {
    if (!isOnline) return 'Offline';
    if (isConnected) return 'Connected';
    if (isConnecting) return 'Connecting...';
    if (connectionStatus === 'failed') return 'Connection Failed';
    return 'Disconnected';
  };

  const formatLatency = (ms: number) => {
    if (ms < 100) return `${Math.round(ms)}ms (Excellent)`;
    if (ms < 300) return `${Math.round(ms)}ms (Good)`;
    if (ms < 500) return `${Math.round(ms)}ms (Fair)`;
    return `${Math.round(ms)}ms (Poor)`;
  };

  const formatUptime = () => {
    if (!connectionStats.lastConnected) return 'N/A';
    const uptime = Date.now() - connectionStats.lastConnected.getTime();
    const minutes = Math.floor(uptime / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  };

  if (variant === 'indicator') {
    return (
      <Tooltip title={`Real-time connection: ${getStatusText()}`}>
        <Box
          sx={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            bgcolor: `${getStatusColor()}.main`,
            animation: isConnecting ? 'pulse 1.5s infinite' : 'none'
          }}
        />
      </Tooltip>
    );
  }

  if (variant === 'chip') {
    return (
      <>
        <Chip
          icon={getStatusIcon()}
          label={getStatusText()}
          color={getStatusColor()}
          size="small"
          onClick={showDetails ? handleClick : undefined}
          sx={{ 
            cursor: showDetails ? 'pointer' : 'default',
            '& .spinning': {
              animation: 'spin 1s linear infinite'
            }
          }}
        />
        
        {showDetails && (
          <Popover
            open={Boolean(anchorEl)}
            anchorEl={anchorEl}
            onClose={handleClose}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'left',
            }}
          >
            <Card sx={{ minWidth: 300, maxWidth: 400 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Connection Details
                </Typography>
                
                <Stack direction="row" spacing={2}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" color="textSecondary">
                      Status
                    </Typography>
                    <Typography variant="body1">
                      {getStatusText()}
                    </Typography>
                  </Box>
                  
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" color="textSecondary">
                      Network
                    </Typography>
                    <Typography variant="body1">
                      {isOnline ? 'Online' : 'Offline'}
                    </Typography>
                  </Box>
                  
                  {isConnected && (
                    <>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" color="textSecondary">
                          Latency
                        </Typography>
                        <Typography variant="body1">
                          {formatLatency(connectionStats.averageLatency)}
                        </Typography>
                      </Box>
                      
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" color="textSecondary">
                          Uptime
                        </Typography>
                        <Typography variant="body1">
                          {formatUptime()}
                        </Typography>
                      </Box>
                    </>
                  )}
                  
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" color="textSecondary">
                      Data Received
                    </Typography>
                    <Typography variant="body1">
                      {connectionStats.totalDataReceived.toLocaleString()}
                    </Typography>
                  </Box>
                  
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" color="textSecondary">
                      Reconnect Attempts
                    </Typography>
                    <Typography variant="body1">
                      {connectionStats.reconnectAttempts}
                    </Typography>
                  </Box>
                  
                  {lastSync && (
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" color="textSecondary">
                        Last Sync
                      </Typography>
                      <Typography variant="body1">
                        {lastSync.toLocaleString()}
                      </Typography>
                    </Box>
                  )}
                </Stack>
                
                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                  <IconButton
                    onClick={forceReconnect}
                    disabled={isConnecting}
                    size="small"
                  >
                    <Refresh />
                  </IconButton>
                </Box>
              </CardContent>
            </Card>
          </Popover>
        )}
      </>
    );
  }

  // Detailed variant
  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          {getStatusIcon()}
          <Typography variant="h6" sx={{ ml: 1 }}>
            Real-time Connection
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <IconButton
            onClick={forceReconnect}
            disabled={isConnecting}
            size="small"
          >
            <Refresh />
          </IconButton>
        </Box>
        
        {isConnecting && (
          <Box sx={{ mb: 2 }}>
            <LinearProgress />
            <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
              Establishing connection...
            </Typography>
          </Box>
        )}
        
        <Stack direction="row" spacing={2}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" color="textSecondary">
              Connection Status
            </Typography>
            <Chip
              icon={getStatusIcon()}
              label={getStatusText()}
              color={getStatusColor()}
              size="small"
            />
          </Box>
          
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" color="textSecondary">
              Network Status
            </Typography>
            <Chip
              icon={isOnline ? <Wifi /> : <WifiOff />}
              label={isOnline ? 'Online' : 'Offline'}
              color={isOnline ? 'success' : 'error'}
              size="small"
            />
          </Box>
          
          {isConnected && (
            <>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" color="textSecondary">
                  Connection Quality
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                  {getStatusIcon()}
                  <Box sx={{ ml: 1, flexGrow: 1 }}>
                    <Typography variant="body2">
                      {formatLatency(connectionStats.averageLatency)}
                    </Typography>
                  </Box>
                </Box>
              </Box>
              
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" color="textSecondary">
                  Connected Since
                </Typography>
                <Typography variant="body2">
                  {connectionStats.lastConnected?.toLocaleTimeString() || 'N/A'}
                </Typography>
              </Box>
              
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" color="textSecondary">
                  Uptime
                </Typography>
                <Typography variant="body2">
                  {formatUptime()}
                </Typography>
              </Box>
            </>
          )}
          
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" color="textSecondary">
              Data Points
            </Typography>
            <Typography variant="body2">
              {connectionStats.totalDataReceived.toLocaleString()}
            </Typography>
          </Box>
          
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" color="textSecondary">
              Failed Attempts
            </Typography>
            <Typography variant="body2">
              {connectionStats.reconnectAttempts}
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
};

// Add CSS for animations
const styles = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = styles;
  document.head.appendChild(styleElement);
}