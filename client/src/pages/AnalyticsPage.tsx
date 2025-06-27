import React from 'react';
import { Box, Typography, Paper, Alert } from '@mui/material';

export const AnalyticsPage: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Analytics
      </Typography>
      
      <Alert severity="info" sx={{ mb: 3 }}>
        Analytics dashboard is coming soon! This will include detailed performance metrics, 
        energy production analytics, efficiency trends, and predictive maintenance insights.
      </Alert>
      
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Planned Features
        </Typography>
        <ul>
          <li>Energy production analytics with time-series charts</li>
          <li>Device performance comparisons</li>
          <li>Efficiency trend analysis</li>
          <li>Weather correlation analytics</li>
          <li>Predictive maintenance insights</li>
          <li>Cost savings calculations</li>
          <li>Carbon footprint tracking</li>
          <li>Custom report generation</li>
        </ul>
      </Paper>
    </Box>
  );
};