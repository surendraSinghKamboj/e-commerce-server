const { Order, Product, User, Payment } = require('../models');
const { processPayment } = require('../services/paymentService');
const { sendOrderConfirmationEmail } = require('../services/emailService');
const { logger } = require('../utils/logger');

exports.createOrder = async (req, res) => {
  try {
    const { shippingAddress, paymentMethodId, notes } = req.body;
    const userId = req.user.id;

    // Get user cart
    const cart = await Cart.findOne({
      where: { userId },
      include: [{
        model: Product,
        through: { attributes: ['quantity'] }
      }]
    });

    if (!cart || cart.Products.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cart is empty' 
      });
    }

    // Calculate total
    const total = cart.Products.reduce((sum, product) => {
      return sum + (product.price * product.CartItem.quantity);
    }, 0);

    // Check product availability
    for (const product of cart.Products) {
      if (product.stock < product.CartItem.quantity) {
        return res.status(400).json({ 
          success: false, 
          message: `Insufficient stock for ${product.name}` 
        });
      }
    }

    // Create order
    const order = await Order.create({
      userId,
      totalAmount: total,
      shippingAddress,
      paymentMethodId,
      notes,
      status: 'pending'
    });

    // Add products to order
    await order.addProducts(cart.Products.map(product => {
      return {
        id: product.id,
        through: {
          quantity: product.CartItem.quantity,
          price: product.price
        }
      };
    }));

    // Process payment
    const paymentResult = await processPayment({
      orderId: order.id,
      amount: total,
      paymentMethodId,
      userId
    });

    if (!paymentResult.success) {
      // If payment fails, update order status
      await order.update({ status: 'payment_failed' });
      return res.status(400).json({ 
        success: false, 
        message: paymentResult.message 
      });
    }

    // Update order status
    await order.update({ 
      status: 'processing',
      paymentStatus: 'completed'
    });

    // Update product stock
    for (const product of cart.Products) {
      await product.decrement('stock', { 
        by: product.CartItem.quantity 
      });
    }

    // Clear cart
    await cart.setProducts([]);

    // Send confirmation email
    await sendOrderConfirmationEmail(req.user.email, order);

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: {
        orderId: order.id,
        paymentStatus: paymentResult.status
      }
    });
  } catch (error) {
    logger.error(`Create order error: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error creating order' 
    });
  }
};

exports.getOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findByPk(id, {
      include: [
        {
          model: Product,
          attributes: ['id', 'name', 'price', 'image'],
          through: { attributes: ['quantity'] }
        },
        {
          model: Payment,
          attributes: ['id', 'amount', 'status', 'paymentMethod', 'createdAt']
        }
      ]
    });

    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found' 
      });
    }

    // Check if user is authorized to view this order
    if (order.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized to view this order' 
      });
    }

    res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    logger.error(`Get order error: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching order' 
    });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validate status
    const validStatuses = ['processing', 'shipped', 'delivered', 'canceled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid status' 
      });
    }

    const order = await Order.findByPk(id);
    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found' 
      });
    }

    // Check permissions
    if (req.user.role === 'customer' && order.userId !== req.user.id) {
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized to update this order' 
      });
    }

    // Vendor can only update their own orders
    if (req.user.role === 'vendor') {
      const products = await order.getProducts();
      const vendorProducts = products.filter(p => p.vendorId === req.user.id);
      if (vendorProducts.length === 0) {
        return res.status(403).json({ 
          success: false, 
          message: 'Unauthorized to update this order' 
        });
      }
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

exports.listOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const offset = (page - 1) * limit;

    let where = {};
    if (status) where.status = status;

    // Customers can only see their own orders
    if (req.user.role === 'customer') {
      where.userId = req.user.id;
    }

    // Vendors can only see orders containing their products
    if (req.user.role === 'vendor') {
      const ordersWithVendorProducts = await Order.findAll({
        include: [{
          model: Product,
          where: { vendorId: req.user.id },
          attributes: []
        }],
        attributes: ['id'],
        raw: true
      });

      where.id = ordersWithVendorProducts.map(o => o.id);
    }

    const { count, rows: orders } = await Order.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: Product,
          attributes: ['id', 'name', 'price', 'image'],
          through: { attributes: ['quantity'] }
        }
      ]
    });

    res.status(200).json({
      success: true,
      count,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      data: orders
    });
  } catch (error) {
    logger.error(`List orders error: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching orders' 
    });
  }
};

exports.requestReturn = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const order = await Order.findOne({
      where: { id, userId: req.user.id }
    });

    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found' 
      });
    }

    // Check if order is eligible for return
    if (order.status !== 'delivered') {
      return res.status(400).json({ 
        success: false, 
        message: 'Only delivered orders can be returned' 
      });
    }

    // Check if return was already requested
    if (order.returnRequested) {
      return res.status(400).json({ 
        success: false, 
        message: 'Return already requested for this order' 
      });
    }

    await order.update({ 
      returnRequested: true,
      returnReason: reason,
      returnStatus: 'pending'
    });

    res.status(200).json({ 
      success: true, 
      message: 'Return requested successfully' 
    });
  } catch (error) {
    logger.error(`Request return error: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error requesting return' 
    });
  }
};

exports.processRefund = async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'approve' or 'reject'

    const order = await Order.findByPk(id);
    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found' 
      });
    }

    // Check if return was requested
    if (!order.returnRequested) {
      return res.status(400).json({ 
        success: false, 
        message: 'No return requested for this order' 
      });
    }

    // Only admin can process refunds
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized to process refunds' 
      });
    }

    if (action === 'approve') {
      // Process refund
      const refundResult = await processRefund(order.id);

      if (!refundResult.success) {
        return res.status(400).json({ 
          success: false, 
          message: refundResult.message 
        });
      }

      await order.update({ 
        returnStatus: 'approved',
        status: 'refunded'
      });

      // Restore product stock
      const products = await order.getProducts();
      for (const product of products) {
        const orderItem = await product.OrderItem.findOne({ where: { orderId: id } });
        await product.increment('stock', { by: orderItem.quantity });
      }

      res.status(200).json({ 
        success: true, 
        message: 'Refund processed successfully' 
      });
    } else if (action === 'reject') {
      await order.update({ 
        returnStatus: 'rejected' 
      });

      res.status(200).json({ 
        success: true, 
        message: 'Return request rejected' 
      });
    } else {
      res.status(400).json({ 
        success: false, 
        message: 'Invalid action' 
      });
    }
  } catch (error) {
    logger.error(`Process refund error: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error processing refund' 
    });
  }
};