// Extract businesses without websites from JSON file
import fs from 'fs';
import path from 'path';

const extractBusinessesWithoutWebsite = (jsonFilePath) => {
  try {
    // Check if file exists
    if (!fs.existsSync(jsonFilePath)) {
      console.error(`❌ File not found: ${jsonFilePath}`);
      return;
    }

    // Read and parse JSON file
    console.log(`📂 Reading file: ${jsonFilePath}`);
    const data = fs.readFileSync(jsonFilePath, 'utf-8');
    const businesses = JSON.parse(data);

    console.log(`📊 Total businesses in file: ${businesses.length}`);

    // Filter businesses without websites
    const businessesWithoutWebsite = businesses.filter(business => {
      const hasWebsite = business.website && 
                        business.website.trim() !== '' && 
                        business.website !== '❌ Not found';
      return !hasWebsite;
    });

    console.log(`🔍 Found ${businessesWithoutWebsite.length} businesses without websites`);

    if (businessesWithoutWebsite.length === 0) {
      console.log('✅ All businesses have websites!');
      return;
    }

    // Create output filename in NoWebsites subdirectory
    const inputDir = path.dirname(jsonFilePath);
    const inputFileName = path.basename(jsonFilePath, '.json');
    
    // Create NoWebsites directory if it doesn't exist
    const outputDir = path.join(inputDir, 'NoWebsites');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`📁 Created directory: ${outputDir}`);
    }
    
    const outputFileName = `${inputFileName}_no-website.json`;
    const outputFilePath = path.join(outputDir, outputFileName);

    // Save filtered businesses
    fs.writeFileSync(outputFilePath, JSON.stringify(businessesWithoutWebsite, null, 2), 'utf-8');

    console.log(`✅ Saved ${businessesWithoutWebsite.length} businesses without websites to:`);
    console.log(`📁 ${outputFilePath}`);

    // Display sample of results
    console.log('\n📋 Sample businesses without websites:');
    businessesWithoutWebsite.slice(0, 5).forEach((business, index) => {
      console.log(`\n${index + 1}. 🏢 ${business.name}`);
      console.log(`   📞 ${business.phone}`);
      console.log(`   📍 ${business.address || 'No address'}`);
      console.log(`   🏷️  ${business.category}`);
    });

    if (businessesWithoutWebsite.length > 5) {
      console.log(`\n... and ${businessesWithoutWebsite.length - 5} more businesses`);
    }

    // Statistics
    const percentage = ((businessesWithoutWebsite.length / businesses.length) * 100).toFixed(1);
    console.log(`\n📈 Statistics:`);
    console.log(`   • Without website: ${businessesWithoutWebsite.length}/${businesses.length} (${percentage}%)`);
    console.log(`   • With website: ${businesses.length - businessesWithoutWebsite.length}/${businesses.length} (${(100 - percentage).toFixed(1)}%)`);

  } catch (error) {
    console.error('❌ Error processing file:', error.message);
  }
};

// Get file path from command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('🔧 Usage:');
  console.log('   node extract-no-website.js "path/to/your/file.json"');
  console.log('');
  console.log('📝 Examples:');
  console.log('   node extract-no-website.js "Output/businesses_2026-04-02T21-12-59.json"');
  console.log('   node extract-no-website.js "Output\\businesses_2026-04-02T21-12-59.json"');
  console.log('');
  process.exit(1);
}

const jsonFilePath = args[0];
extractBusinessesWithoutWebsite(jsonFilePath);
