import WhatsAppSender from './whatsapp-sender.js';
import fs from 'fs';

class WhatsAppCronRunner {
  constructor() {
    this.sender = new WhatsAppSender();
    this.config = this.sender.config;
    this.dailyLimit = 10; // 10 businesses per day (2 batches of 5)
    this.sentTodayFile = 'Output/sent-today.json';
  }

  async checkDailyLimit() {
    try {
      const today = new Date().toDateString();
      
      if (fs.existsSync(this.sentTodayFile)) {
        const sentData = JSON.parse(fs.readFileSync(this.sentTodayFile, 'utf8'));
        
        // Check if it's the same day
        if (sentData.date === today) {
          console.log(`📅 Daily limit check: Already sent ${sentData.count}/${this.dailyLimit} messages today`);
          return sentData.count < this.dailyLimit;
        }
      }
      
      // New day or no file - reset counter
      return true;
    } catch (error) {
      console.error('❌ Error checking daily limit:', error.message);
      return true; // Allow sending if check fails
    }
  }

  async getSentTodayCount() {
    try {
      const today = new Date().toDateString();
      
      if (fs.existsSync(this.sentTodayFile)) {
        const sentData = JSON.parse(fs.readFileSync(this.sentTodayFile, 'utf8'));
        
        if (sentData.date === today) {
          return sentData.count;
        }
      }
      
      return 0;
    } catch (error) {
      console.error('❌ Error getting today count:', error.message);
      return 0;
    }
  }

  async updateSentTodayCount(count) {
    try {
      const today = new Date().toDateString();
      const sentData = {
        date: today,
        count: count,
        lastUpdated: new Date().toISOString()
      };
      
      fs.writeFileSync(this.sentTodayFile, JSON.stringify(sentData, null, 2));
      console.log(`✅ Updated daily count: ${count}/${this.dailyLimit}`);
    } catch (error) {
      console.error('❌ Error updating daily count:', error.message);
    }
  }

  async runDailyCampaign() {
    console.log('🚀 Starting daily WhatsApp campaign...');
    console.log(`📅 Date: ${new Date().toDateString()}`);
    
    // Check if we can send today
    if (!await this.checkDailyLimit()) {
      console.log('⏸️  Daily limit reached. Skipping today.');
      return;
    }
    
    const sentToday = await this.getSentTodayCount();
    const remainingToday = this.dailyLimit - sentToday;
    
    console.log(`📊 Daily status: ${sentToday}/${this.dailyLimit} sent, ${remainingToday} remaining`);
    
    if (remainingToday === 0) {
      console.log('✅ Daily limit already reached. Nothing to send.');
      return;
    }
    
    try {
      // Send remaining messages for today
      console.log(`📱 Sending ${remainingToday} messages today...`);
      
      const result = await this.sender.sendToAllBusinesses(remainingToday, true);
      
      // Update daily count
      const newTotal = sentToday + result.sent;
      await this.updateSentTodayCount(newTotal);
      
      console.log('\n📊 Daily Campaign Summary:');
      console.log(`   ✅ Sent today: ${result.sent}`);
      console.log(`   ❌ Failed today: ${result.failed}`);
      console.log(`   📊 Total today: ${newTotal}/${this.dailyLimit}`);
      console.log(`   📈 Success rate: ${result.sent > 0 ? ((result.sent / (result.sent + result.failed)) * 100).toFixed(1) : 0}%`);
      
      // Check if daily limit is now reached
      if (newTotal >= this.dailyLimit) {
        console.log('🎉 Daily limit reached! Campaign complete for today.');
      } else {
        console.log(`⏳ ${this.dailyLimit - newTotal} messages remaining for next run.`);
      }
      
    } catch (error) {
      console.error('❌ Error in daily campaign:', error.message);
    }
  }

  async getStatus() {
    const sentToday = await this.getSentTodayCount();
    const remaining = this.dailyLimit - sentToday;
    const progress = await this.sender.loadProgress();
    
    console.log('📊 WhatsApp Campaign Status:');
    console.log(`   📅 Today: ${new Date().toDateString()}`);
    console.log(`   📱 Sent today: ${sentToday}/${this.dailyLimit}`);
    console.log(`   📊 Remaining: ${remaining}`);
    console.log(`   🎯 Total completed: ${progress.completedBusinesses.length}`);
    console.log(`   📦 Current batch: ${progress.currentBatch}`);
    console.log(`   📈 Overall success rate: ${progress.totalMessagesSent > 0 ? ((progress.totalMessagesSent / (progress.totalMessagesSent + progress.totalMessagesFailed)) * 100).toFixed(1) : 0}%`);
  }

  async resetDailyCounter() {
    try {
      if (fs.existsSync(this.sentTodayFile)) {
        fs.unlinkSync(this.sentTodayFile);
        console.log('✅ Daily counter reset successfully');
      } else {
        console.log('ℹ️  No daily counter file found');
      }
    } catch (error) {
      console.error('❌ Error resetting daily counter:', error.message);
    }
  }
}

// CLI interface for cron runner
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (!command) {
    console.log('📖 WhatsApp Cron Commands:');
    console.log('  node whatsapp-cron.js run           - Run daily campaign');
    console.log('  node whatsapp-cron.js status        - Show campaign status');
    console.log('  node whatsapp-cron.js reset-daily   - Reset daily counter');
    console.log('');
    console.log('💡 Cron setup examples:');
    console.log('  # Run at 9:00 AM every day');
    console.log('  0 9 * * * cd /path/to/project && node whatsapp-cron.js run');
    console.log('');
    console.log('  # Run at 9:00 AM and 3:00 PM every day');
    console.log('  0 9,15 * * * cd /path/to/project && node whatsapp-cron.js run');
    process.exit(0);
  }

  try {
    const cronRunner = new WhatsAppCronRunner();
    
    switch (command) {
      case 'run':
        await cronRunner.runDailyCampaign();
        break;
        
      case 'status':
        await cronRunner.getStatus();
        break;
        
      case 'reset-daily':
        await cronRunner.resetDailyCounter();
        break;
        
      default:
        console.log('❌ Unknown command. Use "run", "status", or "reset-daily"');
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

export default WhatsAppCronRunner;
