const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fileUpload = require('express-fileupload');
const path = require('path');
const database = require('./database');

// Khởi tạo Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Middleware xử lý file upload
app.use(fileUpload({
  createParentPath: true,
  limits: { 
    fileSize: 20 * 1024 * 1024 * 1024 // 20MB max file size
  },
  abortOnLimit: true
}));

// Phục vụ các file tĩnh từ thư mục public
app.use(express.static(path.join(__dirname, 'public')));
app.use('/images', express.static(path.join(__dirname, 'images')));

// Import routes
const authRoutes = require('./server/routes/auth.routes');
const productRoutes = require('./server/routes/product.routes');
const databaseRoutes = require('./server/routes/database.routes');

// Sử dụng routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/database', databaseRoutes);

// Route mặc định để phục vụ trang HTML chính
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Khởi động server
app.listen(PORT, async () => {
  console.log(`Server đang chạy tại http://localhost:${PORT}`);
  
  // Kết nối database khi khởi động server
  try {
    const dbConfig = {
      server: process.env.DB_SERVER || 'localhost',
      database: process.env.DB_NAME || 'TitiDB',
      username: process.env.DB_USER || 'sa',
      password: process.env.DB_PASSWORD || 'YourStrong@Passw0rd'
    };
    
    await database.connect(dbConfig);
    console.log('Đã kết nối đến database');
  } catch (err) {
    console.error('Không thể kết nối đến database:', err);
  }
});