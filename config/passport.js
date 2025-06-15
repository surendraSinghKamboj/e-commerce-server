const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const JwtStrategy = require('passport-jwt').Strategy;
const { ExtractJwt } = require('passport-jwt');
const bcrypt = require('bcryptjs');
const { User } = require('../models');
const { logger } = require('../utils/logger');

// Local Strategy for username/password login
passport.use(
  new LocalStrategy(
    {
      usernameField: 'email',
      passwordField: 'password',
      session: false
    },
    async (email, password, done) => {
      try {
        // Find user by email
        const user = await User.findOne({ where: { email } });
        
        if (!user) {
          logger.warn(`Login attempt failed for non-existent email: ${email}`);
          return done(null, false, { message: 'Incorrect email or password.' });
        }

        // Check if account is active
        if (user.status !== 'active') {
          logger.warn(`Login attempt for ${email} with status: ${user.status}`);
          return done(null, false, { 
            message: `Account is ${user.status}. Please contact support.` 
          });
        }

        // Verify password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
          logger.warn(`Failed login attempt for user: ${email}`);
          return done(null, false, { message: 'Incorrect email or password.' });
        }

        // Check if email is verified (only for non-admin users)
        if (!user.isVerified && user.role !== 'admin') {
          logger.warn(`Unverified email attempt: ${email}`);
          return done(null, false, { 
            message: 'Please verify your email address before logging in.' 
          });
        }

        logger.info(`User logged in: ${email}`);
        return done(null, user);
      } catch (err) {
        logger.error(`Login error for ${email}: ${err.message}`);
        return done(err);
      }
    }
  )
);

// JWT Strategy for token authentication
const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromExtractors([
    ExtractJwt.fromAuthHeaderAsBearerToken(),
    ExtractJwt.fromUrlQueryParameter('token'),
    (req) => {
      let token = null;
      if (req && req.cookies) {
        token = req.cookies['jwt'];
      }
      return token;
    }
  ]),
  secretOrKey: process.env.JWT_SECRET,
  issuer: process.env.JWT_ISSUER || 'ecommerce-api',
  audience: process.env.JWT_AUDIENCE || 'ecommerce-client'
};

passport.use(
  new JwtStrategy(jwtOptions, async (payload, done) => {
    try {
      // Find user by ID from token payload
      const user = await User.findByPk(payload.id);
      
      if (!user) {
        logger.warn(`JWT authentication failed - user not found: ${payload.id}`);
        return done(null, false);
      }

      // Check if account is active
      if (user.status !== 'active') {
        logger.warn(`JWT authentication for inactive user: ${user.email}`);
        return done(null, false, { 
          message: `Account is ${user.status}. Please contact support.` 
        });
      }

      logger.debug(`JWT authentication successful for user: ${user.email}`);
      return done(null, user);
    } catch (err) {
      logger.error(`JWT authentication error: ${err.message}`);
      return done(err, false);
    }
  })
);

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findByPk(id, {
      attributes: { exclude: ['password'] }
    });
    done(null, user);
  } catch (err) {
    done(err);
  }
});

// Custom middleware for role-based access
const roleMiddleware = (roles) => (req, res, next) => {
  if (!req.user) {
    logger.warn('Role check failed - no user authenticated');
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (!roles.includes(req.user.role)) {
    logger.warn(`Role check failed for ${req.user.email} - required: ${roles}, has: ${req.user.role}`);
    return res.status(403).json({ message: 'Forbidden - insufficient privileges' });
  }

  next();
};

// Helper function to generate JWT token
const generateToken = (user) => {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role
  };

  const options = {
    expiresIn: process.env.JWT_EXPIRE || '1h',
    issuer: jwtOptions.issuer,
    audience: jwtOptions.audience
  };

  return jwt.sign(payload, jwtOptions.secretOrKey, options);
};

module.exports = {
  initialize: () => passport.initialize(),
  session: () => passport.session(),
  authenticateLocal: passport.authenticate('local', { session: false }),
  authenticateJWT: passport.authenticate('jwt', { session: false }),
  roleMiddleware,
  generateToken
};