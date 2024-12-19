const axios = require('axios');

// Unicorn blockchain REST API endpoint
const REST_URL = 'https://rest.unicorn.meme';
const UNICORN_DEX_CONTRACT = 'unicorn16jzpxp0e8550c9aht6q9svcux30vtyyyyxv5w2l2djjra46580wsl825uf'; // Update with actual contract address

async function fetchBuyTransactions() {
  const transactions = [];
  try {
    const events = `message.action='/cosmwasm.wasm.v1.MsgExecuteContract'`;
    const encodedEvents = encodeURIComponent(events);
    const url = `${REST_URL}/cosmos/tx/v1beta1/txs?events=${encodedEvents}&order_by=ORDER_BY_DESC&limit=10`;

    const response = await axios.get(url);

    if (!response.data || !response.data.tx_responses) {
      console.error('❌ Invalid response from REST endpoint:', response.data);
      return transactions;
    }

    const txResponses = response.data.tx_responses;

    for (const tx of txResponses) {
      const messages = tx.tx.body.messages || [];

      for (const message of messages) {
        if (
          message['@type'] === '/cosmwasm.wasm.v1.MsgExecuteContract' &&
          message.contract === UNICORN_DEX_CONTRACT &&
          message.msg &&
          (message.msg.swap || message.msg.execute_swap_operations)
        ) {
          transactions.push({ message, txHash: tx.txhash });
        }
      }
    }
  } catch (error) {
    if (error.response) {
      console.error('❌ Failed to fetch transactions:', error.response.status, error.response.statusText);
      console.error('Response data:', error.response.data);
    } else if (error.request) {
      console.error('❌ No response received:', error.request);
    } else {
      console.error('❌ Error in setting up the request:', error.message);
    }
  }
  return transactions;
}

module.exports = {
  fetchBuyTransactions,
};
