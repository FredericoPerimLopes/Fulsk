import { Router } from 'express';
import { WeatherService } from '@services/WeatherService';
import { authenticate } from '@middleware/auth';
import { validateRequest } from '@middleware/validation';
import logger from '@utils/logger';
import Joi from 'joi';

const router = Router();
const weatherService = WeatherService.getInstance();

// Validation schemas
const deviceIdSchema = Joi.object({
  deviceId: Joi.string().required()
});

/**
 * GET /api/weather/current/:deviceId
 * Get current weather data for a device location
 */
router.get('/current/:deviceId',
  authenticate,
  validateRequest({ params: deviceIdSchema }),
  async (req, res) => {
    try {
      const { deviceId } = req.params;
      
      logger.info(`🌤️ Current weather requested for device ${deviceId}`);
      
      const weatherData = await weatherService.getCurrentWeather(deviceId);
      
      res.json({
        success: true,
        data: weatherData,
        message: 'Current weather data retrieved successfully'
      });
    } catch (error) {
      logger.error('❌ Error retrieving current weather:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve current weather',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * GET /api/weather/solar/:deviceId
 * Get solar irradiance data for a device location
 */
router.get('/solar/:deviceId',
  authenticate,
  validateRequest({ params: deviceIdSchema }),
  async (req, res) => {
    try {
      const { deviceId } = req.params;
      
      logger.info(`☀️ Solar data requested for device ${deviceId}`);
      
      const solarData = await weatherService.getSolarData(deviceId);
      
      res.json({
        success: true,
        data: solarData,
        message: 'Solar data retrieved successfully'
      });
    } catch (error) {
      logger.error('❌ Error retrieving solar data:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve solar data',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * GET /api/weather/forecast/:deviceId
 * Get weather forecast for the next 7 days
 */
router.get('/forecast/:deviceId',
  authenticate,
  validateRequest({ params: deviceIdSchema }),
  async (req, res) => {
    try {
      const { deviceId } = req.params;
      
      logger.info(`📅 Weather forecast requested for device ${deviceId}`);
      
      const forecast = await weatherService.getWeatherForecast(deviceId);
      
      res.json({
        success: true,
        data: forecast,
        message: 'Weather forecast retrieved successfully'
      });
    } catch (error) {
      logger.error('❌ Error retrieving weather forecast:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve weather forecast',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * GET /api/weather/impact/:deviceId
 * Analyze weather impact on solar panel performance
 */
router.get('/impact/:deviceId',
  authenticate,
  validateRequest({ params: deviceIdSchema }),
  async (req, res) => {
    try {
      const { deviceId } = req.params;
      
      logger.info(`🔍 Weather impact analysis requested for device ${deviceId}`);
      
      const impact = await weatherService.analyzeWeatherImpact(deviceId);
      
      res.json({
        success: true,
        data: impact,
        message: 'Weather impact analysis completed successfully'
      });
    } catch (error) {
      logger.error('❌ Error analyzing weather impact:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to analyze weather impact',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * GET /api/weather/production-forecast/:deviceId
 * Predict solar production based on weather forecast
 */
router.get('/production-forecast/:deviceId',
  authenticate,
  validateRequest({ params: deviceIdSchema }),
  async (req, res) => {
    try {
      const { deviceId } = req.params;
      
      logger.info(`🔮 Solar production forecast requested for device ${deviceId}`);
      
      const forecast = await weatherService.predictSolarProduction(deviceId);
      
      res.json({
        success: true,
        data: forecast,
        message: 'Solar production forecast generated successfully'
      });
    } catch (error) {
      logger.error('❌ Error generating solar production forecast:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate solar production forecast',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * GET /api/weather/maintenance-windows/:deviceId
 * Get optimal maintenance windows based on weather
 */
router.get('/maintenance-windows/:deviceId',
  authenticate,
  validateRequest({ params: deviceIdSchema }),
  async (req, res) => {
    try {
      const { deviceId } = req.params;
      
      logger.info(`🛠️ Maintenance windows requested for device ${deviceId}`);
      
      const windows = await weatherService.getOptimalMaintenanceWindows(deviceId);
      
      res.json({
        success: true,
        data: windows,
        message: 'Optimal maintenance windows retrieved successfully'
      });
    } catch (error) {
      logger.error('❌ Error retrieving maintenance windows:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve maintenance windows',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * GET /api/weather/historical/:deviceId
 * Get historical weather data for ML model training
 */
router.get('/historical/:deviceId',
  authenticate,
  validateRequest({ params: deviceIdSchema }),
  async (req, res) => {
    try {
      const { deviceId } = req.params;
      
      logger.info(`📊 Historical weather data requested for device ${deviceId}`);
      
      const historicalData = await weatherService.getHistoricalWeatherData(deviceId);
      
      res.json({
        success: true,
        data: historicalData,
        message: 'Historical weather data retrieved successfully'
      });
    } catch (error) {
      logger.error('❌ Error retrieving historical weather data:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve historical weather data',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

export default router;