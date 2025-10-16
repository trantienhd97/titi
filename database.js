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
      const user = await this.models.User.findOne({
        where: {
          username,
          password
        }
      });
      
      if (user) {
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
}

module.exports = new Database();