const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/authMiddleware');

// Home page route
router.get('/', (req, res) => {
  res.render('index', { title: 'E-Commerce Home' });
});

// About page route
router.get('/about', (req, res) => {
  res.render('about', { title: 'About Us' });
});

// Contact page route
router.get('/contact', (req, res) => {
  res.render('contact', { title: 'Contact Us' });
});

// Products page route
router.get('/products', (req, res) => {
  res.redirect('/products/list');
});

// Protected profile route
router.get('/profile', ensureAuthenticated, (req, res) => {
  res.render('profile', { 
    title: 'My Profile',
    user: req.user 
  });
});

module.exports = router;