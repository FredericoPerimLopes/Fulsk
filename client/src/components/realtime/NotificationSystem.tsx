import React, { useEffect, useState } from 'react';
import {
  Box,
  Badge,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Typography,
  Chip,
  Button,
  Divider,
  Switch,
  FormControlLabel,
  Alert,
  Snackbar,
  Card,
  CardContent,
  Fab,
  Tooltip,
  Avatar,
  Stack
} from '@mui/material';
import Grid from '@mui/system/Grid';
import {
  Notifications,
  NotificationsOff,
  Warning,
  Error,
  Info,
  CheckCircle,
  Close,
  VolumeUp,
  VolumeOff,
  Settings,
  Clear,
  MarkEmailRead
} from '@mui/icons-material';
import { useAlertStore } from '../../stores/alertStore';
import { Alert as AlertType } from '../../types/api';

interface NotificationSystemProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  maxVisible?: number;
  autoHideDuration?: number;
}

export const NotificationSystem: React.FC<NotificationSystemProps> = ({
  position = 'top-right',
  maxVisible = 3,
  autoHideDuration = 5000
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [currentSnackbar, setCurrentSnackbar] = useState<AlertType | null>(null);
  
  const {
    alerts,
    notifications,
    unreadCount,
    isNotificationsEnabled,
    soundEnabled,
    acknowledgeAlert,
    acknowledgeAllAlerts,
    removeAlert,
    toggleNotifications,
    toggleSound,
    markAsRead,
    markAllAsRead
  } = useAlertStore();

  // Show snackbar for new critical alerts
  useEffect(() => {
    const criticalAlerts = notifications.filter(n => n.severity === 'CRITICAL' && n.isNew);
    if (criticalAlerts.length > 0 && !snackbarOpen) {
      setCurrentSnackbar(criticalAlerts[0]);
      setSnackbarOpen(true);
    }
  }, [notifications, snackbarOpen]);

  const handleCloseSnackbar = () => {
    setSnackbarOpen(false);
    if (currentSnackbar) {
      markAsRead(currentSnackbar.id);
    }
    setCurrentSnackbar(null);
  };

  const handleAcknowledgeSnackbar = () => {
    if (currentSnackbar) {
      acknowledgeAlert(currentSnackbar.id);
    }
    handleCloseSnackbar();
  };

  const getSeverityIcon = (severity: AlertType['severity']) => {
    switch (severity) {
      case 'CRITICAL':
        return <Error color="error" />;
      case 'WARNING':
        return <Warning color="warning" />;
      case 'INFO':
        return <Info color="info" />;
      default:
        return <Info />;
    }
  };

  const getSeverityColor = (severity: AlertType['severity']) => {
    switch (severity) {
      case 'CRITICAL':
        return 'error';
      case 'WARNING':
        return 'warning';
      case 'INFO':
        return 'info';
      default:
        return 'default';
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date().getTime();
    const alertTime = new Date(timestamp).getTime();
    const diffMs = now - alertTime;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const getPositionStyles = () => {
    const baseStyles = {
      position: 'fixed' as const,
      zIndex: 1300,
      maxWidth: 400,
      minWidth: 300
    };

    switch (position) {
      case 'top-right':
        return { ...baseStyles, top: 20, right: 20 };
      case 'top-left':
        return { ...baseStyles, top: 20, left: 20 };
      case 'bottom-right':
        return { ...baseStyles, bottom: 20, right: 20 };
      case 'bottom-left':
        return { ...baseStyles, bottom: 20, left: 20 };
      default:
        return { ...baseStyles, top: 20, right: 20 };
    }
  };

  return (
    <>
      {/* Notification Bell */}
      <Tooltip title="Notifications">
        <IconButton
          color="inherit"
          onClick={() => setDrawerOpen(true)}
          sx={{ position: 'relative' }}
        >
          <Badge badgeContent={unreadCount} color="error" max={99}>
            {isNotificationsEnabled ? <Notifications /> : <NotificationsOff />}
          </Badge>
        </IconButton>
      </Tooltip>

      {/* Floating notifications */}
      <Box sx={getPositionStyles()}>
        {notifications.slice(0, maxVisible).map((notification, index) => (
          <Card
            key={notification.id}
            sx={{
              mb: 1,
              opacity: notification.isNew ? 1 : 0.8,
              transform: `translateY(${index * 10}px)`,
              transition: 'all 0.3s ease-in-out',
              border: notification.severity === 'CRITICAL' ? '2px solid' : '1px solid',
              borderColor: notification.severity === 'CRITICAL' ? 'error.main' : 'divider'
            }}
          >
            <CardContent sx={{ py: 1.5, px: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                <Avatar
                  sx={{
                    width: 32,
                    height: 32,
                    bgcolor: `${getSeverityColor(notification.severity)}.main`,
                    mr: 1.5
                  }}
                >
                  {getSeverityIcon(notification.severity)}
                </Avatar>
                
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {notification.deviceName}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="textSecondary"
                    sx={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical'
                    }}
                  >
                    {notification.message}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {formatTimeAgo(notification.timestamp)}
                  </Typography>
                </Box>
                
                <IconButton
                  size="small"
                  onClick={() => acknowledgeAlert(notification.id)}
                  sx={{ ml: 1 }}
                >
                  <Close />
                </IconButton>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* Critical Alert Snackbar */}
      <Snackbar
        open={snackbarOpen}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        sx={{ zIndex: 1400 }}
      >
        <Alert
          severity="error"
          action={
            <Box>
              <Button
                color="inherit"
                size="small"
                onClick={handleAcknowledgeSnackbar}
                sx={{ mr: 1 }}
              >
                ACKNOWLEDGE
              </Button>
              <IconButton
                size="small"
                aria-label="close"
                color="inherit"
                onClick={handleCloseSnackbar}
              >
                <Close fontSize="small" />
              </IconButton>
            </Box>
          }
        >
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Critical Alert: {currentSnackbar?.deviceName}
            </Typography>
            <Typography variant="body2">
              {currentSnackbar?.message}
            </Typography>
          </Box>
        </Alert>
      </Snackbar>

      {/* Notification Drawer */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
          sx: { width: 400, maxWidth: '90vw' }
        }}
      >
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">
              Notifications ({alerts.length})
            </Typography>
            <Box>
              <IconButton size="small" onClick={toggleSound}>
                {soundEnabled ? <VolumeUp /> : <VolumeOff />}
              </IconButton>
              <IconButton size="small" onClick={() => setDrawerOpen(false)}>
                <Close />
              </IconButton>
            </Box>
          </Box>
          
          <Box sx={{ mt: 1 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={isNotificationsEnabled}
                  onChange={toggleNotifications}
                  size="small"
                />
              }
              label="Enable notifications"
            />
          </Box>
          
          {alerts.length > 0 && (
            <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
              <Button
                size="small"
                startIcon={<MarkEmailRead />}
                onClick={markAllAsRead}
                disabled={unreadCount === 0}
              >
                Mark all read
              </Button>
              <Button
                size="small"
                startIcon={<Clear />}
                onClick={acknowledgeAllAlerts}
                color="warning"
              >
                Clear all
              </Button>
            </Box>
          )}
        </Box>

        <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
          {alerts.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <CheckCircle sx={{ fontSize: 48, color: 'success.main', mb: 2 }} />
              <Typography variant="h6" color="textSecondary">
                All clear!
              </Typography>
              <Typography variant="body2" color="textSecondary">
                No alerts at this time
              </Typography>
            </Box>
          ) : (
            <List>
              {alerts.map((alert, index) => (
                <React.Fragment key={alert.id}>
                  <ListItem
                    sx={{
                      bgcolor: alert.isNew ? 'action.hover' : 'inherit',
                      borderLeft: alert.severity === 'CRITICAL' ? 4 : 2,
                      borderLeftColor: `${getSeverityColor(alert.severity)}.main`
                    }}
                  >
                    <ListItemIcon>
                      {getSeverityIcon(alert.severity)}
                    </ListItemIcon>
                    
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="subtitle2">
                            {alert.deviceName}
                          </Typography>
                          {alert.isNew && (
                            <Chip
                              label="NEW"
                              size="small"
                              color="primary"
                              sx={{ height: 18 }}
                            />
                          )}
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" sx={{ mb: 0.5 }}>
                            {alert.message}
                          </Typography>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Chip
                              label={alert.severity}
                              size="small"
                              color={getSeverityColor(alert.severity)}
                            />
                            <Typography variant="caption" color="textSecondary">
                              {formatTimeAgo(alert.timestamp)}
                            </Typography>
                          </Box>
                        </Box>
                      }
                    />
                    
                    <ListItemSecondaryAction>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {alert.isNew && (
                          <IconButton
                            size="small"
                            onClick={() => markAsRead(alert.id)}
                            title="Mark as read"
                          >
                            <MarkEmailRead fontSize="small" />
                          </IconButton>
                        )}
                        <IconButton
                          size="small"
                          onClick={() => acknowledgeAlert(alert.id)}
                          title="Acknowledge"
                        >
                          <CheckCircle fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => removeAlert(alert.id)}
                          title="Remove"
                        >
                          <Close fontSize="small" />
                        </IconButton>
                      </Box>
                    </ListItemSecondaryAction>
                  </ListItem>
                  
                  {index < alerts.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}
        </Box>
      </Drawer>
    </>
  );
};