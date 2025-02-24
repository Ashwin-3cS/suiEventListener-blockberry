import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const main = async () => {
  // Package ID for Kumo NFT collection
  const kumoPackage =
    "0x57191e5e5c41166b90a4b7811ad3ec7963708aa537a8438c1761a5d33e2155fd";
  const x_api_key = process.env.X_API_KEY;
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
      console.log("Historical events fetched:", response.data);
      console.log("response", response.data);
      return response.data;
    } catch (error) {
      console.error("Error fetching historical events:", error);
      throw error;
    }
  };

  const events = await fetchHistoricalEvents();
  console.log("Events retrieval complete");
  return events;
};

main()
  .then((result) => {
    console.log("Successfully initialized event monitoring");
  })
  .catch((error) => {
    console.error("Error in initialization:", error);
  });
