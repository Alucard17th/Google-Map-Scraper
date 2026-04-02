// Test script for minimal configuration
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
puppeteer.use(StealthPlugin());

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Load test configuration
let config;
try {
  const configFile = fs.readFileSync('test-config.json', 'utf-8');
  config = JSON.parse(configFile);
  console.log('✅ Test configuration loaded');
} catch (err) {
  console.error('❌ Error loading test config:', err.message);
  process.exit(1);
}

class TestScraper {
  constructor() {
    this.headless = true;
    this.maxRetries = 2;
  }

  async init() {
    try {
      const launchOptions = {
        headless: this.headless,
        executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
        args: [
          '--window-size=1920,1080',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-web-security',
          '--disable-dev-shm-usage',
          '--no-first-run',
          '--disable-default-apps'
        ],
        timeout: 60000,
        ignoreDefaultArgs: ['--enable-automation']
      };

      this.browser = await puppeteer.launch(launchOptions);
      this.page = await this.browser.newPage();
      
      await this.page.setViewport({ width: 1920, height: 1080 });
      await this.page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      );
      
      console.log("🤖 Test browser launched successfully");
    } catch (err) {
      console.error("❌ Browser init error:", err);
      throw err;
    }
  }

  async testScrape() {
    const testConfig = config.scrapingConfig[0]; // Use first config
    const searchTerm = `${testConfig.businessType} ${testConfig.regions[0]}`;
    const url = `https://www.google.com/maps/search/${encodeURIComponent(searchTerm)}/`;
    
    console.log(`🔍 Testing search: ${searchTerm}`);
    
    try {
      await this.page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
      await sleep(3000);
      
      // Wait for results
      await this.page.waitForSelector('div[role="feed"], .Nv2PK', { timeout: 15000 }).catch(() => {
        console.log("Results loaded");
      });
      
      // Find business links
      const links = await this.page.$$eval('a.hfpxzc', els => 
        els.map(el => el.href).filter(href => href && href.includes('/maps/place/'))
      );
      
      console.log(`📍 Found ${links.length} businesses`);
      
      if (links.length > 0) {
        // Extract first business details
        const detailPage = await this.browser.newPage();
        await detailPage.goto(links[0], { waitUntil: "domcontentloaded", timeout: 30000 });
        await sleep(2000);
        
        const details = {};
        
        // Extract name
        try {
          const nameEl = await detailPage.$("h1[data-attrid='title']");
          if (nameEl) {
            details.name = await detailPage.evaluate(el => el.innerText, nameEl);
          }
        } catch (err) {
          details.name = "Not found";
        }
        
        // Extract phone
        try {
          const phoneEl = await detailPage.$("button[data-item-id^='phone']");
          if (phoneEl) {
            details.phone = await detailPage.evaluate(el => el.innerText, phoneEl);
          }
        } catch (err) {
          details.phone = "Not found";
        }
        
        await detailPage.close();
        
        console.log('\n✅ TEST SUCCESSFUL!');
        console.log(`🏢 Name: ${details.name}`);
        console.log(`📞 Phone: ${details.phone}`);
        console.log(`🌐 Found ${links.length} total businesses`);
        
        return true;
      } else {
        console.log('❌ No businesses found');
        return false;
      }
      
    } catch (err) {
      console.error('❌ Test error:', err.message);
      return false;
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log("🤖 Test browser closed");
    }
  }
}

async function runTest() {
  console.log('🧪 ' + '='.repeat(50));
  console.log('🧪 GOOGLE MAPS SCRAPER TEST');
  console.log('🧪 ' + '='.repeat(50));
  
  const scraper = new TestScraper();
  
  try {
    await scraper.init();
    const success = await scraper.testScrape();
    
    if (success) {
      console.log('\n🎉 TEST PASSED! Your scraper is ready for production.');
    } else {
      console.log('\n❌ TEST FAILED! Check the errors above.');
    }
    
  } catch (error) {
    console.error('\n❌ FATAL TEST ERROR:', error.message);
  } finally {
    await scraper.close();
  }
}

runTest();
