import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());

// Basic proxy endpoint
app.get("/", async (req, res) => {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).send("Missing ?url= parameter");
  }

  try {
    const response = await fetch(targetUrl);
    const data = await response.text();

    // Remove restrictive headers
    res.set("Content-Type", response.headers.get("content-type") || "text/html");
    res.set("Access-Control-Allow-Origin", "*");

    // Return the fetched content
    res.send(data);
  } catch (err) {
    res.status(500).send("Error fetching the requested URL: " + err.message);
  }
});

app.listen(PORT, () => {
  console.log(`Proxy running on port ${PORT}`);
});
