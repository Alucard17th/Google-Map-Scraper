import puppeteer from 'puppeteer-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';

puppeteer.use(stealth());

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function checkSpecificBusinesses() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  
  const businesses = [
    "Plombier Clermont-Ferrand - Romain Leitao",
    "THL Plomberie"
  ];
  
  for (const businessName of businesses) {
    console.log(`\n🔍 Checking: ${businessName}`);
    
    const searchTerm = `${businessName} Clermont-Ferrand`;
    const url = `https://www.google.com/maps/search/${encodeURIComponent(searchTerm)}/`;
    
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await sleep(2000);
      
      // Find the first business link
      const link = await page.$eval('a[href*="/maps/place/"]', el => el.href).catch(() => null);
      
      if (link) {
        console.log(`📋 Found: ${link}`);
        
        // Extract details
        const detailPage = await browser.newPage();
        await detailPage.goto(link, { waitUntil: "domcontentloaded", timeout: 30000 });
        await sleep(2000);
        
        // Check for website
        const websiteSelectors = [
          "a[data-item-id^='authority']",
          "button[data-item-id^='authority']",
          "a[href^='http']:not([href*='google']):not([href*='maps'])"
        ];
        
        let hasWebsite = false;
        let websiteUrl = "";
        
        for (const selector of websiteSelectors) {
          try {
            const elements = await detailPage.$$(selector);
            for (const element of elements) {
              const href = await detailPage.evaluate(el => el.href, element);
              if (href && href.startsWith('http') && !href.includes('google.com') && !href.includes('maps')) {
                hasWebsite = true;
                websiteUrl = href;
                break;
              }
            }
            if (hasWebsite) break;
          } catch (err) {
            continue;
          }
        }
        
        if (hasWebsite) {
          console.log(`🌐 HAS WEBSITE: ${websiteUrl}`);
        } else {
          console.log(`❌ NO WEBSITE FOUND`);
        }
        
        await detailPage.close();
      } else {
        console.log(`❌ No business found`);
      }
    } catch (err) {
      console.log(`❌ Error: ${err.message}`);
    }
  }
  
  await browser.close();
}

checkSpecificBusinesses();
