#!/bin/bash

# Deploy script for TITI application
echo "🚀 Bắt đầu quá trình deploy..."

# Cập nhật code từ git
echo "📡 Pulling latest code..."
git pull origin main

# Cài đặt dependencies
echo "📦 Installing dependencies..."
npm install --production

# Restart application với PM2
echo "🔄 Restarting application..."
pm2 restart titi || pm2 start server.js --name titi

# Reload nginx (nếu có)
echo "🌐 Reloading nginx..."
sudo nginx -t && sudo systemctl reload nginx

echo "✅ Deploy hoàn thành!"