const { logger } = require('../utils/logger');

// Higher-order function to create role-based middleware
exports.requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        logger.warn('Role check failed - no user authenticated');
        return res.status(401).json({ 
          success: false, 
          message: 'Authentication required' 
        });
      }

      if (!allowedRoles.includes(req.user.role)) {
        logger.warn(
          `Role check failed for ${req.user.email} - ` +
          `Required: ${allowedRoles.join(', ')}, ` +
          `Has: ${req.user.role}`
        );
        return res.status(403).json({ 
          success: false, 
          message: 'Insufficient permissions' 
        });
      }

      logger.debug(
        `Role check passed for ${req.user.email} ` +
        `(required: ${allowedRoles.join(', ')})`
      );
      next();
    } catch (error) {
      logger.error(`Role middleware error: ${error.message}`);
      res.status(500).json({ 
        success: false, 
        message: 'Authorization failed' 
      });
    }
  };
};

// Specific role middlewares for common cases
exports.requireAdmin = exports.requireRole('admin');
exports.requireVendor = exports.requireRole('vendor');
exports.requireCustomer = exports.requireRole('customer');

// Middleware for vendor product ownership
exports.requireProductOwnership = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await Product.findByPk(id);

    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }

    if (product.vendorId !== req.user.id && req.user.role !== 'admin') {
      logger.warn(
        `Product ownership check failed - ` +
        `User ${req.user.id} tried to access product ${id} owned by ${product.vendorId}`
      );
      return res.status(403).json({ 
        success: false, 
        message: 'You do not own this product' 
      });
    }

    req.product = product;
    next();
  } catch (error) {
    logger.error(`Product ownership middleware error: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Authorization failed' 
    });
  }
};

// Middleware for order access control
exports.requireOrderAccess = async (req, res, next) => {
  try {
    const { id } = req.params;
    const order = await Order.findByPk(id, {
      include: [{
        model: Product,
        attributes: ['vendorId']
      }]
    });

    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found' 
      });
    }

    // Admins can access any order
    if (req.user.role === 'admin') {
      req.order = order;
      return next();
    }

    // Customers can access their own orders
    if (req.user.role === 'customer' && order.userId === req.user.id) {
      req.order = order;
      return next();
    }

    // Vendors can access orders containing their products
    if (req.user.role === 'vendor') {
      const hasVendorProducts = order.Products.some(
        product => product.vendorId === req.user.id
      );

      if (hasVendorProducts) {
        req.order = order;
        return next();
      }
    }

    logger.warn(
      `Order access denied - User ${req.user.id} tried to access order ${id}`
    );
    res.status(403).json({ 
      success: false, 
      message: 'Access to this order denied' 
    });
  } catch (error) {
    logger.error(`Order access middleware error: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Authorization failed' 
    });
  }
};

// Middleware for resource ownership (generic)
exports.requireOwnership = (model, ownerField = 'userId') => {
  return async (req, res, next) => {
    try {
      const { id } = req.params;
      const resource = await model.findByPk(id);

      if (!resource) {
        return res.status(404).json({ 
          success: false, 
          message: 'Resource not found' 
        });
      }

      // Admins can access any resource
      if (req.user.role === 'admin') {
        req.resource = resource;
        return next();
      }

      // Check ownership
      if (resource[ownerField] !== req.user.id) {
        logger.warn(
          `Ownership check failed - ` +
          `User ${req.user.id} tried to access ${model.name} ${id} ` +
          `owned by ${resource[ownerField]}`
        );
        return res.status(403).json({ 
          success: false, 
          message: 'You do not own this resource' 
        });
      }

      req.resource = resource;
      next();
    } catch (error) {
      logger.error(`Ownership middleware error: ${error.message}`);
      res.status(500).json({ 
        success: false, 
        message: 'Authorization failed' 
      });
    }
  };
};