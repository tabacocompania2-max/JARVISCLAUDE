import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
import apiRouter from './routes/api';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// Middlewares
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', apiRouter);

// Root
app.get('/', (_req, res) => {
  res.json({ message: '🤖 Jarvis API is running', version: '1.0.0' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Jarvis Server running on http://0.0.0.0:${PORT}`);
  console.log(`📡 Health: http://localhost:${PORT}/api/health\n`);
});

export default app;
