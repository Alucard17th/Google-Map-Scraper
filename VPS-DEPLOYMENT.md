# Google Maps Scraper VPS Deployment Guide

## 🚀 Quick Setup

### 1. Upload to VPS
```bash
# Upload your project files to VPS
scp -r /path/to/Google-Map-Scraper user@your-vps-ip:/tmp/
```

### 2. Run Deployment Script
```bash
ssh user@your-vps-ip
cd /tmp/Google-Map-Scraper
chmod +x deploy-vps.sh
./deploy-vps.sh
```

### 3. Use VPS Manager
```bash
# Make manager script executable
chmod +x /opt/google-maps-scraper/vps-manager.sh

# Create symlink for easy access
sudo ln -s /opt/google-maps-scraper/vps-manager.sh /usr/local/bin/scraper-manager

# Now you can use from anywhere:
scraper-manager status
scraper-manager logs
scraper-manager manual-run
```

## 📋 VPS Management Commands

### Basic Operations
```bash
scraper-manager start     # Start the service
scraper-manager stop      # Stop the service
scraper-manager restart   # Restart the service
scraper-manager status    # Check status
scraper-manager logs      # View live logs
```

### Maintenance
```bash
scraper-manager manual-run  # Test manually
scraper-manager backup      # Create backup
scraper-manager update      # Update scraper
```

## 🔧 Configuration

### VPS-Specific Settings
The `scraping-config-vps.json` includes VPS optimizations:
- **More conservative delays** (8-15s between requests)
- **Lower daily limit** (25 requests)
- **Longer breaks** (10 minutes every 8 requests)
- **3:00 AM schedule** (off-peak hours)

### Environment Variables
```bash
# Set Chrome path
export CHROME_PATH=/usr/bin/chromium-browser

# Add to .bashrc for persistence
echo 'export CHROME_PATH=/usr/bin/chromium-browser' >> ~/.bashrc
```

## 📊 Monitoring

### Check Service Status
```bash
# PM2 status
pm2 status

# System service status
sudo systemctl status google-maps-scraper

# View logs
pm2 logs google-maps-scraper

# Resource usage
pm2 monit
```

### Log Files Location
```
/opt/google-maps-scraper/logs/
├── err.log       # Error logs
├── out.log       # Output logs
└── combined.log  # Combined logs
```

## 🔒 Security Recommendations

### 1. Firewall Setup
```bash
# Allow only necessary ports
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

### 2. User Permissions
```bash
# Run as non-root user (recommended)
sudo adduser scraper
sudo usermod -aG sudo scraper
# Then deploy as 'scraper' user
```

### 3. Auto-Updates
```bash
# Enable automatic security updates
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

## 📁 File Structure on VPS

```
/opt/google-maps-scraper/
├── cron-scraper.js              # Main scraper
├── scraping-config-vps.json     # VPS configuration
├── ecosystem.config.js          # PM2 config
├── package.json                 # Dependencies
├── node_modules/               # Node modules
├── Output/                     # Scraped data
├── logs/                       # Log files
└── vps-manager.sh              # Management script
```

## 🔄 Backup Strategy

### Automated Backups
```bash
# Create backup directory
sudo mkdir -p /opt/backups

# Add to crontab for daily backups
crontab -e
# Add line:
0 4 * * * /opt/google-maps-scraper/vps-manager.sh backup
```

### Manual Backup
```bash
scraper-manager backup
```

## 🐛 Troubleshooting

### Common Issues

1. **Chrome not found**
   ```bash
   sudo apt install chromium-browser
   export CHROME_PATH=/usr/bin/chromium-browser
   ```

2. **Permission errors**
   ```bash
   sudo chown -R $USER:$USER /opt/google-maps-scraper
   ```

3. **Memory issues**
   ```bash
   # Increase swap space
   sudo fallocate -l 2G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   ```

4. **Service not starting**
   ```bash
   sudo systemctl status google-maps-scraper
   journalctl -u google-maps-scraper
   ```

## 📈 Performance Monitoring

### System Resources
```bash
# CPU and memory usage
htop

# Disk usage
df -h

# Network activity
iftop
```

### PM2 Monitoring
```bash
# Real-time monitoring
pm2 monit

# Restart on memory issues
pm2 start ecosystem.config.js --max-memory-restart 1G
```

## 🌐 Accessing Data

### Download Results
```bash
# Download latest results
scp user@your-vps-ip:/opt/google-maps-scraper/Output/latest.json ./

# Download all results
scp -r user@your-vps-ip:/opt/google-maps-scraper/Output/ ./
```

### Web Server (Optional)
```bash
# Install nginx for web access
sudo apt install nginx

# Configure to serve Output directory
sudo nano /etc/nginx/sites-available/google-maps-scraper
```

## 📞 Support

### Getting Help
- Check logs: `scraper-manager logs`
- Check status: `scraper-manager status`
- Manual test: `scraper-manager manual-run`

### Emergency Stop
```bash
scraper-manager stop
pm2 delete google-maps-scraper
```

Your scraper is now production-ready on VPS! 🎉
