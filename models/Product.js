const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Product = sequelize.define('Product', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0.01
      }
    },
    stock: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    image: {
      type: DataTypes.STRING
    },
    additionalImages: {
      type: DataTypes.JSON,
      defaultValue: []
    },
    averageRating: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
      validate: {
        min: 0,
        max: 5
      }
    },
    reviewCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'out_of_stock'),
      defaultValue: 'active'
    },
    sku: {
      type: DataTypes.STRING(50),
      unique: true
    },
    weight: {
      type: DataTypes.DECIMAL(6, 2),
      comment: 'Weight in grams'
    },
    dimensions: {
      type: DataTypes.STRING,
      comment: 'Format: "LxWxH" in cm'
    }
  }, {
    timestamps: true,
    paranoid: true,
    indexes: [
      {
        fields: ['name']
      },
      {
        fields: ['price']
      },
      {
        fields: ['averageRating']
      }
    ]
  });

  Product.associate = (models) => {
    Product.belongsTo(models.Category, {
      foreignKey: 'categoryId',
      as: 'category'
    });
    
    Product.belongsTo(models.User, {
      foreignKey: 'vendorId',
      as: 'vendor'
    });
    
    Product.hasMany(models.Review, {
      foreignKey: 'productId',
      as: 'reviews'
    });
    
    Product.belongsToMany(models.User, {
      through: 'ProductWishlist',
      as: 'wishlistedBy',
      foreignKey: 'productId',
      otherKey: 'userId'
    });
    
    Product.belongsToMany(models.Cart, {
      through: 'CartItem',
      as: 'carts',
      foreignKey: 'productId',
      otherKey: 'cartId'
    });
    
    Product.belongsToMany(models.Order, {
      through: 'OrderItem',
      as: 'orders',
      foreignKey: 'productId',
      otherKey: 'orderId'
    });
  };

  return Product;
};