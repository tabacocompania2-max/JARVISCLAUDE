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

export async function transcribeAudioFile(audioUri: string): Promise<string> {
  const res = await FileSystem.uploadAsync(`${API_BASE_URL}/api/transcribe`, audioUri, {
    httpMethod: 'POST',
    uploadType: 1, // 1 es MULTIPART en Expo FileSystem
    fieldName: 'audio',
    mimeType: 'audio/m4a',
  });

  if (res.status !== 200) throw new Error(`Transcription failed: ${res.status}`);
  const data = JSON.parse(res.body);
  return data.text ?? '';
}