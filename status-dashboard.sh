#!/bin/bash

# Check WhatsApp Dashboard Server Status

echo "=== WhatsApp Dashboard Server Status ==="

# Check by PID file
if [ -f /var/run/whatsapp-dashboard.pid ]; then
    PID=$(cat /var/run/whatsapp-dashboard.pid)
    if ps -p $PID > /dev/null; then
        echo "Status: RUNNING"
        echo "PID: $PID"
        echo "URL: http://45.76.176.92:8083/whatsapp-logs.html"
        echo "Started: $(ps -o lstart= -p $PID)"
        echo "Memory: $(ps -o rss= -p $PID) KB"
    else
        echo "Status: NOT RUNNING (PID file exists but process dead)"
        echo "Cleaning up PID file..."
        rm -f /var/run/whatsapp-dashboard.pid
    fi
else
    echo "Status: NOT RUNNING (no PID file)"
fi

# Check if port 8083 is in use
if netstat -tuln | grep :8083 > /dev/null; then
    echo "Port 8083 is in use"
else
    echo "Port 8083 is free"
fi

# Show recent logs
if [ -f /var/log/whatsapp-dashboard.log ]; then
    echo ""
    echo "Recent logs:"
    tail -5 /var/log/whatsapp-dashboard.log
else
    echo "No log file found"
fi
