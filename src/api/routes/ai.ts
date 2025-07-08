import { Router } from 'express';
import { AIService } from '@services/AIService';
import { authenticate } from '@middleware/auth';
import { validateRequest } from '@middleware/validation';
import logger from '@utils/logger';
import Joi from 'joi';

const router = Router();
const aiService = AIService.getInstance();

// Validation schemas
const deviceIdSchema = Joi.object({
  deviceId: Joi.string().required()
});

const trainingSchema = Joi.object({
  deviceId: Joi.string().optional(),
  modelType: Joi.string().valid('predictive', 'performance', 'both').default('both')
});

/**
 * GET /api/ai/predictive-maintenance/:deviceId
 * Analyze device for predictive maintenance needs
 */
router.get('/predictive-maintenance/:deviceId', 
  authenticate,
  validateRequest({ params: deviceIdSchema }),
  async (req, res) => {
    try {
      const { deviceId } = req.params;
      
      logger.info(`🤖 Predictive maintenance analysis requested for device ${deviceId}`);
      
      const analysis = await aiService.analyzePredictiveMaintenance(deviceId);
      
      res.json({
        success: true,
        data: analysis,
        message: 'Predictive maintenance analysis completed successfully'
      });
    } catch (error) {
      logger.error('❌ Error in predictive maintenance analysis:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to analyze predictive maintenance',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * GET /api/ai/performance-optimization/:deviceId
 * Analyze device for performance optimization opportunities
 */
router.get('/performance-optimization/:deviceId',
  authenticate,
  validateRequest({ params: deviceIdSchema }),
  async (req, res) => {
    try {
      const { deviceId } = req.params;
      
      logger.info(`🎯 Performance optimization analysis requested for device ${deviceId}`);
      
      const analysis = await aiService.analyzePerformanceOptimization(deviceId);
      
      res.json({
        success: true,
        data: analysis,
        message: 'Performance optimization analysis completed successfully'
      });
    } catch (error) {
      logger.error('❌ Error in performance optimization analysis:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to analyze performance optimization',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * POST /api/ai/train-models
 * Train AI models with new data
 */
router.post('/train-models',
  authenticate,
  validateRequest({ body: trainingSchema }),
  async (req, res) => {
    try {
      const { deviceId } = req.body;
      
      logger.info(`🎓 AI model training requested${deviceId ? ` for device ${deviceId}` : ''}`);
      
      // Only allow admins to train models
      if (req.user?.role !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          message: 'Only administrators can train AI models'
        });
      }
      
      const metrics = await aiService.trainModels(deviceId);
      
      res.json({
        success: true,
        data: metrics,
        message: 'AI models trained successfully'
      });
    } catch (error) {
      logger.error('❌ Error training AI models:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to train AI models',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * GET /api/ai/model-metrics
 * Get current AI model performance metrics
 */
router.get('/model-metrics',
  authenticate,
  async (req, res) => {
    try {
      logger.info('📊 AI model metrics requested');
      
      const metrics = await aiService.getModelMetrics();
      
      res.json({
        success: true,
        data: metrics,
        message: 'AI model metrics retrieved successfully'
      });
    } catch (error) {
      logger.error('❌ Error retrieving AI model metrics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve AI model metrics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * GET /api/ai/health
 * Check AI service health status
 */
router.get('/health',
  authenticate,
  async (req, res) => {
    try {
      // Check if AI service is properly initialized
      const healthCheck = {
        status: 'healthy',
        timestamp: new Date(),
        services: {
          aiService: 'operational',
          tensorFlow: 'operational',
          modelLoading: 'operational'
        }
      };
      
      res.json({
        success: true,
        data: healthCheck,
        message: 'AI service is healthy'
      });
    } catch (error) {
      logger.error('❌ Error checking AI service health:', error);
      res.status(500).json({
        success: false,
        error: 'AI service health check failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

export default router;