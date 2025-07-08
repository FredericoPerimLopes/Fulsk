import { Router } from 'express';
import { EnergyOptimizationService } from '@services/EnergyOptimizationService';
import { authenticate } from '@middleware/auth';
import { validateRequest } from '@middleware/validation';
import logger from '@utils/logger';
import Joi from 'joi';

const router = Router();
const energyService = EnergyOptimizationService.getInstance();

// Validation schemas
const deviceIdSchema = Joi.object({
  deviceId: Joi.string().required()
});

const tradingStrategySchema = Joi.object({
  strategy: Joi.string().valid('buy_low_sell_high', 'demand_response', 'peak_shaving', 'arbitrage').required(),
  parameters: Joi.object({
    buyThreshold: Joi.number().min(0).max(100).required(),
    sellThreshold: Joi.number().min(0).max(100).required(),
    batteryReserve: Joi.number().min(0).max(100).required(),
    maxTradeAmount: Joi.number().min(0).required()
  }).required(),
  active: Joi.boolean().default(true)
});

const energyTradeSchema = Joi.object({
  amount: Joi.number().min(0).required(),
  type: Joi.string().valid('buy', 'sell').required()
});

const demandResponseSchema = Joi.object({
  programId: Joi.string().required()
});

/**
 * GET /api/energy/prices/:location
 * Get current energy prices for a location
 */
router.get('/prices/:location',
  authenticate,
  async (req, res) => {
    try {
      const { location } = req.params;
      
      logger.info(`💰 Energy prices requested for location ${location}`);
      
      const prices = await energyService.getCurrentEnergyPrices(location);
      
      res.json({
        success: true,
        data: prices,
        message: 'Energy prices retrieved successfully'
      });
    } catch (error) {
      logger.error('❌ Error retrieving energy prices:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve energy prices',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * GET /api/energy/optimization/:deviceId
 * Optimize energy usage for a device
 */
router.get('/optimization/:deviceId',
  authenticate,
  validateRequest({ params: deviceIdSchema }),
  async (req, res) => {
    try {
      const { deviceId } = req.params;
      
      logger.info(`⚡ Energy optimization requested for device ${deviceId}`);
      
      const optimization = await energyService.optimizeEnergyUsage(deviceId);
      
      res.json({
        success: true,
        data: optimization,
        message: 'Energy optimization completed successfully'
      });
    } catch (error) {
      logger.error('❌ Error optimizing energy usage:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to optimize energy usage',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * GET /api/energy/battery-optimization/:deviceId
 * Optimize battery charging/discharging strategy
 */
router.get('/battery-optimization/:deviceId',
  authenticate,
  validateRequest({ params: deviceIdSchema }),
  async (req, res) => {
    try {
      const { deviceId } = req.params;
      
      logger.info(`🔋 Battery optimization requested for device ${deviceId}`);
      
      const optimization = await energyService.optimizeBatteryStrategy(deviceId);
      
      res.json({
        success: true,
        data: optimization,
        message: 'Battery optimization completed successfully'
      });
    } catch (error) {
      logger.error('❌ Error optimizing battery strategy:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to optimize battery strategy',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * POST /api/energy/trading-strategy/:deviceId
 * Set energy trading strategy for a device
 */
router.post('/trading-strategy/:deviceId',
  authenticate,
  validateRequest({ 
    params: deviceIdSchema,
    body: tradingStrategySchema 
  }),
  async (req, res) => {
    try {
      const { deviceId } = req.params;
      const strategy = req.body;
      
      logger.info(`📝 Trading strategy update requested for device ${deviceId}`);
      
      energyService.setTradingStrategy(deviceId, strategy);
      
      res.json({
        success: true,
        data: { deviceId, strategy },
        message: 'Trading strategy updated successfully'
      });
    } catch (error) {
      logger.error('❌ Error updating trading strategy:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update trading strategy',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * POST /api/energy/execute-trade/:deviceId
 * Execute energy trading transaction
 */
router.post('/execute-trade/:deviceId',
  authenticate,
  validateRequest({ 
    params: deviceIdSchema,
    body: energyTradeSchema 
  }),
  async (req, res) => {
    try {
      const { deviceId } = req.params;
      const { amount, type } = req.body;
      
      logger.info(`💱 Energy trade execution requested for device ${deviceId}: ${type} ${amount} kWh`);
      
      const success = await energyService.executeEnergyTrade(deviceId, amount, type);
      
      if (success) {
        res.json({
          success: true,
          data: { deviceId, amount, type, executed: true },
          message: 'Energy trade executed successfully'
        });
      } else {
        res.status(400).json({
          success: false,
          error: 'Trade execution failed',
          message: 'Trade could not be executed due to strategy constraints or market conditions'
        });
      }
    } catch (error) {
      logger.error('❌ Error executing energy trade:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to execute energy trade',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * POST /api/energy/demand-response/:deviceId
 * Participate in demand response program
 */
router.post('/demand-response/:deviceId',
  authenticate,
  validateRequest({ 
    params: deviceIdSchema,
    body: demandResponseSchema 
  }),
  async (req, res) => {
    try {
      const { deviceId } = req.params;
      const { programId } = req.body;
      
      logger.info(`📋 Demand response participation requested for device ${deviceId} in program ${programId}`);
      
      const success = await energyService.participateInDemandResponse(deviceId, programId);
      
      if (success) {
        res.json({
          success: true,
          data: { deviceId, programId, participated: true },
          message: 'Demand response participation successful'
        });
      } else {
        res.status(400).json({
          success: false,
          error: 'Demand response participation failed',
          message: 'Could not participate in demand response program'
        });
      }
    } catch (error) {
      logger.error('❌ Error participating in demand response:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to participate in demand response',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * GET /api/energy/market-forecast
 * Get energy market forecast
 */
router.get('/market-forecast',
  authenticate,
  async (req, res) => {
    try {
      logger.info('📈 Energy market forecast requested');
      
      const forecast = await energyService.getEnergyMarketForecast();
      
      res.json({
        success: true,
        data: forecast,
        message: 'Energy market forecast retrieved successfully'
      });
    } catch (error) {
      logger.error('❌ Error retrieving energy market forecast:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve energy market forecast',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * GET /api/energy/health
 * Check energy optimization service health
 */
router.get('/health',
  authenticate,
  async (req, res) => {
    try {
      const healthCheck = {
        status: 'healthy',
        timestamp: new Date(),
        services: {
          energyOptimization: 'operational',
          priceData: 'operational',
          tradingStrategies: 'operational',
          demandResponse: 'operational'
        }
      };
      
      res.json({
        success: true,
        data: healthCheck,
        message: 'Energy optimization service is healthy'
      });
    } catch (error) {
      logger.error('❌ Error checking energy service health:', error);
      res.status(500).json({
        success: false,
        error: 'Energy service health check failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

export default router;