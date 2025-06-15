const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { generateToken, verifyToken } = require('../utils/tokenUtils');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/emailService');
const { logger } = require('../utils/logger');

exports.register = async (req, res) => {
  try {
    const { username, email, password, firstName, lastName, role = 'customer' } = req.body;

    // Validate role
    if (role === 'admin' && !req.user?.isAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized to create admin accounts' 
      });
    }

    // Check for existing user
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email already in use' 
      });
    }

    // Create user
    const user = await User.create({
      username,
      email,
      password,
      firstName,
      lastName,
      role
    });

    // Generate verification token
    const token = generateToken(user.id, '1h', 'email_verification');

    // Send verification email
    await sendVerificationEmail(user.email, token);

    // Respond without sensitive data
    const userData = user.get({ plain: true });
    delete userData.password;

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please check your email to verify your account.',
      data: userData
    });
  } catch (error) {
    logger.error(`Registration error: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error during registration' 
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    // Check if account is active
    if (user.status !== 'active') {
      return res.status(403).json({ 
        success: false, 
        message: `Account is ${user.status}` 
      });
    }

    // Check if email is verified (except for admins)
    if (!user.isVerified && user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Please verify your email first' 
      });
    }

    // Generate tokens
    const accessToken = generateToken(user.id, '15m');
    const refreshToken = generateToken(user.id, '7d');

    // Update last login
    await user.update({ lastLogin: new Date() });

    // Respond with user data (excluding password)
    const userData = user.get({ plain: true });
    delete userData.password;

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: userData,
        tokens: {
          accessToken,
          refreshToken
        }
      }
    });
  } catch (error) {
    logger.error(`Login error: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error during login' 
    });
  }
};

exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;
    const decoded = verifyToken(token, 'email_verification');

    const user = await User.findByPk(decoded.id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    if (user.isVerified) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email already verified' 
      });
    }

    await user.update({ isVerified: true });

    res.status(200).json({ 
      success: true, 
      message: 'Email verified successfully' 
    });
  } catch (error) {
    logger.error(`Email verification error: ${error.message}`);
    res.status(400).json({ 
      success: false, 
      message: 'Invalid or expired token' 
    });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'If this email exists, a reset link has been sent' 
      });
    }

    // Generate reset token
    const token = generateToken(user.id, '1h', 'password_reset');

    // Send reset email
    await sendPasswordResetEmail(user.email, token);

    res.status(200).json({ 
      success: true, 
      message: 'Password reset link sent to your email' 
    });
  } catch (error) {
    logger.error(`Forgot password error: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error processing request' 
    });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const decoded = verifyToken(token, 'password_reset');

    const user = await User.findByPk(decoded.id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.status(200).json({ 
      success: true, 
      message: 'Password reset successfully' 
    });
  } catch (error) {
    logger.error(`Password reset error: ${error.message}`);
    res.status(400).json({ 
      success: false, 
      message: 'Invalid or expired token' 
    });
  }
};

exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const decoded = verifyToken(refreshToken);

    const user = await User.findByPk(decoded.id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Generate new access token
    const accessToken = generateToken(user.id, '15m');

    res.status(200).json({
      success: true,
      data: {
        accessToken
      }
    });
  } catch (error) {
    logger.error(`Token refresh error: ${error.message}`);
    res.status(401).json({ 
      success: false, 
      message: 'Invalid or expired token' 
    });
  }
};