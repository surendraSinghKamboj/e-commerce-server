const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');

// Public category routes
router.get('/', categoryController.listCategories);
router.get('/:id', categoryController.getCategoryProducts);

// Admin category management routes (protected)
router.post('/', 
  ensureAuthenticated, 
  ensureAdmin, 
  upload.single('image'), 
  categoryController.createCategory
);

router.put('/:id', 
  ensureAuthenticated, 
  ensureAdmin, 
  upload.single('image'), 
  categoryController.updateCategory
);

router.delete('/:id', 
  ensureAuthenticated, 
  ensureAdmin, 
  categoryController.deleteCategory
);

module.exports = router;