import { useState, useRef, useCallback, useEffect } from 'react';
import { useAudioRecorder, AudioModule, RecordingPresets } from 'expo-audio';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { sendMessage, transcribeAudioFile, Message } from '../services/api';
import { getUserSettings } from '../services/storage';

export type JarvisStatus = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

export function useJarvis() {
  const [status, setStatus] = useState<JarvisStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [jarvisText, setJarvisText] = useState('Hola, soy Jarvis. Tu profesor de inglés personal. ¿Listo para practicar?');
  const [history, setHistory] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState('Estudiante');
  const [level, setLevel] = useState('Beginner');

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const isProcessingRef = useRef(false);
  const voicesRef = useRef<{en: string | null, es: string | null}>({ en: null, es: null });
  const statusRef = useRef<JarvisStatus>('idle');
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Update statusRef whenever status changes
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Load user settings and voices on mount
  useEffect(() => {
    getUserSettings().then(s => {
      setUserName(s.userName);
      setLevel(s.level);
      setJarvisText(`Hola ${s.userName}, soy Jarvis. Tu profesor de inglés personal. ¿Listo para practicar?`);
    });

    // Fetch and select best voices
    Speech.getAvailableVoicesAsync().then(voices => {
      const enVoice = voices.find(v => v.language.startsWith('en') && (v.quality === 'Enhanced' || v.name.includes('Premium') || v.name.includes('Google'))) || 
                      voices.find(v => v.language.startsWith('en'));
      const esVoice = voices.find(v => v.language.startsWith('es') && (v.quality === 'Enhanced' || v.name.includes('Premium') || v.name.includes('Google'))) || 
                      voices.find(v => v.language.startsWith('es'));
      
      voicesRef.current = { 
        en: enVoice?.identifier || null, 
        es: esVoice?.identifier || null 
      };
      console.log('Selected voices:', voicesRef.current);
    });
  }, []);

  // Lógica Hands-Free: Auto-detener tras 1.5s de silencio real
  useEffect(() => {
    if (status === 'listening' && recorder.isRecording) {
      if (recorder.metering < -45) {
        // Si no hay temporizador activo, lo iniciamos
        if (!silenceTimerRef.current) {
          silenceTimerRef.current = setTimeout(() => {
            console.log('Silencio detectado por 1.5s, deteniendo...');
            stopRecordingAndProcess();
            silenceTimerRef.current = null;
          }, 1500);
        }
      } else {
        // Si el usuario vuelve a hablar, cancelamos el temporizador
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
      }
    } else {
      // Limpiar si cambia de estado
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    }

    return () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    };
  }, [recorder.metering, recorder.isRecording, status, stopRecordingAndProcess]);

  const requestPermissions = async (): Promise<boolean> => {
    // Usamos expo-av para permisos por estabilidad en Expo Go
    const { status: audioStatus } = await Audio.requestPermissionsAsync();
    return audioStatus === 'granted';
  };

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      const hasPermission = await requestPermissions();
      if (!hasPermission) {
        setError('Necesito permiso para usar el micrófono');
        return;
      }

      // Cancel any speaking
      await Speech.stop();

      // Configure audio mode for recording
      await AudioModule.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        interruptionModeIOS: 'doNotMix',
        shouldRouteThroughEarpieceAndroid: false,
      });

      await recorder.prepareToRecordAsync();
      await recorder.record();
      
      setStatus('listening');
      setTranscript('');
    } catch (err: any) {
      console.error('Start recording error:', err);
      setError('Error al iniciar grabación');
      setStatus('error');
    }
  }, [recorder]);

  const stopRecordingAndProcess = useCallback(async () => {
    if (!recorder.isRecording || isProcessingRef.current) return;

    try {
      isProcessingRef.current = true;
      setStatus('thinking');

      await recorder.stop();
      const uri = recorder.uri; // Obtenemos la URI directamente del recorder

      if (!uri) throw new Error('No se generó el archivo de audio');

      // Reset audio mode for playback
      await AudioModule.setAudioModeAsync({ allowsRecordingIOS: false });

      // Step 1: Transcribe
      const userText = await transcribeAudioFile(uri);
      if (!userText.trim()) {
        setStatus('idle');
        isProcessingRef.current = false;
        return;
      }
      setTranscript(userText);

      // Step 2: Chat
      await processMessage(userText);
      isProcessingRef.current = false;
    } catch (err: any) {
      console.error('Process error:', err);
      setError(err.message ?? 'Error de conexión');
      setStatus('error');
      isProcessingRef.current = false;
    }
  }, [recorder, history, userName, level]);

  const processMessage = useCallback(async (userText: string) => {
    setStatus('thinking');

    const newHistory: Message[] = [
      ...history,
      { role: 'user', content: userText, timestamp: new Date().toISOString() },
    ];
    setHistory(newHistory);

    try {
      const response = await sendMessage(userText, newHistory, userName, level);

      // Strip [YOUTUBE:...] tag for display/speech but keep reference
      const youtubeMatch = response.match(/\[YOUTUBE:([^\]]+)\]/);
      const cleanResponse = response.replace(/\[YOUTUBE:[^\]]+\]/g, '').trim();

      setJarvisText(cleanResponse + (youtubeMatch ? `\n\n🎬 YouTube: "${youtubeMatch[1]}"` : ''));

      const fullHistory: Message[] = [
        ...newHistory,
        { role: 'assistant', content: response, timestamp: new Date().toISOString() },
      ];
      setHistory(fullHistory);

      // Step 3: Speak
      await speakResponse(cleanResponse);
    } catch (err: any) {
      setError(err.message);
      setStatus('error');
    }
  }, [history, userName, level]);

  const speakResponse = async (text: string) => {
    console.log('[Speech] Preparando audio para hablar...');
    
    try {
      // Forzamos el modo de audio a reproducción pura antes de hablar
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });
    } catch (err) {
      console.warn('[Speech] No se pudo resetear el modo de audio:', err);
    }

    console.log('[Speech] Intentando hablar:', text.substring(0, 30) + '...');
    setStatus('speaking');
    
    // Split text into sentences to handle bilingual switching
    const sentences = text.match(/[^.!?]+[.!?]*/g) || [text];
    
    for (const sentence of sentences) {
      if (statusRef.current !== 'speaking') break; 
      
      const isEnglish = /[a-zA-Z]{4,}/.test(sentence) && !/[áéíóúñ]/i.test(sentence);
      const voice = isEnglish ? voicesRef.current.en : voicesRef.current.es;
      const lang = isEnglish ? 'en-US' : 'es-ES';

      console.log(`[Speech] Hablando en ${lang} (${isEnglish ? 'EN' : 'ES'})`);

      await new Promise<void>((resolve) => {
        Speech.speak(sentence, {
          language: lang,
          voice: voice || undefined,
          pitch: 1.0,
          rate: 0.9,
          onDone: () => {
            console.log('[Speech] Oración terminada');
            resolve();
          },
          onError: (e) => {
            console.error('[Speech] Error al hablar:', e);
            resolve();
          },
        });
      });
    }
    
    setStatus('idle');
  };

  const sendTextMessage = useCallback(async (text: string) => {
    if (!text.trim() || status === 'thinking' || status === 'listening') return;
    setTranscript(text);
    await processMessage(text);
  }, [processMessage, status]);

  const stopSpeaking = useCallback(() => {
    Speech.stop();
    setStatus('idle');
  }, []);

  const cancelRecording = useCallback(async () => {
    if (recorder.isRecording) {
      try { await recorder.stop(); } catch {}
    }
    isProcessingRef.current = false;
    setStatus('idle');
    setTranscript('');
  }, [recorder]);

  const clearError = useCallback(() => setError(null), []);

  const clearConversation = useCallback(() => {
    setHistory([]);
    setTranscript('');
    setJarvisText(`Conversación nueva. ¡Hola ${userName}! ¿En qué practicamos hoy?`);
    setStatus('idle');
  }, [userName]);

  return {
    status,
    transcript,
    jarvisText,
    history,
    error,
    userName,
    level,
    isListening: status === 'listening',
    isThinking: status === 'thinking',
    isSpeaking: status === 'speaking',
    startRecording,
    stopRecordingAndProcess,
    cancelRecording,
    sendTextMessage,
    stopSpeaking,
    clearError,
    clearConversation,
    setUserName,
    setLevel,
  };
}
