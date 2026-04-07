import https from 'https';
import fs from 'fs';
import path from 'path';

class PreviewUrlTester {
  constructor() {
    this.basePreviewUrl = 'https://preview.grow-with-tools.com';
    this.mergedFile = path.join('Output', 'NoWebsites', 'all-businesses-merged.json');
    this.testResults = [];
  }

  async loadBusinesses() {
    try {
      if (fs.existsSync(this.mergedFile)) {
        const mergedData = JSON.parse(fs.readFileSync(this.mergedFile, 'utf8'));
        return mergedData.businesses.slice(0, 10); // Get first 10 businesses
      }
      return [];
    } catch (error) {
      console.error('Error loading businesses:', error.message);
      return [];
    }
  }

  async testUrl(url, businessName, slug) {
    return new Promise((resolve) => {
      console.log(`\nTesting: ${businessName}`);
      console.log(`URL: ${url}`);
      
      const startTime = Date.now();
      
      const req = https.get(url, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          const responseTime = Date.now() - startTime;
          const result = {
            business: {
              name: businessName,
              slug: slug,
              url: url
            },
            status: {
              statusCode: res.statusCode,
              statusMessage: res.statusMessage,
              responseTime: responseTime,
              contentLength: data.length
            },
            success: res.statusCode === 200,
            content: {
              hasContent: data.length > 0,
              hasError: data.toLowerCase().includes('error') || data.toLowerCase().includes('not found'),
              hasBusinessName: data.toLowerCase().includes(businessName.toLowerCase()),
              previewElements: this.extractPreviewElements(data)
            },
            timestamp: new Date().toISOString()
          };
          
          resolve(result);
        });
      });
      
      req.on('error', (error) => {
        const responseTime = Date.now() - startTime;
        const result = {
          business: {
            name: businessName,
            slug: slug,
            url: url
          },
          status: {
            statusCode: 0,
            statusMessage: 'Connection Error',
            responseTime: responseTime,
            contentLength: 0,
            error: error.message
          },
          success: false,
          content: {
            hasContent: false,
            hasError: true,
            hasBusinessName: false,
            previewElements: []
          },
          timestamp: new Date().toISOString()
        };
        
        resolve(result);
      });
      
      req.setTimeout(10000, () => {
        req.destroy();
        const responseTime = Date.now() - startTime;
        const result = {
          business: {
            name: businessName,
            slug: slug,
            url: url
          },
          status: {
            statusCode: 0,
            statusMessage: 'Timeout',
            responseTime: responseTime,
            contentLength: 0
          },
          success: false,
          content: {
            hasContent: false,
            hasError: true,
            hasBusinessName: false,
            previewElements: []
          },
          timestamp: new Date().toISOString()
        };
        
        resolve(result);
      });
    });
  }

  extractPreviewElements(html) {
    const elements = {
      hasTitle: /<title[^>]*>/i.test(html),
      hasH1: /<h1[^>]*>/i.test(html),
      hasBusinessInfo: /business|company|service|plombier|chauffagiste/i.test(html),
      hasContactInfo: /phone|telephone|contact|address/i.test(html),
      hasImages: /<img[^>]*>/i.test(html),
      hasStyles: /<style[^>]*>|<link[^>]*stylesheet/i.test(html),
      hasScripts: /<script[^>]*>/i.test(html),
      hasMetaTags: /<meta[^>]*>/i.test(html),
      errorIndicators: {
        has404: /404|not found/i.test(html),
        hasError: /error|exception|failed/i.test(html),
        hasServerError: /server error|internal error/i.test(html)
      }
    };
    
    return elements;
  }

  async runTests() {
    console.log('=== Preview URL Test Suite ===');
    console.log(`Testing first 10 business preview URLs...\n`);
    
    const businesses = await this.loadBusinesses();
    
    if (businesses.length === 0) {
      console.log('No businesses found to test');
      return;
    }
    
    console.log(`Found ${businesses.length} businesses to test\n`);
    
    for (const business of businesses) {
      const previewUrl = `${this.basePreviewUrl}/${business.slug}`;
      const result = await this.testUrl(previewUrl, business.name, business.slug);
      this.testResults.push(result);
      
      // Display result
      if (result.success) {
        console.log(`\n${result.success ? 'SUCCESS' : 'FAILED'}: ${business.name}`);
        console.log(`Status: ${result.status.statusCode} (${result.status.statusMessage})`);
        console.log(`Response Time: ${result.status.responseTime}ms`);
        console.log(`Content Length: ${result.status.contentLength} bytes`);
        
        if (result.content.hasBusinessName) {
          console.log(`Business name found in content: YES`);
        } else {
          console.log(`Business name found in content: NO`);
        }
        
        if (result.content.previewElements.errorIndicators.has404) {
          console.log(`404 Error detected: YES`);
        }
        
        if (result.content.previewElements.errorIndicators.hasError) {
          console.log(`Error indicators found: YES`);
        }
      } else {
        console.log(`\nFAILED: ${business.name}`);
        console.log(`Error: ${result.status.statusMessage}`);
        if (result.status.error) {
          console.log(`Details: ${result.status.error}`);
        }
      }
      
      // Add delay between requests
      await this.sleep(1000);
    }
    
    this.generateReport();
  }

  generateReport() {
    console.log('\n=== TEST REPORT ===');
    
    const totalTests = this.testResults.length;
    const successfulTests = this.testResults.filter(r => r.success).length;
    const failedTests = totalTests - successfulTests;
    const averageResponseTime = this.testResults.reduce((sum, r) => sum + r.status.responseTime, 0) / totalTests;
    
    console.log(`\nTotal Tests: ${totalTests}`);
    console.log(`Successful: ${successfulTests} (${((successfulTests/totalTests)*100).toFixed(1)}%)`);
    console.log(`Failed: ${failedTests} (${((failedTests/totalTests)*100).toFixed(1)}%)`);
    console.log(`Average Response Time: ${Math.round(averageResponseTime)}ms`);
    
    // Failed tests details
    if (failedTests > 0) {
      console.log('\n=== FAILED TESTS ===');
      this.testResults.filter(r => !r.success).forEach(result => {
        console.log(`\nFAILED: ${result.business.name}`);
        console.log(`URL: ${result.business.url}`);
        console.log(`Status: ${result.status.statusMessage}`);
        if (result.status.error) {
          console.log(`Error: ${result.status.error}`);
        }
      });
    }
    
    // Successful tests details
    if (successfulTests > 0) {
      console.log('\n=== SUCCESSFUL TESTS ===');
      this.testResults.filter(r => r.success).forEach(result => {
        console.log(`\nSUCCESS: ${result.business.name}`);
        console.log(`Status: ${result.status.statusCode}`);
        console.log(`Response Time: ${result.status.responseTime}ms`);
        console.log(`Content Length: ${result.status.contentLength} bytes`);
        console.log(`Business Name Found: ${result.content.hasBusinessName ? 'YES' : 'NO'}`);
      });
    }
    
    // Save detailed report
    const report = {
      summary: {
        totalTests,
        successfulTests,
        failedTests,
        successRate: ((successfulTests/totalTests)*100).toFixed(1),
        averageResponseTime: Math.round(averageResponseTime),
        testDate: new Date().toISOString()
      },
      results: this.testResults
    };
    
    const reportFile = 'Output/preview-url-test-report.json';
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    console.log(`\nDetailed report saved to: ${reportFile}`);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run the tests
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith('test-preview-urls.js')) {
  const tester = new PreviewUrlTester();
  tester.runTests().catch(console.error);
}

export default PreviewUrlTester;
