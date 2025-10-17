const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const usersFilePath = path.join(__dirname, '../../users.json');

// Hàm để đọc dữ liệu người dùng từ file
const readUsersFile = async () => {
    try {
        const data = await fs.readFile(usersFilePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            // File không tồn tại, tạo file mới với mảng rỗng
            await fs.writeFile(usersFilePath, JSON.stringify({ users: [] }));
            return { users: [] };
        }
        throw error;
    }
};

// Hàm để ghi dữ liệu người dùng vào file
const writeUsersFile = async (data) => {
    await fs.writeFile(usersFilePath, JSON.stringify(data, null, 2));
};

// Tạo JWT token
const generateToken = (user) => {
    const payload = {
        id: user.id,
        username: user.username,
        role: user.role
    };

    return jwt.sign(payload, 'your_jwt_secret', { expiresIn: '1d' });
};

// Đăng nhập
exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;

        // Kiểm tra đầu vào
        if (!username || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Tên đăng nhập và mật khẩu là bắt buộc!' 
            });
        }

        // Sử dụng database thay vì file JSON
        const database = require('../../database');
        
        // Tìm người dùng trong cơ sở dữ liệu
        const user = await database.models.User.findOne({
            where: { username }
        });

        // Kiểm tra người dùng tồn tại
        if (!user) {
            return res.status(401).json({ 
                success: false, 
                message: 'Tên đăng nhập hoặc mật khẩu không chính xác!' 
            });
        }

        // Kiểm tra mật khẩu
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ 
                success: false, 
                message: 'Tên đăng nhập hoặc mật khẩu không chính xác!' 
            });
        }

        // Tạo token
        const token = generateToken({
            id: user.username, // Sử dụng username làm id vì đó là khóa chính trong model User
            username: user.username,
            role: 'user' // Mặc định là user vì model User hiện tại không có trường role
        });

        // Trả về thông tin người dùng (không bao gồm mật khẩu) và token
        res.status(200).json({
            success: true,
            message: 'Đăng nhập thành công!',
            user: {
                username: user.username,
                fullName: user.fullName
            },
            token
        });
    } catch (error) {
        console.error('Lỗi đăng nhập:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Có lỗi xảy ra khi đăng nhập!' 
        });
    }
};

// Đăng ký
exports.register = async (req, res) => {
    try {
        const { username, password, fullName } = req.body;

        // Kiểm tra đầu vào
        if (!username || !password || !fullName) {
            return res.status(400).json({ 
                success: false, 
                message: 'Vui lòng cung cấp tất cả thông tin bắt buộc!' 
            });
        }

        // Mã hóa mật khẩu
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Sử dụng database thay vì file JSON
        const database = require('../../database');
        
        // Gọi hàm tạo người dùng mới trong database.js
        const result = await database.createUser(username, hashedPassword, fullName);
        
        if (!result.success) {
            return res.status(400).json({ 
                success: false, 
                message: result.message || 'Có lỗi xảy ra khi đăng ký!' 
            });
        }

        res.status(201).json({
            success: true,
            message: 'Đăng ký thành công!',
            user: {
                username,
                fullName
            }
        });
    } catch (error) {
        console.error('Lỗi đăng ký:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Có lỗi xảy ra khi đăng ký!' 
        });
    }
};

// Lấy thông tin người dùng hiện tại
exports.getCurrentUser = async (req, res) => {
    try {
        // Thông tin người dùng được lấy từ req.user (được set trong middleware xác thực)
        if (!req.user) {
            return res.status(401).json({ 
                success: false, 
                message: 'Không được phép truy cập!' 
            });
        }

        // Đọc dữ liệu người dùng để lấy thông tin mới nhất
        const data = await readUsersFile();
        const user = data.users.find(user => user.id === req.user.id);

        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'Không tìm thấy thông tin người dùng!' 
            });
        }

        // Trả về thông tin người dùng (không bao gồm mật khẩu)
        const { password, ...userInfo } = user;
        
        res.status(200).json({
            success: true,
            user: userInfo
        });
    } catch (error) {
        console.error('Lỗi lấy thông tin người dùng:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Có lỗi xảy ra khi lấy thông tin người dùng!' 
        });
    }
};

// Lấy danh sách tất cả người dùng (chỉ admin)
exports.getAllUsers = async (req, res) => {
    try {
        // Kiểm tra quyền admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ 
                success: false, 
                message: 'Bạn không có quyền truy cập chức năng này!' 
            });
        }

        // Đọc dữ liệu người dùng
        const data = await readUsersFile();
        
        // Loại bỏ thông tin mật khẩu trước khi trả về
        const usersWithoutPasswords = data.users.map(user => {
            const { password, ...userInfo } = user;
            return userInfo;
        });
        
        res.status(200).json({
            success: true,
            users: usersWithoutPasswords
        });
    } catch (error) {
        console.error('Lỗi lấy danh sách người dùng:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Có lỗi xảy ra khi lấy danh sách người dùng!' 
        });
    }
};

// Lấy thông tin người dùng theo ID
exports.getUserById = async (req, res) => {
    try {
        const userId = req.params.id;
        
        // Kiểm tra quyền: chỉ admin hoặc chính người dùng đó mới có quyền xem
        if (req.user.role !== 'admin' && req.user.id !== userId) {
            return res.status(403).json({ 
                success: false, 
                message: 'Bạn không có quyền truy cập thông tin này!' 
            });
        }

        // Đọc dữ liệu người dùng
        const data = await readUsersFile();
        const user = data.users.find(user => user.id === userId);

        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'Không tìm thấy người dùng!' 
            });
        }

        // Trả về thông tin người dùng (không bao gồm mật khẩu)
        const { password, ...userInfo } = user;
        
        res.status(200).json({
            success: true,
            user: userInfo
        });
    } catch (error) {
        console.error('Lỗi lấy thông tin người dùng:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Có lỗi xảy ra khi lấy thông tin người dùng!' 
        });
    }
};

// Tạo người dùng mới (chỉ admin)
exports.createUser = async (req, res) => {
    try {
        // Kiểm tra quyền admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ 
                success: false, 
                message: 'Bạn không có quyền thực hiện chức năng này!' 
            });
        }

        const { username, password, fullName, role } = req.body;

        // Kiểm tra đầu vào
        if (!username || !password || !fullName) {
            return res.status(400).json({ 
                success: false, 
                message: 'Vui lòng cung cấp tất cả thông tin bắt buộc!' 
            });
        }

        // Đọc dữ liệu người dùng
        const data = await readUsersFile();
        
        // Kiểm tra username đã tồn tại chưa
        if (data.users.some(user => user.username === username)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Tên đăng nhập đã tồn tại!' 
            });
        }

        // Mã hóa mật khẩu
        const hashedPassword = await bcrypt.hash(password, 10);

        // Tạo người dùng mới
        const newUser = {
            id: uuidv4(),
            username,
            password: hashedPassword,
            fullName,
            role: role || 'user',
            createdAt: new Date().toISOString()
        };

        // Thêm người dùng mới vào dữ liệu
        data.users.push(newUser);
        await writeUsersFile(data);

        // Trả về thông tin người dùng (không bao gồm mật khẩu)
        const { password: userPassword, ...userInfo } = newUser;
        
        res.status(201).json({
            success: true,
            message: 'Tạo người dùng thành công!',
            user: userInfo
        });
    } catch (error) {
        console.error('Lỗi tạo người dùng:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Có lỗi xảy ra khi tạo người dùng!' 
        });
    }
};

// Cập nhật thông tin người dùng
exports.updateUser = async (req, res) => {
    try {
        const userId = req.params.id;
        const { username, password, fullName, role } = req.body;

        // Kiểm tra quyền: chỉ admin hoặc chính người dùng đó mới có quyền cập nhật
        // Ngoài ra, chỉ admin mới có quyền thay đổi role
        if (req.user.role !== 'admin' && req.user.id !== userId) {
            return res.status(403).json({ 
                success: false, 
                message: 'Bạn không có quyền thực hiện chức năng này!' 
            });
        }

        if (role && req.user.role !== 'admin') {
            return res.status(403).json({ 
                success: false, 
                message: 'Bạn không có quyền thay đổi vai trò người dùng!' 
            });
        }

        // Đọc dữ liệu người dùng
        const data = await readUsersFile();
        
        // Tìm người dùng cần cập nhật
        const userIndex = data.users.findIndex(user => user.id === userId);
        
        if (userIndex === -1) {
            return res.status(404).json({ 
                success: false, 
                message: 'Không tìm thấy người dùng!' 
            });
        }

        const user = data.users[userIndex];

        // Kiểm tra username đã tồn tại chưa (nếu thay đổi username)
        if (username && username !== user.username && 
            data.users.some(u => u.username === username)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Tên đăng nhập đã tồn tại!' 
            });
        }

        // Cập nhật thông tin người dùng
        if (username) user.username = username;
        if (fullName) user.fullName = fullName;
        if (role && req.user.role === 'admin') user.role = role;
        
        // Cập nhật mật khẩu nếu có
        if (password) {
            user.password = await bcrypt.hash(password, 10);
        }

        user.updatedAt = new Date().toISOString();

        // Lưu dữ liệu đã cập nhật
        data.users[userIndex] = user;
        await writeUsersFile(data);

        // Trả về thông tin người dùng đã cập nhật (không bao gồm mật khẩu)
        const { password: userPassword, ...userInfo } = user;
        
        res.status(200).json({
            success: true,
            message: 'Cập nhật thông tin người dùng thành công!',
            user: userInfo
        });
    } catch (error) {
        console.error('Lỗi cập nhật người dùng:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Có lỗi xảy ra khi cập nhật thông tin người dùng!' 
        });
    }
};

// Xóa người dùng (chỉ admin)
exports.deleteUser = async (req, res) => {
    try {
        const userId = req.params.id;

        // Kiểm tra quyền admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ 
                success: false, 
                message: 'Bạn không có quyền thực hiện chức năng này!' 
            });
        }

        // Không cho phép xóa chính mình
        if (req.user.id === userId) {
            return res.status(400).json({ 
                success: false, 
                message: 'Bạn không thể xóa tài khoản của chính mình!' 
            });
        }

        // Đọc dữ liệu người dùng
        const data = await readUsersFile();
        
        // Tìm người dùng cần xóa
        const userIndex = data.users.findIndex(user => user.id === userId);
        
        if (userIndex === -1) {
            return res.status(404).json({ 
                success: false, 
                message: 'Không tìm thấy người dùng!' 
            });
        }

        // Xóa người dùng
        data.users.splice(userIndex, 1);
        await writeUsersFile(data);
        
        res.status(200).json({
            success: true,
            message: 'Xóa người dùng thành công!'
        });
    } catch (error) {
        console.error('Lỗi xóa người dùng:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Có lỗi xảy ra khi xóa người dùng!' 
        });
    }
};

// Đổi mật khẩu
exports.changePassword = async (req, res) => {
    try {
        const userId = req.user.id;
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ 
                success: false, 
                message: 'Vui lòng cung cấp mật khẩu hiện tại và mật khẩu mới!' 
            });
        }

        // Đọc dữ liệu người dùng
        const data = await readUsersFile();
        const userIndex = data.users.findIndex(user => user.id === userId);
        
        if (userIndex === -1) {
            return res.status(404).json({ 
                success: false, 
                message: 'Không tìm thấy người dùng!' 
            });
        }

        const user = data.users[userIndex];

        // Kiểm tra mật khẩu hiện tại
        const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ 
                success: false, 
                message: 'Mật khẩu hiện tại không chính xác!' 
            });
        }

        // Mã hóa và cập nhật mật khẩu mới
        user.password = await bcrypt.hash(newPassword, 10);
        user.updatedAt = new Date().toISOString();
        
        // Lưu dữ liệu đã cập nhật
        data.users[userIndex] = user;
        await writeUsersFile(data);
        
        res.status(200).json({
            success: true,
            message: 'Đổi mật khẩu thành công!'
        });
    } catch (error) {
        console.error('Lỗi đổi mật khẩu:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Có lỗi xảy ra khi đổi mật khẩu!' 
        });
    }
};

// Đăng xuất
exports.logout = (req, res) => {
    try {
        // Trong thực tế, phía server không thể hủy JWT token
        // Vì vậy, việc đăng xuất thường được xử lý ở phía client
        // bằng cách xóa token đã lưu
        
        res.status(200).json({
            success: true,
            message: 'Đăng xuất thành công!'
        });
    } catch (error) {
        console.error('Lỗi đăng xuất:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Có lỗi xảy ra khi đăng xuất!' 
        });
    }
};

// Tạo middleware xác thực JWT
exports.authenticate = (req, res, next) => {
    try {
        // Lấy token từ header Authorization
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                success: false, 
                message: 'Không tìm thấy token xác thực!' 
            });
        }
        
        const token = authHeader.split(' ')[1];
        
        // Xác thực token
        jwt.verify(token, 'your_jwt_secret', (err, decoded) => {
            if (err) {
                return res.status(401).json({ 
                    success: false, 
                    message: 'Token không hợp lệ hoặc đã hết hạn!' 
                });
            }
            
            // Lưu thông tin người dùng đã giải mã vào request
            req.user = decoded;
            next();
        });
    } catch (error) {
        console.error('Lỗi xác thực:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Có lỗi xảy ra khi xác thực!' 
        });
    }
};

// Middleware kiểm tra quyền admin
exports.isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ 
            success: false, 
            message: 'Bạn không có quyền thực hiện chức năng này!' 
        });
    }
};