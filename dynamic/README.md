# Dynamic Scraper

A configurable scraper for different business types and regions, based on the no-website scraper but with dynamic configuration support.

## Features

- **Multiple Business Types**: Plombier, Chauffagiste, Electricien, Carreleur, Peintre
- **Configurable Regions**: Different cities per business type
- **Independent Progress Tracking**: Separate progress files per business type
- **Flexible Configuration**: Easy to add new business types and regions
- **Status Monitoring**: Track progress for all business types

## Usage

### List Available Business Types
```bash
npm run scrape-dynamic-list
```

### Check Status of All Business Types
```bash
npm run scrape-dynamic-status
```

### Scrape Specific Business Type
```bash
# Scrape plumbers
npm run scrape-dynamic-plombier

# Scrape heating technicians
npm run scrape-dynamic-chauffagiste

# Scrape electricians
npm run scrape-dynamic-electricien

# Scrape tilers
npm run scrape-dynamic-carreleur

# Scrape painters
npm run scrape-dynamic-peintre
```

### Manual Usage
```bash
# Scrape specific business type
node dynamic-scraper.js --type=plombier

# Show status
node dynamic-scraper.js --status

# List types
node dynamic-scraper.js --list-types
```

## Configuration

### Business Types Configuration

Edit `dynamic-config.json` to configure:

- **Business Types**: Add new business types with search terms
- **Regions**: Specify cities/regions per business type
- **Scraping Settings**: Delays, batch sizes, browser settings
- **Filters**: Keywords for including/excluding businesses

### Example Configuration
```json
{
  "businessTypes": [
    {
      "name": "plombier",
      "searchTerm": "plombier sans site web France",
      "maxResults": 30,
      "batchSize": 3,
      "regions": ["Paris", "Lyon", "Marseille"]
    }
  ]
}
```

## Progress Tracking

Each business type has its own progress file:

- `dynamic-progress-plombier.json`
- `dynamic-progress-chauffagiste.json`
- `dynamic-progress-electricien.json`
- etc.

Progress files track:
- Completed regions
- Total businesses found
- Last run timestamp
- Current region being processed

## Output Structure

```
Output/NoWebsites/
  plombier-Paris.json
  plombier-Lyon.json
  chauffagiste-Marseille.json
  electricien-Toulouse.json
  etc.
```

## Adding New Business Types

1. Edit `dynamic-config.json`
2. Add new business type to the `businessTypes` array
3. Specify search term, regions, and settings
4. The scraper will automatically create progress files

## Monitoring

### Check Overall Status
```bash
npm run scrape-dynamic-status
```

### Check Specific Business Type
```bash
cat dynamic-progress-plombier.json
```

### View Recent Results
```bash
ls -la Output/NoWebsites/plombier-*.json
```

## Troubleshooting

### Common Issues

1. **Browser Launch Failures**: Ensure Puppeteer dependencies are installed
2. **Rate Limiting**: Increase delays in configuration
3. **Empty Results**: Check search terms and region names

### Reset Progress

To reset progress for a business type:
```bash
rm dynamic-progress-plombier.json
```

## Configuration Options

### Delays (in milliseconds)
- `betweenResults`: Delay between processing results
- `betweenRegions`: Delay between regions
- `betweenBusinesses`: Delay between individual businesses
- `pageLoad`: Delay after page load

### Browser Settings
- `headless`: Run browser in headless mode
- `viewport`: Browser window dimensions

### Filters
- `excludeKeywords`: Skip businesses with these keywords
- `includeKeywords`: Only include businesses with these keywords
- `minRating`: Minimum star rating

## Integration

The dynamic scraper integrates with:
- **API Server**: Serves scraped data via REST API
- **WhatsApp Sender**: Sends messages to scraped businesses
- **Dashboard**: Visualizes scraping progress and results

## Best Practices

1. **Start Small**: Test with one business type first
2. **Monitor Progress**: Use status commands regularly
3. **Respect Rate Limits**: Configure appropriate delays
4. **Backup Data**: Regular backup of output files
5. **Review Results**: Manually verify scraped data quality
