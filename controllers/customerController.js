const { User, Order, Product, Review, PaymentMethod } = require('../models');
const { logger } = require('../utils/logger');

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error(`Get profile error: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching profile' 
    });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, phone, address } = req.body;

    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    await user.update({
      firstName,
      lastName,
      phone,
      address
    });

    // Exclude sensitive data
    const userData = user.get({ plain: true });
    delete userData.password;

    res.status(200).json({
      success: true,
      message: 'Profile updated',
      data: userData
    });
  } catch (error) {
    logger.error(`Update profile error: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error updating profile' 
    });
  }
};

exports.updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ 
        success: false, 
        message: 'Current password is incorrect' 
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.status(200).json({ 
      success: true, 
      message: 'Password updated successfully' 
    });
  } catch (error) {
    logger.error(`Update password error: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error updating password' 
    });
  }
};

exports.getOrders = async (req, res) => {
  try {
    const orders = await Order.findAll({
      where: { userId: req.user.id },
      include: [
        {
          model: Product,
          attributes: ['id', 'name', 'price', 'image']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    logger.error(`Get orders error: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching orders' 
    });
  }
};

exports.getOrderDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findOne({
      where: { id, userId: req.user.id },
      include: [
        {
          model: Product,
          attributes: ['id', 'name', 'price', 'image'],
          through: { attributes: ['quantity'] }
        }
      ]
    });

    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found' 
      });
    }

    res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    logger.error(`Get order details error: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching order details' 
    });
  }
};

exports.cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findOne({
      where: { id, userId: req.user.id }
    });

    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found' 
      });
    }

    // Check if order can be canceled
    if (!['pending', 'processing'].includes(order.status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Order cannot be canceled at this stage' 
      });
    }

    await order.update({ status: 'canceled' });

    // Restore product stock
    const products = await order.getProducts();
    for (const product of products) {
      const orderItem = await product.OrderItem.findOne({ where: { orderId: id } });
      await product.increment('stock', { by: orderItem.quantity });
    }

    res.status(200).json({ 
      success: true, 
      message: 'Order canceled' 
    });
  } catch (error) {
    logger.error(`Cancel order error: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error canceling order' 
    });
  }
};

exports.addReview = async (req, res) => {
  try {
    const { productId } = req.params;
    const { rating, comment } = req.body;

    // Check if product exists
    const product = await Product.findByPk(productId);
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }

    // Check if user has purchased the product
    const hasPurchased = await Order.findOne({
      where: { userId: req.user.id },
      include: [{
        model: Product,
        where: { id: productId }
      }]
    });

    if (!hasPurchased) {
      return res.status(403).json({ 
        success: false, 
        message: 'You must purchase the product before reviewing' 
      });
    }

    // Check if already reviewed
    const existingReview = await Review.findOne({
      where: { userId: req.user.id, productId }
    });

    if (existingReview) {
      return res.status(400).json({ 
        success: false, 
        message: 'You have already reviewed this product' 
      });
    }

    // Create review
    const review = await Review.create({
      userId: req.user.id,
      productId,
      rating,
      comment
    });

    // Update product rating
    await updateProductRating(productId);

    res.status(201).json({
      success: true,
      message: 'Review added',
      data: review
    });
  } catch (error) {
    logger.error(`Add review error: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error adding review' 
    });
  }
};

async function updateProductRating(productId) {
  const result = await Review.findAll({
    where: { productId },
    attributes: [
      [sequelize.fn('AVG', sequelize.col('rating')), 'avgRating'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'reviewCount']
    ],
    raw: true
  });

  await Product.update({
    averageRating: parseFloat(result[0].avgRating) || 0,
    reviewCount: result[0].reviewCount
  }, { where: { id: productId } });
}

exports.getPaymentMethods = async (req, res) => {
  try {
    const paymentMethods = await PaymentMethod.findAll({
      where: { userId: req.user.id },
      attributes: { exclude: ['details'] }
    });

    res.status(200).json({
      success: true,
      count: paymentMethods.length,
      data: paymentMethods
    });
  } catch (error) {
    logger.error(`Get payment methods error: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching payment methods' 
    });
  }
};

exports.addPaymentMethod = async (req, res) => {
  try {
    const { type, details } = req.body;

    // Validate payment method type
    const validTypes = ['credit_card', 'paypal', 'bank_account'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid payment method type' 
      });
    }

    // Add payment method
    const paymentMethod = await PaymentMethod.create({
      userId: req.user.id,
      type,
      details,
      isDefault: false
    });

    res.status(201).json({
      success: true,
      message: 'Payment method added',
      data: {
        id: paymentMethod.id,
        type: paymentMethod.type,
        isDefault: paymentMethod.isDefault
      }
    });
  } catch (error) {
    logger.error(`Add payment method error: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error adding payment method' 
    });
  }
};

exports.removePaymentMethod = async (req, res) => {
  try {
    const { id } = req.params;

    const paymentMethod = await PaymentMethod.findOne({
      where: { id, userId: req.user.id }
    });

    if (!paymentMethod) {
      return res.status(404).json({ 
        success: false, 
        message: 'Payment method not found' 
      });
    }

    await paymentMethod.destroy();

    res.status(200).json({ 
      success: true, 
      message: 'Payment method removed' 
    });
  } catch (error) {
    logger.error(`Remove payment method error: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error removing payment method' 
    });
  }
};