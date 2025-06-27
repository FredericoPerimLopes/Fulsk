import React from 'react';
import { Box, Typography, Paper, Alert } from '@mui/material';

export const SettingsPage: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>
      
      <Alert severity="info" sx={{ mb: 3 }}>
        Settings page is coming soon! This will include user preferences, 
        system configuration, notification settings, and account management.
      </Alert>
      
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Planned Features
        </Typography>
        <ul>
          <li>User profile management</li>
          <li>Notification preferences</li>
          <li>Dashboard customization</li>
          <li>Data export settings</li>
          <li>System configuration</li>
          <li>API key management</li>
          <li>Security settings</li>
          <li>Integration settings</li>
        </ul>
      </Paper>
    </Box>
  );
};