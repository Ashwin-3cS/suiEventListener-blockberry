import WebSocket from "ws";

const ws = new WebSocket("ws://localhost:8080");

const sendMessage = (message) => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  } else {
    console.log("WebSocket is not connected");
  }
};

// Connection opened
ws.on("open", () => {
  console.log("Connected to NFT Event Stream server");

  // Send initial ping
  sendMessage({
    type: "ping",
    timestamp: Date.now(),
  });

  // Set up periodic pings
  setInterval(() => {
    sendMessage({
      type: "ping",
      timestamp: Date.now(),
    });
  }, 30000);
});

// Listen for messages
ws.on("message", (data) => {
  try {
    const message = JSON.parse(data.toString());

    switch (message.type) {
      case "connection_established":
        console.log(`Connection established. Client ID: ${message.clientId}`);
        console.log(`Monitoring collection: ${message.collection}`);
        console.log(`Poll interval: ${message.pollInterval}ms`);
        break;

      case "pong":
        console.log(`Ping-pong latency: ${Date.now() - message.timestamp}ms`);
        break;

      case "nft_event":
        console.log("\n=== NEW NFT EVENT ===");
        console.log(`Transaction: ${message.data.txHash}`);
        console.log(`Type: ${message.data.eventType}`);
        console.log(`NFT: ${message.data.nftName || "Unknown"}`);
        console.log(
          `Price: ${
            message.data.latestPrice ? message.data.latestPrice + " SUI" : "N/A"
          }`
        );
        console.log(
          `Seller: ${
            message.data.sellerName || message.data.sellerAddress || "Unknown"
          }`
        );
        console.log(`Marketplace: ${message.data.marketplace || "Unknown"}`);
        console.log(
          `Timestamp: ${new Date(message.data.timestamp).toLocaleString()}`
        );
        if (message.data.nftImg) {
          console.log(`NFT Image: ${message.data.nftImg}`);
        }
        console.log("=====================\n");
        break;

      case "error":
        console.error(`Server Error: ${message.message}`);
        break;

      default:
        console.log("Received message:", message);
    }
  } catch (error) {
    console.error("Failed to parse message:", error);
  }
});

// Handle errors
ws.on("error", (error) => {
  console.error("WebSocket error:", error);
});

// Handle close
ws.on("close", () => {
  console.log("Disconnected from server");
});

// Handle process termination
process.on("SIGINT", () => {
  console.log("\nClosing WebSocket connection...");
  ws.close();
  process.exit(0);
});
