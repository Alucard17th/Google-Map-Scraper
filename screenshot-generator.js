// Screenshot Generator for Business Proposals
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

puppeteer.use(StealthPlugin());

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class ScreenshotGenerator {
  constructor(forceRegenerate = false) {
    this.screenshotsDir = 'Output/Screenshots';
    this.baseUrl = process.env.SCREENSHOT_BASE_URL || 'http://localhost:3000';
    this.browser = null;
    this.page = null;
    this.forceRegenerate = forceRegenerate;
  }

  async init() {
    console.log('🚀 Initializing screenshot generator...');
    
    try {
      const executablePath = process.env.CHROME_PATH || this.getDefaultChromePath();
      
      this.browser = await puppeteer.launch({
        headless: true,
        executablePath,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });

      this.page = await this.browser.newPage();
      
      // Set viewport for consistent screenshots
      await this.page.setViewport({ width: 1200, height: 800 });
      
      // Create screenshots directory if it doesn't exist
      if (!fs.existsSync(this.screenshotsDir)) {
        fs.mkdirSync(this.screenshotsDir, { recursive: true });
      }
      
      console.log('✅ Screenshot generator initialized');
      console.log(`📁 Screenshots will be saved to: ${this.screenshotsDir}`);
      console.log(`🌐 Base URL: ${this.baseUrl}`);
      
    } catch (err) {
      console.error('❌ Failed to initialize screenshot generator:', err.message);
      throw err;
    }
  }

  getDefaultChromePath() {
    const platform = process.platform;
    if (platform === 'win32') return 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';
    if (platform === 'darwin') return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    return '/usr/bin/google-chrome-stable';
  }

  async takeScreenshot(slug, businessName) {
    try {
      const url = `${this.baseUrl}/${slug}`;
      const filename = `${slug}.png`;
      const filepath = path.join(this.screenshotsDir, filename);
      
      console.log(`📸 Taking screenshot for: ${businessName}`);
      console.log(`🌐 URL: ${url}`);
      
      // Navigate to the page
      await this.page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      
      // Wait for initial page load
      await sleep(3000);
      
      // Scroll down slowly to trigger scroll animations
      console.log(`📜 Simulating scroll animations for ${businessName}...`);
      
      // Scroll in steps to trigger animations
      const scrollSteps = 5;
      const viewportHeight = 800;
      const totalHeight = await this.page.evaluate(() => document.body.scrollHeight);
      
      for (let i = 0; i <= scrollSteps; i++) {
        const scrollY = (totalHeight / scrollSteps) * i;
        await this.page.evaluate(y => window.scrollTo(0, y), scrollY);
        await sleep(500); // Wait for animations to trigger
      }
      
      // Scroll back to top for final screenshot
      await this.page.evaluate(() => window.scrollTo(0, 0));
      await sleep(1000);
      
      // Wait a bit more for any final animations
      await sleep(2000);
      
      // Take screenshot
      await this.page.screenshot({
        path: filepath,
        fullPage: true
      });
      
      console.log(`✅ Screenshot saved: ${filename}`);
      return filename;
      
    } catch (err) {
      console.error(`❌ Failed to take screenshot for ${slug}:`, err.message);
      return null;
    }
  }

  async processJsonFiles() {
    try {
      // Get all JSON files in NoWebsites directory
      const noWebsitesDir = 'Output/NoWebsites';
      if (!fs.existsSync(noWebsitesDir)) {
        throw new Error(`Directory not found: ${noWebsitesDir}`);
      }

      const jsonFiles = fs.readdirSync(noWebsitesDir).filter(file => file.endsWith('.json'));
      
      if (jsonFiles.length === 0) {
        console.log('❌ No JSON files found in Output/NoWebsites directory');
        return;
      }

      // Find the most recently created file
      let latestFile = null;
      let latestTime = 0;

      for (const jsonFile of jsonFiles) {
        const filePath = path.join(noWebsitesDir, jsonFile);
        const stats = fs.statSync(filePath);
        
        if (stats.mtimeMs > latestTime) {
          latestTime = stats.mtimeMs;
          latestFile = filePath;
        }
      }

      if (!latestFile) {
        console.log('❌ Could not determine the latest JSON file');
        return;
      }

      console.log(`📁 Processing latest file: ${path.basename(latestFile)}`);
      console.log(`📅 Modified: ${new Date(latestTime).toLocaleString()}`);
      console.log(`📁 Total files found: ${jsonFiles.length} (processing only latest)`);

      await this.processJsonFile(latestFile);

      console.log('\n🎉 Latest file screenshots generated successfully!');
      
    } catch (err) {
      console.error('❌ Error processing JSON files:', err.message);
    }
  }

  async processJsonFile(jsonFilePath) {
    try {
      console.log(`\n📄 Processing: ${jsonFilePath}`);
      
      // Read and parse JSON
      const jsonData = fs.readFileSync(jsonFilePath, 'utf-8');
      const businesses = JSON.parse(jsonData);
      
      console.log(`🔍 Found ${businesses.length} businesses to screenshot`);
      
      let processedCount = 0;
      
      // Process each business
      for (let i = 0; i < businesses.length; i++) {
        const business = businesses[i];
        
        // Skip if already has screenshot (unless force regenerate)
        if (business.screenshotUrl && !this.forceRegenerate) {
          console.log(`⏭️  Skipping ${business.name} - already has screenshot`);
          continue;
        }
        
        // Remove existing screenshot URL if forcing regeneration
        if (this.forceRegenerate && business.screenshotUrl) {
          console.log(`🔄 Regenerating screenshot for: ${business.name}`);
          delete business.screenshotUrl;
        }
        
        // Take screenshot
        const screenshotFilename = await this.takeScreenshot(business.slug, business.name);
        
        if (screenshotFilename) {
          // Add screenshot URL to business object
          business.screenshotUrl = `./Screenshots/${screenshotFilename}`;
          processedCount++;
          
          console.log(`📊 Progress: ${i + 1}/${businesses.length} businesses processed`);
        }
        
        // Add delay between screenshots
        if (i < businesses.length - 1) {
          await sleep(1000);
        }
      }
      
      // Save updated JSON with screenshot URLs
      const updatedJsonData = JSON.stringify(businesses, null, 2);
      fs.writeFileSync(jsonFilePath, updatedJsonData);
      
      console.log(`✅ Updated ${jsonFilePath} with ${processedCount} screenshot URLs`);
      
    } catch (err) {
      console.error(`❌ Error processing ${jsonFilePath}:`, err.message);
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log('🤖 Browser closed');
    }
  }
}

// Main execution function
async function generateScreenshots() {
  console.log('🎯 ' + '='.repeat(60));
  console.log('🎯 BUSINESS SCREENSHOT GENERATOR');
  console.log('🎯 ' + '='.repeat(60));
  
  // Check for force flag
  const forceRegenerate = process.argv.includes('--force') || process.argv.includes('-f');
  
  if (forceRegenerate) {
    console.log('🔄 Force regeneration mode enabled - will replace existing screenshots');
  }
  
  const generator = new ScreenshotGenerator(forceRegenerate);
  
  try {
    await generator.init();
    await generator.processJsonFiles();
    
    console.log('\n🎉 ' + '='.repeat(60));
    console.log('🎉 SCREENSHOT GENERATION COMPLETE!');
    console.log('🎉 ' + '='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error.message);
  } finally {
    await generator.close();
  }
}

// Check if localhost is available
async function checkLocalhost() {
  try {
    const response = await fetch('http://localhost:3000');
    return response.ok;
  } catch (err) {
    return false;
  }
}

// Run the generator
generateScreenshots().catch(console.error);
