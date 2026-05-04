import { Router, Request, Response } from 'express';
import multer from 'multer';
import { chatWithJarvis, transcribeAudio, Message } from '../services/groq';
import { buildSystemPrompt } from '../prompts/system';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// POST /api/chat
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { message, history = [], userName = 'Amigo', level = 'Intermediate' } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({ error: 'message is required' });
    }

    const systemPrompt = buildSystemPrompt(userName, level);
    
    // FILTRO ANTI-ECO: Si el usuario dice exactamente lo mismo que Jarvis acaba de decir, ignoramos.
    const lastAssistantMessage = history.filter(m => m.role === 'assistant').pop()?.content || '';
    if (message.toLowerCase().trim() === lastAssistantMessage.toLowerCase().trim()) {
      console.log('[Anti-Echo] Ignorando mensaje repetido de Jarvis');
      return res.json({ response: '', timestamp: new Date().toISOString() });
    }

    let response = await chatWithJarvis(message, history as Message[], systemPrompt);

    // Si la IA generó una etiqueta de YouTube, buscamos el video real
    const youtubeMatch = response.match(/\[YOUTUBE:([^\]]+)\]/);
    if (youtubeMatch) {
      const { getFirstYoutubeVideo } = require('../services/youtube');
      const videoUrl = await getFirstYoutubeVideo(youtubeMatch[1]);
      if (videoUrl) {
        // Reemplazamos la búsqueda por la URL real
        response = response.replace(youtubeMatch[0], `[YOUTUBE_URL:${videoUrl}]`);
      }
    }

    return res.json({ response, timestamp: new Date().toISOString() });
  } catch (err: any) {
    console.error('[CHAT ERROR]', err.message);
    return res.status(500).json({ error: 'Failed to get response', details: err.message });
  }
});

// POST /api/transcribe  (multipart audio)
router.post('/transcribe', upload.single('audio'), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'audio file required' });

    const text = await transcribeAudio(req.file.buffer, req.file.originalname || 'audio.m4a');
    return res.json({ text });
  } catch (err: any) {
    console.error('[TRANSCRIBE ERROR]', err.message);
    return res.status(500).json({ error: 'Transcription failed', details: err.message });
  }
});

// GET /api/health
router.get('/health', (_req, res) => res.json({ status: 'ok', model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile' }));

export default router;
