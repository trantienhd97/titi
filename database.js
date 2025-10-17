const { Sequelize, DataTypes } = require('sequelize');

class Database {
  constructor() {
    this.sequelize = null;
    this.models = {};
    this.isConnected = false;
  }

  /**
   * Kết nối đến cơ sở dữ liệu SQL Server
   * @param {Object} config - Cấu hình kết nối
   * @param {string} config.server - Tên server
   * @param {string} config.database - Tên cơ sở dữ liệu
   * @param {string} config.username - Tên đăng nhập
   * @param {string} config.password - Mật khẩu
   * @returns {Promise<boolean>} - Kết quả kết nối
   */
  async connect(config) {
    try {
      // Kết nối đến master để có thể tạo database mới nếu cần
      const masterSequelize = new Sequelize('master', config.username, config.password, {
        host: config.server,
        dialect: 'mssql',
        dialectOptions: {
          options: {
            encrypt: true,
            trustServerCertificate: true,
          }
        },
        logging: false
      });
      
      // Kiểm tra kết nối
      await masterSequelize.authenticate();
      console.log('Kết nối đến SQL Server thành công.');
      
      // Tạo cơ sở dữ liệu nếu chưa tồn tại
      await this.createDatabaseIfNotExists(masterSequelize, config.database);
      
      // Đóng kết nối đến master
      await masterSequelize.close();
      
      // Kết nối đến cơ sở dữ liệu của ứng dụng
      this.sequelize = new Sequelize(config.database, config.username, config.password, {
        host: config.server,
        dialect: 'mssql',
        dialectOptions: {
          options: {
            encrypt: true,
            trustServerCertificate: true,
          }
        },
        logging: false
      });
      
      // Xác thực kết nối
      await this.sequelize.authenticate();
      console.log(`Kết nối đến cơ sở dữ liệu ${config.database} thành công.`);
      
      // Định nghĩa các model
      this.defineModels();
      
      // Đồng bộ hóa các model với cơ sở dữ liệu
      await this.sequelize.sync({ alter: true });
      console.log('Đồng bộ hóa các bảng thành công.');
      
      // Initialize database (create tables if not exist)
      await this.initializeDatabase();

      this.isConnected = true;
      return true;
    } catch (error) {
      console.error('Không thể kết nối đến cơ sở dữ liệu:', error);
      this.isConnected = false;
      return false;
    }
  }
  
  /**
   * Tạo cơ sở dữ liệu nếu chưa tồn tại
   * @param {Sequelize} sequelize - Đối tượng Sequelize đã kết nối đến master
   * @param {string} dbName - Tên cơ sở dữ liệu cần tạo
   */
  async createDatabaseIfNotExists(sequelize, dbName) {
    try {
      // Kiểm tra xem cơ sở dữ liệu đã tồn tại chưa
      const [results] = await sequelize.query(
        `SELECT name FROM sys.databases WHERE name = '${dbName}'`
      );
      
      if (results.length === 0) {
        console.log(`Cơ sở dữ liệu ${dbName} chưa tồn tại. Đang tạo...`);
        await sequelize.query(`CREATE DATABASE [${dbName}]`);
        console.log(`Đã tạo cơ sở dữ liệu ${dbName} thành công.`);
      } else {
        console.log(`Cơ sở dữ liệu ${dbName} đã tồn tại.`);
      }
    } catch (error) {
      console.error('Lỗi khi tạo cơ sở dữ liệu:', error);
      throw error;
    }
  }
  
  /**
   * Định nghĩa các model trong cơ sở dữ liệu
   */
  defineModels() {
    // Định nghĩa model User
    this.models.User = this.sequelize.define('User', {
      username: {
        type: DataTypes.STRING(50),
        primaryKey: true,
        allowNull: false
      },
      password: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      fullName: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      }
    }, {
      tableName: 'Users',
      timestamps: false
    });
  }

  /**
   * Đóng kết nối đến cơ sở dữ liệu
   */
  async disconnect() {
    if (this.sequelize) {
      await this.sequelize.close();
      this.isConnected = false;
      console.log('Đã ngắt kết nối với cơ sở dữ liệu.');
    }
  }

  /**
   * Xác thực thông tin đăng nhập
   * @param {string} username - Tên đăng nhập
   * @param {string} password - Mật khẩu
   * @returns {Promise<Object>} - Kết quả xác thực
   */
  async authenticate(username, password) {
    try {
      const bcrypt = require('bcrypt');
      
      // Tìm user theo username
      const user = await this.models.User.findOne({
        where: { username }
      });
      
      if (!user) {
        return { success: false, message: 'Tên đăng nhập hoặc mật khẩu không đúng' };
      }
      
      // So sánh mật khẩu sử dụng bcrypt
      const isPasswordValid = await bcrypt.compare(password, user.password);
      
      if (isPasswordValid) {
        return { 
          success: true, 
          user: { 
            username: user.username, 
            fullName: user.fullName 
          } 
        };
      }
      
      return { success: false, message: 'Tên đăng nhập hoặc mật khẩu không đúng' };
    } catch (error) {
      console.error('Lỗi xác thực:', error);
      return { success: false, message: 'Có lỗi xảy ra khi xác thực' };
    }
  }
  
  /**
   * Tạo người dùng mới
   * @param {string} username - Tên đăng nhập
   * @param {string} password - Mật khẩu
   * @param {string} fullName - Họ tên đầy đủ
   * @returns {Promise<Object>} - Kết quả tạo người dùng
   */
  async createUser(username, password, fullName) {
    try {
      // Kiểm tra xem người dùng đã tồn tại chưa
      const existingUser = await this.models.User.findOne({
        where: { username }
      });
      
      if (existingUser) {
        return { success: false, message: 'Tên đăng nhập đã tồn tại' };
      }
      
      // Tạo người dùng mới
      await this.models.User.create({
        username,
        password,
        fullName,
        createdAt: new Date()
      });
      
      return { success: true, message: 'Tạo tài khoản thành công' };
    } catch (error) {
      console.error('Lỗi khi tạo người dùng:', error);
      return { success: false, message: 'Có lỗi xảy ra khi tạo tài khoản' };
    }
  }
  
  /**
   * Lấy danh sách tất cả người dùng
   * @returns {Promise<Array>} - Danh sách người dùng
   */
  async getAllUsers() {
    try {
      const users = await this.models.User.findAll({
        attributes: ['username', 'fullName', 'createdAt']
      });
      
      return users.map(user => ({
        username: user.username,
        fullName: user.fullName,
        createdAt: user.createdAt
      }));
    } catch (error) {
      console.error('Lỗi khi lấy danh sách người dùng:', error);
      return [];
    }
  }

  /**
   * Lấy danh sách tất cả bảng trong cơ sở dữ liệu
   * @returns {Promise<Array>} - Danh sách tên các bảng
   */
  async getAllTables() {
    try {
      if (!this.isConnected) {
        return { success: false, message: 'Không có kết nối đến cơ sở dữ liệu.' };
      }
      
      // Truy vấn lấy danh sách các bảng
      const [results] = await this.sequelize.query(`
        SELECT 
          t.name AS tableName,
          SCHEMA_NAME(t.schema_id) AS schemaName
        FROM 
          sys.tables t
        ORDER BY 
          t.name;
      `);
      
      return { success: true, tables: results };
    } catch (error) {
      console.error('Lỗi khi lấy danh sách bảng:', error);
      return { success: false, message: 'Có lỗi xảy ra khi lấy danh sách bảng.' };
    }
  }

  /**
   * Lấy thông tin cấu trúc của một bảng
   * @param {string} tableName - Tên bảng
   * @returns {Promise<Object>} - Thông tin về cấu trúc bảng
   */
  async getTableStructure(tableName) {
    try {
      if (!this.isConnected) {
        return { success: false, message: 'Không có kết nối đến cơ sở dữ liệu.' };
      }
      
      // Truy vấn lấy thông tin về các cột của bảng
      const [columns] = await this.sequelize.query(`
        SELECT 
          c.name AS columnName,
          t.name AS dataType,
          c.max_length AS maxLength,
          c.precision AS precision,
          c.scale AS scale,
          c.is_nullable AS isNullable,
          CASE WHEN pk.column_id IS NOT NULL THEN 1 ELSE 0 END AS isPrimaryKey
        FROM 
          sys.columns c
        INNER JOIN 
          sys.types t ON c.user_type_id = t.user_type_id
        LEFT JOIN 
          (SELECT i.object_id, ic.column_id
           FROM sys.indexes i
           INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
           WHERE i.is_primary_key = 1) pk 
        ON c.object_id = pk.object_id AND c.column_id = pk.column_id
        WHERE 
          c.object_id = OBJECT_ID(N'${tableName}')
        ORDER BY 
          c.column_id;
      `);
      
      return { success: true, columns };
    } catch (error) {
      console.error(`Lỗi khi lấy cấu trúc bảng ${tableName}:`, error);
      return { success: false, message: `Có lỗi xảy ra khi lấy cấu trúc bảng ${tableName}.` };
    }
  }

  /**
   * Thêm sản phẩm vào cơ sở dữ liệu
   * @param {Object} product - Thông tin sản phẩm
   */
  async addProductToDatabase(product) {
    // Tính toán lại các trường số lượng
    let importedQuantity = parseInt(product.importedQuantity) || 0;
    let soldQuantity = parseInt(product.soldQuantity) || 0;
    let remainingQuantity = parseInt(product.remainingQuantity) || 0;
    // Ưu tiên: nếu nhập importedQuantity và soldQuantity, tính remainingQuantity
    if (!isNaN(importedQuantity) && !isNaN(soldQuantity)) {
        remainingQuantity = importedQuantity - soldQuantity;
    } else if (!isNaN(importedQuantity) && !isNaN(remainingQuantity)) {
        soldQuantity = importedQuantity - remainingQuantity;
    } else if (!isNaN(soldQuantity) && !isNaN(remainingQuantity)) {
        importedQuantity = soldQuantity + remainingQuantity;
    }

    const query = `INSERT INTO Products (id, name, code, autoCode, importPrice, salePrice, discountPercent, discountAmount, thumbnail, productImages, description, importedQuantity, soldQuantity, remainingQuantity) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const params = [
        product.id,
        product.name,
        product.code,
        product.autoCode,
        product.importPrice,
        product.salePrice,
        product.discountPercent,
        product.discountAmount,
        product.thumbnail,
        JSON.stringify(product.productImages),
        product.description || null,
        importedQuantity,
        soldQuantity,
        remainingQuantity
    ];
    try {
        console.log('Executing query:', query);
        console.log('With parameters:', params);
        await this.sequelize.query(query, { replacements: params });
        console.log('Product added to database successfully');
    } catch (error) {
        console.error('Error adding product to database:', error);
        throw new Error(`Failed to add product: ${error.message}`);
    }
  }

  /**
   * Cập nhật sản phẩm trong cơ sở dữ liệu
   * @param {Object} product - Thông tin sản phẩm
   */
  async updateProductInDatabase(product) {
    try {
      // Kiểm tra xem sản phẩm có ID không
      if (!product.id) {
        throw new Error('Product ID is required for update');
      }

      // Tính toán lại các trường số lượng
      let importedQuantity = parseInt(product.importedQuantity) || 0;
      let soldQuantity = parseInt(product.soldQuantity) || 0;
      let remainingQuantity = parseInt(product.remainingQuantity) || 0;
      
      // Ưu tiên: nếu nhập importedQuantity và soldQuantity, tính remainingQuantity
      if (!isNaN(importedQuantity) && !isNaN(soldQuantity)) {
          remainingQuantity = importedQuantity - soldQuantity;
      } else if (!isNaN(importedQuantity) && !isNaN(remainingQuantity)) {
          soldQuantity = importedQuantity - remainingQuantity;
      } else if (!isNaN(soldQuantity) && !isNaN(remainingQuantity)) {
          importedQuantity = soldQuantity + remainingQuantity;
      }

      // Chuẩn bị dữ liệu an toàn
      const params = [
          product.name || '',
          product.code || '',
          parseFloat(product.importPrice) || 0,
          parseFloat(product.salePrice) || 0,
          parseFloat(product.discountPercent) || 0,
          parseFloat(product.discountAmount) || 0,
          product.thumbnail || null,
          product.productImages ? JSON.stringify(product.productImages) : null,
          product.description || null,
          importedQuantity,
          soldQuantity,
          remainingQuantity,
          product.id
      ];

      const query = `UPDATE Products SET 
        name = ?, 
        code = ?, 
        importPrice = ?, 
        salePrice = ?, 
        discountPercent = ?, 
        discountAmount = ?, 
        thumbnail = ?, 
        productImages = ?, 
        description = ?, 
        importedQuantity = ?, 
        soldQuantity = ?, 
        remainingQuantity = ? 
        WHERE id = ?`;

      console.log('Executing query:', query);
      console.log('With parameters:', params);
      
      const [results, metadata] = await this.sequelize.query(query, { 
        replacements: params,
        type: this.sequelize.QueryTypes.UPDATE
      });
      
      console.log('Product updated in database successfully');
      return { success: true, affectedRows: metadata };
    } catch (error) {
        console.error('Error updating product in database:', error);
        throw new Error(`Failed to update product: ${error.message}`);
    }
  }

  /**
   * Xóa sản phẩm khỏi cơ sở dữ liệu
   * @param {string} productId - ID sản phẩm
   */
  async deleteProductFromDatabase(productId) {
    const query = `DELETE FROM Products WHERE id = ?`;
    try {
        console.log('Executing query:', query);
        console.log('With parameter:', productId);
        await this.sequelize.query(query, { replacements: [productId] });
        console.log('Product deleted from database successfully');
    } catch (error) {
        console.error('Error deleting product from database:', error);
        throw new Error(`Failed to delete product: ${error.message}`);
    }
  }

  /**
   * Tạo bảng Products nếu chưa tồn tại
   */
  async createProductsTable() {
    const query = `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Products' AND xtype='U')
    BEGIN
        CREATE TABLE Products (
            id NVARCHAR(50) PRIMARY KEY,
            name NVARCHAR(255) NOT NULL,
            code NVARCHAR(50),
            autoCode NVARCHAR(50),
            importPrice FLOAT,
            salePrice FLOAT,
            discountPercent FLOAT,
            discountAmount FLOAT,
            thumbnail NVARCHAR(MAX),
            productImages NVARCHAR(MAX),
            description NVARCHAR(MAX) NULL,
            importedQuantity INT DEFAULT 0,
            soldQuantity INT DEFAULT 0,
            remainingQuantity INT DEFAULT 0
        )
    END
    IF COL_LENGTH('Products', 'description') IS NULL
    BEGIN
        ALTER TABLE Products ADD description NVARCHAR(MAX) NULL
    END
    IF COL_LENGTH('Products', 'importedQuantity') IS NULL
    BEGIN
        ALTER TABLE Products ADD importedQuantity INT DEFAULT 0
    END
    IF COL_LENGTH('Products', 'soldQuantity') IS NULL
    BEGIN
        ALTER TABLE Products ADD soldQuantity INT DEFAULT 0
    END
    IF COL_LENGTH('Products', 'remainingQuantity') IS NULL
    BEGIN
        ALTER TABLE Products ADD remainingQuantity INT DEFAULT 0
    END`;
    try {
        await this.sequelize.query(query);
        console.log('Products table created successfully');
    } catch (error) {
        console.error('Error creating Products table:', error);
    }
  }

  /**
   * Khởi tạo cơ sở dữ liệu (tạo bảng nếu chưa tồn tại)
   */
  async initializeDatabase() {
    await this.createProductsTable();
  }

  /**
   * Lấy danh sách sản phẩm từ cơ sở dữ liệu
   */
  async getAllProducts() {
    const query = `SELECT * FROM Products`;
    try {
        console.log('Executing query:', query);
        const [results] = await this.sequelize.query(query);
        console.log('Products retrieved successfully:', results);
        return results;
    } catch (error) {
        console.error('Error retrieving products from database:', error);
        throw new Error('Failed to retrieve products');
    }
  }
}

module.exports = new Database();