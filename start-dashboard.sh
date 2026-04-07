#!/bin/bash

# WhatsApp Logs Dashboard Server
# Auto-starts PHP server on port 8083

cd /var/www/Google-Map-Scraper

# Kill any existing process on port 8083
pkill -f "php -S.*8083" 2>/dev/null

# Start PHP server in background
nohup php -S 0.0.0.0:8083 > /var/log/whatsapp-dashboard.log 2>&1 &

# Get the PID
SERVER_PID=$!

# Save PID for later use
echo $SERVER_PID > /var/run/whatsapp-dashboard.pid

echo "WhatsApp Dashboard Server Started!"
echo "PID: $SERVER_PID"
echo "URL: http://45.76.176.92:8083/whatsapp-logs.html"
echo "Logs: /var/log/whatsapp-dashboard.log"

# Wait a moment and check if it's running
sleep 2

if ps -p $SERVER_PID > /dev/null; then
    echo "Server is running successfully!"
else
    echo "Server failed to start. Check logs: /var/log/whatsapp-dashboard.log"
    exit 1
fi
