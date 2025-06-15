const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { ensureAuthenticated, ensureAdmin } = require('../middleware/authMiddleware');

// Admin dashboard
router.get('/dashboard', ensureAuthenticated, ensureAdmin, adminController.getDashboard);

// User management
router.get('/users', ensureAuthenticated, ensureAdmin, adminController.manageUsers);
router.put('/users/:id', ensureAuthenticated, ensureAdmin, adminController.updateUser);
router.delete('/users/:id', ensureAuthenticated, ensureAdmin, adminController.deleteUser);

// Product management
router.get('/products', ensureAuthenticated, ensureAdmin, adminController.manageProducts);
router.put('/products/:id/status', ensureAuthenticated, ensureAdmin, adminController.updateProductStatus);

// Category management
router.get('/categories', ensureAuthenticated, ensureAdmin, adminController.manageCategories);
router.post('/categories', ensureAuthenticated, ensureAdmin, adminController.createCategory);
router.put('/categories/:id', ensureAuthenticated, ensureAdmin, adminController.updateCategory);
router.delete('/categories/:id', ensureAuthenticated, ensureAdmin, adminController.deleteCategory);

// Order management
router.get('/orders', ensureAuthenticated, ensureAdmin, adminController.manageOrders);
router.put('/orders/:id/status', ensureAuthenticated, ensureAdmin, adminController.updateOrderStatus);

// Reports and analytics
router.get('/reports/sales', ensureAuthenticated, ensureAdmin, adminController.getSalesReport);
router.get('/reports/users', ensureAuthenticated, ensureAdmin, adminController.getUserReport);
router.get('/reports/products', ensureAuthenticated, ensureAdmin, adminController.getProductReport);

module.exports = router;