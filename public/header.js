// Header functionality
(function() {
    // Kiểm tra xem có đang chạy trong Electron hay không
    const isElectron = window.navigator.userAgent.toLowerCase().indexOf('electron') !== -1;
    
    // Get API config
    const getApiUrl = (endpoint) => {
        if (isElectron) {
            return `http://localhost:3000/api${endpoint}`;
        }
        return window.API_CONFIG ? `${window.API_CONFIG.apiURL}${endpoint}` : `/api${endpoint}`;
    };
    
    // Tạo HTML cho header
    function createHeader() {
        const headerHTML = `
            <header class="main-header">
                <div class="header-container">
                    <a href="main-page.html" class="header-logo">
                        <h1>TITI</h1>
                    </a>
                    
                    <nav class="header-nav">
                        <a href="main-page.html" class="nav-item" data-page="main-page">Trang chủ</a>
                        <a href="product-list.html" class="nav-item" data-page="product-list">Danh sách sản phẩm</a>
                        <a href="store-management.html" class="nav-item" data-page="store-management">Quản lý cửa hàng</a>
                        <a href="database-viewer.html" class="nav-item" data-page="database-viewer">Cơ sở dữ liệu</a>
                        <a href="accounts.html" class="nav-item" data-page="accounts">Tài khoản</a>
                    </nav>
                    
                    <div class="header-user">
                        <div class="user-info">
                            <div class="user-avatar" id="userAvatar">U</div>
                            <span id="userFullName">Người dùng</span>
                        </div>
                        <a href="#" class="logout-btn" onclick="logout()">Đăng xuất</a>
                    </div>
                </div>
            </header>
        `;
        
        // Chèn header vào đầu body
        document.body.insertAdjacentHTML('afterbegin', headerHTML);
    }
    
    // Cập nhật trạng thái active cho navigation
    function updateActiveNav() {
        const currentPage = window.location.pathname.split('/').pop().replace('.html', '');
        const navItems = document.querySelectorAll('.nav-item');
        
        navItems.forEach(item => {
            const itemPage = item.getAttribute('data-page');
            if (itemPage === currentPage) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }
    
    // Cập nhật thông tin người dùng
    function updateUserInfo() {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const userFullNameElement = document.getElementById('userFullName');
        const userAvatarElement = document.getElementById('userAvatar');
        
        if (user.fullName) {
            userFullNameElement.textContent = user.fullName;
            // Lấy chữ cái đầu của tên để làm avatar
            const firstLetter = user.fullName.charAt(0).toUpperCase();
            userAvatarElement.textContent = firstLetter;
        } else if (user.username) {
            userFullNameElement.textContent = user.username;
            const firstLetter = user.username.charAt(0).toUpperCase();
            userAvatarElement.textContent = firstLetter;
        }
    }
    
    // Hàm đăng xuất
    window.logout = async function() {
        if (confirm('Bạn có chắc chắn muốn đăng xuất?')) {
            try {
                // Xóa thông tin đăng nhập từ localStorage
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                
                // Nếu đang trong Electron, có thể gọi API logout
                if (isElectron) {
                    try {
                        const { ipcRenderer } = require('electron');
                        await ipcRenderer.invoke('logout');
                    } catch (error) {
                        console.warn('Không thể gọi logout IPC:', error);
                    }
                } else {
                    // Trong browser, gọi API logout
                    try {
                        await fetch(getApiUrl('/auth/logout'), {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            }
                        });
                    } catch (error) {
                        console.warn('Không thể gọi logout API:', error);
                    }
                }
                
                // Chuyển về trang đăng nhập
                window.location.href = 'index.html';
            } catch (error) {
                console.error('Lỗi khi đăng xuất:', error);
                // Vẫn chuyển về trang đăng nhập nếu có lỗi
                window.location.href = 'index.html';
            }
        }
    };
    
    // Khởi tạo header khi trang được tải
    function initHeader() {
        // Kiểm tra xem đã đăng nhập chưa
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = 'index.html';
            return;
        }
        
        // Tạo header
        createHeader();
        
        // Cập nhật trạng thái active
        updateActiveNav();
        
        // Cập nhật thông tin người dùng
        updateUserInfo();
    }
    
    // Khởi tạo khi DOM đã sẵn sàng
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initHeader);
    } else {
        initHeader();
    }
})();