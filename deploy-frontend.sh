#!/bin/bash

echo "🚀 Deploying TITI Frontend to Firebase Hosting..."

# Kiểm tra nếu đã đăng nhập Firebase
if ! firebase projects:list > /dev/null 2>&1; then
    echo "❌ Chưa đăng nhập Firebase CLI"
    echo "Chạy: firebase login"
    exit 1
fi

# Build và deploy
echo "📦 Building and deploying..."
firebase deploy --only hosting

if [ $? -eq 0 ]; then
    echo "✅ Deploy thành công!"
    echo "🌐 Website: https://titi-8b326.web.app"
    echo "🔧 Firebase Console: https://console.firebase.google.com"
else
    echo "❌ Deploy thất bại!"
    exit 1
fi