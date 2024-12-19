require('dotenv').config();
const { Telegraf } = require('telegraf');
const { loadTokenMetadata, formatAlertMessage, getCurrentPrice } = require('./utils');
const { fetchBuyTransactions } = require('./api');
const fs = require('fs');
const path = require('path');
const keepAlive = require('./server'); // For keeping the Repl awake

// Load environment variables
const BOT_TOKEN = process.env['BOT_TOKEN'];
const CHAT_ID = process.env['CHAT_ID'];
const bot = new Telegraf(BOT_TOKEN);

// Token metadata
let tokenMetadata = [];
// Set to store processed transaction hashes
let processedTxHashes = new Set();
// Load processed transactions from file
const cacheFilePath = path.join(__dirname, 'cache.json');

function loadProcessedTransactions() {
  try {
    if (fs.existsSync(cacheFilePath)) {
      const data = fs.readFileSync(cacheFilePath, 'utf8');
      processedTxHashes = new Set(JSON.parse(data));
      console.log('✅ Loaded processed transaction hashes.');
    }
  } catch (error) {
    console.error('❌ Failed to load processed transaction hashes:', error.message);
  }
}

function saveProcessedTransactions() {
  try {
    fs.writeFileSync(cacheFilePath, JSON.stringify(Array.from(processedTxHashes)));
    console.log('💾 Processed transaction hashes saved.');
  } catch (error) {
    console.error('❌ Failed to save processed transaction hashes:', error.message);
  }
}

// Command to show the chart
bot.command('chart', async (ctx) => {
  try {
    // Get the message text after the command
    const messageText = ctx.message.text;
    // Extract the token symbol
    const args = messageText.split(' ');
    const tokenSymbol = args[1]?.toUpperCase() || 'UWU'; // Default to UWU if no symbol provided

    // Construct the chart URL
    const chartUrl = `https://charts.unicorn.meme/${encodeURIComponent(tokenSymbol)}`;

    // Send the chart URL to the user
    await ctx.reply(`📊 *Live Chart for ${tokenSymbol}:* ${chartUrl}`, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('❌ Error handling /chart command:', error.message);
    await ctx.reply('Sorry, I could not retrieve the chart at this time.');
  }
});

// Optionally, add a /price command
bot.command('price', async (ctx) => {
  try {
    const messageText = ctx.message.text;
    const args = messageText.split(' ');
    const tokenSymbol = args[1]?.toUpperCase();

    if (!tokenSymbol) {
      await ctx.reply('Please provide a token symbol. Usage: /price [TOKEN_SYMBOL]');
      return;
    }

    const price = await getCurrentPrice(tokenSymbol);

    if (price) {
      await ctx.reply(`💰 *Current Price of ${tokenSymbol}:* $${price.toFixed(4)}`, { parse_mode: 'Markdown' });
    } else {
      await ctx.reply(`Sorry, I couldn't retrieve the price for ${tokenSymbol}.`);
    }
  } catch (error) {
    console.error('❌ Error handling /price command:', error.message);
    await ctx.reply('Sorry, I could not retrieve the price at this time.');
  }
});

async function main() {
  console.log('🚀 Starting Unicorn Meme Buy Alert Bot...');
  tokenMetadata = await loadTokenMetadata();

  if (!tokenMetadata || tokenMetadata.length === 0) {
    console.error('❌ No token metadata loaded. Please check unicorn.json.');
    process.exit(1); // Exit the bot if no tokens are loaded
  }

  loadProcessedTransactions();

  // Set bot commands
  bot.telegram.setMyCommands([
    { command: 'chart', description: 'Show the live chart. Usage: /chart [TOKEN_SYMBOL]' },
    { command: 'price', description: 'Get the current price. Usage: /price [TOKEN_SYMBOL]' },
    { command: 'help', description: 'Show help information' },
    // Add more commands as needed
  ]);

  // Start polling transactions every 15 seconds
  setInterval(async () => {
    try {
      const transactions = await fetchBuyTransactions();
      for (const { message, txHash } of transactions) {
        if (processedTxHashes.has(txHash)) continue;
        processedTxHashes.add(txHash);

        const alertMessage = await formatAlertMessage(message, txHash, tokenMetadata);

        if (alertMessage) {
          await bot.telegram.sendMessage(CHAT_ID, alertMessage, { parse_mode: 'Markdown' });
        }
      }
      saveProcessedTransactions();
    } catch (error) {
      console.error('❌ Error during transaction processing:', error.message);
    }
  }, 15000);
}

// Start the bot
bot.launch();
main();
keepAlive(); // For keeping the Repl awake
console.log('🌈 Bot is now running!');
