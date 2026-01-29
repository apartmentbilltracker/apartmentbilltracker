#!/bin/bash

# Apartment Bill Tracker - Mobile App Installation Script

echo "================================"
echo "Apartment Bill Tracker Mobile App"
echo "================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

echo "✅ Node.js found: $(node --version)"
echo ""

# Navigate to mobile directory
cd "$(dirname "$0")" || exit

# Install dependencies
echo "📦 Installing dependencies..."
npm install

echo ""
echo "✅ Installation complete!"
echo ""
echo "================================"
echo "Next Steps:"
echo "================================"
echo ""
echo "1. Update API Configuration:"
echo "   Edit: src/config/config.js"
echo "   Change API_BASE_URL to your backend server IP"
echo ""
echo "2. Start the development server:"
echo "   npm start"
echo ""
echo "3. Run on Android/iOS:"
echo "   - Download Expo Go app"
echo "   - Scan the QR code"
echo ""
echo "================================"
echo ""
