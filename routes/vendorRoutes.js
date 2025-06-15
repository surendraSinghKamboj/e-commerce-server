const express = require('express');
const router = express.Router();
const vendorController = require('../controllers/vendorController');
const { ensureAuthenticated, ensureVendor } = require('../middleware/authMiddleware');
const upload = require('../utils/upload');

// Vendor dashboard
router.get('/dashboard', ensureAuthenticated, ensureVendor, vendorController.getDashboard);

// Product management
router.get('/products', ensureAuthenticated, ensureVendor, vendorController.getProducts);
router.post('/products', ensureAuthenticated, ensureVendor, upload.array('images', 5), vendorController.createProduct);
router.put('/products/:id', ensureAuthenticated, ensureVendor, upload.array('images', 5), vendorController.updateProduct);
router.delete('/products/:id', ensureAuthenticated, ensureVendor, vendorController.deleteProduct);

// Order management
router.get('/orders', ensureAuthenticated, ensureVendor, vendorController.getOrders);
router.put('/orders/:id/status', ensureAuthenticated, ensureVendor, vendorController.updateOrderStatus);

// Sales reports
router.get('/reports/sales', ensureAuthenticated, ensureVendor, vendorController.getSalesReport);
router.get('/reports/products', ensureAuthenticated, ensureVendor, vendorController.getProductPerformanceReport);

// Vendor profile
router.get('/profile', ensureAuthenticated, ensureVendor, vendorController.getProfile);
router.put('/profile', ensureAuthenticated, ensureVendor, vendorController.updateProfile);
router.put('/profile/bank', ensureAuthenticated, ensureVendor, vendorController.updateBankDetails);

// Inventory management
router.get('/inventory', ensureAuthenticated, ensureVendor, vendorController.getInventory);
router.post('/inventory/update', ensureAuthenticated, ensureVendor, vendorController.bulkUpdateInventory);

module.exports = router;