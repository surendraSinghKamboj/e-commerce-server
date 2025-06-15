const { Order, User, Product } = require('../models');
const moment = require('moment');

exports.getSalesAnalytics = async () => {
  try {
    // Last 30 days sales data
    const startDate = moment().subtract(30, 'days').startOf('day');
    const endDate = moment().endOf('day');
    
    const orders = await Order.findAll({
      where: {
        createdAt: {
          [Op.between]: [startDate.toDate(), endDate.toDate()]
        },
        paymentStatus: 'completed'
      },
      attributes: [
        [sequelize.fn('DATE', sequelize.col('createdAt')), 'date'],
        [sequelize.fn('SUM', sequelize.col('totalAmount')), 'total']
      ],
      group: [sequelize.fn('DATE', sequelize.col('createdAt'))],
      order: [[sequelize.fn('DATE', sequelize.col('createdAt')), 'ASC']],
      raw: true
    });
    
    // Format data for chart
    const dates = [];
    const sales = [];
    
    for (let day = moment(startDate); day <= endDate; day.add(1, 'day')) {
      const dateStr = day.format('YYYY-MM-DD');
      const order = orders.find(o => moment(o.date).format('YYYY-MM-DD') === dateStr);
      
      dates.push(day.format('MMM D'));
      sales.push(order ? parseFloat(order.total) : 0);
    }
    
    return { dates, sales };
  } catch (err) {
    throw err;
  }
};

exports.getVendorSalesAnalytics = async (vendorId) => {
  try {
    // Last 30 days sales data for vendor
    const startDate = moment().subtract(30, 'days').startOf('day');
    const endDate = moment().endOf('day');
    
    const orders = await Order.findAll({
      include: [{
        model: Product,
        where: { vendorId },
        attributes: []
      }],
      where: {
        createdAt: {
          [Op.between]: [startDate.toDate(), endDate.toDate()]
        },
        paymentStatus: 'completed'
      },
      attributes: [
        [sequelize.fn('DATE', sequelize.col('Order.createdAt')), 'date'],
        [sequelize.fn('SUM', sequelize.col('totalAmount')), 'total']
      ],
      group: [sequelize.fn('DATE', sequelize.col('Order.createdAt'))],
      order: [[sequelize.fn('DATE', sequelize.col('Order.createdAt')), 'ASC']],
      raw: true
    });
    
    // Format data for chart
    const dates = [];
    const sales = [];
    
    for (let day = moment(startDate); day <= endDate; day.add(1, 'day')) {
      const dateStr = day.format('YYYY-MM-DD');
      const order = orders.find(o => moment(o.date).format('YYYY-MM-DD') === dateStr);
      
      dates.push(day.format('MMM D'));
      sales.push(order ? parseFloat(order.total) : 0);
    }
    
    return { dates, sales };
  } catch (err) {
    throw err;
  }
};

exports.getUserAnalytics = async () => {
  try {
    // User growth over time
    const startDate = moment().subtract(12, 'months').startOf('month');
    const endDate = moment().endOf('month');
    
    const users = await User.findAll({
      where: {
        createdAt: {
          [Op.between]: [startDate.toDate(), endDate.toDate()]
        }
      },
      attributes: [
        [sequelize.fn('DATE_FORMAT', sequelize.col('createdAt'), '%Y-%m'), 'month'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: [sequelize.fn('DATE_FORMAT', sequelize.col('createdAt'), '%Y-%m')],
      order: [[sequelize.fn('DATE_FORMAT', sequelize.col('createdAt'), '%Y-%m'), 'ASC']],
      raw: true
    });
    
    // Format data for chart
    const months = [];
    const counts = [];
    
    for (let month = moment(startDate); month <= endDate; month.add(1, 'month')) {
      const monthStr = month.format('YYYY-MM');
      const userData = users.find(u => u.month === monthStr);
      
      months.push(month.format('MMM YYYY'));
      counts.push(userData ? parseInt(userData.count) : 0);
    }
    
    return { months, counts };
  } catch (err) {
    throw err;
  }
};

exports.getProductAnalytics = async () => {
  try {
    // Top selling products
    const products = await Product.findAll({
      attributes: [
        'id',
        'name',
        [sequelize.fn('SUM', sequelize.col('OrderProducts.quantity')), 'totalSold']
      ],
      include: [{
        model: Order,
        as: 'OrderProducts',
        attributes: [],
        where: {
          paymentStatus: 'completed'
        },
        required: false
      }],
      group: ['Product.id'],
      order: [[sequelize.fn('SUM', sequelize.col('OrderProducts.quantity')), 'DESC']],
      limit: 10,
      raw: true
    });
    
    // Format data for chart
    const labels = products.map(p => p.name);
    const data = products.map(p => parseInt(p.totalSold) || 0);
    
    return { labels, data };
  } catch (err) {
    throw err;
  }
};