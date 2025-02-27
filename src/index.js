import axios from "axios";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

// Get the directory name properly in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

const main = async () => {
  // Load environment variables with validation
  const env = loadEnvironment();

  // Package ID for Kumo NFT collection
  const kumoPackage =
    "0x57191e5e5c41166b90a4b7811ad3ec7963708aa537a8438c1761a5d33e2155fd";

  const x_api_key = env.X_API_KEY;
  console.log("x_api_key available:", x_api_key ? "Yes" : "No");

  // using BlockBerry API
  const fetchHistoricalEvents = async () => {
    const options = {
      method: "POST",
      url: `https://api.blockberry.one/sui/v1/events/collection/${kumoPackage}%3A%3Akumo%3A%3AKumo`,
      params: {
        page: 0,
        size: 20,
        orderBy: "DESC",
        sortBy: "AGE",
      },
      headers: {
        accept: "*/*",
        "content-type": "application/json",
        "x-api-key": x_api_key,
      },
      data: {
        eventTypes: ["List"],
        marketplaces: ["TradePort"], // kumo's marketplace type
      },
    };

    try {
      const response = await axios.request(options);
      // Log the actual data for debugging
      console.log(
        "Historical events fetched:",
        JSON.stringify(response.data, null, 2)
      );

      // Check if the response contains the expected data structure
      if (response.data && response.data.data) {
        console.log(`Found ${response.data.data.length} events`);

        // Log a sample of the first event if available
        if (response.data.data.length > 0) {
          console.log(
            "Sample event:",
            JSON.stringify(response.data.data[0], null, 2)
          );
        } else {
          console.log("No events found in the response");
        }
      } else {
        console.log(
          "Unexpected response structure:",
          Object.keys(response.data)
        );
      }

      return response.data;
    } catch (error) {
      console.error("Error fetching historical events:", error.message);
      if (error.response) {
        console.error("Response status:", error.response.status);
        console.error(
          "Response data:",
          JSON.stringify(error.response.data, null, 2)
        );
      }
      throw error;
    }
  };

  const events = await fetchHistoricalEvents();
  console.log("Events retrieval complete");
  return events;
};

// Execute main function with proper error handling
main()
  .then((result) => {
    console.log("Successfully initialized event monitoring");
    // Log the final result structure
    console.log("Result structure:", Object.keys(result));

    // If there's data in the result, log how many items were found
    if (result && result.data) {
      console.log(`Total events found: ${result.data.length}`);
    }
  })
  .catch((error) => {
    console.error("Error in initialization:", error);
    process.exit(1);
  });
