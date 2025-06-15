const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { ensureAuthenticated } = require('../middleware/authMiddleware');
const upload = require('../utils/upload');

// Public product routes
router.get('/list', productController.listProducts);
router.get('/search', productController.searchProducts);
router.get('/:id', productController.getProductDetails);

// Authenticated product routes
router.post('/:id/reviews', ensureAuthenticated, productController.addReview);
router.delete('/reviews/:id', ensureAuthenticated, productController.deleteReview);

// Vendor product management routes
router.get('/manage/list', ensureAuthenticated, productController.listVendorProducts);
router.post('/manage/create', ensureAuthenticated, upload.single('image'), productController.createProduct);
router.put('/manage/:id', ensureAuthenticated, upload.single('image'), productController.updateProduct);
router.delete('/manage/:id', ensureAuthenticated, productController.deleteProduct);

// Wishlist routes
router.post('/:id/wishlist', ensureAuthenticated, productController.addToWishlist);
router.delete('/:id/wishlist', ensureAuthenticated, productController.removeFromWishlist);
router.get('/wishlist/list', ensureAuthenticated, productController.getWishlist);

module.exports = router;