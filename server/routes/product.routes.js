const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');

// Routes quản lý sản phẩm
router.get('/', productController.getAllProducts);
router.get('/:id', productController.getProductDetail);
router.post('/', productController.addProduct);
router.put('/:id', productController.updateProduct);
router.delete('/:id', productController.deleteProduct);

module.exports = router;