const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Cart = sequelize.define('Cart', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    sessionId: {
      type: DataTypes.STRING
    },
    expiresAt: {
      type: DataTypes.DATE
    }
  }, {
    timestamps: true,
    paranoid: true
  });

  Cart.associate = (models) => {
    Cart.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user'
    });
    
    Cart.belongsToMany(models.Product, {
      through: 'CartItem',
      as: 'products',
      foreignKey: 'cartId',
      otherKey: 'productId'
    });
  };

  return Cart;
};