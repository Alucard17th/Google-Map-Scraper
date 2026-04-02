// Simple test to check basic Google Maps access
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
puppeteer.use(StealthPlugin());

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function simpleTest() {
  console.log('🧪 Simple test starting...');
  
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-size=1920,1080'
    ]
  });
  
  const page = await browser.newPage();
  
  try {
    // Test with a simpler URL first
    console.log('🌐 Loading Google Maps homepage...');
    await page.goto('https://www.google.com/maps', { waitUntil: "networkidle2" });
    await sleep(3000);
    
    const title = await page.title();
    console.log(`✅ Google Maps loaded! Title: ${title}`);
    
    // Now try search
    console.log('🔍 Searching for "plombier Paris"...');
    await page.type('#searchboxinput', 'plombier Paris');
    await sleep(2000);
    
    // Click search button
    await page.click('#searchbox-searchbutton');
    await sleep(5000);
    
    // Check if we have results
    const results = await page.$$('div[role="article"]');
    console.log(`📍 Found ${results.length} business results`);
    
    if (results.length > 0) {
      console.log('✅ SUCCESS! Found businesses');
      
      // Extract first business name
      const firstResult = await results[0].$('.section-result-title, h3, span');
      if (firstResult) {
        const name = await page.evaluate(el => el.textContent, firstResult);
        console.log(`🏢 First business: ${name}`);
      }
    } else {
      console.log('❌ Still no results, checking for captcha...');
      
      // Check for captcha or bot detection
      const captcha = await page.$('[src*="captcha"], .captcha, #captcha');
      if (captcha) {
        console.log('🚨 CAPTCHA detected! Google is blocking automated access.');
      }
      
      // Check for unusual traffic message
      const pageText = await page.evaluate(() => document.body.innerText);
      if (pageText.includes('unusual traffic') || pageText.includes('captcha')) {
        console.log('🚨 Bot detection message found in page content');
        console.log(`📝 Page contains: ${pageText.substring(0, 200)}...`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

simpleTest();
