const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { logger } = require('../utils/logger');

// Authentication middleware for JWT
exports.authenticateJWT = async (req, res, next) => {
  try {
    // Get token from header, cookie, or query param
    const token = req.header('Authorization')?.replace('Bearer ', '') || 
                 req.cookies?.token || 
                 req.query?.token;

    if (!token) {
      logger.warn('Authentication failed - no token provided');
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find user
    const user = await User.findByPk(decoded.id, {
      attributes: { exclude: ['password'] }
    });

    if (!user) {
      logger.warn(`Authentication failed - user not found: ${decoded.id}`);
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication failed' 
      });
    }

    // Check if account is active
    if (user.status !== 'active') {
      logger.warn(`Authentication failed - account ${user.status}: ${user.email}`);
      return res.status(403).json({ 
        success: false, 
        message: `Account is ${user.status}` 
      });
    }

    // Check if email is verified (except for admins)
    if (!user.isVerified && user.role !== 'admin') {
      logger.warn(`Authentication failed - email not verified: ${user.email}`);
      return res.status(403).json({ 
        success: false, 
        message: 'Please verify your email address' 
      });
    }

    // Attach user to request
    req.user = user;
    logger.debug(`Authentication successful for user: ${user.email}`);
    next();
  } catch (error) {
    logger.error(`Authentication error: ${error.message}`);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Token expired' 
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token' 
      });
    }

    res.status(500).json({ 
      success: false, 
      message: 'Authentication failed' 
    });
  }
};

// Authentication middleware for sessions (if using session-based auth)
exports.authenticateSession = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ 
    success: false, 
    message: 'Not authenticated' 
  });
};

// Email verification check middleware
exports.checkVerified = (req, res, next) => {
  if (!req.user.isVerified && req.user.role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      message: 'Please verify your email address' 
    });
  }
  next();
};

// Password reset token verification middleware
exports.verifyPasswordResetToken = async (req, res, next) => {
  try {
    const { token } = req.params;

    const decoded = jwt.verify(token, process.env.JWT_SECRET, { 
      subject: 'password_reset' 
    });

    const user = await User.findByPk(decoded.id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    req.resetUser = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Password reset link has expired' 
      });
    }
    res.status(400).json({ 
      success: false, 
      message: 'Invalid password reset token' 
    });
  }
};

// Forward authenticated users away from auth routes
exports.forwardAuthenticated = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return next();
  }
  res.redirect('/dashboard');
};