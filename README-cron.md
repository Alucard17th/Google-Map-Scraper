# Google Maps Cron Scraper

## Overview
This is an automated cron job version of the Google Maps scraper that runs daily and scrapes multiple business types across multiple regions based on a configuration file.

## Features
- **Automated Daily Execution**: Runs automatically at 2:00 AM daily
- **Configurable Business Types**: Define multiple business types and regions in config
- **IP Protection**: Human-like delays and rate limiting to avoid bans
- **JSON Export**: Clean JSON output with timestamp
- **Manual Testing**: Run manually for testing purposes

## Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Scraping
Edit `scraping-config.json` to customize:
- Business types and regions
- Safety settings (delays, limits)
- Schedule timing
- Output preferences

### 3. Run the Scraper

#### Manual Run (for testing)
```bash
node cron-scraper.js manual
```

#### Start Cron Scheduler
```bash
node cron-scraper.js
```

The scheduler will run continuously and execute scraping at the configured time.

## Configuration File Structure

### `scraping-config.json`

```json
{
  "scrapingConfig": [
    {
      "businessType": "plombier",
      "regions": ["Paris", "Lyon", "Marseille"],
      "maxResults": 5,
      "enabled": true
    }
  ],
  "safetySettings": {
    "dailyRequestLimit": 50,
    "minDelayBetweenRequests": 3000,
    "maxDelayBetweenRequests": 8000,
    "minDelayBetweenRegions": 5000,
    "maxDelayBetweenRegions": 10000,
    "minDelayBetweenBusinessTypes": 8000,
    "maxDelayBetweenBusinessTypes": 15000,
    "maxScrollsPerSearch": 3,
    "headless": true
  },
  "schedule": {
    "cronExpression": "0 2 * * *",
    "timezone": "Europe/Paris",
    "enabled": true
  },
  "output": {
    "format": "json",
    "directory": "Output",
    "includeTimestamp": true
  }
}
```

## Safety Features

### Rate Limiting
- **Daily Request Limit**: Maximum requests per day (default: 50)
- **Automatic Reset**: Counter resets daily
- **Graceful Stop**: Stops when limit reached

### Human-Like Behavior
- **Random Delays**: 3-8 seconds between requests
- **Region Delays**: 5-10 seconds between regions
- **Business Type Delays**: 8-15 seconds between business types
- **Reduced Scrolling**: Limited scrolls to appear more human

### Browser Configuration
- **Headless Mode**: Invisible browser operation
- **Stealth Plugin**: Anti-detection measures
- **Random User Agents**: Rotating browser signatures

## Output Files

Files are saved in the `Output/` directory with format:
- `daily_scraping_YYYY-MM-DDTHH-MM-SS.json`

### JSON Structure
```json
[
  {
    "name": "Business Name",
    "category": "Category",
    "rating": "4.5",
    "phone": "+33 1 23 45 67 89",
    "website": "https://example.com",
    "address": "123 Street, City, Country"
  }
]
```

## Cron Schedule

The default schedule is:
```
0 2 * * *
```
This means: **At 2:00 AM every day**

### Common Cron Expressions
- `0 2 * * *` - Daily at 2:00 AM
- `0 */6 * * *` - Every 6 hours
- `0 2 * * 1` - Weekly on Monday at 2:00 AM
- `0 2 1 * *` - Monthly on 1st at 2:00 AM

## Monitoring

The scraper provides detailed logging:
- 📅 Date and time of execution
- 🎯 Business types being processed
- 🌍 Regions being scraped
- ✅ Success/failure status
- 📊 Summary statistics
- ⚠️ Rate limit warnings

## Troubleshooting

### Common Issues

1. **Rate Limit Hit**
   - Reduce `dailyRequestLimit` in config
   - Increase delays between requests
   - Disable some business types

2. **No Results Found**
   - Check business type spelling
   - Verify region names
   - Try with broader search terms

3. **Browser Issues**
   - Ensure Chrome is installed
   - Check Chrome path in `getDefaultChromePath()`
   - Update Chrome/Chromium

### Safety Tips
- Start with conservative limits
- Monitor Google Maps for captcha warnings
- Use different times of day for testing
- Keep daily requests under 100

## Files

- `cron-scraper.js` - Main cron scraper
- `scraping-config.json` - Configuration file
- `scraper.js` - Original interactive scraper
- `package.json` - Dependencies and scripts

## Example Usage

1. **Configure** your business types in `scraping-config.json`
2. **Test manually**: `node cron-scraper.js manual`
3. **Start scheduler**: `node cron-scraper.js`
4. **Check results** in `Output/` directory

The scraper will automatically run daily and collect fresh data for all enabled configurations!
