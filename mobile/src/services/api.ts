import * as FileSystem from 'expo-file-system';

// ⚙️ CAMBIA ESTA URL POR LA IP DE TU COMPUTADORA
// Ejemplo: http://192.168.1.5:3001
// En producción: https://tu-servidor.railway.app
export const API_BASE_URL = 'http://192.168.100.181:3001';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ChatResponse {
  response: string;
  timestamp: string;
}

export async function sendMessage(
  message: string,
  history: Message[],
  userName: string,
  level: string
): Promise<string> {
  const body = {
    message,
    history: history.map(m => ({ role: m.role, content: m.content })),
    userName,
    level,
  };

  const res = await fetch(`${API_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  const data: ChatResponse = await res.json();
  return data.response;
}

export async function transcribeAudioFile(audioUri: string): Promise<string> {
  const uploadResult = await FileSystem.uploadAsync(`${API_BASE_URL}/api/transcribe`, audioUri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
    fieldName: 'audio',
    mimeType: 'audio/m4a',
  });

  if (uploadResult.status !== 200) {
    throw new Error(`Transcription failed: ${uploadResult.status}`);
  }

  const data = JSON.parse(uploadResult.body);
  return data.text ?? '';
}
