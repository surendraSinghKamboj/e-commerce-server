const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Category = sequelize.define('Category', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true
    },
    description: {
      type: DataTypes.TEXT
    },
    image: {
      type: DataTypes.STRING
    },
    slug: {
      type: DataTypes.STRING(100),
      unique: true
    },
    isFeatured: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }, {
    timestamps: true,
    paranoid: true,
    indexes: [
      {
        fields: ['name']
      },
      {
        fields: ['slug']
      }
    ]
  });

  Category.associate = (models) => {
    Category.hasMany(models.Product, {
      foreignKey: 'categoryId',
      as: 'products'
    });
    
    Category.belongsTo(models.Category, {
      foreignKey: 'parentId',
      as: 'parent'
    });
    
    Category.hasMany(models.Category, {
      foreignKey: 'parentId',
      as: 'children'
    });
  };

  return Category;
};