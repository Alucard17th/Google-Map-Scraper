import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import XLSX from 'xlsx';
import cron from 'node-cron';
puppeteer.use(StealthPlugin());

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Load configuration from external file
let config;
try {
  const configFile = fs.readFileSync('scraping-config.json', 'utf-8');
  config = JSON.parse(configFile);
  console.log('✅ Configuration loaded from scraping-config.json');
} catch (err) {
  console.error('❌ Error loading config file:', err.message);
  process.exit(1);
}

class GoogleMapsCronScraper {
  constructor(headless = true) {
    this.headless = headless || config.safetySettings.headless;
    this.maxRetries = 3;
    this.dailyRequestLimit = config.safetySettings.dailyRequestLimit;
    this.requestCountToday = 0;
    this.lastRequestTime = null;
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
      
      await this.page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });
      });
      
      await this.page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br'
      });
      
      console.log("🤖 Browser launched for cron job");
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
        return "/usr/bin/google-chrome";
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  // Human-like random delay between requests
  async humanDelay(minMs = config.safetySettings.minDelayBetweenRequests, maxMs = config.safetySettings.maxDelayBetweenRequests) {
    const delay = minMs + Math.random() * (maxMs - minMs);
    console.log(`⏳ Human-like delay: ${Math.round(delay/1000)}s`);
    await sleep(delay);
  }

  // Random break to appear more human
  async takeRandomBreak() {
    if (config.safetySettings.randomBreakInterval && this.requestCountToday % config.safetySettings.randomBreakInterval === 0) {
      const breakDuration = config.safetySettings.randomBreakDuration || 300000; // 5 minutes default
      console.log(`☕ Taking random break: ${Math.round(breakDuration/1000/60)} minutes to appear human`);
      await sleep(breakDuration);
    }
  }

  // Check if we should continue scraping to stay safe
  async checkRateLimit() {
    const now = new Date();
    const today = now.toDateString();
    
    // Reset counter if it's a new day
    if (this.lastRequestTime && this.lastRequestTime.toDateString() !== today) {
      this.requestCountToday = 0;
    }
    
    if (this.requestCountToday >= this.dailyRequestLimit) {
      console.log(`⚠️  Daily limit reached (${this.dailyRequestLimit}). Stopping for today.`);
      return false;
    }
    
    // Take random break periodically
    await this.takeRandomBreak();
    
    this.lastRequestTime = now;
    this.requestCountToday++;
    return true;
  }

  async _scrollResults(scrollCount = config.safetySettings.maxScrollsPerSearch) {
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

  async _extractBusinessDetails(link) {
    let detailPage;
    const details = {};
    let retryCount = 0;
    
    while (retryCount < this.maxRetries) {
      try {
        detailPage = await this.browser.newPage();
        
        await detailPage.goto(link, { 
          waitUntil: "domcontentloaded", 
          timeout: 30000 
        });
        
        await detailPage.waitForFunction(() => document.readyState === 'complete', 
          { timeout: 10000 }).catch(() => {});
        
        await sleep(2000 + Math.random() * 2000); // Random delay
        
        await detailPage.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight / 2);
        });
        await sleep(1500);
        
        console.log(`🔍 Extracting: ${link.substring(0, 60)}...`);
        
        // Extract name
        const nameSelectors = [
          "h1[data-attrid='title']",
          "h1.DUwDvf", 
          "h1"
        ];
        
        for (const selector of nameSelectors) {
          try {
            const nameEl = await detailPage.$(selector);
            if (nameEl) {
              details.name = (await detailPage.evaluate(el => el.innerText, nameEl)).trim();
              break;
            }
          } catch (err) {
            continue;
          }
        }
        
        // Extract category
        const categorySelectors = [
          "button[jsaction*='category']",
          "span.DkEaL",
          ".YhemCb"
        ];
        
        for (const selector of categorySelectors) {
          try {
            const catEl = await detailPage.$(selector);
            if (catEl) {
              const categoryText = (await detailPage.evaluate(el => el.innerText, catEl)).trim();
              if (categoryText && !categoryText.includes('directions') && !categoryText.includes('call')) {
                details.category = categoryText;
                break;
              }
            }
          } catch (err) {
            continue;
          }
        }
        
        // Extract rating
        const ratingSelectors = [
          "div.jANrlb > div.fontDisplayLarge",
          "span.ceNzKf"
        ];
        
        for (const selector of ratingSelectors) {
          try {
            const ratingEl = await detailPage.$(selector);
            if (ratingEl) {
              const ratingText = (await detailPage.evaluate(el => el.innerText, ratingEl)).trim();
              if (ratingText && /^\d+\.?\d*$/.test(ratingText)) {
                details.rating = ratingText;
                break;
              }
            }
          } catch (err) {
            continue;
          }
        }
        
        // Extract phone
        const phoneSelectors = [
          "button[data-item-id^='phone']",
          "a[href^='tel:']",
          "button[aria-label*='phone']"
        ];
       
        for (const selector of phoneSelectors) {
          try {
            const phoneEl = await detailPage.$(selector);
            if (phoneEl) {
              let phoneText = await detailPage.evaluate(el => el.innerText || el.getAttribute('href'), phoneEl);
              if (phoneText) {
                if (phoneText.startsWith("tel:")) {
                  phoneText = phoneText.replace("tel:", "");
                }
                phoneText = phoneText.replace(//g, '');
                details.phone = phoneText.trim();
                break;
              }
            }
          } catch (err) {
            continue;
          }
        }
        
        // Extract website
        try {
          const websiteSelectors = [
            "a[data-item-id^='authority']",
            "button[data-item-id^='authority']",
            "a[href^='http']:not([href*='google']):not([href*='maps']):not([href*='facebook']):not([href*='instagram']):not([href*='youtube']):not([href*='twitter'])"
          ];
          
          for (const selector of websiteSelectors) {
            try {
              const elements = await detailPage.$$(selector);
              for (const element of elements) {
                const href = await detailPage.evaluate(el => el.href, element);
                const text = await detailPage.evaluate(el => el.innerText || el.textContent, element);
                
                if (href && href.startsWith('http') && !href.includes('google.com') && !href.includes('maps')) {
                  details.website = href;
                  break;
                }
                
                if (text && (text.includes('www.') || text.includes('http'))) {
                  const urlMatch = text.match(/(https?:\/\/[^\s]+|www\.[^\s]+)/);
                  if (urlMatch) {
                    let url = urlMatch[0];
                    if (!url.startsWith('http')) {
                      url = 'https://' + url;
                    }
                    details.website = url;
                    break;
                  }
                }
              }
              if (details.website) break;
            } catch (err) {
              continue;
            }
          }
        } catch (err) {
          console.error("Website extraction error:", err.message);
        }
        
        // Extract address
        const addressSelectors = [
          "button[data-item-id^='address']",
          "button[aria-label*='address']"
        ];
        
        for (const selector of addressSelectors) {
          try {
            const addrEl = await detailPage.$(selector);
            if (addrEl) {
              let addressText = (await detailPage.evaluate(el => el.innerText, addrEl)).trim();
              addressText = addressText.replace(//g, '');
              details.address = addressText.trim();
              break;
            }
          } catch (err) {
            continue;
          }
        }
        
        break;
        
      } catch (error) {
        retryCount++;
        console.error(`Error (attempt ${retryCount}):`, error.message);
        if (retryCount >= this.maxRetries) {
          console.error(`Failed after ${this.maxRetries} attempts`);
        } else {
          await sleep(3000 * retryCount);
        }
      } finally {
        if (detailPage) {
          await detailPage.close();
        }
      }
    }
    
    return details;
  }

  async searchBusinesses(query, region, maxResults = 5) { // Reduced default for cron
    const results = [];
    try {
      const searchTerm = `${query} ${region}`;
      const url = `https://www.google.com/maps/search/${encodeURIComponent(searchTerm)}/`;
      
      console.log(`🔍 Searching: ${searchTerm}`);
      
      await this.page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
      await sleep(3000 + Math.random() * 2000);
      
      await this.page.waitForSelector('div[role="feed"], .Nv2PK', { timeout: 30000 }).catch(() => {
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
        return results;
      }
      
      links = [...new Set(links)];
      
      const targetCount = Math.min(links.length, maxResults);
      console.log(`🎯 Processing ${targetCount} businesses...`);
      
      for (let i = 0; i < links.length && results.length < targetCount; i++) {
        // Check rate limit before each request
        if (!await this.checkRateLimit()) {
          break;
        }
        
        console.log(`\n🔍 Business ${results.length + 1}/${targetCount}`);
        
        const data = await this._extractBusinessDetails(links[i]);
        
        if (Object.keys(data).length > 0) {
          results.push(data);
          console.log(`✅ Success! Progress: ${results.length}/${targetCount}`);
        } else {
          console.log(`❌ Failed to extract data`);
        }
        
        // Human-like delay between businesses
        if (results.length < targetCount) {
          await this.humanDelay();
        }
      }
    } catch (err) {
      console.error("Search error:", err.message);
    }
    return results;
  }

  exportToJson(businesses, filename) {
    if (!businesses || businesses.length === 0) {
      console.log("No data to export");
      return false;
    }
    
    try {
      const headers = ["name", "category", "rating", "phone", "website", "address"];
      const dataOrdered = businesses.map(biz => {
        const ordered = {};
        headers.forEach(key => ordered[key] = biz[key] || "");
        return ordered;
      });
      
      const jsonContent = JSON.stringify(dataOrdered, null, 2);
      fs.writeFileSync(filename, jsonContent, { encoding: "utf-8" });
      console.log(`✅ JSON saved: ${filename} (${businesses.length} entries)`);
      return true;
    } catch (err) {
      console.error("JSON export error:", err.message);
      return false;
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log("🤖 Browser closed");
    }
  }
}

// Schedule the cron job
if (config.schedule.enabled) {
  console.log(`🕐 Scheduling cron job with expression: ${config.schedule.cronExpression}`);
  console.log(`🌍 Timezone: ${config.schedule.timezone}`);
  cron.schedule(config.schedule.cronExpression, async () => {
    console.log('⏰ Running scheduled daily scraping...');
    await runDailyScraping();
  });
} else {
  console.log('⚠️  Scheduling is disabled in config');
}

// Allow manual run for testing
console.log('💡 You can run manually with: node cron-scraper.js manual');
if (process.argv.includes('manual')) {
  console.log('🔧 Running manual test...');
  runDailyScraping();
}

if (config.schedule.enabled) {
  console.log('⏳ Cron scheduler is active. Waiting for scheduled time...');
}

async function runDailyScraping() {
  console.log('🚀 ' + '='.repeat(50));
  console.log('🤖 DAILY CRON SCRAPER STARTING');
  console.log('🚀 ' + '='.repeat(50));
  console.log(`📅 Date: ${new Date().toLocaleDateString()}`);
  console.log(`⏰ Time: ${new Date().toLocaleTimeString()}`);
  
  // Create output directory
  const outputDir = config.output.directory;
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
    console.log(`📁 Created output directory: ${outputDir}/`);
  }

  const scraper = new GoogleMapsCronScraper();
  await scraper.init();
  
  const totalResults = [];
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  
  try {
    // Filter enabled configurations
    const enabledConfigs = config.scrapingConfig.filter(cfg => cfg.enabled);
    console.log(`🎯 Processing ${enabledConfigs.length} enabled business types`);
    
    for (const scrapeConfig of enabledConfigs) {
      console.log(`\n🎯 Processing: ${scrapeConfig.businessType.toUpperCase()}`);
      
      for (const region of scrapeConfig.regions) {
        console.log(`\n🌍 Region: ${region}`);
        
        // Check if we should continue
        if (!await scraper.checkRateLimit()) {
          console.log("⚠️  Rate limit reached, stopping for today");
          break;
        }
        
        const results = await scraper.searchBusinesses(
          scrapeConfig.businessType, 
          region, 
          scrapeConfig.maxResults
        );
        
        if (results.length > 0) {
          totalResults.push(...results);
          console.log(`✅ Scraped ${results.length} ${scrapeConfig.businessType} in ${region}`);
        } else {
          console.log(`❌ No results for ${scrapeConfig.businessType} in ${region}`);
        }
        
        // Delay between different regions
        await scraper.humanDelay(
          config.safetySettings.minDelayBetweenRegions,
          config.safetySettings.maxDelayBetweenRegions
        );
      }
      
      // Delay between different business types
      await scraper.humanDelay(
        config.safetySettings.minDelayBetweenBusinessTypes,
        config.safetySettings.maxDelayBetweenBusinessTypes
      );
    }
    
    // Export all results
    if (totalResults.length > 0) {
      const filename = config.output.includeTimestamp 
        ? `${outputDir}/daily_scraping_${timestamp}.json`
        : `${outputDir}/daily_scraping.json`;
      
      scraper.exportToJson(totalResults, filename);
      
      console.log('\n' + '🎉 DAILY SCRAPING COMPLETE!'.padStart(40, '=').padEnd(60, '='));
      console.log(`✅ Total Businesses Scraped: ${totalResults.length}`);
      console.log(`📊 JSON File: ${filename}`);
      console.log(`📈 Requests Today: ${scraper.requestCountToday}`);
      
      // Summary by business type
      const summary = {};
      totalResults.forEach(biz => {
        const category = biz.category || 'Unknown';
        summary[category] = (summary[category] || 0) + 1;
      });
      
      console.log('\n📊 SUMMARY BY CATEGORY:');
      Object.entries(summary).forEach(([category, count]) => {
        console.log(`🏷️  ${category}: ${count} businesses`);
      });
      
    } else {
      console.log('\n❌ NO RESULTS FOUND TODAY');
    }
    
  } catch (error) {
    console.error('\n❌ CRON JOB ERROR:', error.message);
  } finally {
    await scraper.close();
  }
}

// Schedule the cron job to run daily at 2:00 AM
console.log('🕐 Scheduling daily cron job for 2:00 AM...');
cron.schedule('0 2 * * *', async () => {
  console.log('⏰ Running scheduled daily scraping...');
  await runDailyScraping();
});

// Also allow manual run for testing
console.log('💡 You can also run manually with: node cron-scraper.js manual');
if (process.argv.includes('manual')) {
  console.log('🔧 Running manual test...');
  runDailyScraping();
}

console.log('⏳ Cron scheduler is active. Waiting for scheduled time...');
