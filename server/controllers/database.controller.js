const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const { promisify } = require('util');

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const existsAsync = promisify(fs.exists);
const mkdirAsync = promisify(fs.mkdir);

// Đường dẫn đến file database
const dbPath = path.resolve(__dirname, '../../database.db');

// Tạo kết nối đến database
const getDbConnection = () => {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Không thể kết nối đến database:', err.message);
        reject(err);
      } else {
        console.log('Đã kết nối đến database SQLite');
        resolve(db);
      }
    });
  });
};

// Lấy thông tin về database
exports.getDatabaseInfo = async (req, res) => {
  try {
    const db = await getDbConnection();
    
    // Lấy thông tin database
    const infoPromise = new Promise((resolve, reject) => {
      db.get("PRAGMA database_list", [], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
    
    // Lấy phiên bản SQLite
    const versionPromise = new Promise((resolve, reject) => {
      db.get("SELECT sqlite_version() as version", [], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row.version);
        }
      });
    });
    
    // Lấy danh sách bảng
    const tablesPromise = new Promise((resolve, reject) => {
      db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'", [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows.length);
        }
      });
    });
    
    const [dbInfo, version, tableCount] = await Promise.all([infoPromise, versionPromise, tablesPromise]);
    
    // Lấy kích thước file database
    const stats = fs.statSync(dbPath);
    const fileSizeInBytes = stats.size;
    const fileSizeInMegabytes = (fileSizeInBytes / (1024 * 1024)).toFixed(2);
    
    const dbMetaData = {
      name: path.basename(dbPath),
      server: 'SQLite',
      version: version,
      tableCount: tableCount,
      size: `${fileSizeInMegabytes} MB`,
      createDate: new Date(stats.birthtime).toLocaleString(),
      status: 'Hoạt động'
    };
    
    db.close();
    
    return res.status(200).json({
      success: true,
      info: dbMetaData
    });
  } catch (error) {
    console.error('Lỗi khi lấy thông tin database:', error);
    return res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi khi lấy thông tin database'
    });
  }
};

// Lấy danh sách các bảng trong database
exports.getTables = async (req, res) => {
  try {
    const db = await getDbConnection();
    
    db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'", [], async (err, tables) => {
      if (err) {
        db.close();
        console.error('Lỗi khi lấy danh sách bảng:', err);
        return res.status(500).json({
          success: false,
          message: 'Đã xảy ra lỗi khi lấy danh sách bảng'
        });
      }
      
      const tableDetails = [];
      
      // Lấy số lượng bản ghi cho mỗi bảng
      for (const table of tables) {
        try {
          const countPromise = new Promise((resolve, reject) => {
            db.get(`SELECT COUNT(*) as count FROM "${table.name}"`, [], (err, row) => {
              if (err) {
                reject(err);
              } else {
                resolve(row.count);
              }
            });
          });
          
          const recordCount = await countPromise;
          
          tableDetails.push({
            name: table.name,
            recordCount: recordCount
          });
        } catch (error) {
          console.error(`Lỗi khi đếm bản ghi cho bảng ${table.name}:`, error);
          tableDetails.push({
            name: table.name,
            recordCount: 'Lỗi'
          });
        }
      }
      
      db.close();
      
      return res.status(200).json({
        success: true,
        tables: tableDetails
      });
    });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách bảng:', error);
    return res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi khi lấy danh sách bảng'
    });
  }
};

// Lấy chi tiết của một bảng
exports.getTableDetails = async (req, res) => {
  try {
    const { tableName } = req.params;
    
    // Kiểm tra tên bảng để tránh SQL injection
    if (!tableName || /[^\w]/.test(tableName)) {
      return res.status(400).json({
        success: false,
        message: 'Tên bảng không hợp lệ'
      });
    }
    
    const db = await getDbConnection();
    
    // Lấy thông tin cấu trúc bảng
    const columnsPromise = new Promise((resolve, reject) => {
      db.all(`PRAGMA table_info("${tableName}")`, [], (err, columns) => {
        if (err) {
          reject(err);
        } else {
          // Chuyển đổi dữ liệu cột
          const formattedColumns = columns.map(column => {
            return {
              name: column.name,
              type: column.type,
              isNullable: column.notnull === 0,
              isPrimaryKey: column.pk === 1,
              defaultValue: column.dflt_value,
              isForeignKey: false  // Sẽ cập nhật sau
            };
          });
          resolve(formattedColumns);
        }
      });
    });
    
    // Lấy thông tin khóa ngoại
    const foreignKeysPromise = new Promise((resolve, reject) => {
      db.all(`PRAGMA foreign_key_list("${tableName}")`, [], (err, foreignKeys) => {
        if (err) {
          reject(err);
        } else {
          resolve(foreignKeys);
        }
      });
    });
    
    // Lấy dữ liệu từ bảng (giới hạn 100 bản ghi)
    const recordsPromise = new Promise((resolve, reject) => {
      db.all(`SELECT * FROM "${tableName}" LIMIT 100`, [], (err, records) => {
        if (err) {
          reject(err);
        } else {
          resolve(records);
        }
      });
    });
    
    const [columnsData, foreignKeys, records] = await Promise.all([columnsPromise, foreignKeysPromise, recordsPromise]);
    
    // Cập nhật thông tin khóa ngoại vào cột
    if (foreignKeys.length > 0) {
      for (const fk of foreignKeys) {
        const columnIndex = columnsData.findIndex(col => col.name === fk.from);
        if (columnIndex !== -1) {
          columnsData[columnIndex].isForeignKey = true;
          columnsData[columnIndex].foreignTable = fk.table;
          columnsData[columnIndex].foreignColumn = fk.to;
        }
      }
    }
    
    db.close();
    
    return res.status(200).json({
      success: true,
      columns: columnsData,
      records: records,
      recordCount: records.length
    });
  } catch (error) {
    console.error('Lỗi khi lấy chi tiết bảng:', error);
    return res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi khi lấy chi tiết bảng'
    });
  }
};

// Thực thi truy vấn SQL
exports.executeQuery = async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Truy vấn không hợp lệ'
      });
    }
    
    // Kiểm tra xem truy vấn có phải là SELECT không
    const isSelectQuery = query.trim().toUpperCase().startsWith('SELECT');
    
    const db = await getDbConnection();
    
    if (isSelectQuery) {
      // Thực thi truy vấn SELECT
      db.all(query, [], (err, rows) => {
        db.close();
        
        if (err) {
          console.error('Lỗi khi thực thi truy vấn:', err);
          return res.status(400).json({
            success: false,
            message: err.message
          });
        }
        
        return res.status(200).json({
          success: true,
          isSelect: true,
          records: rows,
          recordCount: rows.length
        });
      });
    } else {
      // Thực thi truy vấn không phải SELECT (INSERT, UPDATE, DELETE, v.v.)
      db.run(query, function(err) {
        db.close();
        
        if (err) {
          console.error('Lỗi khi thực thi truy vấn:', err);
          return res.status(400).json({
            success: false,
            message: err.message
          });
        }
        
        return res.status(200).json({
          success: true,
          isSelect: false,
          affectedRows: this.changes
        });
      });
    }
  } catch (error) {
    console.error('Lỗi khi thực thi truy vấn:', error);
    return res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi khi thực thi truy vấn'
    });
  }
};

// Đường dẫn tới thư mục data
const dataDir = path.join(__dirname, '../../');
const backupDir = path.join(__dirname, '../../backups');

// Đảm bảo thư mục backups tồn tại
const ensureBackupDirExists = async () => {
    if (!await existsAsync(backupDir)) {
        await mkdirAsync(backupDir, { recursive: true });
    }
};

// Lấy đường dẫn đến file dữ liệu
const getDataFilePath = (dbName) => {
    // Đảm bảo tên file không chứa ký tự đặc biệt để tránh lỗi bảo mật
    const safeDbName = dbName.replace(/[^a-zA-Z0-9_-]/g, '');
    return path.join(dataDir, `${safeDbName}.json`);
};

// Lấy đường dẫn đến file backup
const getBackupFilePath = (dbName) => {
    const safeDbName = dbName.replace(/[^a-zA-Z0-9_-]/g, '');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return path.join(backupDir, `${safeDbName}_${timestamp}.json`);
};

// Lấy file backup gần nhất
const getLatestBackup = async (dbName) => {
    const safeDbName = dbName.replace(/[^a-zA-Z0-9_-]/g, '');
    await ensureBackupDirExists();

    const files = await promisify(fs.readdir)(backupDir);
    const backupFiles = files.filter(file => file.startsWith(`${safeDbName}_`));
    
    if (backupFiles.length === 0) {
        return null;
    }
    
    backupFiles.sort().reverse();
    return path.join(backupDir, backupFiles[0]);
};

// Đọc dữ liệu từ file
const readData = async (filePath) => {
    try {
        if (!await existsAsync(filePath)) {
            return [];
        }
        
        const data = await readFileAsync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading data from ${filePath}:`, error);
        return [];
    }
};

// Lưu dữ liệu vào file
const saveData = async (filePath, data) => {
    try {
        await writeFileAsync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error(`Error saving data to ${filePath}:`, error);
        return false;
    }
};

// Controller methods
exports.getAllRecords = async (req, res) => {
    try {
        const { dbName } = req.params;
        const filePath = getDataFilePath(dbName);
        const data = await readData(filePath);
        
        res.json({
            success: true,
            data
        });
    } catch (error) {
        console.error('Error getting all records:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

exports.getRecordById = async (req, res) => {
    try {
        const { dbName, id } = req.params;
        const filePath = getDataFilePath(dbName);
        const data = await readData(filePath);
        
        const record = data.find(item => item.id === id);
        
        if (!record) {
            return res.status(404).json({
                success: false,
                message: 'Record not found'
            });
        }
        
        res.json({
            success: true,
            data: record
        });
    } catch (error) {
        console.error('Error getting record by ID:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

exports.createRecord = async (req, res) => {
    try {
        const { dbName } = req.params;
        const { data: newRecord } = req.body;
        
        if (!newRecord || !newRecord.id) {
            return res.status(400).json({
                success: false,
                message: 'Invalid record data. ID is required.'
            });
        }
        
        const filePath = getDataFilePath(dbName);
        const data = await readData(filePath);
        
        // Kiểm tra xem ID đã tồn tại chưa
        const existingRecord = data.find(item => item.id === newRecord.id);
        if (existingRecord) {
            return res.status(400).json({
                success: false,
                message: 'A record with this ID already exists'
            });
        }
        
        data.push(newRecord);
        const saved = await saveData(filePath, data);
        
        if (!saved) {
            return res.status(500).json({
                success: false,
                message: 'Failed to save record'
            });
        }
        
        res.status(201).json({
            success: true,
            data: newRecord
        });
    } catch (error) {
        console.error('Error creating record:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

exports.updateRecord = async (req, res) => {
    try {
        const { dbName, id } = req.params;
        const { data: updatedRecord } = req.body;
        
        if (!updatedRecord || updatedRecord.id !== id) {
            return res.status(400).json({
                success: false,
                message: 'Invalid record data. ID must match the path parameter.'
            });
        }
        
        const filePath = getDataFilePath(dbName);
        const data = await readData(filePath);
        
        const index = data.findIndex(item => item.id === id);
        
        if (index === -1) {
            return res.status(404).json({
                success: false,
                message: 'Record not found'
            });
        }
        
        data[index] = updatedRecord;
        const saved = await saveData(filePath, data);
        
        if (!saved) {
            return res.status(500).json({
                success: false,
                message: 'Failed to save record'
            });
        }
        
        res.json({
            success: true,
            data: updatedRecord
        });
    } catch (error) {
        console.error('Error updating record:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

exports.deleteRecord = async (req, res) => {
    try {
        const { dbName, id } = req.params;
        const filePath = getDataFilePath(dbName);
        const data = await readData(filePath);
        
        const index = data.findIndex(item => item.id === id);
        
        if (index === -1) {
            return res.status(404).json({
                success: false,
                message: 'Record not found'
            });
        }
        
        data.splice(index, 1);
        const saved = await saveData(filePath, data);
        
        if (!saved) {
            return res.status(500).json({
                success: false,
                message: 'Failed to delete record'
            });
        }
        
        res.json({
            success: true,
            message: 'Record deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting record:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

exports.importData = async (req, res) => {
    try {
        const { dbName } = req.params;
        const { data } = req.body;
        
        if (!Array.isArray(data)) {
            return res.status(400).json({
                success: false,
                message: 'Data must be an array'
            });
        }
        
        // Backup current data before import
        const filePath = getDataFilePath(dbName);
        if (await existsAsync(filePath)) {
            await ensureBackupDirExists();
            const backupPath = getBackupFilePath(dbName);
            const currentData = await readFileAsync(filePath, 'utf8');
            await writeFileAsync(backupPath, currentData, 'utf8');
        }
        
        // Save imported data
        const saved = await saveData(filePath, data);
        
        if (!saved) {
            return res.status(500).json({
                success: false,
                message: 'Failed to import data'
            });
        }
        
        res.json({
            success: true,
            message: `Successfully imported ${data.length} records`,
            count: data.length
        });
    } catch (error) {
        console.error('Error importing data:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

exports.backupDatabase = async (req, res) => {
    try {
        const { dbName } = req.params;
        const filePath = getDataFilePath(dbName);
        
        if (!await existsAsync(filePath)) {
            return res.status(404).json({
                success: false,
                message: 'Database file not found'
            });
        }
        
        await ensureBackupDirExists();
        const backupPath = getBackupFilePath(dbName);
        const data = await readFileAsync(filePath, 'utf8');
        await writeFileAsync(backupPath, data, 'utf8');
        
        res.json({
            success: true,
            message: 'Database backed up successfully',
            backupFile: path.basename(backupPath)
        });
    } catch (error) {
        console.error('Error backing up database:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

exports.restoreDatabase = async (req, res) => {
    try {
        const { dbName } = req.params;
        const filePath = getDataFilePath(dbName);
        
        const latestBackup = await getLatestBackup(dbName);
        
        if (!latestBackup) {
            return res.status(404).json({
                success: false,
                message: 'No backup found'
            });
        }
        
        const backupData = await readFileAsync(latestBackup, 'utf8');
        await writeFileAsync(filePath, backupData, 'utf8');
        
        res.json({
            success: true,
            message: 'Database restored successfully',
            backupFile: path.basename(latestBackup)
        });
    } catch (error) {
        console.error('Error restoring database:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};