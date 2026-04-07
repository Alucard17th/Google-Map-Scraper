import fs from 'fs';
import path from 'path';

// Debug the merged file structure
const mergedFile = path.join('Output', 'NoWebsites', 'all-businesses-merged.json');

if (fs.existsSync(mergedFile)) {
  try {
    const content = fs.readFileSync(mergedFile, 'utf8');
    const mergedData = JSON.parse(content);
    
    console.log('=== DEBUG INFO ===');
    console.log('Merged data keys:', Object.keys(mergedData));
    console.log('Businesses type:', typeof mergedData.businesses);
    console.log('Businesses is array:', Array.isArray(mergedData.businesses));
    console.log('Businesses length:', mergedData.businesses.length);
    
    // Check if there's an issue with the data structure
    if (mergedData.businesses && Array.isArray(mergedData.businesses)) {
      console.log('First business:', mergedData.businesses[0]);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
} else {
  console.log('File not found:', mergedFile);
}
