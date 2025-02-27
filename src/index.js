import { fileURLToPath } from "url";
import path from "path";
import dotenv from "dotenv";
import fs from "fs";
import { createNftEventStreamServer } from "./websocketServer.js";

// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

main();

async function main() {
  // Load environment variables
  const env = loadEnvironment();

  // Create and start the NFT Event Stream server
  const eventServer = createNftEventStreamServer({
    port: process.env.WS_PORT || 8080,
    apiKey: process.env.X_API_KEY,
    pollInterval: process.env.POLL_INTERVAL
      ? parseInt(process.env.POLL_INTERVAL)
      : 30000,
    collection:
      process.env.NFT_COLLECTION ||
      "0x57191e5e5c41166b90a4b7811ad3ec7963708aa537a8438c1761a5d33e2155fd",
  });

  console.log("NFT Event Stream server initialized and running");

  // Handle application shutdown
  process.on("SIGINT", () => {
    console.log("Shutting down server...");
    eventServer.shutdown();
    process.exit(0);
  });
}

function loadEnvironment() {
  // Try multiple possible locations for the .env file
  const possiblePaths = [
    path.resolve(process.cwd(), ".env"), // Current working directory
    path.resolve(__dirname, "../.env"), // Parent directory of the script
    path.resolve(__dirname, ".env"), // Same directory as the script
    path.resolve(process.cwd(), "src", ".env"), // src subdirectory
    path.resolve(process.cwd(), "..", ".env"), // Parent of working directory
  ];

  let envPath = null;
  let loadResult = null;

  // Try each path until we find a valid .env file
  for (const testPath of possiblePaths) {
    if (fs.existsSync(testPath)) {
      console.log(`Found .env file at: ${testPath}`);
      envPath = testPath;
      loadResult = dotenv.config({ path: testPath });
      if (!loadResult.error) break;
    }
  }

  // Handle case where no .env file was found
  if (!envPath) {
    console.error("No .env file found in any of the following locations:");
    possiblePaths.forEach((p) => console.error(`- ${p}`));
    console.error(
      "Please create a .env file with X_API_KEY=your_api_key in one of these locations"
    );
    process.exit(1);
  }

  // Handle case where .env file was found but couldn't be parsed
  if (loadResult.error) {
    console.error(
      `Error loading .env file from ${envPath}:`,
      loadResult.error.message
    );
    console.error("Please check the format of your .env file");
    process.exit(1);
  }

  // Verify critical environment variables
  if (!process.env.X_API_KEY) {
    console.error("X_API_KEY is not defined in your environment variables");
    console.error(`Your .env file at ${envPath} does not contain X_API_KEY`);
    console.error("Please add X_API_KEY=your_api_key to your .env file");
    process.exit(1);
  }

  return process.env;
}
