const { app, BrowserWindow, ipcMain, session, dialog } = require('electron');
const path = require('path');
const url = require('url');
const fetch = require('electron-fetch').default;
const fs = require('fs');

// Tắt thông báo lỗi liên quan đến mach port
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling');
app.disableHardwareAcceleration();

// Cấu hình API server
const API_BASE_URL = process.env.API_URL || 'http://localhost:3000/api';
let mainWindow;
let currentUser = null;
let authToken = null;
let isServerConnected = false;

// Hàm kiểm tra kết nối đến server
async function checkServerConnection() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${API_BASE_URL.split('/api')[0]}/`, {
      method: 'GET',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    isServerConnected = response.ok;
    return isServerConnected;
  } catch (error) {
    console.error('Lỗi kết nối đến server:', error);
    isServerConnected = false;
    return false;
  }
}

function createWindow() {
  // Tạo cửa sổ trình duyệt.
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      webSecurity: false // Thêm để cho phép load ảnh từ local server
    }
  });

  // Tải trang đăng nhập
  mainWindow.loadFile('public/index.html');
  
  // Mở DevTools nếu đang trong môi trường dev
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Xử lý khi cửa sổ đóng
  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

// Khi app đã sẵn sàng
app.whenReady().then(async () => {
  // Kiểm tra kết nối đến server trước khi tạo cửa sổ
  try {
    const serverConnected = await checkServerConnection();
    if (!serverConnected) {
      dialog.showErrorBox(
        'Lỗi kết nối server',
        'Không thể kết nối đến máy chủ. Vui lòng đảm bảo server đang chạy tại địa chỉ ' + 
        API_BASE_URL.split('/api')[0] + ' và thử lại.\n\n' +
        'Bạn có thể khởi động server bằng cách mở một cửa sổ Terminal và chạy lệnh:\nnode server.js'
      );
    }
  } catch (error) {
    console.error('Lỗi kiểm tra kết nối:', error);
  }
  
  createWindow();

  app.on('activate', function () {
    // Trên macOS, tạo lại cửa sổ khi icon được click
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Khi tất cả cửa sổ đóng, thoát ứng dụng
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// XỬ LÝ CÁC SỰ KIỆN IPC GIỮA RENDERER VÀ MAIN PROCESS

// Thêm hàm xử lý lỗi kết nối
async function handleApiRequest(apiFunction, errorMessage) {
  if (!isServerConnected) {
    // Thử kết nối lại nếu trước đó không kết nối được
    isServerConnected = await checkServerConnection();
  }
  
  if (!isServerConnected) {
    return {
      success: false,
      message: 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra server và khởi động lại ứng dụng.',
      serverError: true
    };
  }
  
  try {
    return await apiFunction();
  } catch (error) {
    console.error(errorMessage, error);
    
    // Kiểm tra xem lỗi có phải do kết nối không
    if (error.name === 'AbortError' || error.code === 'ECONNREFUSED' || error.type === 'system' || error.code === 'ENOTFOUND') {
      isServerConnected = false;
      return {
        success: false,
        message: 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra server và thử lại.',
        serverError: true
      };
    }
    
    return {
      success: false,
      message: errorMessage
    };
  }
}

// Xử lý sự kiện đăng nhập
ipcMain.handle('login', async (event, credentials) => {
  return handleApiRequest(async () => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(credentials)
    });
    
    const data = await response.json();
    
    if (data.success) {
      authToken = data.token;
      currentUser = data.user;
      return { success: true, user: currentUser };
    } else {
      return { success: false, message: data.message || 'Đăng nhập thất bại' };
    }
  }, 'Đã xảy ra lỗi khi đăng nhập');
});

// Xử lý sự kiện đăng ký
ipcMain.handle('register', async (event, userData) => {
  return handleApiRequest(async () => {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(userData)
    });
    
    const data = await response.json();
    return data;
  }, 'Đã xảy ra lỗi khi đăng ký');
});

// Xử lý sự kiện lấy danh sách sản phẩm
ipcMain.handle('get-products', async () => {
  return handleApiRequest(async () => {
    const response = await fetch(`${API_BASE_URL}/products`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    return data;
  }, 'Đã xảy ra lỗi khi lấy danh sách sản phẩm');
});

// Xử lý sự kiện thêm sản phẩm
ipcMain.handle('add-product', async (event, productData) => {
  return handleApiRequest(async () => {
    if (!authToken) {
      return { success: false, message: 'Không có quyền truy cập' };
    }
    
    // Xử lý thumbnail nếu có
    let formData = new FormData();
    
    // Thêm các trường dữ liệu vào form
    Object.keys(productData).forEach(key => {
      if (key !== 'thumbnailPath') {
        formData.append(key, productData[key]);
      }
    });
    
    // Xử lý file thumbnail nếu có
    if (productData.thumbnailPath) {
      const fileBuffer = fs.readFileSync(productData.thumbnailPath);
      const fileName = path.basename(productData.thumbnailPath);
      formData.append('thumbnail', new Blob([fileBuffer]), fileName);
    }
    
    const response = await fetch(`${API_BASE_URL}/products`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      body: formData
    });
    
    const data = await response.json();
    return data;
  }, 'Đã xảy ra lỗi khi thêm sản phẩm');
});

// Xử lý sự kiện cập nhật sản phẩm
ipcMain.handle('update-product', async (event, productData) => {
  return handleApiRequest(async () => {
    const productId = productData.id;
    delete productData.id;
    
    console.log('Updating product with data:', productData);
    
    // Trong Node.js/Electron, chúng ta cần sử dụng form-data package thay vì FormData
    const FormData = require('form-data');
    let formData = new FormData();
    
    // Thêm các trường dữ liệu vào form
    Object.keys(productData).forEach(key => {
      if (key !== 'thumbnailPath' && productData[key] !== undefined && productData[key] !== null) {
        formData.append(key, productData[key].toString());
      }
    });
    
    // Xử lý file thumbnail nếu có
    if (productData.thumbnailPath) {
      try {
        if (fs.existsSync(productData.thumbnailPath)) {
          const fileName = path.basename(productData.thumbnailPath);
          formData.append('thumbnail', fs.createReadStream(productData.thumbnailPath), fileName);
        } else {
          console.warn('File thumbnail không tồn tại:', productData.thumbnailPath);
        }
      } catch (error) {
        console.warn('Không thể đọc file thumbnail:', error);
      }
    }
    
    const response = await fetch(`${API_BASE_URL}/products/${productId}`, {
      method: 'PUT',
      body: formData,
      headers: formData.getHeaders()
    });
    
    const data = await response.json();
    console.log('Update response:', data);
    return data;
  }, 'Đã xảy ra lỗi khi cập nhật sản phẩm');
});

// Xử lý sự kiện xóa sản phẩm
ipcMain.handle('delete-product', async (event, productId) => {
  return handleApiRequest(async () => {
    if (!authToken) {
      return { success: false, message: 'Không có quyền truy cập' };
    }
    
    const response = await fetch(`${API_BASE_URL}/products/${productId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    const data = await response.json();
    return data;
  }, 'Đã xảy ra lỗi khi xóa sản phẩm');
});

// Xử lý sự kiện lấy danh sách người dùng
ipcMain.handle('get-users', async () => {
  return handleApiRequest(async () => {
    if (!authToken) {
      return { success: false, message: 'Không có quyền truy cập' };
    }
    
    const response = await fetch(`${API_BASE_URL}/auth/all-users`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    const data = await response.json();
    return data;
  }, 'Đã xảy ra lỗi khi lấy danh sách người dùng');
});

// Các hàm xử lý database
ipcMain.handle('get-database-info', async () => {
  return handleApiRequest(async () => {
    if (!authToken) {
      return { success: false, message: 'Không có quyền truy cập' };
    }
    
    const response = await fetch(`${API_BASE_URL}/database/info`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    const data = await response.json();
    return data;
  }, 'Lỗi lấy thông tin database');
});

ipcMain.handle('get-database-tables', async () => {
  return handleApiRequest(async () => {
    if (!authToken) {
      return { success: false, message: 'Không có quyền truy cập' };
    }
    
    const response = await fetch(`${API_BASE_URL}/database/tables`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    const data = await response.json();
    return data;
  }, 'Lỗi lấy danh sách bảng');
});

ipcMain.handle('get-table-details', async (event, tableName) => {
  return handleApiRequest(async () => {
    if (!authToken) {
      return { success: false, message: 'Không có quyền truy cập' };
    }
    
    const response = await fetch(`${API_BASE_URL}/database/tables/${tableName}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    const data = await response.json();
    return data;
  }, 'Lỗi lấy chi tiết bảng');
});

ipcMain.handle('execute-query', async (event, query) => {
  return handleApiRequest(async () => {
    if (!authToken) {
      return { success: false, message: 'Không có quyền truy cập' };
    }
    
    const response = await fetch(`${API_BASE_URL}/database/execute-query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query })
    });
    
    const data = await response.json();
    return data;
  }, 'Lỗi thực thi truy vấn');
});

// Thêm hàm kiểm tra kết nối server và hiển thị thông báo
ipcMain.handle('check-server-connection', async () => {
  const wasConnected = isServerConnected;
  const isNowConnected = await checkServerConnection();
  
  if (!wasConnected && isNowConnected) {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Kết nối thành công',
      message: 'Đã kết nối được đến máy chủ.',
      buttons: ['OK']
    });
  } else if (!isNowConnected) {
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: 'Lỗi kết nối server',
      message: 'Không thể kết nối đến máy chủ. Vui lòng đảm bảo server đang chạy tại địa chỉ ' + 
        API_BASE_URL.split('/api')[0],
      buttons: ['Thử lại', 'Mở Terminal', 'Đóng'],
      defaultId: 0,
      cancelId: 2
    });
    
    if (result.response === 0) {
      // Thử kết nối lại
      return ipcMain.emit('check-server-connection');
    } else if (result.response === 1) {
      // Mở Terminal để chạy lệnh khởi động server
      const terminalCommand = process.platform === 'darwin' ? 'open -a Terminal .' : 'start cmd';
      require('child_process').exec(terminalCommand);
    }
  }
  
  return { connected: isServerConnected };
});

// Thêm hàm xử lý lỗi kết nối chung cho ứng dụng
ipcMain.handle('handle-server-error', async (event, errorData) => {
  if (errorData && errorData.serverError) {
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: 'Lỗi kết nối server',
      message: errorData.message || 'Không thể kết nối đến máy chủ.',
      buttons: ['Thử kết nối lại', 'Đóng'],
      defaultId: 0,
      cancelId: 1
    });
    
    if (result.response === 0) {
      // Thử kết nối lại và trả về kết quả
      await checkServerConnection();
      return { connected: isServerConnected };
    }
  }
  
  return { connected: isServerConnected };
});