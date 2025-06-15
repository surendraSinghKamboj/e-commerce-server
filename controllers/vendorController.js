const { Product, Order, User, Review } = require('../models');
const { uploadImage, deleteImage } = require('../services/storageService');
const { generateVendorAnalytics } = require('../services/analyticsService');
const { logger } = require('../utils/logger');

exports.getDashboard = async (req, res) => {
  try {
    const vendorId = req.user.id;

    // Get vendor stats
    const productCount = await Product.count({ where: { vendorId } });
    const orderCount = await Order.count({
      include: [{
        model: Product,
        where: { vendorId },
        attributes: []
      }]
    });
    const revenue = await Order.sum('totalAmount', {
      include: [{
        model: Product,
        where: { vendorId },
        attributes: []
      }],
      where: { paymentStatus: 'completed' }
    });

    // Get recent orders
    const recentOrders = await Order.findAll({
      limit: 5,
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: User,
          attributes: ['id', 'username', 'email']
        },
        {
          model: Product,
          where: { vendorId },
          attributes: ['id', 'name', 'price']
        }
      ]
    });

    // Get analytics
    const analytics = await generateVendorAnalytics(vendorId);

    res.status(200).json({
      success: true,
      data: {
        stats: {
          productCount,
          orderCount,
          revenue
        },
        recentOrders,
        analytics
      }
    });
  } catch (error) {
    logger.error(`Vendor dashboard error: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching dashboard data' 
    });
  }
};

exports.getProducts = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const offset = (page - 1) * limit;

    let where = { vendorId: req.user.id };
    if (status) where.status = status;

    const { count, rows: products } = await Product.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']],
      include: [{
        model: Category,
        attributes: ['id', 'name']
      }]
    });

    res.status(200).json({
      success: true,
      count,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      data: products
    });
  } catch (error) {
    logger.error(`Vendor products error: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching products' 
    });
  }
};

exports.createProduct = async (req, res) => {
  try {
    const { name, description, price, stock, categoryId } = req.body;
    const vendorId = req.user.id;

    // Validate category
    const category = await Category.findByPk(categoryId);
    if (!category) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid category' 
      });
    }

    // Handle image upload
    let imageUrl;
    if (req.files && req.files.length > 0) {
      imageUrl = await uploadImage(req.files[0]); // First image as main
    }

    const product = await Product.create({
      name,
      description,
      price,
      stock,
      image: imageUrl,
      categoryId,
      vendorId,
      status: 'active'
    });

    // Handle additional images
    if (req.files && req.files.length > 1) {
      const additionalImages = await Promise.all(
        req.files.slice(1).map(file => uploadImage(file))
      );
      await product.update({ additionalImages });
    }

    res.status(201).json({
      success: true,
      message: 'Product created',
      data: product
    });
  } catch (error) {
    logger.error(`Create product error: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error creating product' 
    });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, stock, categoryId, status } = req.body;

    const product = await Product.findOne({
      where: { id, vendorId: req.user.id }
    });

    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }

    // Validate category if provided
    if (categoryId) {
      const category = await Category.findByPk(categoryId);
      if (!category) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid category' 
        });
      }
    }

    // Handle image update
    let imageUrl = product.image;
    if (req.files && req.files.length > 0) {
      // Delete old image if exists
      if (imageUrl) {
        await deleteImage(imageUrl);
      }
      imageUrl = await uploadImage(req.files[0]);
    }

    await product.update({
      name: name || product.name,
      description: description || product.description,
      price: price || product.price,
      stock: stock || product.stock,
      categoryId: categoryId || product.categoryId,
      status: status || product.status,
      image: imageUrl
    });

    res.status(200).json({
      success: true,
      message: 'Product updated',
      data: product
    });
  } catch (error) {
    logger.error(`Update product error: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error updating product' 
    });
  }
};

exports.getOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const offset = (page - 1) * limit;

    let where = {};
    if (status) where.status = status;

    const orders = await Order.findAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: User,
          attributes: ['id', 'username', 'email']
        },
        {
          model: Product,
          where: { vendorId: req.user.id },
          attributes: ['id', 'name', 'price'],
          through: { attributes: ['quantity'] }
        }
      ]
    });

    // Filter orders to only include those with the vendor's products
    const filteredOrders = orders.filter(order => order.Products.length > 0);

    res.status(200).json({
      success: true,
      count: filteredOrders.length,
      data: filteredOrders
    });
  } catch (error) {
    logger.error(`Vendor orders error: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching orders' 
    });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validate status
    const validStatuses = ['processing', 'shipped'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid status' 
      });
    }

    // Find order with vendor's products
    const order = await Order.findOne({
      where: { id },
      include: [{
        model: Product,
        where: { vendorId: req.user.id },
        attributes: ['id']
      }]
    });

    if (!order || order.Products.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found or unauthorized' 
      });
    }

    // Vendor can only update to shipped if currently processing
    if (status === 'shipped' && order.status !== 'processing') {
      return res.status(400).json({ 
        success: false, 
        message: 'Order must be in processing status to ship' 
      });
    }

    await order.update({ status });

    res.status(200).json({ 
      success: true, 
      message: 'Order status updated' 
    });
  } catch (error) {
    logger.error(`Update order status error: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error updating order status' 
    });
  }
};

exports.getReviews = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const { count, rows: reviews } = await Review.findAndCountAll({
      include: [
        {
          model: Product,
          where: { vendorId: req.user.id },
          attributes: ['id', 'name']
        },
        {
          model: User,
          attributes: ['id', 'username']
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json({
      success: true,
      count,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      data: reviews
    });
  } catch (error) {
    logger.error(`Vendor reviews error: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching reviews' 
    });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { storeName, description, contactEmail, phone, address } = req.body;

    const vendor = await User.findByPk(req.user.id);
    if (!vendor) {
      return res.status(404).json({ 
        success: false, 
        message: 'Vendor not found' 
      });
    }

    // Handle logo upload
    let logoUrl = vendor.logo;
    if (req.file) {
      // Delete old logo if exists
      if (logoUrl) {
        await deleteImage(logoUrl);
      }
      logoUrl = await uploadImage(req.file);
    }

    await vendor.update({
      storeName,
      description,
      contactEmail,
      phone,
      address,
      logo: logoUrl
    });

    // Exclude sensitive data
    const vendorData = vendor.get({ plain: true });
    delete vendorData.password;

    res.status(200).json({
      success: true,
      message: 'Profile updated',
      data: vendorData
    });
  } catch (error) {
    logger.error(`Update vendor profile error: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error updating profile' 
    });
  }
};

exports.getSalesReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const report = await generateSalesReport(req.user.id, startDate, endDate);

    res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    logger.error(`Sales report error: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error generating sales report' 
    });
  }
};