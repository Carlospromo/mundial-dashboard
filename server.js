const express = require('express');
const axios = require('axios');
const Papa = require('papaparse');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// URL of the Google Sheet CSV export
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1H_quYjxZ8joo7Z8bx8Gg7-0zam8wamgQwnV6nnInekE/export?format=csv&gid=1269986405';

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Cache variables to avoid hammering Google Sheets on every request
let dataCache = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache

app.get('/api/data', async (req, res) => {
    try {
        const now = Date.now();
        if (dataCache && (now - lastFetchTime < CACHE_TTL_MS)) {
            return res.json(dataCache);
        }

        const response = await axios.get(SHEET_URL, {
            responseType: 'text'
        });
        
        // The first row is just categories, second row has the actual questions/headers.
        // We parse the entire CSV and clean it up.
        Papa.parse(response.data, {
            header: false, // Parse as array of arrays first to handle the complex double headers
            skipEmptyLines: true,
            complete: (results) => {
                const rows = results.data;
                if (rows.length < 2) {
                    return res.status(500).json({ error: 'No data found' });
                }

                // Use the second row as keys (the questions/teams) for simplicity, or we can just pass the raw matrix
                // to let the frontend handle the logic. 
                // Let's pass the raw matrix to the frontend, it gives us maximum flexibility.
                
                dataCache = rows;
                lastFetchTime = Date.now();
                
                res.json(dataCache);
            },
            error: (error) => {
                res.status(500).json({ error: 'Error parsing CSV', details: error });
            }
        });

    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).json({ error: 'Failed to fetch data' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
