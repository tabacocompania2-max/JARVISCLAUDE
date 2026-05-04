import { useState, useRef, useCallback, useEffect } from 'react';
import { Linking } from 'react-native';
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

  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    meteringEnabled: true,
  });
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

  // Lógica Hands-Free: Auto-detener tras 1.0s de silencio real
  useEffect(() => {
    if (!recorder.isRecording) return;

    const volume = recorder?.metering ?? -100;
    
    // Umbral ligeramente más alto para ignorar ruido de fondo leve
    if (volume > -42) { 
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    } else {
      // Silencio: esperar 1 segundo antes de enviar
      if (!silenceTimerRef.current) {
        silenceTimerRef.current = setTimeout(() => {
          console.log('[Hands-Free] Silencio estable, procesando...');
          stopRecordingAndProcess();
          silenceTimerRef.current = null;
        }, 1000);
      }
    }

    return () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    };
  }, [recorder.metering, recorder.isRecording, stopRecordingAndProcess]);

  const requestPermissions = async (): Promise<boolean> => {
    const { status: audioStatus } = await Audio.requestPermissionsAsync();
    return audioStatus === 'granted';
  };

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      const hasPermission = await requestPermissions();
      if (!hasPermission) {
        setError('Permiso de micrófono denegado');
        return;
      }

      await Speech.stop(); // Callamos a Jarvis si estaba hablando

      await AudioModule.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        interruptionModeIOS: 'doNotMix',
        shouldRouteThroughEarpieceAndroid: false,
      });

      await recorder.prepareToRecordAsync();
      setJarvisText('Te escucho...');
      setStatus('listening');
      await recorder.record();
      
      setTranscript('');
    } catch (err: any) {
      console.error('Start recording error:', err);
      setError('Error al iniciar micro');
      setStatus('error');
    }
  }, [recorder]);

  const stopRecordingAndProcess = useCallback(async () => {
    if (!recorder.isRecording || isProcessingRef.current) {
      console.log('[Hands-Free] Ignorando trigger (ya procesando o no grabando)');
      return;
    }

    try {
      isProcessingRef.current = true;
      setStatus('thinking');

      await recorder.stop();
      const uri = recorder.uri;

      if (!uri) throw new Error('Audio no capturado');

      // Reiniciamos el micro casi de inmediato para no perder el siguiente fragmento
      setTimeout(() => {
        if (statusRef.current !== 'error') startRecording();
      }, 400);

      const userText = await transcribeAudioFile(uri);
      if (!userText.trim()) {
        console.log('[Audio] Sin contenido audible');
        isProcessingRef.current = false;
        setStatus('listening');
        return;
      }
      setTranscript(userText);

      // Step 2: Chat
      await processMessage(userText);
      
    } catch (err: any) {
      console.error('Process error:', err);
      setError(err.message ?? 'Error de conexión');
      setStatus('error');
    } finally {
      // SIEMPRE liberamos el proceso al final
      isProcessingRef.current = false;
      if (statusRef.current === 'thinking') setStatus('idle');
      
      // MODO CONTINUO: Si no hubo error y el estado no es idle, reiniciamos el micro tras un breve delay
      // Pero primero esperamos a que termine de hablar (esto se maneja en speakResponse)
    }
  }, [recorder, history, userName, level, processMessage, startRecording]);

  const processMessage = useCallback(async (userText: string) => {
    setStatus('thinking');

    const newHistory: Message[] = [
      ...history,
      { role: 'user', content: userText, timestamp: new Date().toISOString() },
    ];
    setHistory(newHistory);

    try {
      const response = await sendMessage(userText, newHistory, userName, level);
      
      // Si la respuesta es vacía (filtro anti-eco), no hacemos nada
      if (!response.trim()) {
        console.log('[Anti-Echo] Respuesta filtrada por el servidor');
        return;
      }

      // Strip [YOUTUBE:...] or [YOUTUBE_URL:...] tags
      const youtubeMatch = response.match(/\[YOUTUBE:([^\]]+)\]/);
      const youtubeUrlMatch = response.match(/\[YOUTUBE_URL:([^\]]+)\]/);
      
      const cleanResponse = response
        .replace(/\[YOUTUBE:[^\]]+\]/g, '')
        .replace(/\[YOUTUBE_URL:[^\]]+\]/g, '')
        .trim();

      setJarvisText(cleanResponse + (youtubeUrlMatch || youtubeMatch ? `\n\n🎬 YouTube Listo` : ''));

      // Si tenemos URL directa (del servidor), la abrimos con prioridad
      if (youtubeUrlMatch) {
        setTimeout(() => {
          console.log('[YouTube] Abriendo video directo:', youtubeUrlMatch[1]);
          Linking.openURL(youtubeUrlMatch[1]);
        }, 3000);
      } else if (youtubeMatch) {
        // Backup: Si el servidor falló la búsqueda, hacemos búsqueda normal
        setTimeout(() => {
          const query = encodeURIComponent(youtubeMatch[1] + ' lyrics');
          Linking.openURL(`https://www.youtube.com/results?search_query=${query}`);
        }, 3000);
      }

      const fullHistory: Message[] = [
        ...newHistory,
        { role: 'assistant', content: response, timestamp: new Date().toISOString() },
      ];
      setHistory(fullHistory);

      // Step 3: Speak (SIN AWAIT para no bloquear el micrófono de la siguiente vez)
      speakResponse(cleanResponse);
    } catch (err: any) {
      setError(err.message);
      setStatus('error');
    }
  }, [history, userName, level]);

  const speakResponse = async (text: string) => {
    console.log('[Speech] Preparando audio para hablar...');
    
    try {
      // Mantenemos el micrófono abierto incluso mientras hablamos para permitir interrupciones
      await AudioModule.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        interruptionModeIOS: 'doNotMix',
        shouldRouteThroughEarpieceAndroid: false,
      });
    } catch (err) {
      console.warn('[Speech] No se pudo configurar modo dual:', err);
    }

    console.log('[Speech] Intentando hablar:', text.substring(0, 30) + '...');
    setStatus('speaking');
    statusRef.current = 'speaking'; // Forzamos la actualización inmediata del ref
    
    // Split text into sentences to handle bilingual switching
    const sentences = text.match(/[^.!?]+[.!?]*/g) || [text];
    
    for (const sentence of sentences) {
      if (statusRef.current !== 'speaking') {
        console.log('[Speech] Interrumpido: el estado ya no es speaking');
        break; 
      }
      
      const isEnglish = /[a-zA-Z]{4,}/.test(sentence) && !/[áéíóúñ]/i.test(sentence);
      const voice = isEnglish ? voicesRef.current.en : voicesRef.current.es;
      const lang = isEnglish ? 'en-US' : 'es-ES';

      console.log(`[Speech] Hablando oración: "${sentence.substring(0, 20)}..." en ${lang}`);

      await new Promise<void>((resolve) => {
        Speech.speak(sentence, {
          language: lang,
          voice: voice || undefined,
          pitch: 1.0,
          rate: 1.25, // Voz mucho más rápida y dinámica
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
