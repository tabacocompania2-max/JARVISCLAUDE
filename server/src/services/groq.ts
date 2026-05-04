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
    model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
    messages,
    temperature: 0.75,
    max_tokens: 512,
    stream: false,
  });

  return completion.choices[0]?.message?.content ?? '(Sin respuesta)';
}

// ✅ NUEVO: Interface para respuesta detallada de Whisper
export interface TranscriptionWithConfidence {
  text: string;
  confidence: number; // 0-1
  hasVoice: boolean;
}

// ✅ NUEVO: Transcribir CON confidence scores
export async function transcribeAudioWithConfidence(
  audioBuffer: Buffer,
  filename: string
): Promise<TranscriptionWithConfidence> {
  console.log(`[Whisper] Transcribiendo: ${filename} (${audioBuffer.length} bytes)`);
  
  const file = new File([audioBuffer], filename, { type: 'audio/m4a' });

  // ✅ CAMBIO: Usar response_format 'verbose_json' para obtener confidence
  const transcription = await groq.audio.transcriptions.create({
    file,
    model: 'whisper-large-v3',
    response_format: 'verbose_json', // ← CAMBIO CLAVE
  }) as any;

  const text = (transcription.text || '').trim();
  
  // ✅ EXTRAER confidence: Groq devuelve objeto con datos de confianza
  // Si no está disponible, calcular basado en longitud del texto
  let confidence = 0.5; // Default
  
  if (transcription.words) {
    // Si hay información por palabra, promediar confianzas
    const confidences = transcription.words
      .filter((w: any) => w.confidence)
      .map((w: any) => w.confidence);
    
    if (confidences.length > 0) {
      confidence = confidences.reduce((a: number, b: number) => a + b, 0) / confidences.length;
    }
  }
  
  // ✅ LÓGICA DE DETECCIÓN DE VOZ
  const hasVoice = text.length > 0 && confidence > 0.5;
  
  console.log(`[Whisper] Texto: "${text.substring(0, 30)}..." | Confianza: ${(confidence * 100).toFixed(0)}% | Voz: ${hasVoice}`);
  
  return {
    text,
    confidence,
    hasVoice,
  };
}

// ✅ MANTENER la función antigua para compatibilidad
export async function transcribeAudio(audioBuffer: Buffer, filename: string): Promise<string> {
  const result = await transcribeAudioWithConfidence(audioBuffer, filename);
  return result.text;
}
