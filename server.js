const express = require('express');
const axios = require('axios');
const Papa = require('papaparse');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json()); // Middleware to parse JSON bodies

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1H_quYjxZ8joo7Z8bx8Gg7-0zam8wamgQwnV6nnInekE/export?format=csv&gid=1269986405';

let dataCache = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 60 * 1000; 

// No global genAI initialization

app.get('/api/data', async (req, res) => {
    try {
        const now = Date.now();
        if (dataCache && (now - lastFetchTime < CACHE_TTL_MS)) {
            return res.json(dataCache);
        }

        const response = await axios.get(SHEET_URL, { responseType: 'text' });
        
        Papa.parse(response.data, {
            header: false,
            skipEmptyLines: true,
            complete: (results) => {
                const rows = results.data;
                if (rows.length < 2) return res.status(500).json({ error: 'No data found' });
                
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

// Chatbot Endpoint
app.post('/api/chat', async (req, res) => {
    const API_KEY = process.env.GEMINI_API_KEY;
    
    if (!API_KEY) {
        return res.status(503).json({ error: 'Gemini API Key no configurada en el servidor. Revisa las variables en Railway.' });
    }
    
    const genAI = new GoogleGenerativeAI(API_KEY);
    
    const { message } = req.body;
    if (!message) {
        return res.status(400).json({ error: 'Mensaje vacío.' });
    }
    
    if (!dataCache) {
        return res.status(503).json({ error: 'El dataset aún no está cargado. Inténtalo en unos segundos.' });
    }

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        
        // Convert array to a concise format to save tokens. We can convert to CSV text.
        const csvData = Papa.unparse(dataCache);
        
        const prompt = `
Eres la IA oficial del Dashboard de la Porra del Mundial 2026. Tu objetivo es responder a las preguntas del usuario basándote EXCLUSIVAMENTE en el siguiente dataset CSV que contiene las predicciones de todos los participantes.
Si alguien pregunta algo que no está en el CSV, dile que no tienes esa información.
Responde de forma amigable, futbolera, conversacional, como un analista deportivo, y concisa. Si puedes, menciona a los participantes (sus alias) que han votado ciertas cosas para darle salseo.

DATASET (CSV):
${csvData}

Pregunta del usuario: ${message}
`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        
        res.json({ reply: responseText });
    } catch (error) {
        console.error('Error in Gemini API:', error);
        res.status(500).json({ error: 'Fallo en la IA: ' + (error.message || 'Error desconocido') });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
