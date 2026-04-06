# VPS Deployment Guide for Google Maps Scraper API

## 🚀 Step-by-Step Deployment

### Prerequisites
- VPS with root access (you're at `root@vmi3198927:~#`)
- Git installed
- Node.js 18+ installed
- Your GitHub repository URL

---

## 📋 Step 1: Install Node.js (if not installed)

```bash
# Check if Node.js is installed
node --version
npm --version

# If not installed, install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt-get install -y nodejs

# Verify installation
node --version  # Should show v18.x.x
npm --version   # Should show 9.x.x
```

---

## 📋 Step 2: Install Git (if not installed)

```bash
# Check if Git is installed
git --version

# If not installed, install Git
apt update
apt install git -y

# Verify installation
git --version
```

---

## 📋 Step 3: Clone Your Repository

```bash
# Navigate to your preferred directory (use /var/www for web apps)
cd /var/www

# Clone your repository
git clone https://github.com/Alucard17th/Google-Map-Scraper.git

# Navigate into the project directory
cd Google-Map-Scraper

# List contents to verify
ls -la
```

---

## 📋 Step 4: Install Dependencies

```bash
# Install all dependencies
npm install

# Verify installation (should show node_modules)
ls -la
```

---

## 📋 Step 5: Set Up Environment Variables

```bash
# Create production .env file
cp .env.example .env

# Edit the .env file for production
nano .env
```

**Edit your .env file:**
```env
# API Server Configuration
PORT=3001
API_BASE_URL=http://YOUR_VPS_IP:3001

# Screenshot Generator Configuration  
SCREENSHOT_BASE_URL=http://YOUR_VPS_IP:3000

# Environment
NODE_ENV=production

# Chrome Path (usually not needed on VPS)
# CHROME_PATH=/usr/bin/google-chrome
```

**Replace `YOUR_VPS_IP` with your actual VPS IP address.**

---

## 📋 Step 6: Install Chrome/Chromium for Screenshots

```bash
# Install Chromium (lighter than Chrome)
apt update
apt install chromium-browser -y

# Or install Google Chrome
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add -
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list
apt update
apt install google-chrome-stable -y

# Verify installation
google-chrome --version
# or
chromium-browser --version
```

---

## 📋 Step 7: Create Production Scripts

```bash
# Create a production startup script
nano start-api.sh
```

**Add this content to start-api.sh:**
```bash
#!/bin/bash
cd /var/www/Google-Map-Scraper
npm run api
```

```bash
# Make it executable
chmod +x start-api.sh

# Create a screenshot script
nano start-screenshots.sh
```

**Add this content to start-screenshots.sh:**
```bash
#!/bin/bash
cd /var/www/Google-Map-Scraper
npm run screenshots --force
```

```bash
# Make it executable
chmod +x start-screenshots.sh
```

---

## 📋 Step 8: Test the Application

```bash
# Test the scraper first
npm run scraper

# Test screenshots
npm run screenshots --force

# Test API server (in background)
npm run api &
```

**Test API endpoints:**
```bash
# Test health endpoint
curl http://localhost:3001/api/health

# Test businesses endpoint
curl http://localhost:3001/api/businesses
```

---

## 📋 Step 9: Set Up PM2 for Process Management

```bash
# Install PM2 globally
npm install -g pm2

# Create PM2 configuration file
nano ecosystem.config.js
```

**Add this content to ecosystem.config.js:**
```javascript
module.exports = {
  apps: [
    {
      name: 'google-scraper-api',
      script: 'api-server.js',
      cwd: '/var/www/Google-Map-Scraper',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: '/var/log/pm2/google-scraper-error.log',
      out_file: '/var/log/pm2/google-scraper-out.log',
      log_file: '/var/log/pm2/google-scraper-combined.log',
      time: true
    }
  ]
};
```

```bash
# Create log directory
mkdir -p /var/log/pm2

# Start the application with PM2
pm2 start ecosystem.config.js

# Check status
pm2 status

# View logs
pm2 logs google-scraper-api

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

---

## 📋 Step 10: Set Up Firewall

```bash
# Allow necessary ports
ufw allow 22      # SSH
ufw allow 3001   # API server
ufw allow 3000   # Your frontend app (if running)

# Enable firewall
ufw enable

# Check status
ufw status
```

---

## 📋 Step 11: Set Up Nginx Reverse Proxy (Optional but Recommended)

```bash
# Install Nginx
apt install nginx -y

# Create Nginx configuration
nano /etc/nginx/sites-available/google-scraper-api
```

**Add this content:**
```nginx
server {
    listen 80;
    server_name YOUR_VPS_IP;  # or your domain name

    location /api/ {
        proxy_pass http://localhost:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /screenshots/ {
        proxy_pass http://localhost:3001/screenshots/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Enable the site
ln -s /etc/nginx/sites-available/google-scraper-api /etc/nginx/sites-enabled/

# Remove default site
rm /etc/nginx/sites-enabled/default

# Test Nginx configuration
nginx -t

# Restart Nginx
systemctl restart nginx

# Enable Nginx on boot
systemctl enable nginx
```

---

## 📋 Step 12: Set Up SSL Certificate (Optional but Recommended)

```bash
# Install Certbot
apt install certbot python3-certbot-nginx -y

# Get SSL certificate (replace with your domain)
certbot --nginx -d yourdomain.com

# Set up auto-renewal
crontab -e
```

**Add this line for auto-renewal:**
```bash
0 12 * * * /usr/bin/certbot renew --quiet
```

---

## 📋 Step 13: Final Testing

```bash
# Test API from external connection
curl http://YOUR_VPS_IP:3001/api/health

# Test with Nginx (if set up)
curl http://YOUR_VPS_IP/api/health

# Check PM2 status
pm2 status

# Check logs if needed
pm2 logs google-scraper-api
```

---

## 🔄 Step 14: Update Workflow

**To update your application:**
```bash
cd /var/www/Google-Map-Scraper

# Pull latest changes
git pull origin main

# Install new dependencies
npm install

# Restart PM2
pm2 restart google-scraper-api
```

---

## 📊 Step 15: Monitoring

```bash
# Monitor PM2
pm2 monit

# Check system resources
htop
df -h
free -h

# Check API logs
tail -f /var/log/pm2/google-scraper-out.log
```

---

## 🎯 Complete Commands Summary

```bash
# 1. Install dependencies
apt update && apt install -y git nodejs npm chromium-browser

# 2. Clone repository
cd /var/www && git clone https://github.com/Alucard17th/Google-Map-Scraper.git

# 3. Setup project
cd Google-Map-Scraper
npm install
cp .env.example .env
nano .env  # Edit with your VPS IP

# 4. Install PM2
npm install -g pm2

# 5. Setup PM2 config
echo 'module.exports = {
  apps: [{
    name: "google-scraper-api",
    script: "api-server.js",
    cwd: "/var/www/Google-Map-Scraper",
    instances: 1,
    autorestart: true,
    env: { NODE_ENV: "production", PORT: 3001 }
  }]
};' > ecosystem.config.js

# 6. Start application
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# 7. Setup firewall
ufw allow 22 && ufw allow 3001 && ufw enable

# 8. Test
curl http://localhost:3001/api/health
```

---

## 🌐 Access Your API

Once deployed, your API will be available at:
- **Direct:** `http://YOUR_VPS_IP:3001/api/businesses`
- **With Nginx:** `http://YOUR_VPS_IP/api/businesses`

## 📱 WhatsApp Integration

Your API is now ready for WhatsApp integration with:
- **Business data:** `/api/businesses`
- **Screenshots:** `/screenshots/{filename}`
- **Individual businesses:** `/api/business/{slug}`

**🎉 Your Google Maps Scraper API is now live on your VPS!**
