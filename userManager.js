const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class UserManager {
  constructor() {
    this.usersFilePath = path.join(__dirname, 'users.json');
    this.users = this.loadUsers();
  }

  // Tạo hash mật khẩu để bảo mật
  hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  // Tải danh sách người dùng từ file
  loadUsers() {
    try {
      if (fs.existsSync(this.usersFilePath)) {
        const data = fs.readFileSync(this.usersFilePath, 'utf8');
        return JSON.parse(data);
      }
      return [];
    } catch (error) {
      console.error('Lỗi khi đọc file users.json:', error);
      return [];
    }
  }

  // Lưu danh sách người dùng vào file
  saveUsers() {
    try {
      fs.writeFileSync(this.usersFilePath, JSON.stringify(this.users, null, 2), 'utf8');
    } catch (error) {
      console.error('Lỗi khi lưu file users.json:', error);
    }
  }

  // Tạo tài khoản người dùng mới
  createUser(username, password, fullName) {
    // Kiểm tra xem người dùng đã tồn tại chưa
    if (this.users.find(user => user.username === username)) {
      return { success: false, message: 'Tên đăng nhập đã tồn tại' };
    }

    // Tạo người dùng mới
    const newUser = {
      username,
      password: this.hashPassword(password),
      fullName: fullName || username,
      createdAt: new Date().toISOString()
    };

    this.users.push(newUser);
    this.saveUsers();

    return { success: true, message: 'Tạo tài khoản thành công' };
  }

  // Xác thực người dùng
  authenticate(username, password) {
    const user = this.users.find(user => 
      user.username === username && 
      user.password === this.hashPassword(password)
    );

    if (user) {
      return { success: true, user: { username: user.username, fullName: user.fullName } };
    }
    
    return { success: false, message: 'Tên đăng nhập hoặc mật khẩu không đúng' };
  }
  
  // Lấy tất cả tài khoản (loại bỏ mật khẩu để bảo mật)
  getAllAccounts() {
    return this.users.map(user => ({
      username: user.username,
      fullName: user.fullName,
      createdAt: user.createdAt
    }));
  }
}

module.exports = new UserManager();