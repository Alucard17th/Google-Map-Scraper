import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

class WhatsAppSender {
  constructor() {
    this.apiKey = process.env.EVOLUTION_API_KEY;
    this.apiUrl = process.env.EVOLUTION_API_URL || 'https://business.grow-with-tools.com/message/sendText/wa1';
    this.apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
    this.yourName = process.env.YOUR_NAME || 'Your Name';
    this.yourPhone = process.env.YOUR_PHONE || '+33612345678';
    this.logFile = 'Output/whatsapp-sending-log.json';
    this.progressFile = 'Output/whatsapp-progress.json';
    this.configFile = 'whatsapp-config.json';
    
    // Load configuration
    this.config = this.loadConfig();
  }

  loadConfig() {
    try {
      const configData = JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
      return configData;
    } catch (error) {
      console.log('📝 Creating new WhatsApp config file');
      return {
        whatsappConfig: [{
          campaignType: 'no-website-businesses',
          batchSize: 5,
          maxMessagesPerHour: 30,
          enabled: true,
          skipAlreadySent: true,
          messageDelay: { min: 5000, max: 10000 }
        }],
        globalSettings: {
          pauseOnFailure: true,
          maxRetries: 3,
          logLevel: 'info',
          autoSaveProgress: true
        }
      };
    }
  }

  async loadProgress() {
    try {
      if (fs.existsSync(this.progressFile)) {
        const progress = JSON.parse(fs.readFileSync(this.progressFile, 'utf8'));
        return progress;
      }
    } catch (error) {
      console.log('📝 Creating new WhatsApp progress file');
    }
    
    return {
      completedBusinesses: [],
      lastRun: null,
      totalMessagesSent: 0,
      totalMessagesFailed: 0,
      currentBatch: 0,
      campaignStats: {
        totalProcessed: 0,
        successRate: 0,
        averageResponseTime: 0
      }
    };
  }

  async saveProgress(progress) {
    try {
      progress.lastRun = new Date().toISOString();
      fs.writeFileSync(this.progressFile, JSON.stringify(progress, null, 2));
      console.log('✅ WhatsApp progress saved');
    } catch (error) {
      console.error('❌ Error saving WhatsApp progress:', error.message);
    }
  }

  async getBusinesses() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/businesses`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const businesses = await response.json();
      console.log(`📊 Loaded ${businesses.length} businesses from API`);
      return businesses;
    } catch (error) {
      console.error('❌ Error fetching businesses:', error.message);
      throw error;
    }
  }

  async sendWhatsAppMessage(number, message) {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.apiKey
        },
        body: JSON.stringify({
          number: number,
          text: message
        })
      });

      const result = await response.json();
      
      if (response.ok) {
        console.log(`✅ Message sent successfully to ${number}`);
        return { success: true, data: result };
      } else {
        console.error(`❌ Failed to send message to ${number}:`, result);
        return { success: false, error: result };
      }
    } catch (error) {
      console.error(`❌ Error sending message to ${number}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  async logMessage(business, result, messageType = 'campaign') {
    try {
      const logEntry = {
        timestamp: new Date().toISOString(),
        messageType: messageType,
        business: {
          name: business.name || 'Test Message',
          slug: business.slug || 'test-message',
          phone: business.phone || result.number || 'Unknown',
          category: business.category || 'Test',
          rating: business.rating || 5
        },
        result: {
          success: result.success,
          error: result.error || null,
          data: result.data || null
        }
      };

      // Add message preview only for real businesses
      if (business.name && business.slug && business.slug !== 'test-message') {
        try {
          logEntry.messagePreview = this.createBusinessMessage(business).substring(0, 100) + '...';
        } catch (error) {
          logEntry.messagePreview = 'Test message - no preview available';
        }
      } else {
        logEntry.messagePreview = 'Test message - no preview available';
      }

      // Read existing logs
      let logs = [];
      try {
        if (fs.existsSync(this.logFile)) {
          const existingLogs = fs.readFileSync(this.logFile, 'utf8');
          logs = JSON.parse(existingLogs);
        }
      } catch (error) {
        console.log('Creating new log file');
      }

      // Add new entry
      logs.push(logEntry);

      // Keep only last 1000 entries to prevent file from getting too large
      if (logs.length > 1000) {
        logs = logs.slice(-1000);
      }

      // Write logs
      fs.writeFileSync(this.logFile, JSON.stringify(logs, null, 2));
      
      console.log(`Logged message for ${business.name || 'Test'}: ${result.success ? 'SUCCESS' : 'FAILED'}`);
    } catch (error) {
      console.error('Error logging message:', error.message);
    }
  }

  createBusinessMessage(business) {
    const { name, category, rating, reviews, address, slug } = business;
    
    // Create compelling message with preview link
    let message = `🔧 *Proposition de Site Web Professionnel*\n\n`;
    message += `Bonjour ! Je suis ${this.yourName}, et j'ai remarqué que ${name}, ${category} à ${address?.split(',')[0] || 'votre ville'} n'a pas de site web.\n\n`;
    message += `⭐ *Note*: ${rating}/5 avec ${reviews.length} avis clients\n\n`;
    
    message += `🌐 *Je vous propose une solution web complète pour:*\n`;
    message += `• Présence professionnelle en ligne\n`;
    message += `• Plus de visibilité pour vos services\n`;
    message += `• Acquisition de nouveaux clients\n`;
    message += `• Mise en avant de vos excellents avis\n\n`;
    
    message += `📱 *Contactez-moi pour discuter de votre projet!*\n`;
    message += `Téléphone: ${this.yourPhone}\n\n`;
    
    // Add preview link
    const previewUrl = `https://preview.grow-with-tools.com/${slug}`;
    message += `🔗 *Voir votre futur site web:*\n${previewUrl}`;
    
    return message;
  }

  async sendToAllBusinesses(limit = null, skipSent = true) {
    console.log('🚀 Starting WhatsApp message campaign...');
    
    const progress = await this.loadProgress();
    const businesses = await this.getBusinesses();
    
    // Filter businesses based on skip setting and progress
    let businessesToContact = skipSent ? 
      businesses.filter(b => !progress.completedBusinesses.includes(b.slug)) : 
      businesses;
    
    if (limit) {
      businessesToContact = businessesToContact.slice(0, limit);
    }

    const config = this.config.whatsappConfig[0];
    const batchSize = config.batchSize;
    
    console.log(`📊 Found ${businessesToContact.length} businesses to contact`);
    console.log(`📦 Batch size: ${batchSize}`);

    let sentCount = 0;
    let failedCount = 0;

    // Process in batches
    for (let batchStart = 0; batchStart < businessesToContact.length; batchStart += batchSize) {
      const batchEnd = Math.min(batchStart + batchSize, businessesToContact.length);
      const batch = businessesToContact.slice(batchStart, batchEnd);
      
      console.log(`\n📦 Batch ${Math.floor(batchStart/batchSize) + 1}: Processing ${batch.length} businesses (${batchStart + 1}-${batchEnd}/${businessesToContact.length})`);

      for (let i = 0; i < batch.length; i++) {
        const business = batch[i];
        
        console.log(`\n📱 ${batchStart + i + 1}/${businessesToContact.length} - Contacting ${business.name}`);
        
        // Clean phone number
        const cleanPhone = business.phone.replace(/[^\d]/g, '');
        
        if (!cleanPhone || cleanPhone.length < 10) {
          console.log(`⚠️  Invalid phone number: ${business.phone}`);
          failedCount++;
          continue;
        }

        // Create personalized message
        const message = this.createBusinessMessage(business);
        
        // Send message
        const result = await this.sendWhatsAppMessage(cleanPhone, message);
        
        if (result.success) {
          sentCount++;
          await this.logMessage(business, result, 'campaign');
          progress.completedBusinesses.push(business.slug);
        } else {
          failedCount++;
          await this.logMessage(business, result, 'campaign');
        }

        // Add delay between messages
        if (i < batch.length - 1 || batchEnd < businessesToContact.length) {
          const delay = Math.random() * (config.messageDelay.max - config.messageDelay.min) + config.messageDelay.min;
          console.log(`⏳ Waiting ${Math.round(delay/1000)}s before next message...`);
          await this.sleep(delay);
        }
      }

      // Save progress after each batch
      progress.totalMessagesSent = sentCount;
      progress.totalMessagesFailed = failedCount;
      progress.currentBatch = Math.floor(batchStart/batchSize) + 1;
      await this.saveProgress(progress);

      // Add delay between batches
      if (batchEnd < businessesToContact.length) {
        console.log(`\n🌍 Batch completed. Waiting 30s before next batch...`);
        await this.sleep(30000);
      }
    }

    console.log(`\n📊 Campaign Summary:`);
    console.log(`   ✅ Sent: ${sentCount}`);
    console.log(`   ❌ Failed: ${failedCount}`);
    console.log(`   📊 Total: ${businessesToContact.length}`);

    return { sent: sentCount, failed: failedCount, total: businessesToContact.length };
  }

  async testSimpleMessage(phone) {
    console.log(`🧪 Testing simple WhatsApp message to ${phone}`);
    
    const testMessage = `🔧 *Test Message - Proposition de Site Web*\n\nCeci est un message test pour vérifier que l'API WhatsApp fonctionne correctement.\n\n🔗 *Exemple de preview:* https://preview.grow-with-tools.com/hbi-rnovation-rodez\n\nSi vous recevez ce message, votre système est prêt pour la campagne! 🚀`;
    
    const result = await this.sendWhatsAppMessage(phone, testMessage);
    
    // Log test message
    const testBusiness = {
      name: 'Test Message',
      slug: 'test-message',
      phone: phone,
      category: 'Test',
      rating: 5
    };
    await this.logMessage(testBusiness, result, 'test');
    
    if (result.success) {
      console.log(`✅ Simple test message sent successfully to ${phone}`);
    } else {
      console.error(`❌ Simple test message failed:`, result.error);
    }
    
    return result;
  }

  async testBusinessMessage(phone, slug = 'hbi-rnovation-rodez') {
    console.log(`🧪 Testing business message to ${phone} using business: ${slug}`);
    
    // Get the actual business data
    const businesses = await this.getBusinesses();
    const business = businesses.find(b => b.slug === slug);
    
    if (!business) {
      console.error(`❌ Business not found: ${slug}`);
      return { success: false, error: 'Business not found' };
    }
    
    // Create the exact message that would be sent to this business
    const message = this.createBusinessMessage(business);
    
    console.log(`📱 Message preview for ${business.name}:`);
    console.log('-'.repeat(50));
    console.log(message);
    console.log('-'.repeat(50));
    
    // Send the message
    const result = await this.sendWhatsAppMessage(phone, message);
    
    // Log the test message
    await this.logMessage(business, result, 'test');
    
    if (result.success) {
      console.log(`✅ Business message sent successfully to ${phone}`);
    } else {
      console.error(`❌ Business message failed:`, result.error);
    }
    
    return result;
  }

  async getStats() {
    const progress = await this.loadProgress();
    const logs = await this.getSendingLogs();
    
    console.log('📊 WhatsApp Campaign Statistics:');
    console.log(`   📋 Total messages: ${logs.length}`);
    console.log(`   ✅ Successful: ${logs.filter(log => log.result.success).length}`);
    console.log(`   ❌ Failed: ${logs.filter(log => !log.result.success).length}`);
    console.log(`   🎯 Completed businesses: ${progress.completedBusinesses.length}`);
    console.log(`   📦 Current batch: ${progress.currentBatch}`);
    console.log(`   📅 Last run: ${progress.lastRun || 'Never'}`);
  }

  async getSendingLogs() {
    try {
      if (!fs.existsSync(this.logFile)) {
        return [];
      }
      return JSON.parse(fs.readFileSync(this.logFile, 'utf8'));
    } catch (error) {
      console.error('❌ Error reading logs:', error.message);
      return [];
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (!command) {
    console.log('📖 Available commands:');
    console.log('  npm run whatsapp test <phone>           - Send actual business message test');
    console.log('  npm run whatsapp test-simple <phone>     - Send simple test message');
    console.log('  npm run whatsapp send [limit]           - Send to businesses (skip sent)');
    console.log('  npm run whatsapp send-all                - Send to all businesses');
    console.log('  npm run whatsapp business <slug>         - Send to specific business');
    console.log('  npm run whatsapp stats                   - Show campaign statistics');
    console.log('  npm run whatsapp progress                 - Show campaign progress');
    console.log('  npm run whatsapp reset-progress          - Reset campaign progress');
    console.log('');
    console.log('💡 Examples:');
    console.log('  npm run whatsapp test 212707673488');
    console.log('  npm run whatsapp test-simple 212707673488');
    console.log('  npm run whatsapp send 5');
    console.log('  npm run whatsapp business hbi-rnovation-rodez');
    console.log('  npm run whatsapp stats');
    process.exit(0);
  }

  try {
    const sender = new WhatsAppSender();
    
    switch (command) {
      case 'test':
        const phone = args[1];
        if (!phone) {
          console.error('❌ Please provide a phone number');
          console.log('💡 Usage: npm run whatsapp test 212707673488');
          process.exit(1);
        }
        const slug = args[2];
        await sender.testBusinessMessage(phone, slug);
        break;

      case 'test-simple':
        const simplePhone = args[1];
        if (!simplePhone) {
          console.error('❌ Please provide a phone number');
          console.log('💡 Usage: npm run whatsapp test-simple 212707673488');
          process.exit(1);
        }
        await sender.testSimpleMessage(simplePhone);
        break;

      case 'send':
        const limit = args[1] ? parseInt(args[1]) : null;
        await sender.sendToAllBusinesses(limit, true);
        break;

      case 'send-all':
        await sender.sendToAllBusinesses(null, false);
        break;

      case 'business':
        const businessSlug = args[1];
        if (!businessSlug) {
          console.error('❌ Please provide a business slug');
          console.log('💡 Usage: npm run whatsapp business hbi-rnovation-rodez');
          process.exit(1);
        }
        await sender.sendToSpecificBusiness(businessSlug);
        break;

      case 'stats':
        await sender.getStats();
        break;

      case 'progress':
        const progress = await sender.loadProgress();
        console.log('📊 WhatsApp Campaign Progress:');
        console.log(`   🎯 Completed businesses: ${progress.completedBusinesses.length}`);
        console.log(`   📦 Current batch: ${progress.currentBatch}`);
        console.log(`   ✅ Messages sent: ${progress.totalMessagesSent}`);
        console.log(`   ❌ Messages failed: ${progress.totalMessagesFailed}`);
        console.log(`   📅 Last run: ${progress.lastRun || 'Never'}`);
        console.log(`   📈 Success rate: ${progress.totalMessagesSent > 0 ? ((progress.totalMessagesSent / (progress.totalMessagesSent + progress.totalMessagesFailed)) * 100).toFixed(1) : 0}%`);
        break;

      case 'reset-progress':
        if (fs.existsSync('Output/whatsapp-progress.json')) {
          fs.unlinkSync('Output/whatsapp-progress.json');
          console.log('✅ WhatsApp progress reset successfully');
        } else {
          console.log('ℹ️  No progress file found');
        }
        break;

      default:
        console.log('📖 Available commands:');
        console.log('  npm run whatsapp test <phone>           - Send actual business message test');
        console.log('  npm run whatsapp test-simple <phone>     - Send simple test message');
        console.log('  npm run whatsapp send [limit]           - Send to businesses (skip sent)');
        console.log('  npm run whatsapp send-all                - Send to all businesses');
        console.log('  npm run whatsapp business <slug>         - Send to specific business');
        console.log('  npm run whatsapp stats                   - Show campaign statistics');
        console.log('  npm run whatsapp progress                 - Show campaign progress');
        console.log('  npm run whatsapp reset-progress          - Reset campaign progress');
        break;
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

export default WhatsAppSender;
