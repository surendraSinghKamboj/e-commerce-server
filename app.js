const express = require('express');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const exphbs = require('express-handlebars');
const helmet = require('helmet');
const morgan = require('morgan');
const cors = require('cors');
const flash = require('connect-flash');
const sequelize = require('./config/database');
const { errorHandler } = require('./utils/errorHandler');

require('dotenv').config();
require('./config/passport')(passport);

// Initialize Express
const app = express();

// Database sync
sequelize.sync({ alter: true })
  .then(() => console.log('Database connected'))
  .catch(err => console.error('Database connection error:', err));

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Passport
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

// View Engine
app.engine('hbs', exphbs({
  extname: '.hbs',
  defaultLayout: 'main',
  helpers: require('./utils/helpers')
}));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Global variables
app.use((req, res, next) => {
  res.locals.user = req.user || null;
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.error = req.flash('error');
  next();
});

// Routes
app.use('/', require('./routes/index'));
app.use('/auth', require('./routes/authRoutes'));
app.use('/products', require('./routes/productRoutes'));
app.use('/cart', require('./routes/cartRoutes'));
app.use('/orders', require('./routes/orderRoutes'));
app.use('/categories', require('./routes/categoryRoutes'));
app.use('/admin', require('./routes/adminRoutes'));
app.use('/vendor', require('./routes/vendorRoutes'));
app.use('/customer', require('./routes/customerRoutes'));

// Error handling
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;