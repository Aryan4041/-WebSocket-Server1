const express = require("express");
const { WebSocketServer } = require("ws");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from "public" folder
app.use(express.static("public"));

// Start HTTP server
const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

// WebSocket server
const wss = new WebSocketServer({ server });

// Store active and expired alerts
let priceAlerts = [];
let expiredAlerts = [];

// Function to fetch live prices
async function fetchPrice(symbol) {
    try {
        const res = await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
        return parseFloat(res.data.price);
    } catch (error) {
        console.error(`Error fetching price for ${symbol}:`, error.message);
        return null;
    }
}

// Check prices periodically (every 5 seconds)
setInterval(async () => {
    for (let i = priceAlerts.length - 1; i >= 0; i--) {
        const alert = priceAlerts[i];
        const currentPrice = await fetchPrice(alert.symbol);
        if (currentPrice) {
            alert.ws.send(JSON.stringify({ type: "price", symbol: alert.symbol, price: currentPrice }));

            // Check if alert condition is met
            if ((alert.type === "above" && currentPrice >= alert.targetPrice) ||
                (alert.type === "below" && currentPrice <= alert.targetPrice)) {

                alert.ws.send(JSON.stringify({ type: "alert", symbol: alert.symbol, price: currentPrice }));

                console.log(`🔔 Alert Triggered: ${alert.symbol} reached $${currentPrice}`);

                // Move alert to expired list
                expiredAlerts.push(alert);
                priceAlerts.splice(i, 1);
            }
        }
    }
}, 5000);

// WebSocket connection handling
wss.on("connection", (ws) => {
    ws.on("message", async (message) => {
        const data = JSON.parse(message);

        if (data.type === "setAlert") {
            priceAlerts.push({ ws, symbol: data.symbol, targetPrice: parseFloat(data.price), type: data.condition });
            ws.send(JSON.stringify({ type: "alertSet", symbol: data.symbol, price: data.price, condition: data.condition }));
            console.log(`🔔 Alert Set: ${data.symbol} at $${data.price} (${data.condition})`);
        }
    });
});
