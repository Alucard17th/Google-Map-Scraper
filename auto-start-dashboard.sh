#!/bin/bash

# Auto-start WhatsApp Dashboard Server on boot/reboot
# Add this to root's crontab: @reboot /var/www/Google-Map-Scraper/auto-start-dashboard.sh

cd /var/www/Google-Map-Scraper

# Wait 30 seconds for system to fully boot
sleep 30

# Start the dashboard server
./start-dashboard.sh

# Log the auto-start
echo "$(date): WhatsApp Dashboard auto-started" >> /var/log/whatsapp-dashboard.log
