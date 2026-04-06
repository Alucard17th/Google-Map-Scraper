// WhatsApp Message Sender for Business Proposals
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

  async getBusinesses() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/businesses`);
      const data = await response.json();
      return data.businesses || [];
    } catch (error) {
      console.error('❌ Error fetching businesses:', error.message);
      return [];
    }
  }

  async updateBusinessWhatsAppStatus(slug, sent = true) {
    try {
      // This would update the local JSON file - for now just log
      console.log(`📝 Updated WhatsApp status for ${slug}: ${sent ? 'sent' : 'failed'}`);
      return true;
    } catch (error) {
      console.error(`❌ Error updating WhatsApp status for ${slug}:`, error.message);
      return false;
    }
  }

  createBusinessMessage(business) {
    const { name, category, rating, reviews, address, slug } = business;
    
    // Format phone number (remove +, spaces, etc.)
    const cleanPhone = business.phone.replace(/[^\d]/g, '');
    
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
    
    const businesses = await this.getBusinesses();
    console.log(`📊 Found ${businesses.length} businesses`);

    // Filter businesses
    let businessesToContact = businesses;
    
    if (skipSent) {
      businessesToContact = businesses.filter(b => !b.whatsappSent);
      console.log(`📋 ${businessesToContact.length} businesses haven't been contacted yet`);
    }
    
    if (limit) {
      businessesToContact = businessesToContact.slice(0, limit);
      console.log(`🎯 Limiting to ${businessesToContact.length} businesses`);
    }

    if (businessesToContact.length === 0) {
      console.log('ℹ️  No businesses to contact');
      return { sent: 0, failed: 0, total: 0 };
    }

    let sentCount = 0;
    let failedCount = 0;

    for (let i = 0; i < businessesToContact.length; i++) {
      const business = businessesToContact[i];
      
      console.log(`\n📱 ${i + 1}/${businessesToContact.length} - Contacting ${business.name}`);
      
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
        await this.updateBusinessWhatsAppStatus(business.slug, true);
        
        // Add delay between messages to avoid spam detection
        if (i < businessesToContact.length - 1) {
          const delay = Math.random() * 5000 + 5000; // 5-10 seconds random delay
          console.log(`⏳ Waiting ${Math.round(delay/1000)}s before next message...`);
          await this.sleep(delay);
        }
      } else {
        failedCount++;
        await this.updateBusinessWhatsAppStatus(business.slug, false);
      }
    }

    console.log(`\n📊 Campaign Summary:`);
    console.log(`   ✅ Sent: ${sentCount}`);
    console.log(`   ❌ Failed: ${failedCount}`);
    console.log(`   📊 Total: ${businessesToContact.length}`);

    return { sent: sentCount, failed: failedCount, total: businessesToContact.length };
  }

  async sendToSpecificBusiness(slug) {
    console.log(`🎯 Sending WhatsApp message to specific business: ${slug}`);
    
    const businesses = await this.getBusinesses();
    const business = businesses.find(b => b.slug === slug);
    
    if (!business) {
      console.error(`❌ Business not found: ${slug}`);
      return { success: false, error: 'Business not found' };
    }

    console.log(`📱 Contacting ${business.name}`);
    
    // Clean phone number
    const cleanPhone = business.phone.replace(/[^\d]/g, '');
    
    if (!cleanPhone || cleanPhone.length < 10) {
      console.log(`⚠️  Invalid phone number: ${business.phone}`);
      return { success: false, error: 'Invalid phone number' };
    }

    // Create personalized message
    const message = this.createBusinessMessage(business);
    
    // Send message
    const result = await this.sendWhatsAppMessage(cleanPhone, message);
    
    if (result.success) {
      await this.updateBusinessWhatsAppStatus(business.slug, true);
      console.log(`✅ Message sent to ${business.name}`);
    } else {
      await this.updateBusinessWhatsAppStatus(business.slug, false);
      console.log(`❌ Failed to send message to ${business.name}`);
    }

    return result;
  }

  async testSimpleMessage(phone) {
    console.log(`🧪 Testing simple WhatsApp message to ${phone}`);
    
    const testMessage = `🔧 *Test Message - Proposition de Site Web*\n\nCeci est un message test pour vérifier que l'API WhatsApp fonctionne correctement.\n\n🔗 *Exemple de preview:* https://preview.grow-with-tools.com/epp-entreprise-prigueux-plomberie\n\nSi vous recevez ce message, votre système est prêt pour la campagne! 🚀`;
    
    const result = await this.sendWhatsAppMessage(phone, testMessage);
    
    if (result.success) {
      console.log(`✅ Simple test message sent successfully to ${phone}`);
    } else {
      console.error(`❌ Simple test message failed:`, result.error);
    }
    
    return result;
  }

  async testBusinessMessage(phone, slug = 'epp-entreprise-prigueux-plomberie') {
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
    
    if (result.success) {
      console.log(`✅ Business message sent successfully to ${phone}`);
    } else {
      console.error(`❌ Business message failed:`, result.error);
    }
    
    return result;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async getStats() {
    const businesses = await this.getBusinesses();
    
    const stats = {
      total: businesses.length,
      withPhone: businesses.filter(b => b.phone && b.phone !== 'Not found').length,
      withScreenshots: businesses.filter(b => b.screenshotUrl).length,
      whatsappSent: businesses.filter(b => b.whatsappSent).length,
      whatsappNotSent: businesses.filter(b => !b.whatsappSent).length,
      readyToSend: businesses.filter(b => 
        b.phone && 
        b.phone !== 'Not found' && 
        !b.whatsappSent && 
        b.screenshotUrl
      ).length
    };

    console.log('📊 WhatsApp Campaign Statistics:');
    console.log(`   📋 Total businesses: ${stats.total}`);
    console.log(`   📱 With phone numbers: ${stats.withPhone}`);
    console.log(`   📸 With screenshots: ${stats.withScreenshots}`);
    console.log(`   ✅ WhatsApp sent: ${stats.whatsappSent}`);
    console.log(`   ⏳ WhatsApp not sent: ${stats.whatsappNotSent}`);
    console.log(`   🎯 Ready to send: ${stats.readyToSend}`);

    return stats;
  }
}

// Command line interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const sender = new WhatsAppSender();

  console.log('📱 ' + '='.repeat(60));
  console.log('📱 WHATSAPP MESSAGE SENDER');
  console.log('📱 ' + '='.repeat(60));

  if (!sender.apiKey) {
    console.error('❌ EVOLUTION_API_KEY not found in environment variables');
    console.log('💡 Please add it to your .env file:');
    console.log('   EVOLUTION_API_KEY=your_api_key_here');
    process.exit(1);
  }

  try {
    switch (command) {
      case 'test':
        const testPhone = args[1];
        if (!testPhone) {
          console.error('❌ Please provide a phone number for testing');
          console.log('💡 Usage: npm run whatsapp test 212707673488');
          process.exit(1);
        }
        await sender.testBusinessMessage(testPhone);
        break;

      case 'test-simple':
        const simplePhone = args[1];
        if (!simplePhone) {
          console.error('❌ Please provide a phone number for testing');
          console.log('💡 Usage: npm run whatsapp test-simple 212707673488');
          process.exit(1);
        }
        await sender.testSimpleMessage(simplePhone);
        break;

      case 'send':
        const limit = args[1] ? parseInt(args[1]) : null;
        await sender.sendToAllBusinesses(limit);
        break;

      case 'send-all':
        await sender.sendToAllBusinesses(null, false); // Send to all, including already sent
        break;

      case 'business':
        const slug = args[1];
        if (!slug) {
          console.error('❌ Please provide a business slug');
          console.log('💡 Usage: npm run whatsapp business epp-entreprise-prigueux-plomberie');
          process.exit(1);
        }
        await sender.sendToSpecificBusiness(slug);
        break;

      case 'stats':
        await sender.getStats();
        break;

      default:
        console.log('📖 Available commands:');
        console.log('  npm run whatsapp test <phone>           - Send actual business message test');
        console.log('  npm run whatsapp test-simple <phone>     - Send simple test message');
        console.log('  npm run whatsapp send [limit]           - Send to businesses (skip sent)');
        console.log('  npm run whatsapp send-all                - Send to all businesses');
        console.log('  npm run whatsapp business <slug>         - Send to specific business');
        console.log('  npm run whatsapp stats                   - Show campaign statistics');
        console.log('');
        console.log('💡 Examples:');
        console.log('  npm run whatsapp test 212707673488');
        console.log('  npm run whatsapp test-simple 212707673488');
        console.log('  npm run whatsapp send 5');
        console.log('  npm run whatsapp business epp-entreprise-prigueux-plomberie');
        break;
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Install node-fetch if not available
try {
  await import('node-fetch');
} catch (error) {
  console.error('❌ node-fetch is required. Please install it:');
  console.log('   npm install node-fetch');
  process.exit(1);
}

main().catch(console.error);
