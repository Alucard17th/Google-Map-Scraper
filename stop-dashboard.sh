#!/bin/bash

# Stop WhatsApp Dashboard Server

echo "Stopping WhatsApp Dashboard Server..."

# Kill by PID if file exists
if [ -f /var/run/whatsapp-dashboard.pid ]; then
    PID=$(cat /var/run/whatsapp-dashboard.pid)
    if ps -p $PID > /dev/null; then
        kill $PID
        echo "Stopped server with PID: $PID"
    else
        echo "Server with PID $PID not running"
    fi
    rm -f /var/run/whatsapp-dashboard.pid
fi

# Kill any remaining PHP processes on port 8083
pkill -f "php -S.*8083" 2>/dev/null

echo "WhatsApp Dashboard Server stopped!"
