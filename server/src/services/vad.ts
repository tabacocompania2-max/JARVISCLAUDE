// Voice Activity Detection usando Groq Whisper confidence scores

export interface TranscriptionResult {
  text: string;
  confidence: number; // 0-1
  isVoiceDetected: boolean; // true si es voz humana
}

// Detectar si un texto fue transcrito con confianza de voz humana
export function detectVoiceActivity(transcriptionText: string, confidence: number): boolean {
  // ✅ LÓGICA: Si Whisper transcribió con >50% confianza Y el texto no está vacío = VOZ
  const hasText = transcriptionText.trim().length > 0;
  const highConfidence = confidence > 0.5; // Umbral de confianza
  return hasText && highConfidence;
}

// Analizar si el audio contiene principalmente voz (no ruido)
export function isMainlyVoice(text: string, confidence: number): boolean {
  // Si el texto tiene >5 caracteres Y confianza >60% = definitivamente voz humana
  return text.trim().length > 5 && confidence > 0.6;
}

// Score de "qué tan seguro estamos de que es voz humana"
export function getVoiceScore(text: string, confidence: number): number {
  // 0 = ruido/silencio
  // 1 = definitivamente voz humana
  if (!text.trim()) return 0;
  if (confidence < 0.3) return 0.1; // Probablemente ruido
  if (confidence < 0.5) return 0.5; // Podría ser voz
  if (confidence > 0.8) return 1.0; // Definitivamente voz
  return 0.7; // Buena confianza
}
