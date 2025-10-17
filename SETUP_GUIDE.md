# TITI - Hệ thống Quản lý Cửa hàng

> **Ứng dụng đa nền tảng kết hợp Web App và Desktop App với SQL Server**

![TITI Logo](https://via.placeholder.com/150x50/4285f4/ffffff?text=TITI)

## 📋 Mục lục

1. [Tổng quan](#-tổng-quan)
2. [Yêu cầu hệ thống](#-yêu-cầu-hệ-thống)
3. [Cài đặt](#-cài-đặt)
4. [Chạy ứng dụng](#-chạy-ứng-dụng)
5. [Build & Deploy](#-build--deploy)
6. [Cấu hình Database](#-cấu-hình-database)
7. [Troubleshooting](#-troubleshooting)

---

## 📝 Tổng quan

**TITI** là một hệ thống quản lý cửa hàng đa nền tảng bao gồm:

- **🌐 Web Application**: Chạy trên browser với Node.js backend
- **💻 Desktop Application**: Ứng dụng Electron cho macOS và Windows
- **🗄️ Database**: SQL Server với Sequelize ORM
- **☁️ Cloud Deployment**: Firebase Hosting + Render.com

### ✨ Tính năng chính

- 👤 Quản lý tài khoản và phân quyền
- 📦 Quản lý sản phẩm (CRUD, upload ảnh)
- 🏪 Quản lý cửa hàng
- 🗃️ Database viewer và query executor
- 📱 Responsive design cho mobile
- 🔐 JWT Authentication
- 📊 Real-time data sync

---

## 🛠 Yêu cầu hệ thống

### Phần mềm cần thiết

- **Node.js**: ≥ 18.0.0
- **npm**: ≥ 8.0.0
- **Git**: Latest version
- **SQL Server**: 2019+ hoặc SQL Server Express

### Hệ điều hành hỗ trợ

- ✅ **macOS**: 10.14+
- ✅ **Windows**: 10/11
- ✅ **Linux**: Ubuntu 20.04+

### Browser hỗ trợ

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

---

## 🚀 Cài đặt

### 1. Clone repository

```bash
git clone https://github.com/your-username/titi.git
cd titi
```

### 2. Cài đặt dependencies

```bash
# Cài đặt tất cả packages
npm install

# Hoặc cài đặt production only
npm install --production
```

### 3. Cấu hình môi trường

Tạo file `.env` từ template:

```bash
cp .env.example .env
```

Cập nhật file `.env`:

```env
# Database Configuration
DB_SERVER=localhost
DB_NAME=TitiDB
DB_USER=sa
DB_PASSWORD=YourStrong@Passw0rd

# Server Configuration
PORT=3000
NODE_ENV=development

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here-make-it-very-long-and-random

# API Configuration (cho production)
API_URL=http://localhost:3000/api
CORS_ORIGIN=http://localhost:3000
```

---

## 🏃 Chạy ứng dụng

### 🌐 Web Application

#### Development Mode

```bash
# Chạy web server (development)
npm run web:dev

# Hoặc chạy trực tiếp
node server.js
```

Truy cập: `http://localhost:3000`

#### Production Mode

```bash
# Chạy web server (production)
npm run web:prod

# Hoặc với PM2
pm2 start ecosystem.config.js --env production
```

### 💻 Desktop Application (Electron)

#### Development Mode

```bash
# Chạy Electron app (development)
npm run dev

# Hoặc
npm start
```

#### Debug Mode

```bash
# Chạy với DevTools mở sẵn
NODE_ENV=development npm start
```

### 🔄 Chạy cả Web + Desktop

```bash
# Terminal 1: Chạy web server
npm run web:dev

# Terminal 2: Chạy Electron app
npm run dev
```

---

## 📦 Build & Deploy

### 🏗️ Build Desktop Application

#### Build cho macOS

```bash
# Build app cho macOS
npm run build

# Build và tạo installer
npm run build:mac
```

Kết quả: `dist/TITI.app` hoặc `dist/TITI.dmg`

#### Build cho Windows

```bash
# Build app cho Windows (trên Windows)
npm run build-win

# Hoặc cross-platform từ macOS (cần wine)
npm run build:win
```

Kết quả: `dist/TITI Setup.exe`

#### Build Universal

```bash
# Build cho cả macOS và Windows
npm run build:all
```

### ☁️ Deploy lên Cloud

#### 🔥 Deploy Frontend (Firebase Hosting)

```bash
# Đăng nhập Firebase (chỉ lần đầu)
firebase login

# Deploy frontend
firebase deploy --only hosting

# Hoặc sử dụng script có sẵn
chmod +x deploy-frontend.sh
./deploy-frontend.sh
```

#### 🚀 Deploy Backend (Render.com)

1. **Tự động**: Push code lên GitHub → Render tự động deploy
2. **Thủ công**: 
   ```bash
   git add .
   git commit -m "Deploy backend"
   git push origin main
   ```

#### 📋 Deploy Full Stack

```bash
# Deploy cả frontend và backend
chmod +x deploy.sh
./deploy.sh
```

---

## 🗄️ Cấu hình Database

### SQL Server Local

#### 1. Cài đặt SQL Server

**macOS (với Docker):**
```bash
# Pull SQL Server image
docker pull mcr.microsoft.com/mssql/server:2019-latest

# Run SQL Server container
docker run -e "ACCEPT_EULA=Y" -e "SA_PASSWORD=YourStrong@Passw0rd" \
   -p 1433:1433 --name sqlserver --hostname sqlserver \
   -d mcr.microsoft.com/mssql/server:2019-latest
```

**Windows:**
1. Tải SQL Server Express từ Microsoft
2. Cài đặt với Mixed Authentication
3. Đặt password cho SA user

#### 2. Tạo Database

```sql
-- Kết nối bằng SQL Server Management Studio hoặc Azure Data Studio
CREATE DATABASE TitiDB;
GO

USE TitiDB;
GO

-- Database và tables sẽ được tự động tạo khi app khởi động
```

### Cloud Database

#### Azure SQL Database

```env
DB_SERVER=your-server.database.windows.net
DB_NAME=TitiDB
DB_USER=your-username
DB_PASSWORD=your-password
```

#### Supabase (PostgreSQL)

```bash
# Cần cài thêm pg adapter
npm install pg pg-hstore

# Cập nhật database.js để dùng postgres
```

---

## 🚀 Scripts có sẵn

| Script | Mô tả | Sử dụng |
|--------|-------|---------|
| `npm start` | Chạy Electron app | Development |
| `npm run dev` | Chạy Electron với DevTools | Debug |
| `npm run web` | Chạy web server | Production |
| `npm run web:dev` | Chạy web server | Development |
| `npm run web:prod` | Chạy web server | Production |
| `npm run build` | Build Electron cho macOS | Release |
| `npm run build-win` | Build Electron cho Windows | Release |
| `./deploy-frontend.sh` | Deploy frontend | Production |
| `./deploy.sh` | Deploy full stack | Production |

---

## 🌍 Môi trường và URLs

### Development

| Service | URL | Mô tả |
|---------|-----|-------|
| Web App | http://localhost:3000 | Development server |
| API | http://localhost:3000/api | REST API endpoints |
| Database | localhost:1433 | SQL Server local |

### Production

| Service | URL | Mô tả |
|---------|-----|-------|
| Web App | https://titi-8b326.web.app | Firebase Hosting |
| API | https://titi-backend-xyz.onrender.com/api | Render.com backend |
| Database | Cloud SQL Server | Production database |

---

## 👥 Tài khoản mặc định

Ứng dụng tự động tạo tài khoản admin khi khởi động lần đầu:

```
Username: admin
Password: admin123
Role: Administrator
```

**⚠️ Quan trọng**: Đổi password ngay sau lần đăng nhập đầu tiên!

---

## 🔧 Troubleshooting

### ❌ Lỗi thường gặp

#### 1. Cannot connect to SQL Server

```bash
# Kiểm tra SQL Server đang chạy
docker ps | grep sqlserver

# Restart SQL Server container
docker restart sqlserver

# Kiểm tra connection string trong .env
```

#### 2. Module không tìm thấy

```bash
# Xóa node_modules và cài lại
rm -rf node_modules package-lock.json
npm install
```

#### 3. Port đã được sử dụng

```bash
# Tìm process đang sử dụng port 3000
lsof -ti:3000

# Kill process
kill -9 <PID>

# Hoặc đổi port trong .env
PORT=3001
```

#### 4. Firebase deployment lỗi

```bash
# Đăng nhập lại
firebase logout
firebase login

# Kiểm tra project
firebase projects:list

# Deploy lại
firebase deploy --only hosting
```

#### 5. Electron không khởi động

```bash
# Xóa cache
npm run clean

# Cài lại Electron
npm install electron@latest --save-dev

# Rebuild native modules
npm rebuild
```

### 📋 Debug Mode

#### Web Application

```bash
# Chạy với debug logs
DEBUG=* npm run web:dev

# Hoặc chỉ debug app logs
DEBUG=titi:* npm run web:dev
```

#### Desktop Application

```bash
# Mở DevTools
NODE_ENV=development npm start

# Hoặc debug main process
npm start --inspect
```

### 📊 Performance Monitoring

```bash
# Kiểm tra memory usage
npm run monitor

# Xem PM2 logs (production)
pm2 logs titi
pm2 monit
```

---

## 🔒 Bảo mật

### Environment Variables

**Không bao giờ commit file `.env` vào Git!**

```bash
# File .env phải được add vào .gitignore
echo ".env" >> .gitignore
```

### Production Security

```env
# Sử dụng strong JWT secret
JWT_SECRET=your-very-long-random-string-at-least-256-bits

# Enable HTTPS trong production
HTTPS=true
SSL_KEY=/path/to/ssl.key
SSL_CERT=/path/to/ssl.cert
```

---

## 📚 Tài liệu API

### Authentication Endpoints

```bash
POST /api/auth/login
POST /api/auth/register  
POST /api/auth/logout
GET  /api/auth/users
```

### Product Endpoints

```bash
GET    /api/products
POST   /api/products
GET    /api/products/:id
PUT    /api/products/:id
DELETE /api/products/:id
```

### Database Endpoints

```bash
GET  /api/database/tables
GET  /api/database/:table
POST /api/database/:table
PUT  /api/database/:table/:id
DELETE /api/database/:table/:id
```

---

## 🤝 Contributing

1. Fork repository
2. Tạo feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push branch: `git push origin feature/amazing-feature`
5. Tạo Pull Request

---

## 📄 License

Dự án này sử dụng MIT License. Xem file [LICENSE](LICENSE) để biết thêm chi tiết.

---

## 📞 Hỗ trợ

- **GitHub Issues**: [Tạo issue mới](https://github.com/your-username/titi/issues)
- **Email**: support@titi.com
- **Documentation**: [Wiki](https://github.com/your-username/titi/wiki)

---

## 🎯 Roadmap

### Version 2.0 (Q1 2026)

- [ ] Real-time notifications
- [ ] Advanced reporting
- [ ] Mobile app (React Native)
- [ ] Multi-store support
- [ ] Inventory tracking
- [ ] Barcode scanner

### Version 2.1 (Q2 2026)

- [ ] API integrations
- [ ] Advanced permissions
- [ ] Audit logs
- [ ] Backup & restore
- [ ] Multi-language support

---

**Made with ❤️ by TITI Team**

**Version**: 1.0.0  
**Last Updated**: October 17, 2025