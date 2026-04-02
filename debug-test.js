// Debug script to troubleshoot Google Maps scraping issues
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
puppeteer.use(StealthPlugin());

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function debugPage() {
  console.log('🔍 Starting debug test...');
  
  const browser = await puppeteer.launch({
    headless: false, // Show browser for debugging
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-size=1920,1080',
      '--disable-blink-features=AutomationControlled'
    ]
  });
  
  const page = await browser.newPage();
  
  try {
    const searchTerm = 'plombier Paris';
    const url = `https://www.google.com/maps/search/${encodeURIComponent(searchTerm)}/`;
    
    console.log(`🌐 Loading: ${url}`);
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
    await sleep(5000);
    
    // Take screenshot
    await page.screenshot({ path: 'debug-screenshot.png' });
    console.log('📸 Screenshot saved as debug-screenshot.png');
    
    // Get page title
    const title = await page.title();
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
      const elements = await page.$$(selector);
      console.log(`  Found ${elements.length} elements with selector: ${selector}`);
    }
    
    // Get page content (first 1000 chars)
    const content = await page.content();
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
    
  } catch (error) {
    console.error('❌ Debug error:', error.message);
  } finally {
    // Keep browser open for 10 seconds for manual inspection
    console.log('⏳ Keeping browser open for 10 seconds for manual inspection...');
    await sleep(10000);
    await browser.close();
  }
}

debugPage();
