import WebSocket from "ws";
import http from "http";
import { v4 as uuidv4 } from "uuid";

/**
 * Creates and configures a WebSocket server for real-time event handling
 * @param {Object} options - Server configuration options
 * @param {number} options.port - Port to run the WebSocket server on
 * @param {Function} options.onMessage - Callback for handling incoming messages
 * @param {Function} options.onConnection - Callback for new connections
 * @param {Function} options.onClose - Callback for closed connections
 * @returns {Object} The WebSocket server instance and utility methods
 */
export function createWebSocketServer({
  port = 8080,
  onMessage = () => {},
  onConnection = () => {},
  onClose = () => {},
} = {}) {
  // Create HTTP server
  const server = http.createServer();

  // Create WebSocket server instance
  const wss = new WebSocket.Server({ server });

  // Store active connections with unique IDs
  const clients = new Map();

  // Handle new WebSocket connections
  wss.on("connection", (ws) => {
    const clientId = uuidv4();
    const clientInfo = {
      id: clientId,
      connection: ws,
      connectedAt: new Date(),
    };

    // Store client connection
    clients.set(clientId, clientInfo);
    console.log(`Client connected: ${clientId}`);

    // Call the onConnection callback with client info
    onConnection(clientInfo);

    // Handle incoming messages
    ws.on("message", (message) => {
      try {
        const parsedMessage = JSON.parse(message);
        console.log(`Received message from ${clientId}:`, parsedMessage);

        // Call the onMessage callback with the parsed message and client info
        onMessage(parsedMessage, clientInfo);
      } catch (error) {
        console.error(`Error parsing message from ${clientId}:`, error);
        ws.send(
          JSON.stringify({
            type: "error",
            message: "Invalid message format. Expected JSON.",
          })
        );
      }
    });

    // Handle client disconnection
    ws.on("close", () => {
      console.log(`Client disconnected: ${clientId}`);
      clients.delete(clientId);

      // Call the onClose callback with client info
      onClose(clientInfo);
    });

    // Send welcome message to client
    ws.send(
      JSON.stringify({
        type: "connection_established",
        clientId,
        message: "Connected to WebSocket server",
      })
    );
  });

  // Start the server
  server.listen(port, () => {
    console.log(`WebSocket server is running on port ${port}`);
  });

  // Utility function to broadcast a message to all connected clients
  const broadcast = (message) => {
    const messageStr =
      typeof message === "string" ? message : JSON.stringify(message);
    clients.forEach((client) => {
      if (client.connection.readyState === WebSocket.OPEN) {
        client.connection.send(messageStr);
      }
    });
  };

  // Utility function to send a message to a specific client
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

  // Return the server instance and utility methods
  return {
    server,
    wss,
    clients,
    broadcast,
    sendToClient,
    getConnectedClients: () => Array.from(clients.values()),
    shutdown: () => {
      server.close();
      clients.forEach((client) => {
        client.connection.terminate();
      });
      clients.clear();
    },
  };
}
