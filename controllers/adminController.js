const { User, Product, Order, Category, Review } = require('../models');
const { generateDashboardData } = require('../services/analyticsService');
const { sendEmail } = require('../services/emailService');
const { logger } = require('../utils/logger');

exports.dashboard = async (req, res) => {
  try {
    const dashboardData = await generateDashboardData();
    
    res.status(200).json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    logger.error(`Admin dashboard error: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching dashboard data' 
    });
  }
};

exports.manageUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    logger.error(`User management error: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching users' 
    });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, status } = req.body;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Prevent modifying own admin status
    if (user.id === req.user.id && (role !== 'admin' || status !== 'active')) {
      return res.status(403).json({ 
        success: false, 
        message: 'Cannot modify your own admin status' 
      });
    }

    await user.update({ role, status });

    // Notify user if status changed
    if (user.changed('status')) {
      await sendEmail(
        user.email,
        'Account Status Update',
        `Your account status has been updated to: ${status}`
      );
    }

    res.status(200).json({ 
      success: true, 
      message: 'User updated successfully' 
    });
  } catch (error) {
    logger.error(`User update error: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error updating user' 
    });
  }
};

exports.manageProducts = async (req, res) => {
  try {
    const products = await Product.findAll({
      include: [
        { model: User, as: 'vendor', attributes: ['id', 'username', 'email'] },
        { model: Category, attributes: ['id', 'name'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    logger.error(`Product management error: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching products' 
    });
  }
};

exports.updateProductStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }

    await product.update({ status });

    res.status(200).json({ 
      success: true, 
      message: 'Product status updated' 
    });
  } catch (error) {
    logger.error(`Product status update error: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error updating product status' 
    });
  }
};

exports.manageOrders = async (req, res) => {
  try {
    const orders = await Order.findAll({
      include: [
        { model: User, attributes: ['id', 'username', 'email'] },
        { model: Product, attributes: ['id', 'name', 'price'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    logger.error(`Order management error: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching orders' 
    });
  }
};

exports.generateReports = async (req, res) => {
  try {
    const { type, startDate, endDate } = req.query;
    
    let report;
    switch (type) {
      case 'sales':
        report = await generateSalesReport(startDate, endDate);
        break;
      case 'users':
        report = await generateUserReport(startDate, endDate);
        break;
      case 'products':
        report = await generateProductReport(startDate, endDate);
        break;
      default:
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid report type' 
        });
    }

    res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    logger.error(`Report generation error: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error generating report' 
    });
  }
};