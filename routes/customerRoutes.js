const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { ensureAuthenticated, ensureCustomer } = require('../middleware/authMiddleware');

// Customer dashboard
router.get('/dashboard', ensureAuthenticated, ensureCustomer, customerController.getDashboard);

// Profile management
router.get('/profile', ensureAuthenticated, ensureCustomer, customerController.getProfile);
router.put('/profile', ensureAuthenticated, ensureCustomer, customerController.updateProfile);
router.put('/profile/password', ensureAuthenticated, ensureCustomer, customerController.updatePassword);
router.put('/profile/address', ensureAuthenticated, ensureCustomer, customerController.updateAddress);

// Order history
router.get('/orders', ensureAuthenticated, ensureCustomer, customerController.getOrderHistory);
router.get('/orders/:id', ensureAuthenticated, ensureCustomer, customerController.getOrderDetails);

// Wishlist
router.get('/wishlist', ensureAuthenticated, ensureCustomer, customerController.getWishlist);

// Payment methods
router.get('/payment-methods', ensureAuthenticated, ensureCustomer, customerController.getPaymentMethods);
router.post('/payment-methods', ensureAuthenticated, ensureCustomer, customerController.addPaymentMethod);
router.delete('/payment-methods/:id', ensureAuthenticated, ensureCustomer, customerController.removePaymentMethod);

module.exports = router;