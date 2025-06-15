const { Cart, Product, CartItem } = require('../models');
const { logger } = require('../utils/logger');

exports.getCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({
      where: { userId: req.user.id },
      include: [
        {
          model: Product,
          through: { attributes: ['quantity'] }
        }
      ]
    });

    if (!cart) {
      return res.status(200).json({
        success: true,
        data: { items: [], total: 0 }
      });
    }

    // Calculate total
    const total = cart.Products.reduce((sum, product) => {
      return sum + (product.price * product.CartItem.quantity);
    }, 0);

    res.status(200).json({
      success: true,
      data: {
        items: cart.Products,
        total
      }
    });
  } catch (error) {
    logger.error(`Get cart error: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching cart' 
    });
  }
};

exports.addToCart = async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;

    // Validate product
    const product = await Product.findByPk(productId);
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }

    // Check stock
    if (product.stock < quantity) {
      return res.status(400).json({ 
        success: false, 
        message: 'Insufficient stock' 
      });
    }

    // Find or create cart
    let cart = await Cart.findOne({ where: { userId: req.user.id } });
    if (!cart) {
      cart = await Cart.create({ userId: req.user.id });
    }

    // Check if product already in cart
    const existingItem = await CartItem.findOne({
      where: { cartId: cart.id, productId }
    });

    if (existingItem) {
      // Update quantity
      await existingItem.update({
        quantity: existingItem.quantity + quantity
      });
    } else {
      // Add new item
      await CartItem.create({
        cartId: cart.id,
        productId,
        quantity
      });
    }

    res.status(200).json({ 
      success: true, 
      message: 'Product added to cart' 
    });
  } catch (error) {
    logger.error(`Add to cart error: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error adding to cart' 
    });
  }
};

exports.updateCartItem = async (req, res) => {
  try {
    const { productId } = req.params;
    const { quantity } = req.body;

    // Validate product
    const product = await Product.findByPk(productId);
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }

    // Check stock
    if (product.stock < quantity) {
      return res.status(400).json({ 
        success: false, 
        message: 'Insufficient stock' 
      });
    }

    // Find cart
    const cart = await Cart.findOne({ where: { userId: req.user.id } });
    if (!cart) {
      return res.status(404).json({ 
        success: false, 
        message: 'Cart not found' 
      });
    }

    // Update item
    const [updated] = await CartItem.update(
      { quantity },
      { where: { cartId: cart.id, productId } }
    );

    if (!updated) {
      return res.status(404).json({ 
        success: false, 
        message: 'Item not found in cart' 
      });
    }

    res.status(200).json({ 
      success: true, 
      message: 'Cart updated' 
    });
  } catch (error) {
    logger.error(`Update cart error: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error updating cart' 
    });
  }
};

exports.removeFromCart = async (req, res) => {
  try {
    const { productId } = req.params;

    // Find cart
    const cart = await Cart.findOne({ where: { userId: req.user.id } });
    if (!cart) {
      return res.status(404).json({ 
        success: false, 
        message: 'Cart not found' 
      });
    }

    // Remove item
    await CartItem.destroy({
      where: { cartId: cart.id, productId }
    });

    res.status(200).json({ 
      success: true, 
      message: 'Item removed from cart' 
    });
  } catch (error) {
    logger.error(`Remove from cart error: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error removing from cart' 
    });
  }
};

exports.clearCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ where: { userId: req.user.id } });
    if (!cart) {
      return res.status(404).json({ 
        success: false, 
        message: 'Cart not found' 
      });
    }

    await CartItem.destroy({ where: { cartId: cart.id } });

    res.status(200).json({ 
      success: true, 
      message: 'Cart cleared' 
    });
  } catch (error) {
    logger.error(`Clear cart error: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error clearing cart' 
    });
  }
};