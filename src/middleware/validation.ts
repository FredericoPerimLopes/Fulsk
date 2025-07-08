import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

export interface ValidationSchema {
  body?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
}

export const validateRequest = (schema: ValidationSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Validate body
      if (schema.body) {
        const { error } = schema.body.validate(req.body);
        if (error) {
          res.status(400).json({
            success: false,
            error: 'Validation Error',
            message: error.details[0].message,
            details: error.details
          });
          return;
        }
      }

      // Validate params
      if (schema.params) {
        const { error } = schema.params.validate(req.params);
        if (error) {
          res.status(400).json({
            success: false,
            error: 'Validation Error',
            message: error.details[0].message,
            details: error.details
          });
          return;
        }
      }

      // Validate query
      if (schema.query) {
        const { error } = schema.query.validate(req.query);
        if (error) {
          res.status(400).json({
            success: false,
            error: 'Validation Error',
            message: error.details[0].message,
            details: error.details
          });
          return;
        }
      }

      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Validation middleware error'
      });
    }
  };
};