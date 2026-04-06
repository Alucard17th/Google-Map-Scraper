# Spaceship Subdomain Setup Guide for VPS API

## 🌐 Step-by-Step Subdomain Configuration

### Prerequisites
- Spaceship account with domain access
- Your VPS IP address (e.g., 123.45.67.89)
- API running on port 3001 (or your configured port)

---

## 📋 Step 1: Get Your VPS IP Address

```bash
# On your VPS, get your public IP
curl ifconfig.me
# OR
curl ipinfo.io/ip
```

**Note down this IP address** - you'll need it for DNS configuration.

---

## 📋 Step 2: Create Subdomain in Spaceship

### 2.1 Login to Spaceship
1. Go to [spaceship.com](https://spaceship.com)
2. Login to your account
3. Navigate to **Domains** section

### 2.2 Select Your Domain
1. Choose the domain you want to create a subdomain for
2. Click on **DNS Management** or **DNS Settings**

### 2.3 Add DNS Record
Click **Add Record** and configure:

**For API Subdomain (recommended):**
```
Type: A
Name: api
TTL: 3600 (or default)
Value: YOUR_VPS_IP_ADDRESS
```

**For Full Application:**
```
Type: A
Name: app
TTL: 3600 (or default)
Value: YOUR_VPS_IP_ADDRESS
```

**Example:**
- If your domain is `yourdomain.com`
- Subdomain `api` will create `api.yourdomain.com`
- Pointing to your VPS IP: `123.45.67.89`

---

## 📋 Step 3: Wait for DNS Propagation

DNS changes typically take 5-30 minutes to propagate globally.

**Test DNS propagation:**
```bash
# On your local machine
nslookup api.yourdomain.com
# OR
dig api.yourdomain.com
# OR
ping api.yourdomain.com
```

---

## 📋 Step 4: Update Your VPS Environment

### 4.1 Update .env File
```bash
# On your VPS
nano /var/www/Google-Map-Scraper/.env
```

**Update these lines:**
```env
# API Server Configuration
PORT=3001
API_BASE_URL=http://api.yourdomain.com:3001

# Screenshot Generator Configuration  
SCREENSHOT_BASE_URL=http://api.yourdomain.com:3000

# WhatsApp Evolution API Configuration
EVOLUTION_API_KEY=20ac7106ac9d648ca34cf66bcb824fbd335fbda141658332aaf1e1cc7d07da19
EVOLUTION_API_URL=https://business.grow-with-tools.com/message/sendText/wa1

# Environment
NODE_ENV=production
```

### 4.2 Restart Your Application
```bash
cd /var/www/Google-Map-Scraper
pm2 restart google-scraper-api
```

---

## 📋 Step 5: Set Up Nginx Reverse Proxy (Recommended)

### 5.1 Install Nginx (if not installed)
```bash
apt update
apt install nginx -y
```

### 5.2 Create Nginx Configuration
```bash
nano /etc/nginx/sites-available/api.yourdomain.com
```

**Add this configuration:**
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # API routes
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
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Screenshot images
    location /screenshots/ {
        proxy_pass http://localhost:3001/screenshots/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Cache images for better performance
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Health check endpoint
    location /health {
        proxy_pass http://localhost:3001/api/health;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Default response for unknown routes
    location / {
        return 200 '{"message": "Google Maps Scraper API", "status": "running", "endpoints": ["/api/health", "/api/businesses", "/api/business/:slug", "/api/screenshots"]}';
        add_header Content-Type application/json;
    }
}
```

### 5.3 Enable the Site
```bash
# Create symbolic link
ln -s /etc/nginx/sites-available/api.yourdomain.com /etc/nginx/sites-enabled/

# Remove default site
rm /etc/nginx/sites-enabled/default

# Test Nginx configuration
nginx -t

# Restart Nginx
systemctl restart nginx
systemctl enable nginx

# Check status
systemctl status nginx
```

---

## 📋 Step 6: Set Up SSL Certificate (HTTPS)

### 6.1 Install Certbot
```bash
apt install certbot python3-certbot-nginx -y
```

### 6.2 Get SSL Certificate
```bash
# Replace with your actual subdomain
certbot --nginx -d api.yourdomain.com
```

### 6.3 Test Auto-Renewal
```bash
certbot renew --dry-run
```

### 6.4 Set Up Auto-Renewal Cron Job
```bash
crontab -e
```

**Add this line:**
```bash
0 12 * * * /usr/bin/certbot renew --quiet
```

---

## 📋 Step 7: Update Firewall

```bash
# Allow HTTP and HTTPS
ufw allow 80
ufw allow 443
ufw allow 22  # SSH

# Enable firewall if not already enabled
ufw enable

# Check status
ufw status
```

---

## 📋 Step 8: Test Your Subdomain

### 8.1 Test API Endpoints
```bash
# Test health endpoint
curl https://api.yourdomain.com/api/health

# Test businesses endpoint
curl https://api.yourdomain.com/api/businesses

# Test screenshots
curl https://api.yourdomain.com/api/screenshots
```

### 8.2 Test in Browser
Open these URLs in your browser:
- `https://api.yourdomain.com/api/health`
- `https://api.yourdomain.com/api/businesses`
- `https://api.yourdomain.com/api/docs`

---

## 📋 Step 9: Update WhatsApp Sender

### 9.1 Update .env on VPS
```bash
nano /var/www/Google-Map-Scraper/.env
```

**Update API_BASE_URL:**
```env
API_BASE_URL=https://api.yourdomain.com
```

### 9.2 Restart WhatsApp Service
```bash
cd /var/www/Google-Map-Scraper
pm2 restart google-scraper-api
```

---

## 📋 Step 10: Monitor and Troubleshoot

### 10.1 Check Logs
```bash
# Nginx logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# API logs
pm2 logs google-scraper-api

# System logs
journalctl -u nginx
```

### 10.2 Test DNS Resolution
```bash
# From your VPS
nslookup api.yourdomain.com
dig api.yourdomain.com

# From your local machine
ping api.yourdomain.com
```

### 10.3 Check SSL Certificate
```bash
# Check certificate details
openssl s_client -connect api.yourdomain.com:443

# Check certificate expiry
certbot certificates
```

---

## 🎯 Complete Commands Summary

```bash
# 1. Get VPS IP
curl ifconfig.me

# 2. Setup Nginx
apt install nginx -y

# 3. Create Nginx config
cat > /etc/nginx/sites-available/api.yourdomain.com << 'EOF'
server {
    listen 80;
    server_name api.yourdomain.com;
    location /api/ {
        proxy_pass http://localhost:3001/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location /screenshots/ {
        proxy_pass http://localhost:3001/screenshots/;
        expires 1y;
    }
}
EOF

# 4. Enable site
ln -s /etc/nginx/sites-available/api.yourdomain.com /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx

# 5. Setup SSL
apt install certbot python3-certbot-nginx -y
certbot --nginx -d api.yourdomain.com

# 6. Update firewall
ufw allow 80 && ufw allow 443

# 7. Test
curl https://api.yourdomain.com/api/health
```

---

## 🌐 Final URLs

Once configured, your API will be accessible at:

**API Endpoints:**
- **Health:** `https://api.yourdomain.com/api/health`
- **Businesses:** `https://api.yourdomain.com/api/businesses`
- **Specific Business:** `https://api.yourdomain.com/api/business/{slug}`
- **Screenshots:** `https://api.yourdomain.com/api/screenshots`
- **Images:** `https://api.yourdomain.com/screenshots/{filename}`

**WhatsApp Integration:**
- Your WhatsApp messages will now include links like:
  `https://api.yourdomain.com/screenshots/business-name.png`

---

## 🔧 Troubleshooting Common Issues

### DNS Not Propagating
- Wait 15-30 minutes
- Clear your local DNS cache: `ipconfig /flushdns` (Windows) or `sudo dscacheutil -flushcache` (Mac)

### Nginx 502 Bad Gateway
- Check if your API is running: `pm2 status`
- Check Nginx error logs: `tail -f /var/log/nginx/error.log`

### SSL Certificate Issues
- Check Certbot status: `certbot certificates`
- Renew manually: `certbot renew`

### Firewall Blocking
- Check UFW status: `ufw status`
- Allow ports: `ufw allow 80,443/tcp`

---

## 🎉 Success!

Your subdomain is now pointing to your VPS API with:
- ✅ **HTTPS** encryption
- ✅ **Professional URL** (api.yourdomain.com)
- ✅ **SSL certificate** auto-renewal
- ✅ **Nginx reverse proxy** for performance
- ✅ **WhatsApp integration** ready

**🚀 Your Google Maps Scraper API is now live with a professional subdomain!**
