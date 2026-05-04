import * as FileSystem from 'expo-file-system/legacy';
import { FileSystemUploadType } from 'expo-file-system/legacy';

export const API_BASE_URL = 'https://jarvisclaude-production.up.railway.app';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export async function sendMessage(
  message: string,
  history: Message[],
  userName: string,
  level: string
): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      history: history.map(m => ({ role: m.role, content: m.content })),
      userName,
      level,
    }),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.response;
}

// ✅ NUEVA interface con confianza y detección de voz
export interface TranscriptionResponse {
  text: string;
  confidence: number;
  hasVoice: boolean; // ← CLAVE: true = voz humana detectada
  timestamp: string;
}

export async function transcribeAudioFileWithVAD(audioUri: string): Promise<TranscriptionResponse> {
  const uploadResult = await FileSystem.uploadAsync(`${API_BASE_URL}/api/transcribe`, audioUri, {
    httpMethod: 'POST',
    uploadType: 1, // MULTIPART
    fieldName: 'audio',
    mimeType: 'audio/m4a',
  });

  if (uploadResult.status !== 200) {
    throw new Error(`Transcription failed: ${uploadResult.status}`);
  }

  const data = JSON.parse(uploadResult.body);

  return {
    text: data.text ?? '',
    confidence: data.confidence ?? 0,
    hasVoice: data.hasVoice ?? false, // ← Si false = ruido, ignorar
    timestamp: new Date().toISOString(),
  };
}

// ✅ MANTENER función antigua para compatibilidad
export async function transcribeAudioFile(audioUri: string): Promise<string> {
  const result = await transcribeAudioFileWithVAD(audioUri);
  return result.text;
}