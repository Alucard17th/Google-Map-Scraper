// Simple test using same code structure as scraper.js
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

class SimpleTestScraper {
  constructor(headless = true) {
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
      
      console.log("🤖 Browser launched successfully");
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

  async _scrollResults(scrollCount = 2) {
    console.log("🔄 Scrolling to load results...");
    
    const feedSelectors = [
      "div[role='feed']",
      "div[role='main'] div[role='region']",
      ".m6QErb[data-value='Search results']"
    ];
    
    let feedElement = null;
    for (const selector of feedSelectors) {
      try {
        feedElement = await this.page.$(selector);
        if (feedElement) break;
      } catch (err) {
        continue;
      }
    }

    for (let i = 0; i < scrollCount; i++) {
      try {
        if (feedElement) {
          await this.page.evaluate(el => {
            el.scrollTop = el.scrollHeight;
          }, feedElement);
        } else {
          await this.page.evaluate(() => {
            window.scrollBy(0, 800);
          });
        }
        
        await sleep(1500 + Math.random() * 1500);
        
        try {
          const loadMoreBtn = await this.page.$('button[aria-label*="more"]');
          if (loadMoreBtn) {
            await loadMoreBtn.click();
            await sleep(1500);
          }
        } catch (err) {
          // Continue if no more button
        }
        
        console.log(`📜 Scroll ${i + 1}/${scrollCount} completed`);
      } catch (err) {
        console.error(`Scroll error ${i + 1}:`, err.message);
      }
    }
  }

  async searchBusinesses(query, region, maxResults = 2) {
    const results = [];
    try {
      const searchTerm = `${query} ${region}`;
      const url = `https://www.google.com/maps/search/${encodeURIComponent(searchTerm)}/`;
      
      console.log(`🔍 Searching: ${searchTerm}`);
      
      await this.page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
      await sleep(3000 + Math.random() * 2000);
      
      await this.page.waitForSelector('div[role="feed"], .Nv2PK', { timeout: 15000 }).catch(() => {
        console.log("Results loaded");
      });
      
      await this._scrollResults();
      
      const linkSelectors = [
        "a.hfpxzc",
        "a[data-cid]", 
        "div[role='article'] a",
        ".Nv2PK a"
      ];
      
      let links = [];
      for (const selector of linkSelectors) {
        try {
          const foundLinks = await this.page.$$eval(selector, els => 
            els.map(el => el.href).filter(href => href && href.includes('/maps/place/'))
          );
          if (foundLinks.length > 0) {
            links = foundLinks;
            console.log(`📍 Found ${links.length} businesses`);
            break;
          }
        } catch (err) {
          continue;
        }
      }
      
      if (links.length === 0) {
        console.error("❌ No business links found");
        
        // Debug: Check page content
        const pageText = await this.page.evaluate(() => document.body.innerText);
        if (pageText.includes('unusual traffic') || pageText.includes('captcha') || pageText.includes('robot')) {
          console.log('🚨 Bot detection detected!');
          console.log(`📝 Page contains: ${pageText.substring(0, 300)}...`);
        }
        
        return results;
      }
      
      links = [...new Set(links)];
      
      const targetCount = Math.min(links.length, maxResults);
      console.log(`� Processing ${targetCount} businesses...`);
      
      for (let i = 0; i < links.length && results.length < targetCount; i++) {
        console.log(`\n🔍 Business ${results.length + 1}/${targetCount}`);
        console.log(`📋 URL: ${links[i].substring(0, 80)}...`);
        
        // For simple test, just collect basic info without detailed extraction
        const businessData = {
          url: links[i],
          name: `Business ${results.length + 1}`,
          found: true
        };
        
        results.push(businessData);
        console.log(`✅ Found business ${results.length}/${targetCount}`);
        
        if (results.length < targetCount) {
          const delay = 2000 + Math.random() * 3000;
          console.log(`⏳ Waiting ${Math.round(delay/1000)}s...`);
          await sleep(delay);
        }
      }
    } catch (err) {
      console.error("Search error:", err.message);
    }
    return results;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log("🤖 Browser closed");
    }
  }
}

async function runSimpleTest() {
  console.log('🧪 ' + '='.repeat(50));
  console.log('🧪 SIMPLE TEST - Same structure as scraper.js');
  console.log('🧪 ' + '='.repeat(50));
  
  const scraper = new SimpleTestScraper(true);
  
  try {
    await scraper.init();
    
    // Use first config from test-config.json
    const testConfig = config.scrapingConfig[0];
    const results = await scraper.searchBusinesses(
      testConfig.businessType, 
      testConfig.regions[0], 
      testConfig.maxResults
    );
    
    if (results.length > 0) {
      console.log('\n✅ SIMPLE TEST PASSED!');
      console.log(`🎯 Found ${results.length} businesses`);
      console.log('📍 Sample URLs:');
      results.forEach((biz, i) => {
        console.log(`  ${i+1}. ${biz.url.substring(0, 80)}...`);
      });
      console.log('\n🎉 Your scraper structure is working!');
    } else {
      console.log('\n❌ SIMPLE TEST FAILED!');
      console.log('💡 Check for bot detection or network issues');
    }
    
  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error.message);
  } finally {
    await scraper.close();
  }
}

runSimpleTest();
