const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const process = require('process');
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/../config/database.js')[env];
const db = {};

let sequelize;
if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
  sequelize = new Sequelize(config.database, config.username, config.password, config);
}

// Load all models
fs.readdirSync(__dirname)
  .filter(file => {
    return (
      file.indexOf('.') !== 0 &&
      file !== basename &&
      file.slice(-3) === '.js' &&
      file.indexOf('.test.js') === -1
    );
  })
  .forEach(file => {
    const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
    db[model.name] = model;
  });

// Setup associations
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

// Junction tables
db.CartItem = sequelize.define('CartItem', {
  quantity: {
    type: Sequelize.INTEGER,
    defaultValue: 1,
    validate: {
      min: 1
    }
  }
});

db.OrderItem = sequelize.define('OrderItem', {
  quantity: {
    type: Sequelize.INTEGER,
    allowNull: false,
    validate: {
      min: 1
    }
  },
  price: {
    type: Sequelize.DECIMAL(10, 2),
    allowNull: false
  }
});

db.ProductWishlist = sequelize.define('ProductWishlist', {});

// PaymentMethod model
db.PaymentMethod = sequelize.define('PaymentMethod', {
  type: {
    type: Sequelize.ENUM('credit_card', 'paypal', 'bank_account'),
    allowNull: false
  },
  isDefault: {
    type: Sequelize.BOOLEAN,
    defaultValue: false
  },
  details: {
    type: Sequelize.JSON,
    allowNull: false
  }
});

// Payment model
db.Payment = sequelize.define('Payment', {
  amount: {
    type: Sequelize.DECIMAL(10, 2),
    allowNull: false
  },
  transactionId: {
    type: Sequelize.STRING
  },
  status: {
    type: Sequelize.ENUM('pending', 'completed', 'failed', 'refunded'),
    defaultValue: 'pending'
  },
  paymentMethod: {
    type: Sequelize.ENUM('credit_card', 'paypal', 'bank_transfer', 'cod')
  },
  paymentDetails: {
    type: Sequelize.JSON
  }
});

// Review model
db.Review = sequelize.define('Review', {
  rating: {
    type: Sequelize.INTEGER,
    allowNull: false,
    validate: {
      min: 1,
      max: 5
    }
  },
  comment: {
    type: Sequelize.TEXT
  }
});

module.exports = db;