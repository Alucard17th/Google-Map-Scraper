// Dynamic Scraper - Configurable scraper for different business types and regions
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';
puppeteer.use(StealthPlugin());

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Load dynamic configuration
let config;
try {
  const configFile = fs.readFileSync('dynamic-config.json', 'utf-8');
  config = JSON.parse(configFile);
  console.log('Dynamic configuration loaded');
} catch (err) {
  console.error('Error loading dynamic-config.json:', err.message);
  console.log('Please create dynamic-config.json file');
  process.exit(1);
}

// Get command line arguments
const args = process.argv.slice(2);
const businessTypeArg = args.find(arg => arg.startsWith('--type='))?.split('=')[1];
const statusArg = args.includes('--status');
const listTypesArg = args.includes('--list-types');

// Progress tracking system
function getProgressFile(businessType) {
  return `dynamic-progress-${businessType}.json`;
}

function loadProgress(businessType) {
  const progressFile = getProgressFile(businessType);
  try {
    if (fs.existsSync(progressFile)) {
      const progressData = fs.readFileSync(progressFile, 'utf-8');
      return JSON.parse(progressData);
    }
  } catch (err) {
    console.log(`Error loading progress file for ${businessType}, starting fresh`);
  }
  return { 
    completedRegions: [], 
    lastRun: null, 
    totalBusinessesFound: 0,
    currentRegion: null 
  };
}

function saveProgress(businessType, completedRegions, businessesFound, currentProgress) {
  const progressFile = getProgressFile(businessType);
  const progress = {
    completedRegions,
    lastRun: new Date().toISOString(),
    totalBusinessesFound: (currentProgress?.totalBusinessesFound || 0) + businessesFound,
    currentRegion: currentProgress?.currentRegion || null
  };
  try {
    fs.writeFileSync(progressFile, JSON.stringify(progress, null, 2));
    console.log(`Progress saved for ${businessType}: ${completedRegions.length} regions completed`);
  } catch (err) {
    console.error(`Error saving progress for ${businessType}:`, err.message);
  }
}

// List available business types
function listBusinessTypes() {
  console.log('\n Available Business Types:');
  console.log('='.repeat(40));
  config.businessTypes.forEach((type, index) => {
    console.log(`${index + 1}. ${type.name}`);
    console.log(`   Search: ${type.searchTerm}`);
    console.log(`   Regions: ${type.regions.length} cities`);
    console.log(`   Max results: ${type.maxResults}`);
    console.log('');
  });
}

// Show status for all business types
function showAllStatus() {
  console.log('\n Dynamic Scraper Status');
  console.log('='.repeat(50));
  
  config.businessTypes.forEach(businessType => {
    const progress = loadProgress(businessType.name);
    console.log(`\n${businessType.name.toUpperCase()}:`);
    console.log(`  Regions completed: ${progress.completedRegions.length}/${businessType.regions.length}`);
    console.log(`  Total businesses found: ${progress.totalBusinessesFound}`);
    console.log(`  Last run: ${progress.lastRun || 'Never'}`);
    console.log(`  Current region: ${progress.currentRegion || 'None'}`);
    
    if (progress.completedRegions.length > 0) {
      console.log(`  Completed: ${progress.completedRegions.join(', ')}`);
    }
    const remaining = businessType.regions.filter(r => !progress.completedRegions.includes(r));
    if (remaining.length > 0) {
      console.log(`  Remaining: ${remaining.join(', ')}`);
    }
  });
}

// Get next batch of cities to process
function getNextBatch(allCities, completedCities, batchSize = 10) {
  const nextCities = allCities.filter(city => !completedCities.includes(city));
  return nextCities.slice(0, batchSize);
}

// Main scraping function for a specific business type
async function scrapeBusinessType(businessType) {
  const typeConfig = config.businessTypes.find(t => t.name === businessType);
  if (!typeConfig) {
    console.error(`Business type '${businessType}' not found in configuration`);
    console.log('Available types:', config.businessTypes.map(t => t.name).join(', '));
    return;
  }

  console.log(`Starting scraper for ${businessType}`);
  console.log(`Search term: ${typeConfig.searchTerm}`);
  console.log(`Regions to scrape: ${typeConfig.regions.join(', ')}`);
  
  const progress = loadProgress(businessType);
  const completedRegions = progress.completedRegions || [];
  
  // Get next batch of cities
  const batchSize = typeConfig.batchSize || config.scrapingSettings?.batchSize || 3;
  const nextBatch = getNextBatch(typeConfig.regions, completedRegions, batchSize);
  
  if (nextBatch.length === 0) {
    console.log(`All regions already completed for ${businessType}`);
    return;
  }
  
  console.log(`Next batch (${nextBatch.length}/${batchSize} cities): ${nextBatch.join(', ')}`);
  console.log(`Max results per region: ${typeConfig.maxResults}`);
  
  const browser = await puppeteer.launch({
    headless: config.headless,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setViewport(config.browser.viewport);
  
  let totalBusinessesFound = 0;
  const newCompletedRegions = [];
  
  for (const region of nextBatch) {
    try {
      console.log(`\nScraping ${businessType} in ${region}...`);
      progress.currentRegion = region;
      
      const businesses = await scrapeRegion(page, region, typeConfig);
      totalBusinessesFound += businesses.length;
      
      // Save results
      const outputFile = path.join(
        config.output.directory,
        `${businessType}-${region}.json`
      );
      
      // Ensure output directory exists
      const outputDir = path.dirname(outputFile);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      fs.writeFileSync(outputFile, JSON.stringify(businesses, null, 2));
      console.log(`Saved ${businesses.length} businesses to ${outputFile}`);
      
      // Update completed regions
      newCompletedRegions.push(region);
      
      // Delay between regions
      if (region !== nextBatch[nextBatch.length - 1]) {
        console.log(`Waiting ${config.delays.betweenRegions/1000}s before next region...`);
        await sleep(config.delays.betweenRegions);
      }
      
    } catch (error) {
      console.error(`Error scraping ${region}:`, error.message);
    }
  }
  
  // Update progress with new completed regions
  const updatedCompletedRegions = [...completedRegions, ...newCompletedRegions];
  progress.currentRegion = null;
  saveProgress(businessType, updatedCompletedRegions, totalBusinessesFound, progress);
  
  await browser.close();
  console.log(`\nBatch completed for ${businessType}!`);
  console.log(`Businesses found in this batch: ${totalBusinessesFound}`);
  console.log(`Regions completed in this batch: ${newCompletedRegions.join(', ')}`);
  console.log(`Total regions completed: ${updatedCompletedRegions.length}/${typeConfig.regions.length}`);
  
  const remainingRegions = typeConfig.regions.filter(r => !updatedCompletedRegions.includes(r));
  if (remainingRegions.length > 0) {
    console.log(`Remaining regions for next run: ${remainingRegions.join(', ')}`);
  } else {
    console.log(`\nAll regions completed for ${businessType}!`);
  }
}

// Scrape a specific region
async function scrapeRegion(page, region, typeConfig) {
  const businesses = [];
  
  try {
    const searchQuery = encodeURIComponent(typeConfig.searchTerm + ' ' + region);
    const searchUrl = `https://www.google.com/maps/search/${searchQuery}`;
    
    console.log(`Searching: ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: 'networkidle2' });
    await sleep(config.delays.pageLoad);
    
    // Wait for results
    await page.waitForSelector('[data-value="Search"]', { timeout: 10000 });
    await sleep(2000);
    
    // Scroll to load more results
    let previousHeight = 0;
    let scrollAttempts = 0;
    const maxScrollAttempts = 10;
    
    while (scrollAttempts < maxScrollAttempts) {
      const currentHeight = await page.evaluate(() => document.body.scrollHeight);
      if (currentHeight === previousHeight) break;
      
      previousHeight = currentHeight;
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await sleep(config.delays.betweenResults);
      scrollAttempts++;
    }
    
    // Get business listings
    const businessListings = await page.$$('[data-value="Search"] div[role="article"]');
    console.log(`Found ${businessListings.length} business listings`);
    
    const maxResults = Math.min(businessListings.length, typeConfig.maxResults);
    
    for (let i = 0; i < maxResults; i++) {
      try {
        const business = await extractBusinessInfo(page, businessListings[i], typeConfig);
        if (business && business.noWebsite) {
          businesses.push(business);
          console.log(`  ${i + 1}. ${business.name} - ${business.phone}`);
        }
        
        // Delay between businesses (like original)
        if (i < maxResults - 1) {
          await sleep(config.delays.betweenBusinesses);
        }
      } catch (error) {
        console.error(`Error extracting business ${i + 1}:`, error.message);
      }
    }
    
  } catch (error) {
    console.error(`Error in scrapeRegion for ${region}:`, error.message);
  }
  
  return businesses;
}

// Extract business information
async function extractBusinessInfo(page, element, typeConfig) {
  try {
    const business = await page.evaluate((el, filters) => {
      const nameElement = el.querySelector('[aria-label*=","]');
      const name = nameElement ? nameElement.getAttribute('aria-label').split(',')[0].trim() : 'Unknown';
      
      const linkElement = el.querySelector('a[href*="maps.google.com"]');
      const url = linkElement ? linkElement.href : '';
      const slug = url ? url.split('/').pop().split('?')[0] : '';
      
      // Look for phone number
      const phoneElement = el.querySelector('[data-tooltip*="Phone"]');
      const phone = phoneElement ? phoneElement.getAttribute('data-tooltip').replace('Phone: ', '') : '';
      
      // Look for rating
      const ratingElement = el.querySelector('span[aria-label*="stars"]');
      const ratingText = ratingElement ? ratingElement.getAttribute('aria-label') : '';
      const rating = ratingText ? parseFloat(ratingText.split(' ')[0]) : 0;
      
      // Look for website link
      const websiteElement = el.querySelector('a[data-tooltip*="Website"]');
      const hasWebsite = !!websiteElement;
      
      // Check if business should be included
      const excludeKeywords = filters.excludeKeywords || [];
      const includeKeywords = filters.includeKeywords || [];
      
      const textContent = el.textContent.toLowerCase();
      const hasExcludeKeyword = excludeKeywords.some(keyword => textContent.includes(keyword.toLowerCase()));
      const hasIncludeKeyword = includeKeywords.length === 0 || includeKeywords.some(keyword => textContent.includes(keyword.toLowerCase()));
      
      return {
        name,
        slug,
        phone,
        rating,
        hasWebsite,
        noWebsite: !hasWebsite && !hasExcludeKeyword && hasIncludeKeyword,
        category: filters.businessType || 'Unknown'
      };
    }, element, {
      ...config.filters,
      businessType: typeConfig.name
    });
    
    return business;
    
  } catch (error) {
    console.error('Error extracting business info:', error.message);
    return null;
  }
}

// Main execution
async function main() {
  if (listTypesArg) {
    listBusinessTypes();
    return;
  }
  
  if (statusArg) {
    showAllStatus();
    return;
  }
  
  if (businessTypeArg) {
    await scrapeBusinessType(businessTypeArg);
  } else {
    console.log('Dynamic Scraper - Configurable business scraper');
    console.log('');
    console.log('Usage:');
    console.log('  node dynamic-scraper.js --type=<business-type>');
    console.log('  node dynamic-scraper.js --status');
    console.log('  node dynamic-scraper.js --list-types');
    console.log('');
    console.log('Available business types:');
    listBusinessTypes();
  }
}

// Handle errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Run the scraper
main().catch(console.error);
