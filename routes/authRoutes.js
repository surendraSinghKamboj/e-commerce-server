const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { forwardAuthenticated } = require('../middleware/authMiddleware');

// Login routes
router.get('/login', forwardAuthenticated, authController.showLoginForm);
router.post('/login', authController.login);

// Register routes
router.get('/register', forwardAuthenticated, authController.showRegisterForm);
router.post('/register', authController.register);

// Email verification
router.get('/verify/:token', authController.verifyEmail);
router.get('/resend-verification', ensureAuthenticated, authController.resendVerification);

// Password reset routes
router.get('/forgot-password', forwardAuthenticated, authController.showForgotPasswordForm);
router.post('/forgot-password', authController.forgotPassword);
router.get('/reset-password/:token', forwardAuthenticated, authController.showResetPasswordForm);
router.post('/reset-password', authController.resetPassword);

// Logout route
router.get('/logout', authController.logout);

module.exports = router;