// API Server for Business Data and Screenshots
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const API_BASE_URL = process.env.API_BASE_URL || `http://localhost:${PORT}`;

// Middleware
app.use(express.json());
app.use('/screenshots', express.static(path.join(__dirname, 'Output/Screenshots')));

// Helper function to get the latest JSON file
function getLatestJsonFile() {
  try {
    const noWebsitesDir = path.join(__dirname, 'Output/NoWebsites');
    
    if (!fs.existsSync(noWebsitesDir)) {
      throw new Error('Output/NoWebsites directory not found');
    }

    const jsonFiles = fs.readdirSync(noWebsitesDir).filter(file => file.endsWith('.json'));
    
    if (jsonFiles.length === 0) {
      throw new Error('No JSON files found');
    }

    // Find the most recently created file
    let latestFile = null;
    let latestTime = 0;

    for (const jsonFile of jsonFiles) {
      const filePath = path.join(noWebsitesDir, jsonFile);
      const stats = fs.statSync(filePath);
      
      if (stats.mtimeMs > latestTime) {
        latestTime = stats.mtimeMs;
        latestFile = jsonFile;
      }
    }

    return {
      filename: latestFile,
      filepath: path.join(noWebsitesDir, latestFile),
      modifiedTime: new Date(latestTime).toISOString()
    };
  } catch (error) {
    console.error('Error finding latest JSON file:', error.message);
    return null;
  }
}

// Helper function to get business data with image URLs
function getBusinessDataWithImages(businesses) {
  // Ensure businesses is an array
  if (!Array.isArray(businesses)) {
    console.error('Businesses is not an array:', typeof businesses);
    return [];
  }
  
  return businesses.map(business => {
    const businessData = { ...business };
    
    // Add full screenshot URL if exists
    if (business.screenshotUrl) {
      businessData.fullImageUrl = `${API_BASE_URL}/screenshots/${path.basename(business.screenshotUrl)}`;
      businessData.imagePreview = `${API_BASE_URL}/screenshots/${path.basename(business.screenshotUrl)}`;
    }
    
    // Add API URLs for each business
    businessData.apiUrls = {
      self: `${API_BASE_URL}/api/business/${business.slug}`,
      screenshot: business.screenshotUrl ? `${API_BASE_URL}/screenshots/${path.basename(business.screenshotUrl)}` : null
    };
    
    return businessData;
  });
}

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Get latest business data
app.get('/api/businesses', (req, res) => {
  try {
    // Try to load merged file first
    const mergedFile = path.join(__dirname, 'Output', 'NoWebsites', 'all-businesses-merged.json');
    let businesses = [];
    let sourceFile = '';
    
    if (fs.existsSync(mergedFile)) {
      console.log('Loading merged businesses file...');
      const mergedData = JSON.parse(fs.readFileSync(mergedFile, 'utf8'));
      businesses = mergedData.businesses;
      sourceFile = 'all-businesses-merged.json';
      console.log(`Loaded ${businesses.length} businesses from merged file`);
      console.log('Businesses type:', typeof businesses);
      console.log('Businesses is array:', Array.isArray(businesses));
    } else {
      // Fallback to latest individual file
      const latestFile = getLatestJsonFile();
      
      if (!latestFile) {
        return res.status(404).json({
          error: 'No business data found',
          message: 'No JSON files found in Output/NoWebsites directory'
        });
      }

      const jsonData = fs.readFileSync(latestFile.filepath, 'utf-8');
      const data = JSON.parse(jsonData);
      businesses = data.businesses || data; // Handle both merged and regular format
      sourceFile = latestFile.filename;
    }
    
    // Ensure businesses is an array
    if (!Array.isArray(businesses)) {
      console.error('Businesses is not an array:', typeof businesses);
      console.error('Businesses value:', businesses);
      return res.status(500).json({
        error: 'Data format error',
        message: 'Businesses data is not in expected array format'
      });
    }
    
    console.log(`Businesses type: ${typeof businesses}, length: ${businesses.length}`);
    
    // Add image URLs and API links
    const businessesWithImages = getBusinessDataWithImages(businesses);
    
    // Statistics
    const stats = {
      total: businesses.length,
      withScreenshots: businesses.filter(b => b.screenshotUrl).length,
      withoutScreenshots: businesses.filter(b => !b.screenshotUrl).length,
      byCategory: businesses.reduce((acc, business) => {
        acc[business.category] = (acc[business.category] || 0) + 1;
        return acc;
      }, {})
    };

    res.json({
      metadata: {
        source: sourceFile,
        total: businesses.length,
        statistics: stats,
        lastUpdated: new Date().toISOString()
      },
      businesses: businessesWithImages
    });
  } catch (error) {
    console.error('Error loading businesses:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Get specific business by slug
app.get('/api/business/:slug', (req, res) => {
  try {
    const { slug } = req.params;
    const latestFile = getLatestJsonFile();
    
    if (!latestFile) {
      return res.status(404).json({
        error: 'No business data found'
      });
    }

    const jsonData = fs.readFileSync(latestFile.filepath, 'utf-8');
    const businesses = JSON.parse(jsonData);
    
    const business = businesses.find(b => b.slug === slug);
    
    if (!business) {
      return res.status(404).json({
        error: 'Business not found',
        slug: slug
      });
    }

    // Add image URLs and API links
    const businessWithImages = getBusinessDataWithImages([business])[0];
    
    res.json(businessWithImages);
    
  } catch (error) {
    console.error('Error fetching business:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Get screenshot info
app.get('/api/screenshots', (req, res) => {
  try {
    const screenshotsDir = path.join(__dirname, 'Output/Screenshots');
    
    if (!fs.existsSync(screenshotsDir)) {
      return res.json({
        screenshots: [],
        total: 0,
        directory: screenshotsDir
      });
    }

    const screenshotFiles = fs.readdirSync(screenshotsDir).filter(file => file.endsWith('.png'));
    
    const screenshots = screenshotFiles.map(file => ({
      filename: file,
      url: `${API_BASE_URL}/screenshots/${file}`,
      preview: `${API_BASE_URL}/screenshots/${file}`,
      size: fs.statSync(path.join(screenshotsDir, file)).size,
      created: fs.statSync(path.join(screenshotsDir, file)).mtime.toISOString()
    }));

    res.json({
      screenshots: screenshots,
      total: screenshots.length,
      directory: screenshotsDir
    });
    
  } catch (error) {
    console.error('Error fetching screenshots:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Get API documentation
app.get('/api/docs', (req, res) => {
  const docs = {
    title: 'Business Data API',
    version: '1.0.0',
    baseUrl: API_BASE_URL,
    endpoints: {
      'GET /api/health': {
        description: 'Health check endpoint',
        response: { status: 'OK', timestamp: 'string' }
      },
      'GET /api/businesses': {
        description: 'Get all businesses from latest JSON file',
        response: {
          metadata: {
            sourceFile: 'string',
            lastModified: 'string',
            totalBusinesses: 'number'
          },
          statistics: {
            total: 'number',
            withScreenshots: 'number',
            withoutScreenshots: 'number',
            byCategory: 'object'
          },
          businesses: 'array'
        }
      },
      'GET /api/business/:slug': {
        description: 'Get specific business by slug',
        parameters: { slug: 'string' },
        response: 'business object with image URLs'
      },
      'GET /api/screenshots': {
        description: 'Get all screenshot files info',
        response: {
          screenshots: 'array',
          total: 'number',
          directory: 'string'
        }
      },
      'GET /screenshots/:filename': {
        description: 'Serve screenshot image files',
        response: 'image file'
      }
    }
  };
  
  res.json(docs);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: err.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl,
    availableEndpoints: [
      '/api/health',
      '/api/businesses',
      '/api/business/:slug',
      '/api/screenshots',
      '/api/docs',
      '/screenshots/:filename'
    ],
    baseUrl: API_BASE_URL
  });
});

// Start server
app.listen(PORT, () => {
  console.log('🚀 Business Data API Server');
  console.log('🌐 Server running on:', API_BASE_URL);
  console.log('📖 API Documentation:', `${API_BASE_URL}/api/docs`);
  console.log('📊 Business Data:', `${API_BASE_URL}/api/businesses`);
  console.log('🖼️  Screenshots:', `${API_BASE_URL}/api/screenshots`);
  console.log('');
  console.log('Available endpoints:');
  console.log('  GET /api/health           - Health check');
  console.log('  GET /api/businesses       - All businesses with images');
  console.log('  GET /api/business/:slug   - Specific business');
  console.log('  GET /api/screenshots      - All screenshot files');
  console.log('  GET /api/docs             - API documentation');
  console.log('  GET /screenshots/:file    - Image files');
  console.log('');
  console.log('Environment variables loaded from .env file');
});
