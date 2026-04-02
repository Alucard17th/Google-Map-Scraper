// Debug test using same code structure as scraper.js
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

class DebugTestScraper {
  constructor(headless = false) { // Not headless for debugging
    this.headless = headless;
    this.maxRetries = 3;
  }

  async init() {
    try {
      const executablePath = process.env.CHROME_PATH || this.getDefaultChromePath();
      
      const launchOptions = {
        headless: this.headless,
        executablePath, 
        args: [
          '--window-size=1920,1080',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-web-security',
          '--disable-dev-shm-usage',
          '--no-first-run',
          '--disable-default-apps',
          '--lang=en-US,en'
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
      
      await this.page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });
      });
      
      await this.page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br'
      });
      
      console.log("🤖 Debug browser launched successfully");
    } catch (err) {
      console.error("Init error:", err);
      throw err;
    }
  }

  getDefaultChromePath() {
    const platform = process.platform;
    switch (platform) {
      case 'win32':
        return "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe";
      case 'darwin':
        return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
      case 'linux':
        return process.env.CHROME_PATH || "/usr/bin/google-chrome";
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  async debugPage() {
    try {
      const testConfig = config.scrapingConfig[0];
      const searchTerm = `${testConfig.businessType} ${testConfig.regions[0]}`;
      const url = `https://www.google.com/maps/search/${encodeURIComponent(searchTerm)}/`;
      
      console.log(`🌐 Loading: ${url}`);
      await this.page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
      await sleep(5000);
      
      // Take screenshot
      await this.page.screenshot({ path: 'debug-screenshot.png' });
      console.log('📸 Screenshot saved as debug-screenshot.png');
      
      // Get page title
      const title = await this.page.title();
      console.log(`📄 Page title: ${title}`);
      
      // Check for common selectors
      const selectors = [
        'div[role="feed"]',
        '.Nv2PK',
        'a.hfpxzc',
        'div[role="article"]',
        '[data-cid]',
        'div[role="main"]',
        '.section-result'
      ];
      
      console.log('\n🔍 Checking selectors:');
      for (const selector of selectors) {
        const elements = await this.page.$$(selector);
        console.log(`  Found ${elements.length} elements with selector: ${selector}`);
      }
      
      // Get page content (first 1000 chars)
      const content = await this.page.content();
      console.log(`\n📝 Page content length: ${content.length} characters`);
      console.log(`📝 First 500 chars: ${content.substring(0, 500)}`);
      
      // Check for CAPTCHA or bot detection
      const captcha = await page.$('[src*="captcha"], .captcha, #captcha');
      if (captcha) {
        console.log('🚨 CAPTCHA detected! Google is blocking automated access.');
      }
      
      // Check for "unusual traffic" message
      const unusualTraffic = await page.$('text/unusual traffic');
      if (unusualTraffic) {
        console.log('🚨 "Unusual traffic" message detected!');
      }
      
      // Try to find any links
      const allLinks = await page.$$eval('a', links => 
        links.map(link => ({ href: link.href, text: link.textContent.substring(0, 50) }))
      );
      const mapsLinks = allLinks.filter(link => link.href && link.href.includes('/maps/place/'));
      console.log(`\n🔗 Total links found: ${allLinks.length}`);
      console.log(`📍 Maps/place links found: ${mapsLinks.length}`);
      
      if (mapsLinks.length > 0) {
        console.log('📍 Sample Maps links:');
        mapsLinks.slice(0, 3).forEach((link, i) => {
          console.log(`  ${i+1}. ${link.text} -> ${link.href.substring(0, 80)}...`);
        });
      }
      
      // Check page text for bot detection
      const pageText = await this.page.evaluate(() => document.body.innerText);
      if (pageText.includes('unusual traffic') || pageText.includes('captcha') || pageText.includes('robot')) {
        console.log('🚨 Bot detection detected!');
        console.log(`📝 Page contains: ${pageText.substring(0, 300)}...`);
      }
      
      return mapsLinks.length > 0;
      
    } catch (error) {
      console.error('❌ Debug error:', error.message);
      return false;
    }
  }

  async close() {
    // Keep browser open for manual inspection
    console.log('⏳ Keeping browser open for 10 seconds for manual inspection...');
    await sleep(10000);
    
    if (this.browser) {
      await this.browser.close();
      console.log("🤖 Debug browser closed");
    }
  }
}

async function runDebugTest() {
  console.log('🔍 ' + '='.repeat(50));
  console.log('🔍 DEBUG TEST - Same structure as scraper.js');
  console.log('🔍 ' + '='.repeat(50));
  
  const scraper = new DebugTestScraper(false); // Not headless for debugging
  
  try {
    await scraper.init();
    const success = await scraper.debugPage();
    
    if (success) {
      console.log('\n✅ DEBUG TEST PASSED! Found business links');
      console.log('🎉 Your scraper should work with the current setup');
    } else {
      console.log('\n❌ DEBUG TEST FAILED! No business links found');
      console.log('💡 Check the screenshot and page content for issues');
    }
    
  } catch (error) {
    console.error('\n❌ FATAL DEBUG ERROR:', error.message);
  } finally {
    await scraper.close();
  }
}

runDebugTest();
