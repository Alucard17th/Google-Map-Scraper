// No-Website Scraper - Similar to scraper.js but only saves businesses without websites
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';
puppeteer.use(StealthPlugin());

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Load configuration
let config;
try {
  const configFile = fs.readFileSync('no-website-config.json', 'utf-8');
  config = JSON.parse(configFile);
  console.log('✅ No-website configuration loaded');
} catch (err) {
  console.error('❌ Error loading no-website-config.json:', err.message);
  console.log('💡 Please create no-website-config.json file');
  process.exit(1);
}

// City tracking system
const TRACKING_FILE = 'no-website-progress.json';

// Load progress tracking
function loadProgress() {
  try {
    if (fs.existsSync(TRACKING_FILE)) {
      const progressData = fs.readFileSync(TRACKING_FILE, 'utf-8');
      return JSON.parse(progressData);
    }
  } catch (err) {
    console.log('⚠️  Error loading progress file, starting fresh');
  }
  return { completedCities: [], lastRun: null, totalBusinessesFound: 0 };
}

// Save progress tracking
function saveProgress(completedCities, businessesFound, currentProgress) {
  const progress = {
    completedCities,
    lastRun: new Date().toISOString(),
    totalBusinessesFound: (currentProgress?.totalBusinessesFound || 0) + businessesFound
  };
  try {
    fs.writeFileSync(TRACKING_FILE, JSON.stringify(progress, null, 2));
    console.log(`✅ Progress saved: ${completedCities.length} cities completed`);
  } catch (err) {
    console.error('❌ Error saving progress:', err.message);
  }
}

// Get next batch of cities to process
function getNextBatch(allCities, completedCities, batchSize = 10) {
  const nextCities = allCities.filter(city => !completedCities.includes(city));
  return nextCities.slice(0, batchSize);
}

class NoWebsiteScraper {
  constructor(headless = true) {
    this.headless = headless;
    this.maxRetries = 3;
    this.allBusinessesWithoutWebsite = [];
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
      
      console.log("🤖 Browser launched for no-website scraper");
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

  async _scrollResults(scrollCount = 3) {
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

  async extractBusinessDetails(url) {
    const detailPage = await this.browser.newPage();
    try {
      await detailPage.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await sleep(2000);

      console.log(`Extracting data from: ${url.substring(0, 60)}...`);
      
      const details = {};
      
      // Extract name - exact same logic as scraper.js
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
      
      // Extract category - exact same logic as scraper.js
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
      
      // Extract rating - improved selectors
      const ratingSelectors = [
        "span.ceNzKf",
        "div.jANrlb > div.fontDisplayLarge", 
        "div.F7nice > span",
        "span.Aq14fc",
        "div[aria-label*='stars']",
        ".YMJzob",
        "span[data-attrid*='rating']",
        "div.fontBodySmall > span"
      ];
      
      for (const selector of ratingSelectors) {
        try {
          const ratingEl = await detailPage.$(selector);
          if (ratingEl) {
            const ratingText = (await detailPage.evaluate(el => el.innerText, ratingEl)).trim();
            console.log(`Found rating text: "${ratingText}" with selector: ${selector}`);
            
            // Extract rating number (e.g., "4.5" from "4.5 stars" or "4,5")
            const ratingMatch = ratingText.match(/(\d+[.,]\d+|\d+)/);
            if (ratingMatch) {
              details.rating = ratingMatch[1].replace(',', '.');
              console.log(`✅ Extracted rating: ${details.rating}`);
              break;
            }
          }
        } catch (err) {
          continue;
        }
      }
      
      // Extract phone - exact same logic as scraper.js
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
      
      // Extract website - exact same logic as scraper.js
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
                console.log(`Found website via href: ${href}`);
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
                  console.log(`Found website via text: ${url}`);
                  break;
                }
              }
            }
            if (details.website) break;
          } catch (err) {
            continue;
          }
        }
        
        // Additional website search if not found - exact same logic as scraper.js
        if (!details.website) {
          try {
            const websiteText = await detailPage.evaluate(() => {
              const allElements = document.querySelectorAll('*');
              for (const el of allElements) {
                const text = el.innerText || el.textContent || '';
                if (text.length < 100 && text.length > 5) {
                  const urlMatch = text.match(/(https?:\/\/[^\s]+|www\.[a-zA-Z0-9-]+\.[a-zA-Z]{2,})/);
                  if (urlMatch) {
                    const url = urlMatch[0];
                    
                    if (!url.includes('google') && !url.includes('facebook') && 
                        !url.includes('instagram') && !url.includes('maps') &&
                        !url.includes('youtube') && !url.includes('twitter')) {
                      return url;
                    }
                  }
                }
              }
              return null;
            });
            
            if (websiteText) {
              let cleanUrl = websiteText;
              if (!cleanUrl.startsWith('http')) {
                cleanUrl = 'https://' + cleanUrl;
              }
              details.website = cleanUrl;
              console.log(`Found website via page search: ${cleanUrl}`);
            }
          } catch (err) {
            console.log("Page search for website failed:", err.message);
          }
        }
        
        // Additional website search via attributes - exact same logic as scraper.js
        if (!details.website) {
          try {
            const websiteFromAttributes = await detailPage.evaluate(() => {
              const elements = document.querySelectorAll('[data-href], [aria-label*="website"], [title*="website"]');
              for (const el of elements) {
                const dataHref = el.getAttribute('data-href');
                const ariaLabel = el.getAttribute('aria-label') || '';
                const title = el.getAttribute('title') || '';
                
                if (dataHref && dataHref.startsWith('http') && !dataHref.includes('google')) {
                  return dataHref;
                }
                
                const text = el.innerText || el.textContent || ariaLabel + ' ' + title;
                const urlMatch = text.match(/(https?:\/\/[^\s]+|www\.[a-zA-Z0-9-]+\.[a-zA-Z]{2,})/);
                if (urlMatch && !urlMatch[0].includes('google')) {
                  return urlMatch[0];
                }
              }
              return null;
            });
            
            if (websiteFromAttributes) {
              let cleanUrl = websiteFromAttributes;
              if (!cleanUrl.startsWith('http')) {
                cleanUrl = 'https://' + cleanUrl;
              }
              details.website = cleanUrl;
              console.log(`Found website via attributes: ${cleanUrl}`);
            }
          } catch (err) {
            console.log("Attribute search for website failed:", err.message);
          }
        }
      } catch (err) {
        console.error("Website extraction error:", err.message);
      }
      
      // Extract address - exact same logic as scraper.js
      const addressSelectors = [
        "button[data-item-id^='address']",
        "button[aria-label*='address']"
      ];
      
      for (const selector of addressSelectors) {
        try {
          const addrEl = await detailPage.$(selector);
          if (addrEl) {
            let addressText = await detailPage.evaluate(el => el.innerText || el.getAttribute('aria-label'), addrEl);
            if (addressText) {
              addressText = addressText.replace('Get directions', '').trim();
              details.address = addressText;
              break;
            }
          }
        } catch (err) {
          continue;
        }
      }

      // Initialize all fields with default values - exact same as scraper.js
      details.name = details.name || "Not found";
      details.category = details.category || "Not found";
      details.rating = details.rating || "";
      details.phone = details.phone || "Not found";
      details.website = details.website || "";
      details.address = details.address || "";
      
      // Clean phone number - exact same logic as scraper.js
      if (details.phone && details.phone !== "Not found") {
        details.phone = details.phone.replace(/[\n\r]/g, '').trim();
        // Remove "Envoyer vers un téléphone" text
        details.phone = details.phone.replace('Envoyer vers un téléphone', '').trim();
      }
      
      // Clean address - remove weird characters
      if (details.address) {
        details.address = details.address.replace(/[\n\r]/g, '').trim();
      }

      // Extract detailed reviews (only for businesses without websites)
      if (!details.website || details.website === "") {
        try {
          console.log(`Extracting reviews for: ${details.name}`);
          details.reviews = await this.extractReviews(detailPage);
        } catch (err) {
          console.log(`Review extraction failed: ${err.message}`);
          details.reviews = [];
        }
      } else {
        details.reviews = []; // Skip reviews for businesses with websites
      }

      // Create slug from name
      function createSlug(name) {
        if (!name || name === "Not found") return "not-found";
        return name
          .toLowerCase()
          .replace(/[^\w\s-]/g, '') // Remove special characters
          .replace(/\s+/g, '-') // Replace spaces with hyphens
          .replace(/-+/g, '-') // Replace multiple hyphens with single
          .trim();
      }

      // Create standardized object with exact field order as scraper.js
      const standardizedDetails = {
        name: details.name || "Not found",
        slug: createSlug(details.name),
        category: details.category || "Not found", 
        rating: details.rating || "",
        reviews: details.reviews || [],
        phone: details.phone || "Not found",
        website: details.website || "",
        address: details.address || "",
        whatsappSent: false  // Track WhatsApp message status
      };

      await detailPage.close();
      return standardizedDetails;

    } catch (err) {
      await detailPage.close();
      console.error(`❌ Error extracting details from ${url}:`, err.message);
      return null;
    }
  }

  async extractReviews(detailPage) {
    const reviews = [];
    try {
      // Scroll down to load reviews
      await detailPage.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await sleep(2000);

      // Find review elements
      const reviewSelectors = [
        "div[data-review-id]",
        ".jftiAe",  // Google Maps review container
        ".review-snippet",
        "[jscontroller='fPSHkb']"  // Review controller
      ];

      let reviewElements = [];
      for (const selector of reviewSelectors) {
        try {
          reviewElements = await detailPage.$$(selector);
          if (reviewElements.length > 0) {
            console.log(`Found ${reviewElements.length} review elements with selector: ${selector}`);
            break;
          }
        } catch (err) {
          continue;
        }
      }

      // Extract first 5 reviews
      const maxReviews = Math.min(reviewElements.length, 5);
      console.log(`Extracting ${maxReviews} reviews...`);

      for (let i = 0; i < maxReviews; i++) {
        try {
          const review = await detailPage.evaluate((el, index) => {
            // Extract author
            let author = "Anonymous";
            const authorSelectors = [
              ".d4r55",  // Author name
              "[data-name]",
              ".TSUb4c",  // Alternative author selector
              "a[href*='/maps/contrib/']"
            ];
            
            for (const sel of authorSelectors) {
              const authorEl = el.querySelector(sel);
              if (authorEl) {
                author = authorEl.innerText || authorEl.textContent || authorEl.getAttribute('data-name') || "Anonymous";
                break;
              }
            }

            // Extract rating
            let rating = "";
            const ratingSelectors = [
              ".F7nice > span",  // Star rating
              ".kvMYJc",  // Alternative rating
              "[aria-label*='stars']",
              ".ODSEJ-ShBeI-H1e9j",  // Review rating
              ".duhRB",  // Star container
              "span[aria-label*='étoile']",  // French stars
              "span[aria-label*='star']"
            ];
            
            for (const sel of ratingSelectors) {
              const ratingEl = el.querySelector(sel);
              if (ratingEl) {
                const ariaLabel = ratingEl.getAttribute('aria-label');
                if (ariaLabel && (ariaLabel.includes('stars') || ariaLabel.includes('étoile'))) {
                  const match = ariaLabel.match(/(\d+(?:\.\d+)?)/);
                  if (match) {
                    rating = match[1];
                    break;
                  }
                }
                // Try to count stars
                const stars = ratingEl.querySelectorAll('span[aria-label*="star"], span[aria-label*="étoile"]');
                if (stars.length > 0) {
                  rating = stars.length.toString();
                  break;
                }
                // Try to get text content
                const text = ratingEl.innerText || ratingEl.textContent;
                if (text) {
                  const match = text.match(/(\d+(?:\.\d+)?)/);
                  if (match) {
                    rating = match[1];
                    break;
                  }
                }
              }
            }

            // Extract review text
            let reviewText = "";
            const textSelectors = [
              ".wiI7pd",  // Review text
              ".review-text",
              ".ODSEJ-ShBeI-title",
              ".review-full-text"
            ];
            
            for (const sel of textSelectors) {
              const textEl = el.querySelector(sel);
              if (textEl) {
                reviewText = textEl.innerText || textEl.textContent || "";
                reviewText = reviewText.replace(/\s+/g, ' ').trim();
                break;
              }
            }

            // Extract date
            let date = "";
            const dateSelectors = [
              ".rsqaWe",  // Review date
              ".dehysf",
              "[aria-label*='ago']"
            ];
            
            for (const sel of dateSelectors) {
              const dateEl = el.querySelector(sel);
              if (dateEl) {
                date = dateEl.innerText || dateEl.textContent || "";
                break;
              }
            }

            return {
              author: author.trim(),
              rating: rating,
              text: reviewText,
              date: date.trim()
            };
          }, reviewElements[i]);

          // Only add review if it has text and isn't a duplicate
          if (review.text && review.text.length > 0) {
            // Check for duplicates based on author + text combination
            const isDuplicate = reviews.some(existingReview => 
              existingReview.author === review.author && 
              existingReview.text === review.text
            );
            
            if (!isDuplicate) {
              reviews.push(review);
              console.log(`✅ Review ${reviews.length}: ${review.author} - ${review.rating} stars`);
            } else {
              console.log(`⏭️  Skipping duplicate review: ${review.author}`);
            }
          }
        } catch (err) {
          console.log(`Error extracting review ${i + 1}: ${err.message}`);
        }
      }

      console.log(`✅ Successfully extracted ${reviews.length} reviews`);
      return reviews;

    } catch (err) {
      console.error("Review extraction error:", err.message);
      return [];
    }
  }

  async searchBusinesses(query, region, maxResults = 0) {
    const results = [];
    try {
      const searchTerm = `${query} ${region} France`;
      const url = `https://www.google.com/maps/search/${encodeURIComponent(searchTerm)}/`;
      
      console.log(`Searching: ${searchTerm}`);
      
      await this.page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
      await sleep(5000);
      
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
            console.log(`Found ${links.length} businesses`);
            break;
          }
        } catch (err) {
          continue;
        }
      }
      
      if (links.length === 0) {
        console.error("No business links found");
        return results;
      }
      
      links = [...new Set(links)];
      
      const targetCount = maxResults > 0 ? Math.min(links.length, maxResults) : links.length;
      console.log(`Processing ${targetCount} businesses...`);
      
      for (let i = 0; i < links.length && results.length < targetCount; i++) {
        console.log(`\nBusiness ${results.length + 1}/${targetCount}`);
        console.log(`URL: ${links[i].substring(0, 80)}...`);
        
        const details = await this.extractBusinessDetails(links[i]);
        
        if (details) {
          // Check if business has no website - exact same logic as scraper.js
          const hasWebsite = details.website && 
                            details.website.trim() !== '' && 
                            details.website !== '❌ Not found';
          
          if (!hasWebsite) {
            console.log(`✅ Business without website found: ${details.name}`);
            results.push(details);
            this.allBusinessesWithoutWebsite.push(details);
          } else {
            console.log(`⏭️  Skipping business with website: ${details.name}`);
          }
        }
        
        if (results.length < targetCount) {
          const delay = 2000 + Math.random() * 3000;
          console.log(`Waiting ${Math.round(delay/1000)}s...`);
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

  async saveResults() {
    if (this.allBusinessesWithoutWebsite.length === 0) {
      console.log("❌ No businesses without websites found");
      return;
    }

    // Create NoWebsites directory if it doesn't exist
    const outputDir = 'Output/NoWebsites';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`📁 Created directory: ${outputDir}`);
    }

    // Create filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `${outputDir}/no-website-businesses_${timestamp}.json`;
    
    // Save results
    fs.writeFileSync(filename, JSON.stringify(this.allBusinessesWithoutWebsite, null, 2), 'utf-8');
    
    console.log(`\n✅ Saved ${this.allBusinessesWithoutWebsite.length} businesses without websites to:`);
    console.log(`📁 ${filename}`);
    
    // Display statistics
    console.log('\n📊 SUMMARY:');
    console.log(`🎯 Total businesses without websites: ${this.allBusinessesWithoutWebsite.length}`);
    
    // Group by business type
    const byType = {};
    this.allBusinessesWithoutWebsite.forEach(business => {
      const type = business.category || 'Unknown';
      byType[type] = (byType[type] || 0) + 1;
    });
    
    console.log('\n📈 By Business Type:');
    Object.entries(byType).forEach(([type, count]) => {
      console.log(`   • ${type}: ${count}`);
    });
    
    // Group by region
    const byRegion = {};
    this.allBusinessesWithoutWebsite.forEach(business => {
      // Extract region from address if possible
      const address = business.address || '';
      const region = address.split(',').pop().trim() || 'Unknown';
      byRegion[region] = (byRegion[region] || 0) + 1;
    });
    
    console.log('\n🌍 By Region:');
    Object.entries(byRegion).forEach(([region, count]) => {
      console.log(`   • ${region}: ${count}`);
    });
  }
}

async function runNoWebsiteScraper() {
  console.log('🎯 ' + '='.repeat(60));
  console.log('🎯 NO-WEBSITE BUSINESS SCRAPER - BATCH MODE');
  console.log('🎯 ' + '='.repeat(60));
  
  // Load progress tracking
  const progress = loadProgress();
  console.log(`📊 Progress: ${progress.completedCities.length} cities already completed`);
  console.log(`📊 Total businesses found so far: ${progress.totalBusinessesFound}`);
  
  const scraper = new NoWebsiteScraper(config.headless !== false);
  
  try {
    await scraper.init();
    
    console.log(`\n📋 Processing ${config.scrapingConfig.length} business type configurations...`);
    
    for (let i = 0; i < config.scrapingConfig.length; i++) {
      const businessConfig = config.scrapingConfig[i];
      
      if (!businessConfig.enabled) {
        console.log(`⏭️  Skipping disabled: ${businessConfig.businessType}`);
        continue;
      }
      
      // Get next batch of cities
      const batchSize = businessConfig.batchSize || config.batchSize || 10;
      const nextBatch = getNextBatch(businessConfig.regions, progress.completedCities, batchSize);
      
      if (nextBatch.length === 0) {
        console.log(`\n🎉 All cities completed for ${businessConfig.businessType}!`);
        continue;
      }
      
      console.log(`\n📍 ${i + 1}/${config.scrapingConfig.length}: ${businessConfig.businessType}`);
      console.log(`🏙️  Next batch (${nextBatch.length}/${batchSize} cities): ${nextBatch.join(', ')}`);
      console.log(`🎯 Max per region: ${businessConfig.maxResults}`);
      
      const newCompletedCities = [];
      let batchBusinessesFound = 0;
      
      for (let j = 0; j < nextBatch.length; j++) {
        const region = nextBatch[j];
        console.log(`\n🔍 Scraping ${businessConfig.businessType} in ${region} (${j + 1}/${nextBatch.length})...`);
        
        try {
          const results = await scraper.searchBusinesses(
            businessConfig.businessType,
            region,
            businessConfig.maxResults
          );
          
          batchBusinessesFound += results.length;
          newCompletedCities.push(region);
          
          console.log(`✅ Completed ${region}: Found ${results.length} businesses without websites`);
          console.log(`📊 Total businesses without websites so far: ${scraper.allBusinessesWithoutWebsite.length}`);
        } catch (error) {
          console.error(`❌ Error scraping ${region}:`, error.message);
          // Continue to next region even if one fails
        }
        
        // Add delay between regions
        if (j < nextBatch.length - 1) {
          const delay = config.delays.betweenRegions || 15000;
          console.log(`🌍 Regional delay: ${Math.round(delay/1000)}s...`);
          await sleep(delay);
        }
      }
      
      // Update progress
      const updatedCompletedCities = [...progress.completedCities, ...newCompletedCities];
      saveProgress(updatedCompletedCities, batchBusinessesFound, progress);
      
      // Save results for this batch
      if (batchBusinessesFound > 0) {
        await scraper.saveResults();
      }
      
      console.log(`\n📊 Batch Summary:`);
      console.log(`   • Cities completed: ${newCompletedCities.length}`);
      console.log(`   • Businesses found: ${batchBusinessesFound}`);
      console.log(`   • Total progress: ${updatedCompletedCities.length}/${businessConfig.regions.length} cities`);
      
      // Add delay between business types
      if (i < config.scrapingConfig.length - 1) {
        const delay = config.delays.betweenBusinessTypes || 20000;
        console.log(`🏢 Business type delay: ${Math.round(delay/1000)}s...`);
        await sleep(delay);
      }
    }
    
    console.log('\n🎉 ' + '='.repeat(60));
    console.log('🎉 BATCH SCRAPING COMPLETE!');
    console.log('🎉 ' + '='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error.message);
  } finally {
    await scraper.close();
  }
}

runNoWebsiteScraper();
