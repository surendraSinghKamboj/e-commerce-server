const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    username: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      validate: {
        len: [3, 50]
      }
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        len: [6, 100]
      }
    },
    firstName: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    lastName: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    phone: {
      type: DataTypes.STRING(20)
    },
    address: {
      type: DataTypes.TEXT
    },
    role: {
      type: DataTypes.ENUM('customer', 'vendor', 'admin', 'moderator'),
      defaultValue: 'customer'
    },
    isVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    profileImage: {
      type: DataTypes.STRING
    },
    lastLogin: {
      type: DataTypes.DATE
    },
    status: {
      type: DataTypes.ENUM('active', 'suspended', 'banned'),
      defaultValue: 'active'
    },
    // Vendor-specific fields
    storeName: {
      type: DataTypes.STRING(100),
      unique: true
    },
    description: {
      type: DataTypes.TEXT
    },
    logo: {
      type: DataTypes.STRING
    },
    contactEmail: {
      type: DataTypes.STRING(100),
      validate: {
        isEmail: true
      }
    },
    // Stripe account ID for vendors
    stripeAccountId: {
      type: DataTypes.STRING
    }
  }, {
    timestamps: true,
    paranoid: true, // Enable soft deletes
    hooks: {
      beforeSave: async (user) => {
        if (user.changed('password')) {
          user.password = await bcrypt.hash(user.password, 10);
        }
      }
    },
    defaultScope: {
      attributes: { exclude: ['password'] }
    },
    scopes: {
      withPassword: {
        attributes: {}
      }
    }
  });

  // Instance methods
  User.prototype.comparePassword = async function(password) {
    return await bcrypt.compare(password, this.password);
  };

  // Class methods
  User.associate = (models) => {
    User.hasMany(models.Product, {
      foreignKey: 'vendorId',
      as: 'products'
    });
    
    User.hasMany(models.Order, {
      foreignKey: 'userId',
      as: 'orders'
    });
    
    User.hasMany(models.Review, {
      foreignKey: 'userId',
      as: 'reviews'
    });
    
    User.hasOne(models.Cart, {
      foreignKey: 'userId',
      as: 'cart'
    });
    
    User.belongsToMany(models.Product, {
      through: 'ProductWishlist',
      as: 'wishlist',
      foreignKey: 'userId',
      otherKey: 'productId'
    });
    
    User.hasMany(models.PaymentMethod, {
      foreignKey: 'userId',
      as: 'paymentMethods'
    });
  };

  return User;
};