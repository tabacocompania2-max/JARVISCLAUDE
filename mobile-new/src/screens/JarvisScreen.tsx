import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView,
  Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useJarvis } from '../hooks/useJarvis';
import { JarvisOrb } from '../components/JarvisOrb';
import { MicButton } from '../components/MicButton';
import { ConversationHistory } from '../components/ConversationHistory';

export function JarvisScreen() {
  const jarvis = useJarvis();
  const [textInput, setTextInput] = useState('');
  const [showChat, setShowChat] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const handleMicPress = () => {
    if (jarvis.isListening) {
      jarvis.stopRecordingAndProcess();
    } else if (jarvis.isSpeaking) {
      jarvis.stopSpeaking();
    } else {
      jarvis.startRecording();
    }
  };

  const handleTextSend = () => {
    if (!textInput.trim()) return;
    jarvis.sendTextMessage(textInput.trim());
    setTextInput('');
    inputRef.current?.blur();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.logo}>JARVIS</Text>
            <Text style={styles.subtitle}>English Learning Coach</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.headerBtn} onPress={() => setShowChat(!showChat)}>
              <Text style={styles.headerBtnText}>{showChat ? 'ORB' : 'CHAT'}</Text>
            </TouchableOpacity>
            {jarvis.history.length > 0 && (
              <TouchableOpacity style={styles.headerBtn} onPress={jarvis.clearConversation}>
                <Text style={styles.headerBtnText}>RESET</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Scan lines decorative */}
        <View style={styles.scanLine} />

        {/* Main content */}
        <View style={styles.main}>
          {showChat && jarvis.history.length > 0 ? (
            <ConversationHistory
              history={jarvis.history}
              currentResponse={jarvis.jarvisText}
              transcript={jarvis.transcript}
            />
          ) : (
            <View style={styles.orbSection}>
              {/* Orb */}
              <JarvisOrb status={jarvis.status} />

              {/* Response text */}
              <View style={styles.responseBox}>
                {jarvis.transcript ? (
                  <Text style={styles.transcriptText}>
                    <Text style={styles.transcriptLabel}>TÚ: </Text>
                    {jarvis.transcript}
                  </Text>
                ) : null}
                <Text style={styles.responseText} numberOfLines={5}>
                  {jarvis.jarvisText}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Error banner */}
        {jarvis.error && (
          <TouchableOpacity style={styles.errorBanner} onPress={jarvis.clearError}>
            <Text style={styles.errorText}>⚠ {jarvis.error} — Toca para cerrar</Text>
          </TouchableOpacity>
        )}

        {/* Bottom controls */}
        <View style={styles.bottomSection}>
          {/* Mic button */}
          <MicButton
            isListening={jarvis.isListening}
            isThinking={jarvis.isThinking}
            onPress={handleMicPress}
          />

          {/* Text input */}
          <View style={styles.inputRow}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={textInput}
              onChangeText={setTextInput}
              placeholder="Escribe tu mensaje..."
              placeholderTextColor="rgba(255,255,255,0.25)"
              returnKeyType="send"
              onSubmitEditing={handleTextSend}
              editable={!jarvis.isThinking && !jarvis.isListening}
              multiline={false}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!textInput.trim() || jarvis.isThinking) && styles.sendBtnDisabled]}
              onPress={handleTextSend}
              disabled={!textInput.trim() || jarvis.isThinking}
            >
              <Text style={styles.sendBtnText}>→</Text>
            </TouchableOpacity>
          </View>

          {/* Level badge */}
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>👤 {jarvis.userName}</Text>
            <View style={styles.levelBadge}>
              <Text style={styles.levelText}>{jarvis.level.toUpperCase()}</Text>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#050A14' },
  flex: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerLeft: { gap: 1 },
  logo: {
    fontSize: 22,
    fontWeight: '900',
    color: '#00d4ff',
    letterSpacing: 8,
    fontFamily: 'monospace',
  },
  subtitle: {
    fontSize: 10,
    color: 'rgba(0,212,255,0.5)',
    letterSpacing: 3,
    textTransform: 'uppercase',
    fontFamily: 'monospace',
  },
  headerRight: { flexDirection: 'row', gap: 8 },
  headerBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,212,255,0.3)',
  },
  headerBtnText: {
    color: 'rgba(0,212,255,0.7)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    fontFamily: 'monospace',
  },

  scanLine: {
    height: 1,
    backgroundColor: 'rgba(0,212,255,0.1)',
    marginHorizontal: 0,
  },

  main: { flex: 1 },

  orbSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 48,
  },

  responseBox: {
    width: '100%',
    gap: 8,
    paddingHorizontal: 4,
  },
  transcriptText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  transcriptLabel: {
    color: '#00d4ff',
    fontWeight: '700',
    fontStyle: 'normal',
    fontSize: 10,
  },
  responseText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    lineHeight: 24,
    letterSpacing: 0.3,
  },

  errorBanner: {
    backgroundColor: 'rgba(255,50,50,0.15)',
    borderTopWidth: 1,
    borderColor: 'rgba(255,50,50,0.3)',
    padding: 12,
    alignItems: 'center',
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 12,
    fontFamily: 'monospace',
  },

  bottomSection: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 8 : 24,
    gap: 20,
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: 'rgba(0,212,255,0.08)',
    paddingTop: 24,
  },

  inputRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,212,255,0.2)',
    paddingLeft: 16,
    paddingRight: 4,
    height: 52,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    height: '100%',
  },
  sendBtn: {
    width: 44,
    height: 44,
    backgroundColor: '#00d4ff',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: 'rgba(0,212,255,0.15)',
  },
  sendBtnText: {
    color: '#050A14',
    fontSize: 20,
    fontWeight: '900',
  },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  metaText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  levelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: 'rgba(0,212,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0,212,255,0.3)',
  },
  levelText: {
    color: '#00d4ff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    fontFamily: 'monospace',
  },
});
