import axios from "axios";
import { WebSocketServer } from "ws";
import http from "http";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";

/**
 * Creates a WebSocket server that streams Sui NFT events from Blockberry API
 * @param {Object} options - Server configuration options
 * @param {number} options.port - Port to run the WebSocket server on
 * @param {string} options.apiKey - Blockberry API key
 * @param {number} options.pollInterval - How often to poll the API in milliseconds
 * @returns {Object} The WebSocket server instance and utility methods
 */
export function createNftEventStreamServer({
  port = 8080,
  apiKey,
  pollInterval = 30000, // 30 seconds by default
  collection = "0x57191e5e5c41166b90a4b7811ad3ec7963708aa537a8438c1761a5d33e2155fd",
} = {}) {
  // Create HTTP server
  const server = http.createServer();
  const wss = new WebSocketServer({ server });
  const clients = new Map();

  // Changed to use txHash as unique identifier
  let lastSeenTxHashes = new Set();
  let pollingInterval = null;

  async function fetchNftEvents(
    eventTypes = "List",
    marketplaces = "TradePort",
    page = 0,
    size = 20
  ) {
    try {
      const encodedCollection = encodeURIComponent(collection);
      const url = `https://api.blockberry.one/sui/v1/events/collection/${encodedCollection}%3A%3Akumo%3A%3AKumo`;

      const options = {
        method: "POST",
        url,
        params: {
          page,
          size,
          orderBy: "DESC",
          sortBy: "AGE",
        },
        headers: {
          accept: "*/*",
          "content-type": "application/json",
          "x-api-key": apiKey,
        },
        data: {
          eventTypes: [eventTypes],
          marketplaces: [marketplaces],
        },
      };

      const response = await axios.request(options);
      return response.data;
    } catch (error) {
      console.error("Failed to fetch NFT events:", error.message);
      if (error.response) {
        console.error(
          "API response:",
          error.response.status,
          error.response.data
        );
      }
      return null;
    }
  }

  async function pollEvents() {
    try {
      const eventData = await fetchNftEvents();

      if (
        !eventData ||
        !eventData.content ||
        !Array.isArray(eventData.content)
      ) {
        console.error("Invalid event data received");
        return;
      }

      // Filter out events we've already seen using txHash
      const newEvents = eventData.content.filter(
        (event) => !lastSeenTxHashes.has(event.txHash)
      );

      if (newEvents.length > 0) {
        console.log(`Found ${newEvents.length} new events`);

        // Update our set of seen transaction hashes
        newEvents.forEach((event) => lastSeenTxHashes.add(event.txHash));

        // Keep the set size manageable
        if (lastSeenTxHashes.size > 1000) {
          const hashesArray = Array.from(lastSeenTxHashes);
          lastSeenTxHashes = new Set(
            hashesArray.slice(hashesArray.length - 1000)
          );
        }

        // Broadcast each new event to all clients
        newEvents.forEach((event) => {
          broadcast({
            type: "nft_event",
            data: {
              ...event,
              timestamp: Date.now(),
            },
          });
        });
      } else {
        console.log("No new events found");
      }
    } catch (error) {
      console.error("Error during event polling:", error);
    }
  }

  function startEventPolling() {
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }
    pollEvents();
    pollingInterval = setInterval(pollEvents, pollInterval);
    console.log(`Event polling started (interval: ${pollInterval}ms)`);
  }

  wss.on("connection", (ws) => {
    const clientId = uuidv4();
    const clientInfo = {
      id: clientId,
      connection: ws,
      connectedAt: new Date(),
    };
    clients.set(clientId, clientInfo);
    console.log(`Client connected: ${clientId}`);

    ws.on("message", (message) => {
      try {
        const parsedMessage = JSON.parse(message.toString());
        console.log(`Received message from ${clientId}:`, parsedMessage);

        switch (parsedMessage.type) {
          case "ping":
            sendToClient(clientId, {
              type: "pong",
              timestamp: Date.now(),
            });
            break;

          case "get_latest_events":
            pollEvents();
            sendToClient(clientId, {
              type: "fetching_events",
              timestamp: Date.now(),
            });
            break;

          case "update_filters":
            if (parsedMessage.eventTypes || parsedMessage.marketplaces) {
              sendToClient(clientId, {
                type: "filters_updated",
                eventTypes: parsedMessage.eventTypes || "List",
                marketplaces: parsedMessage.marketplaces || "TradePort",
                timestamp: Date.now(),
              });
              pollEvents();
            }
            break;
        }
      } catch (error) {
        console.error(`Error parsing message from ${clientId}:`, error);
        sendToClient(clientId, {
          type: "error",
          message: "Invalid message format. Expected JSON.",
        });
      }
    });

    ws.on("close", () => {
      console.log(`Client disconnected: ${clientId}`);
      clients.delete(clientId);
    });

    sendToClient(clientId, {
      type: "connection_established",
      clientId,
      message: "Connected to NFT Event Stream server",
      collection,
      pollInterval,
      timestamp: Date.now(),
    });
  });

  const broadcast = (message) => {
    const messageStr =
      typeof message === "string" ? message : JSON.stringify(message);
    let activeClients = 0;

    clients.forEach((client) => {
      if (client.connection.readyState === WebSocket.OPEN) {
        client.connection.send(messageStr);
        activeClients++;
      }
    });

    if (activeClients > 0) {
      console.log(`Broadcasted event to ${activeClients} clients`);
    }
  };

  const sendToClient = (clientId, message) => {
    const client = clients.get(clientId);
    if (client && client.connection.readyState === WebSocket.OPEN) {
      const messageStr =
        typeof message === "string" ? message : JSON.stringify(message);
      client.connection.send(messageStr);
      return true;
    }
    return false;
  };

  server.listen(port, () => {
    console.log(`NFT Event Stream server is running on port ${port}`);
    startEventPolling();
  });

  return {
    server,
    wss,
    clients,
    broadcast,
    sendToClient,
    getConnectedClients: () => Array.from(clients.values()),
    setPollInterval: (newInterval) => {
      pollInterval = newInterval;
      startEventPolling();
    },
    shutdown: () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
      }
      server.close();
      clients.forEach((client) => client.connection.terminate());
      clients.clear();
      console.log("NFT Event Stream server shut down");
    },
  };
}
