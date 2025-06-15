const { Product, Category, User, Review } = require('../models');
const { uploadImage, deleteImage } = require('../services/storageService');
const { logger } = require('../utils/logger');

exports.listProducts = async (req, res) => {
  try {
    const { page = 1, limit = 10, category, search, sort, minPrice, maxPrice } = req.query;
    const offset = (page - 1) * limit;

    let where = {};
    let order = [['createdAt', 'DESC']];

    // Filter by category
    if (category) {
      where.categoryId = category;
    }

    // Search by name or description
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ];
    }

    // Price range filter
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price[Op.gte] = minPrice;
      if (maxPrice) where.price[Op.lte] = maxPrice;
    }

    // Sorting
    if (sort) {
      switch (sort) {
        case 'price_asc':
          order = [['price', 'ASC']];
          break;
        case 'price_desc':
          order = [['price', 'DESC']];
          break;
        case 'rating':
          order = [['averageRating', 'DESC']];
          break;
        case 'newest':
          order = [['createdAt', 'DESC']];
          break;
      }
    }

    const { count, rows: products } = await Product.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order,
      include: [
        {
          model: Category,
          attributes: ['id', 'name']
        },
        {
          model: User,
          as: 'vendor',
          attributes: ['id', 'username']
        }
      ]
    });

    res.status(200).json({
      success: true,
      count,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      data: products
    });
  } catch (error) {
    logger.error(`List products error: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching products' 
    });
  }
};

exports.getProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findByPk(id, {
      include: [
        {
          model: Category,
          attributes: ['id', 'name']
        },
        {
          model: User,
          as: 'vendor',
          attributes: ['id', 'username']
        },
        {
          model: Review,
          include: [{
            model: User,
            attributes: ['id', 'username']
          }]
        }
      ]
    });

    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }

    res.status(200).json({
      success: true,
      data: product
    });
  } catch (error) {
    logger.error(`Get product error: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching product' 
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
    if (req.file) {
      imageUrl = await uploadImage(req.file);
    }

    const product = await Product.create({
      name,
      description,
      price,
      stock,
      image: imageUrl,
      categoryId,
      vendorId
    });

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
    const { name, description, price, stock, categoryId } = req.body;

    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }

    // Check if user is authorized to update this product
    if (product.vendorId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized to update this product' 
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
    if (req.file) {
      // Delete old image if exists
      if (imageUrl) {
        await deleteImage(imageUrl);
      }
      imageUrl = await uploadImage(req.file);
    }

    await product.update({
      name: name || product.name,
      description: description || product.description,
      price: price || product.price,
      stock: stock || product.stock,
      categoryId: categoryId || product.categoryId,
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

exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }

    // Check if user is authorized to delete this product
    if (product.vendorId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized to delete this product' 
      });
    }

    // Check if product has orders
    const hasOrders = await Order.count({
      include: [{
        model: Product,
        where: { id: product.id }
      }]
    });

    if (hasOrders > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot delete product with existing orders' 
      });
    }

    // Delete product image if exists
    if (product.image) {
      await deleteImage(product.image);
    }

    await product.destroy();

    res.status(200).json({ 
      success: true, 
      message: 'Product deleted' 
    });
  } catch (error) {
    logger.error(`Delete product error: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error deleting product' 
    });
  }
};

exports.getProductReviews = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }

    const { count, rows: reviews } = await Review.findAndCountAll({
      where: { productId: id },
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']],
      include: [{
        model: User,
        attributes: ['id', 'username']
      }]
    });

    res.status(200).json({
      success: true,
      count,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      data: reviews
    });
  } catch (error) {
    logger.error(`Get product reviews error: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching product reviews' 
    });
  }
};

exports.addProductToWishlist = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }

    // Check if already in wishlist
    const existing = await product.hasWishlistedBy(req.user.id);
    if (existing) {
      return res.status(400).json({ 
        success: false, 
        message: 'Product already in wishlist' 
      });
    }

    await product.addWishlistedBy(req.user.id);

    res.status(200).json({ 
      success: true, 
      message: 'Product added to wishlist' 
    });
  } catch (error) {
    logger.error(`Add to wishlist error: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error adding to wishlist' 
    });
  }
};

exports.removeProductFromWishlist = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }

    // Check if in wishlist
    const existing = await product.hasWishlistedBy(req.user.id);
    if (!existing) {
      return res.status(400).json({ 
        success: false, 
        message: 'Product not in wishlist' 
      });
    }

    await product.removeWishlistedBy(req.user.id);

    res.status(200).json({ 
      success: true, 
      message: 'Product removed from wishlist' 
    });
  } catch (error) {
    logger.error(`Remove from wishlist error: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error removing from wishlist' 
    });
  }
};

exports.getWishlist = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const { count, rows: products } = await Product.findAndCountAll({
      include: [{
        model: User,
        as: 'wishlistedBy',
        where: { id: req.user.id },
        attributes: []
      }],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json({
      success: true,
      count,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      data: products
    });
  } catch (error) {
    logger.error(`Get wishlist error: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching wishlist' 
    });
  }
};