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

  // --- MOTOR DE VOZ AVANZADO (VAD & BARGE-IN) ---
  useEffect(() => {
    if (!recorder.isRecording) return;
    const volume = recorder?.metering ?? -100;
    const isJarvisSpeaking = statusRef.current === 'speaking';

    // DEBUG VOLUMEN: Descomenta esto si necesitas calibrar el micro en vivo
    // console.log(`[VOL] ${volume.toFixed(1)} dB | Status: ${statusRef.current}`);

    // 1. LÓGICA DE BARGE-IN (Interrupción)
    // Subimos el umbral de interrupción para que no sea tan sensible al eco
    if (isJarvisSpeaking && volume > -25) {
      console.log('[BARGE-IN] Voz fuerte detectada durante TTS. Interrumpiendo...');
      Speech.stop();
      setStatus('listening');
    }

    // 2. LÓGICA VAD (Detección de Actividad de Voz)
    // Si el volumen es mayor a -35dB, consideramos que hay voz humana
    if (volume > -35) {
      if (silenceTimerRef.current) {
        // console.log('[VAD] Voz detectada, reiniciando espera...');
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    } else {
      // SILENCIO: Si estamos en modo escucha y no hay voz, iniciamos cuenta regresiva
      if (recorder.isRecording && !isJarvisSpeaking && statusRef.current === 'listening') {
        if (!silenceTimerRef.current) {
          console.log('[VAD] Silencio detectado... esperando confirmación');
          silenceTimerRef.current = setTimeout(() => {
            console.log('[VAD] Silencio confirmado, procesando audio');
            stopRecordingAndProcess();
            silenceTimerRef.current = null;
          }, 1000); // 1 segundo de silencio es suficiente
        }
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
      console.log('[MIC] Abriendo canal continuo...');
      setError(null);
      const hasPermission = await requestPermissions();
      if (!hasPermission) {
        setError('Permiso de micrófono denegado');
        return;
      }

      // Configuración de Audio para FULL DUPLEX y AEC (Acoustic Echo Cancellation)
      await AudioModule.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        interruptionModeIOS: 'doNotMix', // Evita que el sistema pause el micro al sonar TTS
        shouldRouteThroughEarpieceAndroid: false,
      });

      await recorder.prepareToRecordAsync();
      await recorder.record();
      
      setStatus('listening');
      setTranscript('');
      console.log('[VAD] Modo escucha activa (Hands-free)');
    } catch (err: any) {
      console.error('[MIC ERROR]', err);
      setError('Error en motor de audio');
      setStatus('error');
    }
  }, [recorder]);

  const stopRecordingAndProcess = useCallback(async () => {
    // Si ya estamos procesando un chunk, ignoramos triggers nuevos para evitar colisiones
    if (isProcessingRef.current) return;

    try {
      isProcessingRef.current = true;
      console.log('[STT] Enviando chunk a Groq...');

      await recorder.stop();
      const uri = recorder.uri;

      // REINICIO ULTRA-RÁPIDO (Casi continuo)
      // Reiniciamos antes de procesar el texto para no perder lo que el usuario diga después
      setTimeout(() => {
        if (statusRef.current !== 'error') startRecording();
      }, 100);

      if (!uri) {
        isProcessingRef.current = false;
        return;
      }

      const userText = await transcribeAudioFile(uri);
      console.log(`[STT] Recibido: "${userText}"`);

      if (!userText.trim()) {
        isProcessingRef.current = false;
        // El micro ya se reinició arriba
        return;
      }

      setTranscript(userText);
      await processMessage(userText);
      
    } catch (err: any) {
      console.error('[PROCESS ERROR]', err);
      isProcessingRef.current = false;
    } finally {
      isProcessingRef.current = false;
    }
  }, [recorder, history, userName, level, processMessage, startRecording]);

  const processMessage = useCallback(async (userText: string) => {
    setStatus('thinking');
    console.log('[LLM] Generando respuesta...');

    const newHistory: Message[] = [
      ...history,
      { role: 'user', content: userText, timestamp: new Date().toISOString() },
    ];
    setHistory(newHistory);

    try {
      const response = await sendMessage(userText, newHistory, userName, level);
      
      if (!response.trim()) {
        console.log('[ANTI-ECHO] Ignorado por redundancia');
        setStatus('listening');
        return;
      }

      const cleanResponse = response
        .replace(/\[YOUTUBE:[^\]]+\]/g, '')
        .replace(/\[YOUTUBE_URL:[^\]]+\]/g, '')
        .trim();

      setJarvisText(cleanResponse);
      
      const fullHistory: Message[] = [
        ...newHistory,
        { role: 'assistant', content: response, timestamp: new Date().toISOString() },
      ];
      setHistory(fullHistory);

      // Hablar (TTS)
      speakResponse(cleanResponse);
    } catch (err: any) {
      setError(err.message);
      setStatus('error');
    }
  }, [history, userName, level]);

  const speakResponse = async (text: string) => {
    console.log('[TTS] Iniciando reproducción...');
    setStatus('speaking');
    
    // Mantenemos el micrófono abierto incluso mientras hablamos para permitir interrupciones
    try {
      await AudioModule.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        interruptionModeIOS: 'doNotMix',
        shouldRouteThroughEarpieceAndroid: false,
      });
    } catch (err) {
      console.warn('[TTS] Error configurando modo dual:', err);
    }

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
