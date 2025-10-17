const database = require('../../database');
const fs = require('fs');
const path = require('path');

// Lấy danh sách tất cả sản phẩm
exports.getAllProducts = async (req, res) => {
  try {
    const products = await database.getAllProducts();
    res.json({
      success: true,
      products
    });
  } catch (error) {
    console.error('Error retrieving products:', error);
    res.status(500).json({
      success: false,
      message: 'Không thể lấy danh sách sản phẩm. Vui lòng thử lại!'
    });
  }
};

// Lấy chi tiết một sản phẩm theo ID
exports.getProductDetail = async (req, res) => {
  try {
    const productId = req.params.id;
    const products = await database.getAllProducts();
    const product = products.find(p => p.id == productId);
    
    if (product) {
      res.json({ success: true, product });
    } else {
      res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });
    }
  } catch (error) {
    console.error('Error retrieving product detail:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Thêm sản phẩm mới
exports.addProduct = async (req, res) => {
  try {
    const product = req.body;
    
    // Xử lý upload file nếu có
    if (req.files && req.files.thumbnail) {
      const thumbnail = req.files.thumbnail;
      const imagesDir = path.join(__dirname, '../../images');
      
      if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
      }
      
      const thumbnailPath = path.join(imagesDir, thumbnail.name);
      await thumbnail.mv(thumbnailPath);
      product.thumbnail = `images/${thumbnail.name}`;
    }
    
    // Tính toán lại các trường số lượng
    let importedQuantity = parseInt(product.importedQuantity) || 0;
    let soldQuantity = parseInt(product.soldQuantity) || 0;
    let remainingQuantity = parseInt(product.remainingQuantity) || 0;
    
    if (!isNaN(importedQuantity) && !isNaN(soldQuantity)) {
      remainingQuantity = importedQuantity - soldQuantity;
    } else if (!isNaN(importedQuantity) && !isNaN(remainingQuantity)) {
      soldQuantity = importedQuantity - remainingQuantity;
    } else if (!isNaN(soldQuantity) && !isNaN(remainingQuantity)) {
      importedQuantity = soldQuantity + remainingQuantity;
    }
    
    product.importedQuantity = importedQuantity;
    product.soldQuantity = soldQuantity;
    product.remainingQuantity = remainingQuantity;
    
    await database.addProductToDatabase(product);
    res.json({
      success: true,
      message: 'Sản phẩm đã được thêm vào cơ sở dữ liệu.',
      product
    });
  } catch (error) {
    console.error('Error in adding product:', error);
    res.status(500).json({
      success: false,
      message: 'Không thể thêm sản phẩm. Vui lòng thử lại!'
    });
  }
};

// Cập nhật sản phẩm
exports.updateProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    
    // Kiểm tra xem productId có hợp lệ không
    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'ID sản phẩm không hợp lệ'
      });
    }
    
    // Khởi tạo product object an toàn
    const product = req.body || {};
    
    // Kiểm tra dữ liệu cơ bản
    if (!product.name || !product.importPrice || !product.salePrice) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin bắt buộc: tên sản phẩm, giá nhập, giá bán'
      });
    }
    
    // Gán ID sản phẩm
    product.id = productId;
    
    // Xử lý upload file nếu có
    if (req.files && req.files.thumbnail) {
      const thumbnail = req.files.thumbnail;
      const imagesDir = path.join(__dirname, '../../images');
      
      if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
      }
      
      const thumbnailPath = path.join(imagesDir, thumbnail.name);
      await thumbnail.mv(thumbnailPath);
      product.thumbnail = `images/${thumbnail.name}`;
    }
    
    // Tính toán lại các trường số lượng
    let importedQuantity = parseInt(product.importedQuantity) || 0;
    let soldQuantity = parseInt(product.soldQuantity) || 0;
    let remainingQuantity = parseInt(product.remainingQuantity) || 0;
    
    if (!isNaN(importedQuantity) && !isNaN(soldQuantity)) {
      remainingQuantity = importedQuantity - soldQuantity;
    } else if (!isNaN(importedQuantity) && !isNaN(remainingQuantity)) {
      soldQuantity = importedQuantity - remainingQuantity;
    } else if (!isNaN(soldQuantity) && !isNaN(remainingQuantity)) {
      importedQuantity = soldQuantity + remainingQuantity;
    }
    
    product.importedQuantity = importedQuantity;
    product.soldQuantity = soldQuantity;
    product.remainingQuantity = remainingQuantity;
    
    await database.updateProductInDatabase(product);
    res.json({
      success: true,
      message: 'Cập nhật sản phẩm thành công',
      product
    });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Có lỗi xảy ra khi cập nhật sản phẩm'
    });
  }
};

// Xóa sản phẩm
exports.deleteProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    await database.deleteProductFromDatabase(productId);
    res.json({
      success: true
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};