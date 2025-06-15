const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { ensureAuthenticated } = require('../middleware/authMiddleware');

// Customer order routes
router.get('/', ensureAuthenticated, orderController.listOrders);
router.get('/:id', ensureAuthenticated, orderController.getOrderDetails);
router.post('/:id/cancel', ensureAuthenticated, orderController.cancelOrder);
router.post('/:id/return', ensureAuthenticated, orderController.requestReturn);

// Payment routes
router.get('/:id/payment', ensureAuthenticated, orderController.showPayment);
router.post('/:id/payment', ensureAuthenticated, orderController.processPayment);

// Vendor order management
router.get('/vendor/list', ensureAuthenticated, orderController.listVendorOrders);
router.put('/vendor/:id/status', ensureAuthenticated, orderController.updateVendorOrderStatus);

// Tracking
router.get('/:id/track', ensureAuthenticated, orderController.trackOrder);

module.exports = router;