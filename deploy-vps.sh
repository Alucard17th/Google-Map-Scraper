#!/bin/bash

# VPS Deployment Script for Google Maps Cron Scraper
echo "🚀 Starting VPS Deployment..."

# Update system
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Node.js (if not installed)
if ! command -v node &> /dev/null; then
    echo "📥 Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Install Chrome/Chromium for Puppeteer
echo "🌐 Installing Chromium..."
sudo apt-get install -y chromium-browser

# Install PM2 for process management
echo "⚙️ Installing PM2..."
sudo npm install -g pm2

# Create project directory
echo "📁 Creating project directory..."
sudo mkdir -p /opt/google-maps-scraper
sudo chown $USER:$USER /opt/google-maps-scraper

# Copy project files (run from project directory)
echo "📋 Copying project files..."
cp -r . /opt/google-maps-scraper/

# Navigate to project directory
cd /opt/google-maps-scraper

# Install dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Set Chrome path for Puppeteer
echo "🔧 Setting Chrome path..."
export CHROME_PATH=/usr/bin/chromium-browser
echo 'export CHROME_PATH=/usr/bin/chromium-browser' >> ~/.bashrc

# Create PM2 configuration file
echo "⚙️ Creating PM2 configuration..."
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'google-maps-scraper',
    script: 'cron-scraper.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      CHROME_PATH: '/usr/bin/chromium-browser'
    },
    error_file: '/opt/google-maps-scraper/logs/err.log',
    out_file: '/opt/google-maps-scraper/logs/out.log',
    log_file: '/opt/google-maps-scraper/logs/combined.log',
    time: true
  }]
};
EOF

# Create logs directory
mkdir -p logs

# Create systemd service for auto-start on boot
echo "🔧 Creating systemd service..."
sudo cat > /etc/systemd/system/google-maps-scraper.service << EOF
[Unit]
Description=Google Maps Scraper
After=network.target

[Service]
User=$USER
WorkingDirectory=/opt/google-maps-scraper
ExecStart=/usr/bin/pm2 start ecosystem.config.js
ExecReload=/usr/bin/pm2 reload ecosystem.config.js
ExecStop=/usr/bin/pm2 stop ecosystem.config.js
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
sudo systemctl enable google-maps-scraper.service
sudo systemctl start google-maps-scraper.service

echo "✅ Deployment completed!"
echo "📊 Check status with: pm2 status"
echo "📋 View logs with: pm2 logs google-maps-scraper"
echo "🔄 Restart with: pm2 restart google-maps-scraper"
