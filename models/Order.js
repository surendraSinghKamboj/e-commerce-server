const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Order = sequelize.define('Order', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    totalAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    shippingAddress: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    billingAddress: {
      type: DataTypes.TEXT
    },
    paymentStatus: {
      type: DataTypes.ENUM('pending', 'completed', 'failed', 'refunded'),
      defaultValue: 'pending'
    },
    paymentMethod: {
      type: DataTypes.ENUM('credit_card', 'paypal', 'bank_transfer', 'cod')
    },
    status: {
      type: DataTypes.ENUM(
        'pending', 
        'processing', 
        'shipped', 
        'delivered', 
        'canceled', 
        'returned'
      ),
      defaultValue: 'pending'
    },
    trackingNumber: {
      type: DataTypes.STRING(50)
    },
    trackingUrl: {
      type: DataTypes.STRING
    },
    notes: {
      type: DataTypes.TEXT
    },
    returnRequested: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    returnReason: {
      type: DataTypes.TEXT
    },
    returnStatus: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected'),
      defaultValue: 'pending'
    }
  }, {
    timestamps: true,
    paranoid: true,
    indexes: [
      {
        fields: ['userId']
      },
      {
        fields: ['status']
      },
      {
        fields: ['paymentStatus']
      }
    ]
  });

  Order.associate = (models) => {
    Order.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user'
    });
    
    Order.belongsTo(models.PaymentMethod, {
      foreignKey: 'paymentMethodId',
      as: 'paymentMethod'
    });
    
    Order.belongsToMany(models.Product, {
      through: 'OrderItem',
      as: 'products',
      foreignKey: 'orderId',
      otherKey: 'productId'
    });
    
    Order.hasMany(models.Payment, {
      foreignKey: 'orderId',
      as: 'payments'
    });
  };

  return Order;
};