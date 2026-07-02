import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Ensure data directory exists
const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

app.get('/', (req, res) => {
  res.send('ContextGap Self-Hosted Server is running!');
});

app.post('/api/sync/:workspaceId', (req, res) => {
    const { workspaceId } = req.params;
    const { fileData, timestamp } = req.body;
    
    try {
        const filePath = path.join(DATA_DIR, `${workspaceId}.json`);
        fs.writeFileSync(filePath, JSON.stringify({ fileData, timestamp }, null, 2));
        console.log(`Saved backup for workspace: ${workspaceId}`);
        res.json({ success: true });
    } catch (e) {
        console.error('Error saving data:', e);
        res.status(500).json({ error: 'Failed to save data' });
    }
});

app.get('/api/sync/:workspaceId', (req, res) => {
    const { workspaceId } = req.params;
    const filePath = path.join(DATA_DIR, `${workspaceId}.json`);
    
    if (fs.existsSync(filePath)) {
        try {
            const data = fs.readFileSync(filePath, 'utf-8');
            res.json(JSON.parse(data));
        } catch (e) {
            console.error('Error reading data:', e);
            res.status(500).json({ error: 'Failed to read data' });
        }
    } else {
        res.status(404).json({ error: 'No context found' });
    }
});

app.listen(port, () => {
  console.log(`ContextGap Server running at http://localhost:${port}`);
});
