const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const { ensureAuthenticated } = require('../middleware/authMiddleware');

// Cart management
router.get('/', ensureAuthenticated, cartController.getCart);
router.post('/add', ensureAuthenticated, cartController.addToCart);
router.put('/update/:productId', ensureAuthenticated, cartController.updateCartItem);
router.delete('/remove/:productId', ensureAuthenticated, cartController.removeFromCart);
router.post('/clear', ensureAuthenticated, cartController.clearCart);

// Checkout process
router.get('/checkout', ensureAuthenticated, cartController.showCheckout);
router.post('/checkout', ensureAuthenticated, cartController.processCheckout);
router.get('/checkout/success', ensureAuthenticated, cartController.checkoutSuccess);
router.get('/checkout/cancel', ensureAuthenticated, cartController.checkoutCancel);

module.exports = router;