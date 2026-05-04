import { useState, useRef, useCallback, useEffect } from 'react';
import { useAudioRecorder, AudioModule, RecordingOptionsPresets } from 'expo-audio';
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

  const recorder = useAudioRecorder(RecordingOptionsPresets.HIGH_QUALITY);
  const isProcessingRef = useRef(false);

  // Load user settings on mount
  useEffect(() => {
    getUserSettings().then(s => {
      setUserName(s.userName);
      setLevel(s.level);
      setJarvisText(`Hola ${s.userName}, soy Jarvis. Tu profesor de inglés personal. ¿Listo para practicar?`);
    });
  }, []);

  const requestPermissions = async (): Promise<boolean> => {
    const { status: audioStatus } = await AudioModule.requestPermissionsAsync();
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

      const result = await recorder.stop();
      const uri = result.uri;

      if (!uri) throw new Error('No audio file');

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
    setStatus('speaking');
    return new Promise<void>((resolve) => {
      Speech.speak(text, {
        language: 'es-ES',
        pitch: 1.0,
        rate: 0.95,
        onDone: () => { setStatus('idle'); resolve(); },
        onError: () => { setStatus('idle'); resolve(); },
      });
    });
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
