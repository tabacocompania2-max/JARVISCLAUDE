import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export async function chatWithJarvis(
  userMessage: string,
  history: Message[],
  systemPrompt: string
): Promise<string> {
  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: userMessage },
  ];

  const completion = await groq.chat.completions.create({
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    messages,
    temperature: 0.75,
    max_tokens: 512,
    stream: false,
  });

  return completion.choices[0]?.message?.content ?? '(Sin respuesta)';
}

export async function transcribeAudio(audioBuffer: Buffer, filename: string): Promise<string> {
  console.log(`[Whisper] Iniciando transcripción de: ${filename} (${audioBuffer.length} bytes)`);
  
  // Usamos un Blob para mayor compatibilidad en entornos de servidor
  const blob = new Blob([audioBuffer], { type: 'audio/m4a' });
  const file = new File([blob], filename, { type: 'audio/m4a' });

  const transcription = await groq.audio.transcriptions.create({
    file,
    model: 'whisper-large-v3',
    // Eliminamos language: 'es' para que detecte automáticamente (más rápido y flexible)
    response_format: 'text',
  });

  const text = (transcription as unknown as string).trim();
  console.log(`[Whisper] Resultado: "${text.substring(0, 30)}..."`);
  return text;
}
