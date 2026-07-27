require("dotenv").config();

const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();

app.use(cors());
app.use(express.json());

// Health check
app.get("/", (req, res) => {
  res.send("Backend is running 🚀");
});

// Fetch Monday board
app.get("/monday/:boardId", async (req, res) => {
  try {
    const boardId = req.params.boardId;

    const query = `
      query {
        boards(ids: ${boardId}) {
          id
          name
          columns {
            id
            title
            type
          }
          items_page(limit: 500) {
            items {
              id
              name
              column_values {
                id
                text
                value
              }
            }
          }
        }
      }
    `;

    // Call Monday API
    const response = await axios.post(
      "https://api.monday.com/v2",
      {
        query: query
      },
      {
        headers: {
          Authorization: process.env.MONDAY_API_TOKEN,
          "Content-Type": "application/json",
          "API-Version": "2023-10"
        }
      }
    );

    // Check GraphQL errors
    if (response.data.errors) {
      return res.status(400).json(response.data);
    }

    // Return the board data
    return res.json(response.data);

  } catch (err) {
    console.error("Monday API Error:");
    console.error(err.response?.data || err.message);

    return res.status(500).json(
      err.response?.data || {
        error: err.message
      }
    );
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});