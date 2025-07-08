import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { UserRole } from '@models/User';

// Common validation schemas
export const registerSchema = Joi.object({
  email: Joi.string()
    .email()
    .lowercase()
    .trim()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters long',
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
      'any.required': 'Password is required'
    }),
  firstName: Joi.string()
    .min(2)
    .max(50)
    .trim()
    .pattern(/^[a-zA-Z\s'-]+$/)
    .required()
    .messages({
      'string.pattern.base': 'First name can only contain letters, spaces, hyphens, and apostrophes',
      'any.required': 'First name is required'
    }),
  lastName: Joi.string()
    .min(2)
    .max(50)
    .trim()
    .pattern(/^[a-zA-Z\s'-]+$/)
    .required()
    .messages({
      'string.pattern.base': 'Last name can only contain letters, spaces, hyphens, and apostrophes',
      'any.required': 'Last name is required'
    }),
  role: Joi.string()
    .valid(...Object.values(UserRole))
    .required()
    .messages({
      'any.only': 'Invalid role specified',
      'any.required': 'Role is required'
    })
});

export const loginSchema = Joi.object({
  email: Joi.string()
    .email()
    .lowercase()
    .trim()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
  password: Joi.string()
    .required()
    .messages({
      'any.required': 'Password is required'
    })
});

export const refreshSchema = Joi.object({
  refreshToken: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Invalid refresh token format',
      'any.required': 'Refresh token is required'
    })
});

export const updateProfileSchema = Joi.object({
  email: Joi.string()
    .email()
    .lowercase()
    .trim()
    .optional()
    .messages({
      'string.email': 'Please provide a valid email address'
    }),
  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .optional()
    .messages({
      'string.min': 'Password must be at least 8 characters long',
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    }),
  firstName: Joi.string()
    .min(2)
    .max(50)
    .trim()
    .pattern(/^[a-zA-Z\s'-]+$/)
    .optional()
    .messages({
      'string.pattern.base': 'First name can only contain letters, spaces, hyphens, and apostrophes'
    }),
  lastName: Joi.string()
    .min(2)
    .max(50)
    .trim()
    .pattern(/^[a-zA-Z\s'-]+$/)
    .optional()
    .messages({
      'string.pattern.base': 'Last name can only contain letters, spaces, hyphens, and apostrophes'
    })
}).min(1).messages({
  'object.min': 'At least one field must be provided for update'
});

// Generic validation middleware factory
export const validate = (schema: Joi.Schema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid input data',
        errors
      });
      return;
    }

    // Replace request body with sanitized value
    req.body = value;
    next();
  };
};

// Pre-made validation middlewares
export const validateRegister = validate(registerSchema);
export const validateLogin = validate(loginSchema);
export const validateRefresh = validate(refreshSchema);
export const validateUpdateProfile = validate(updateProfileSchema);