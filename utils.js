const fs = require('fs').promises;
const axios = require('axios');

async function loadTokenMetadata() {
  let tokenMetadata = [];
  try {
    const data = await fs.readFile('unicorn.json', 'utf8'); // Load 'unicorn.json'
    tokenMetadata = JSON.parse(data);

    if (!Array.isArray(tokenMetadata)) {
      throw new Error('Token metadata is not an array');
    }

    console.log('✨ Token metadata loaded:', tokenMetadata.length, 'tokens');
  } catch (error) {
    console.error('❌ Failed to load token metadata:', error.message);
  }
  return tokenMetadata;
}

function getTokenDetails(denom, tokenMetadata) {
  return tokenMetadata.find((token) => token.base === denom) || { symbol: denom, exponent: 6 };
}

let priceCache = {};
let cacheTimestamp = 0;

async function getCurrentPrice(symbol) {
  const now = Date.now();
  if (priceCache[symbol] && now - cacheTimestamp < 60000) {
    // Return cached price if less than 1 minute old
    return priceCache[symbol];
  }

  if (symbol.toUpperCase() === 'UWU') {
    // Fetch price from GeckoTerminal API
    try {
      const response = await axios.get(
        'https://api.geckoterminal.com/api/v2/networks/unicorn/tokens/UwU8RVXB69Y6Dcju6cN2Qef6fykkq6UUNpB15rZku6Z'
      );

      const tokenData = response.data.data;

      // Extract price information
      const priceUsd = tokenData.attributes.price_usd;

      // Update cache
      priceCache[symbol] = priceUsd ? parseFloat(priceUsd) : null;
      cacheTimestamp = now;

      return priceCache[symbol];
    } catch (error) {
      console.error('❌ Failed to fetch UWU token price:', error.message);
      return null;
    }
  } else {
    // Existing logic for other tokens
    try {
      const response = await axios.get(
        `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(
          symbol.toLowerCase()
        )}&vs_currencies=usd`
      );

      // Update cache
      priceCache[symbol] = response.data[symbol.toLowerCase()]?.usd || null;
      cacheTimestamp = now;

      return priceCache[symbol];
    } catch (error) {
      console.error('❌ Failed to fetch current price:', error.message);
      return null;
    }
  }
}

async function formatAlertMessage(message, txHash, tokenMetadata) {
  const msg = message.msg;

  // Determine if it's a swap or execute_swap_operations
  let swapData;
  if (msg.swap) {
    swapData = msg.swap;
  } else if (msg.execute_swap_operations) {
    swapData = msg.execute_swap_operations;
  } else {
    console.error('❌ Unknown message format:', msg);
    return null;
  }

  // Extract offer and ask asset info
  let offerAssetInfo, askAssetInfo;
  if (swapData.offer_asset_info) {
    offerAssetInfo = swapData.offer_asset_info;
    askAssetInfo = swapData.ask_asset_info;
  } else if (swapData.operations && swapData.operations.length > 0) {
    // For execute_swap_operations, extract from operations
    const firstOperation = swapData.operations[0];
    const lastOperation = swapData.operations[swapData.operations.length - 1];

    // Depending on the operation type, extract asset info
    if (firstOperation.astro_swap) {
      offerAssetInfo = firstOperation.astro_swap.offer_asset_info;
    } else if (firstOperation.terra_swap) {
      offerAssetInfo = firstOperation.terra_swap.offer_asset_info;
    }

    if (lastOperation.astro_swap) {
      askAssetInfo = lastOperation.astro_swap.ask_asset_info;
    } else if (lastOperation.terra_swap) {
      askAssetInfo = lastOperation.terra_swap.ask_asset_info;
    }
  }

  const baseToken =
    offerAssetInfo?.native_token?.denom ||
    offerAssetInfo?.token?.contract_addr ||
    'Unknown';

  const tokenDetails = getTokenDetails(baseToken, tokenMetadata);

  // Amount is taken from message.funds (for offer amount)
  const offerAmount = message.funds?.[0]?.amount || '0';
  const amount = parseInt(offerAmount, 10) / Math.pow(10, tokenDetails.exponent);

  // Minimum receive amount
  const minReceive = swapData.minimum_receive
    ? parseInt(swapData.minimum_receive, 10) / Math.pow(10, tokenDetails.exponent)
    : 0;

  const sender = message.sender;

  // Fetch current price
  const price = await getCurrentPrice(tokenDetails.symbol.toUpperCase());
  const totalValue = price ? (amount * price).toFixed(2) : 'N/A';

  // Format the alert message
  const alertMessage = `
🦄 *${tokenDetails.symbol} Meme Buy Alert!*

💰 *Amount*: ${amount.toFixed(2)} ${tokenDetails.symbol} ${
    totalValue !== 'N/A' ? `(~$${totalValue})` : ''
  }
🛡️ *Minimum Receive*: ${minReceive.toFixed(2)} ${tokenDetails.symbol}
👤 *Sender*: [${sender.slice(0, 6)}...${sender.slice(-4)}](https://unicorn.meme/address/${sender})
🔗 [Transaction](https://uwu.direct/Unicorn/tx/${txHash})

📊 [Live Chart](https://charts.unicorn.meme/${encodeURIComponent(tokenDetails.symbol)})
🎉 [Join the Community](https://t.me/unicornmeme)
🚀 *Let’s Moon Together!* 🌕

_Time_: ${new Date().toLocaleString()}
  `;
  return alertMessage;
}

module.exports = {
  loadTokenMetadata,
  getTokenDetails,
  formatAlertMessage,
  getCurrentPrice,
};
