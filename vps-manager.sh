#!/bin/bash

# VPS Management Script for Google Maps Scraper
case "$1" in
    start)
        echo "🚀 Starting Google Maps Scraper..."
        cd /opt/google-maps-scraper
        pm2 start ecosystem.config.js
        sudo systemctl start google-maps-scraper.service
        echo "✅ Scraper started"
        ;;
    
    stop)
        echo "🛑 Stopping Google Maps Scraper..."
        pm2 stop google-maps-scraper
        sudo systemctl stop google-maps-scraper.service
        echo "✅ Scraper stopped"
        ;;
    
    restart)
        echo "🔄 Restarting Google Maps Scraper..."
        pm2 restart google-maps-scraper
        echo "✅ Scraper restarted"
        ;;
    
    status)
        echo "📊 Google Maps Scraper Status:"
        pm2 status google-maps-scraper
        echo ""
        echo "📋 Recent Logs:"
        pm2 logs google-maps-scraper --lines 20
        ;;
    
    logs)
        echo "📋 Viewing logs (press Ctrl+C to exit)..."
        pm2 logs google-maps-scraper
        ;;
    
    update)
        echo "🔄 Updating Google Maps Scraper..."
        cd /opt/google-maps-scraper
        pm2 stop google-maps-scraper
        
        # Backup current version
        cp -r . ../google-maps-scraper-backup-$(date +%Y%m%d)
        
        # Pull latest code (adjust if using git)
        # git pull origin main
        
        # Install dependencies
        npm install
        
        # Restart
        pm2 start ecosystem.config.js
        echo "✅ Scraper updated and restarted"
        ;;
    
    backup)
        echo "💾 Creating backup..."
        cd /opt/google-maps-scraper
        tar -czf ../backups/google-maps-scraper-$(date +%Y%m%d).tar.gz .
        echo "✅ Backup created in /opt/backups/"
        ;;
    
    manual-run)
        echo "🔧 Running manual test..."
        cd /opt/google-maps-scraper
        node cron-scraper.js manual
        ;;
    
    *)
        echo "Google Maps Scraper VPS Management"
        echo ""
        echo "Usage: $0 {start|stop|restart|status|logs|update|backup|manual-run}"
        echo ""
        echo "Commands:"
        echo "  start      - Start the scraper service"
        echo "  stop       - Stop the scraper service"
        echo "  restart    - Restart the scraper service"
        echo "  status     - Show current status and recent logs"
        echo "  logs       - View live logs"
        echo "  update     - Update the scraper (requires git setup)"
        echo "  backup     - Create backup of current installation"
        echo "  manual-run - Run manual test scrape"
        ;;
esac
