const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const url = require('url');
const database = require('./database');
const crypto = require('crypto');
require('electron-reload')(__dirname);

// Giữ một tham chiếu toàn cục đến cửa sổ, nếu không thì cửa sổ 
// sẽ tự động đóng khi đối tượng JavaScript bị thu gom rác
let mainWindow;
let currentUser = null;

// Hàm để mã hóa mật khẩu
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function createWindow() {
  // Tạo cửa sổ trình duyệt
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    title: 'titi'
  });

  // Load trang đăng nhập
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'login.html'),
    protocol: 'file:',
    slashes: true
  }));

  // Mở DevTools khi phát triển
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  // Xử lý sự kiện khi cửa sổ bị đóng
  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

// Phương thức này sẽ được gọi khi Electron hoàn tất
// khởi tạo và sẵn sàng tạo cửa sổ trình duyệt.
app.on('ready', createWindow);

// Thoát khi tất cả cửa sổ đã đóng.
app.on('window-all-closed', function () {
  // Trên macOS, các ứng dụng và thanh menu của chúng thường
  // vẫn hoạt động cho đến khi người dùng thoát
  // rõ ràng bằng Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  // Trên macOS, việc tạo lại cửa sổ trong ứng dụng khi
  // biểu tượng dock được nhấp và không có cửa sổ nào khác mở.
  if (mainWindow === null) {
    createWindow();
  }
});

// IPC để xử lý đăng ký tài khoản
ipcMain.on('register', async (event, userData) => {
  try {
    // Mã hóa mật khẩu trước khi lưu vào database
    const hashedPassword = hashPassword(userData.password);
    
    // Kết nối đến cơ sở dữ liệu với thông tin từ form
    if (!database.isConnected) {
      const dbConfig = userData.dbConfig || {
        server: 'localhost',
        database: 'TitiDB',
        username: 'sa',
        password: 'YourStrong@Passw0rd'
      };
      
      const connected = await database.connect(dbConfig);
      
      if (!connected) {
        event.reply('register-response', { 
          success: false, 
          message: 'Không thể kết nối đến SQL Server. Vui lòng kiểm tra thông tin kết nối.' 
        });
        return;
      }
    }
    
    // Tạo người dùng mới trong cơ sở dữ liệu
    const result = await database.createUser(userData.username, hashedPassword, userData.fullName);
    event.reply('register-response', result);
  } catch (error) {
    console.error('Lỗi đăng ký:', error);
    event.reply('register-response', { 
      success: false, 
      message: 'Có lỗi xảy ra khi đăng ký: ' + error.message 
    });
  }
});

// IPC để xử lý đăng nhập
ipcMain.on('login', async (event, credentials) => {
  try {
    // Kết nối đến cơ sở dữ liệu với thông tin từ form
    if (!database.isConnected) {
      const dbConfig = credentials.dbConfig || {
        server: 'localhost',
        database: 'TitiDB',
        username: 'sa',
        password: 'YourStrong@Passw0rd'
      };
      
      const connected = await database.connect(dbConfig);
      
      if (!connected) {
        event.reply('login-response', { 
          success: false, 
          message: 'Không thể kết nối đến SQL Server. Vui lòng kiểm tra thông tin kết nối.' 
        });
        return;
      }
    }
    
    // Mã hóa mật khẩu để so sánh
    const hashedPassword = hashPassword(credentials.password);
    
    // Xác thực với database
    const result = await database.authenticate(credentials.username, hashedPassword);
    
    if (result.success) {
      // Lưu thông tin người dùng hiện tại
      currentUser = result.user;
      
      // Mở cửa sổ chính sau khi đăng nhập thành công
      mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'main-page.html'),
        protocol: 'file:',
        slashes: true
      }));
      
      event.reply('login-response', { success: true });
    } else {
      event.reply('login-response', { 
        success: false, 
        message: result.message || 'Đăng nhập không thành công'
      });
    }
  } catch (error) {
    console.error('Lỗi đăng nhập:', error);
    event.reply('login-response', { 
      success: false, 
      message: 'Có lỗi xảy ra khi đăng nhập: ' + error.message
    });
  }
});

// IPC để xử lý đăng xuất
ipcMain.on('logout', async (event) => {
  try {
    // Đóng kết nối database
    if (database.isConnected) {
      await database.disconnect();
    }
    
    // Đặt lại thông tin người dùng
    currentUser = null;
    
    // Quay lại trang đăng nhập
    mainWindow.loadURL(url.format({
      pathname: path.join(__dirname, 'login.html'),
      protocol: 'file:',
      slashes: true
    }));
  } catch (error) {
    console.error('Lỗi đăng xuất:', error);
  }
});

// IPC để lấy thông tin người dùng hiện tại
ipcMain.on('get-current-user', (event) => {
  event.reply('current-user', currentUser);
});

// IPC để lấy tất cả tài khoản
ipcMain.on('get-all-accounts', async (event) => {
  try {
    if (database.isConnected) {
      const accounts = await database.getAllUsers();
      event.reply('all-accounts', accounts);
    } else {
      event.reply('all-accounts', []);
    }
  } catch (error) {
    console.error('Lỗi khi lấy danh sách tài khoản:', error);
    event.reply('all-accounts', []);
  }
});

// IPC để điều hướng đến trang accounts.html
ipcMain.on('go-to-accounts', (event) => {
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'accounts.html'),
    protocol: 'file:',
    slashes: true
  }));
});

// IPC để điều hướng đến trang main-page.html
ipcMain.on('go-to-main', (event) => {
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'main-page.html'),
    protocol: 'file:',
    slashes: true
  }));
});

// IPC để lấy tất cả bảng trong cơ sở dữ liệu
ipcMain.on('get-all-tables', async (event) => {
  try {
    const result = await database.getAllTables();
    event.reply('get-all-tables-response', result);
  } catch (error) {
    console.error('Lỗi khi lấy danh sách bảng:', error);
    event.reply('get-all-tables-response', {
      success: false,
      message: 'Có lỗi xảy ra khi lấy danh sách bảng.'
    });
  }
});

// IPC để lấy cấu trúc của một bảng
ipcMain.on('get-table-structure', async (event, tableName) => {
  try {
    const result = await database.getTableStructure(tableName);
    event.reply('get-table-structure-response', {
      ...result,
      tableName
    });
  } catch (error) {
    console.error(`Lỗi khi lấy cấu trúc bảng ${tableName}:`, error);
    event.reply('get-table-structure-response', {
      success: false,
      message: `Có lỗi xảy ra khi lấy cấu trúc bảng ${tableName}.`
    });
  }
});

// IPC để điều hướng đến trang database-viewer.html
ipcMain.on('go-to-database-viewer', (event) => {
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'database-viewer.html'),
    protocol: 'file:',
    slashes: true
  }));
});

// IPC để điều hướng đến trang quản lý cửa hàng
ipcMain.on('go-to-store-management', (event) => {
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'store-management.html'),
    protocol: 'file:',
    slashes: true
  }));
});

ipcMain.handle('add-product', async (event, product) => {
    try {
        await database.addProductToDatabase(product);
        return { success: true, message: 'Sản phẩm đã được thêm vào cơ sở dữ liệu.' };
    } catch (error) {
        console.error('Error in add-product handler:', error);
        return { success: false, message: 'Không thể thêm sản phẩm. Vui lòng thử lại!' };
    }
});

ipcMain.handle('get-products', async () => {
    try {
        const products = await database.getAllProducts();
        return { success: true, products };
    } catch (error) {
        console.error('Error in get-products handler:', error);
        return { success: false, message: 'Không thể lấy danh sách sản phẩm. Vui lòng thử lại!' };
    }
});

ipcMain.handle('delete-product', async (event, productId) => {
  try {
    const db = require('./database.js');
    await db.deleteProductFromDatabase(productId);
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('update-product', async (event, product) => {
  try {
    await database.updateProductInDatabase(product);
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('get-product-detail', async (event, productId) => {
  try {
    const products = await database.getAllProducts();
    const product = products.find(p => p.id == productId);
    if (product) return { success: true, product };
    return { success: false, message: 'Không tìm thấy sản phẩm' };
  } catch (error) {
    return { success: false, message: error.message };
  }
});