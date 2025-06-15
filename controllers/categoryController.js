const { Category, Product } = require('../models');
const { logger } = require('../utils/logger');

exports.listCategories = async (req, res) => {
  try {
    const categories = await Category.findAll({
      order: [['name', 'ASC']],
      include: [{
        model: Category,
        as: 'parent',
        attributes: ['id', 'name']
      }]
    });

    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories
    });
  } catch (error) {
    logger.error(`List categories error: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching categories' 
    });
  }
};

exports.getCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findByPk(id, {
      include: [
        {
          model: Category,
          as: 'parent',
          attributes: ['id', 'name']
        },
        {
          model: Category,
          as: 'children',
          attributes: ['id', 'name']
        }
      ]
    });

    if (!category) {
      return res.status(404).json({ 
        success: false, 
        message: 'Category not found' 
      });
    }

    res.status(200).json({
      success: true,
      data: category
    });
  } catch (error) {
    logger.error(`Get category error: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching category' 
    });
  }
};

exports.createCategory = async (req, res) => {
  try {
    const { name, description, parentId } = req.body;

    const category = await Category.create({
      name,
      description,
      parentId: parentId || null
    });

    res.status(201).json({
      success: true,
      message: 'Category created',
      data: category
    });
  } catch (error) {
    logger.error(`Create category error: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error creating category' 
    });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, parentId } = req.body;

    const category = await Category.findByPk(id);
    if (!category) {
      return res.status(404).json({ 
        success: false, 
        message: 'Category not found' 
      });
    }

    // Prevent circular references
    if (parentId) {
      const parent = await Category.findByPk(parentId);
      if (!parent) {
        return res.status(400).json({ 
          success: false, 
          message: 'Parent category not found' 
        });
      }

      // Check if parent is a descendant of this category
      let current = parent;
      while (current.parentId) {
        if (current.parentId === parseInt(id)) {
          return res.status(400).json({ 
            success: false, 
            message: 'Circular reference detected' 
          });
        }
        current = await Category.findByPk(current.parentId);
      }
    }

    await category.update({
      name,
      description,
      parentId: parentId || null
    });

    res.status(200).json({
      success: true,
      message: 'Category updated',
      data: category
    });
  } catch (error) {
    logger.error(`Update category error: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error updating category' 
    });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findByPk(id);
    if (!category) {
      return res.status(404).json({ 
        success: false, 
        message: 'Category not found' 
      });
    }

    // Check for products in this category
    const productsCount = await Product.count({ where: { categoryId: id } });
    if (productsCount > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot delete category with products' 
      });
    }

    // Reassign children to parent
    const children = await Category.findAll({ where: { parentId: id } });
    for (const child of children) {
      await child.update({ parentId: category.parentId });
    }

    await category.destroy();

    res.status(200).json({
      success: true,
      message: 'Category deleted'
    });
  } catch (error) {
    logger.error(`Delete category error: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error deleting category' 
    });
  }
};

exports.getCategoryProducts = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const category = await Category.findByPk(id);
    if (!category) {
      return res.status(404).json({ 
        success: false, 
        message: 'Category not found' 
      });
    }

    // Get all descendant categories
    const categoryIds = [id];
    const getDescendants = async (parentId) => {
      const children = await Category.findAll({ where: { parentId } });
      for (const child of children) {
        categoryIds.push(child.id);
        await getDescendants(child.id);
      }
    };
    await getDescendants(id);

    // Paginate products
    const offset = (page - 1) * limit;
    const { count, rows: products } = await Product.findAndCountAll({
      where: { categoryId: categoryIds },
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
    logger.error(`Get category products error: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching category products' 
    });
  }
};