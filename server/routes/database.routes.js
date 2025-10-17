const express = require('express');
const databaseController = require('../controllers/database.controller');

const router = express.Router();

// Lấy thông tin về database
router.get('/info', databaseController.getDatabaseInfo);

// Lấy danh sách các bảng trong database
router.get('/tables', databaseController.getTables);

// Lấy chi tiết của một bảng
router.get('/tables/:tableName', databaseController.getTableDetails);

// Thực thi truy vấn SQL
router.post('/query', databaseController.executeQuery);

module.exports = router;