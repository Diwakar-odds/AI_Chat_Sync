import express from 'express';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// In-memory store for Phase 1 (Replace with PostgreSQL later)
const storageStore: Record<string, { fileData: string, timestamp: number }> = {};

app.get('/', (req, res) => {
  res.send('ContextGap Self-Hosted Server is running!');
});

app.post('/api/sync/:workspaceId', (req, res) => {
    const { workspaceId } = req.params;
    const { fileData, timestamp } = req.body;
    
    storageStore[workspaceId] = { fileData, timestamp };
    console.log(`Saved backup for workspace: ${workspaceId}`);
    res.json({ success: true });
});

app.get('/api/sync/:workspaceId', (req, res) => {
    const { workspaceId } = req.params;
    const data = storageStore[workspaceId];
    
    if (data) {
        res.json(data);
    } else {
        res.status(404).json({ error: 'No context found' });
    }
});

app.listen(port, () => {
  console.log(`ContextGap Server running at http://localhost:${port}`);
});
