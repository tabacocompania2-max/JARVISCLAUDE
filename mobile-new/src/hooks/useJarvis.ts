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

  // --- MOTOR DE VOZ INTELIGENTE (AI-POWERED VAD) ---
  const chunksRef = useRef<string[]>([]);
  const consecutiveEmptyRef = useRef(0);

  useEffect(() => {
    if (!recorder.isRecording) return;

    const volume = recorder?.metering ?? -100;
    const isJarvisSpeaking = statusRef.current === 'speaking';

    // Barge-in (Interrupción) sigue siendo por volumen para respuesta instantánea
    if (isJarvisSpeaking && volume > -22) {
      console.log('[BARGE-IN] Interrupción detectada');
      Speech.stop();
      setStatus('listening');
    }

    // Ya no usamos un timer de silencio basado en dB para enviar.
    // En su lugar, usamos un "Heartbeat" de 2.5 segundos para enviar audio a la IA
    // y que ella decida si hay voz o no.
    if (recorder.isRecording && !isJarvisSpeaking && statusRef.current === 'listening') {
      if (!silenceTimerRef.current) {
        silenceTimerRef.current = setTimeout(() => {
          stopRecordingAndProcess();
          silenceTimerRef.current = null;
        }, 2500); // Pulso de 2.5s
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
        setError('Permiso denegado');
        return;
      }

      // CONFIGURACIÓN NIVEL CHATGPT: voiceChat activa AEC y aislamiento de voz por hardware
      await AudioModule.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        interruptionModeIOS: 'doNotMix',
        shouldRouteThroughEarpieceAndroid: false,
        // En iOS, el modo 'voiceChat' es vital para la inteligencia del micro
      });

      await recorder.prepareToRecordAsync();
      await recorder.record();
      
      setStatus('listening');
    } catch (err: any) {
      console.error('[MIC ERROR]', err);
      setStatus('error');
    }
  }, [recorder]);

  const stopRecordingAndProcess = useCallback(async () => {
    if (isProcessingRef.current) return;

    try {
      isProcessingRef.current = true;
      await recorder.stop();
      const uri = recorder.uri;

      // Reinicio ultra-rápido para mantener el canal "abierto"
      setTimeout(() => {
        if (statusRef.current !== 'error') startRecording();
      }, 30);

      if (!uri) {
        isProcessingRef.current = false;
        return;
      }

      const userText = await transcribeAudioFile(uri);
      
      // Filtro de "Inteligencia": Whisper a veces alucina frases con el ruido
      const noisePhrases = ['gracias por ver', 'subtítulos', 'revisado por', 'transcription by', 'thank you for watching'];
      const isNoise = noisePhrases.some(p => userText.toLowerCase().includes(p)) || userText.trim().length <= 1;

      if (!isNoise) {
        console.log(`[AI-FOCUS] Voz detectada: "${userText}"`);
        consecutiveEmptyRef.current = 0;
        chunksRef.current.push(userText);
        setTranscript(chunksRef.current.join(' '));
        
        // Si detectamos voz, el siguiente pulso será más rápido (agilidad)
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          stopRecordingAndProcess();
          silenceTimerRef.current = null;
        }, 1800); // 1.8s mientras detectamos que estás hablando
        
        if (userText.includes('.') || userText.includes('?') || userText.length > 60) {
          const fullMessage = chunksRef.current.join(' ');
          chunksRef.current = [];
          await processMessage(fullMessage);
        }
      } else {
        consecutiveEmptyRef.current++;
        // Si no hay voz, mantenemos el pulso normal de 2.5s
        if (consecutiveEmptyRef.current >= 2 && chunksRef.current.length > 0) {
          const fullMessage = chunksRef.current.join(' ');
          chunksRef.current = [];
          await processMessage(fullMessage);
        }
      }
    } catch (err: any) {
      console.error('[STT ERROR]', err);
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
