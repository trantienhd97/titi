// API Configuration for different environments
const API_CONFIG = {
  development: {
    baseURL: 'http://localhost:3000',
    apiURL: 'http://localhost:3000/api'
  },
  production: {
    baseURL: 'https://titi-backend-abc123.onrender.com', // Thay bằng URL backend thực tế từ Render
    apiURL: 'https://titi-backend-abc123.onrender.com/api'
  }
};

// Detect environment - Firebase domain sẽ được coi là production
const isDevelopment = window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1' ||
                     window.location.hostname.includes('localhost');

const environment = isDevelopment ? 'development' : 'production';

// Export config
window.API_CONFIG = API_CONFIG[environment];

// Debug info (chỉ trong development)
if (isDevelopment) {
  console.log('🔧 Running in development mode');
  console.log('API URL:', API_CONFIG[environment].apiURL);
} else {
  console.log('🚀 Running in production mode');
  console.log('Frontend:', window.location.origin);
  console.log('Backend API:', API_CONFIG[environment].apiURL);
}