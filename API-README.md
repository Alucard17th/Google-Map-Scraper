# Business Data API Documentation

## 🚀 Overview

This API provides access to scraped business data and screenshots from Google Maps. It automatically serves the latest JSON file from the `Output/NoWebsites` directory and provides image URLs for business proposals.

## 🌐 Server Setup

### Start the API Server
```bash
npm run api
# or
node api-server.js
```

The server runs on `http://localhost:3001` by default.

## 📁 Project Structure

```
Google-Map-Scraper/
├── Output/
│   ├── NoWebsites/           # Latest JSON data files
│   │   └── no-website-businesses_2026-04-05T18-44-20.json
│   └── Screenshots/          # Business proposal screenshots
│       ├── epp-entreprise-prigueux-plomberie.png
│       ├── mp-vaz-plombier-prigueux.png
│       └── ...
├── api-server.js             # Express API server
├── no-website-scraper.js     # Business data scraper
├── screenshot-generator.js   # Screenshot automation
└── package.json
```

## 🔗 API Endpoints

### 1. Health Check
```http
GET /api/health
```

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2026-04-05T20:15:30.123Z",
  "version": "1.0.0"
}
```

### 2. Get All Businesses (Latest Data)
```http
GET /api/businesses
```

**Response:**
```json
{
  "metadata": {
    "sourceFile": "no-website-businesses_2026-04-05T18-44-20.json",
    "lastModified": "2026-04-05T20:44:20.000Z",
    "totalBusinesses": 11,
    "apiVersion": "1.0.0"
  },
  "statistics": {
    "total": 11,
    "withScreenshots": 11,
    "withoutScreenshots": 0,
    "byCategory": {
      "Plombier": 10,
      "Chauffagiste": 1
    }
  },
  "businesses": [
    {
      "name": "EPP - Entreprise Périgueux plomberie",
      "slug": "epp-entreprise-prigueux-plomberie",
      "category": "Plombier",
      "rating": "4.3",
      "reviews": [...],
      "phone": "+33 6 58 31 85 96",
      "website": "",
      "address": "151 Rue Victor Hugo, 24000 Périgueux, France",
      "whatsappSent": false,
      "screenshotUrl": "./Screenshots/epp-entreprise-prigueux-plomberie.png",
      "fullImageUrl": "http://localhost:3001/screenshots/epp-entreprise-prigueux-plomberie.png",
      "imagePreview": "http://localhost:3001/screenshots/epp-entreprise-prigueux-plomberie.png",
      "apiUrls": {
        "self": "http://localhost:3001/api/business/epp-entreprise-prigueux-plomberie",
        "screenshot": "http://localhost:3001/screenshots/epp-entreprise-prigueux-plomberie.png"
      }
    }
  ]
}
```

### 3. Get Specific Business
```http
GET /api/business/{slug}
```

**Example:**
```http
GET /api/business/epp-entreprise-prigueux-plomberie
```

**Response:** Single business object with full image URLs

### 4. Get All Screenshots Info
```http
GET /api/screenshots
```

**Response:**
```json
{
  "screenshots": [
    {
      "filename": "epp-entreprise-prigueux-plomberie.png",
      "url": "http://localhost:3001/screenshots/epp-entreprise-prigueux-plomberie.png",
      "preview": "http://localhost:3001/screenshots/epp-entreprise-prigueux-plomberie.png",
      "size": 245760,
      "created": "2026-04-05T20:01:06.000Z"
    }
  ],
  "total": 11,
  "directory": "f:\\WORK\\MapGoogleScrap\\Google-Map-Scraper\\Output\\Screenshots"
}
```

### 5. API Documentation
```http
GET /api/docs
```

Returns complete API documentation in JSON format.

### 6. Serve Images
```http
GET /screenshots/{filename}
```

**Example:**
```http
GET /screenshots/epp-entreprise-prigueux-plomberie.png
```

**Response:** The actual PNG image file

## 🛠️ Usage Examples

### Frontend Integration

```javascript
// Fetch all businesses with images
async function fetchBusinesses() {
  const response = await fetch('http://localhost:3001/api/businesses');
  const data = await response.json();
  
  return data.businesses.map(business => ({
    ...business,
    imageUrl: business.fullImageUrl,
    thumbnailUrl: business.imagePreview
  }));
}

// Fetch specific business
async function fetchBusiness(slug) {
  const response = await fetch(`http://localhost:3001/api/business/${slug}`);
  return await response.json();
}

// Get screenshot list
async function fetchScreenshots() {
  const response = await fetch('http://localhost:3001/api/screenshots');
  return await response.json();
}
```

### WhatsApp Integration

```javascript
// Get businesses ready for WhatsApp messaging
async function getBusinessesForWhatsApp() {
  const response = await fetch('http://localhost:3001/api/businesses');
  const data = await response.json();
  
  return data.businesses
    .filter(business => !business.whatsappSent && business.screenshotUrl)
    .map(business => ({
      name: business.name,
      phone: business.phone,
      slug: business.slug,
      screenshotUrl: business.fullImageUrl,
      category: business.category,
      rating: business.rating
    }));
}
```

## 📊 Data Structure

### Business Object
```json
{
  "name": "Business Name",
  "slug": "business-slug",
  "category": "Plombier",
  "rating": "4.3",
  "reviews": [
    {
      "author": "Customer Name",
      "rating": "5",
      "text": "Review text...",
      "date": "il y a 2 ans"
    }
  ],
  "phone": "+33 6 XX XX XX XX",
  "website": "",
  "address": "Full Address",
  "whatsappSent": false,
  "screenshotUrl": "./Screenshots/business-slug.png",
  "fullImageUrl": "http://localhost:3001/screenshots/business-slug.png",
  "imagePreview": "http://localhost:3001/screenshots/business-slug.png",
  "apiUrls": {
    "self": "http://localhost:3001/api/business/business-slug",
    "screenshot": "http://localhost:3001/screenshots/business-slug.png"
  }
}
```

## 🔄 Workflow Integration

### Complete Workflow
```bash
# 1. Scrape new businesses
npm run scraper

# 2. Generate screenshots
npm run screenshots --force

# 3. Start API server
npm run api

# 4. Access data at http://localhost:3001/api/businesses
```

### Automation Script
```javascript
// automation.js
import { exec } from 'child_process';
import fetch from 'node-fetch';

async function fullWorkflow() {
  console.log('🚀 Starting full workflow...');
  
  // 1. Run scraper
  await new Promise(resolve => {
    exec('npm run scraper', resolve);
  });
  
  // 2. Generate screenshots
  await new Promise(resolve => {
    exec('npm run screenshots --force', resolve);
  });
  
  // 3. Get latest data
  const response = await fetch('http://localhost:3001/api/businesses');
  const data = await response.json();
  
  console.log(`✅ Ready with ${data.businesses.length} businesses`);
  return data;
}
```

## 🔧 Configuration

### Environment Variables
```bash
PORT=3001                    # API server port
NODE_ENV=development         # Environment
```

### Custom Routes
You can easily extend the API by adding new routes to `api-server.js`:

```javascript
// Add custom statistics endpoint
app.get('/api/stats/category/:category', (req, res) => {
  const { category } = req.params;
  // Custom logic here
});
```

## 🚨 Error Handling

### Common Errors
- **404**: No JSON files found or business not found
- **500**: File system errors or JSON parsing errors
- **400**: Invalid parameters

### Error Response Format
```json
{
  "error": "Error type",
  "message": "Detailed error message",
  "path": "/api/businesses"
}
```

## 📱 Mobile & WhatsApp Ready

The API provides:
- **Optimized image URLs** for mobile viewing
- **Business slugs** for URL routing
- **Phone numbers** formatted for WhatsApp
- **Screenshot URLs** ready for sharing
- **JSON responses** perfect for mobile apps

**Perfect for WhatsApp messaging campaigns!** 📱
