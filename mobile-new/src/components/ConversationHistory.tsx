import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Message } from '../services/api';

interface Props {
  history: Message[];
  currentResponse: string;
  transcript: string;
}

export function ConversationHistory({ history, currentResponse, transcript }: Props) {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {history.slice(-6).map((msg, i) => (
        <View key={i} style={[styles.bubble, msg.role === 'user' ? styles.userBubble : styles.jarvisBubble]}>
          <Text style={[styles.label, msg.role === 'user' ? styles.userLabel : styles.jarvisLabel]}>
            {msg.role === 'user' ? 'TÚ' : 'JARVIS'}
          </Text>
          <Text style={[styles.text, msg.role === 'user' ? styles.userText : styles.jarvisText]}>
            {msg.content.replace(/\[YOUTUBE:[^\]]+\]/g, '').trim()}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, width: '100%' },
  content: { padding: 16, gap: 10, paddingBottom: 32 },
  bubble: {
    maxWidth: '85%',
    padding: 12,
    borderRadius: 16,
    gap: 4,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(0, 212, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.25)',
    borderBottomRightRadius: 4,
  },
  jarvisBubble: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderBottomLeftRadius: 4,
  },
  label: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2,
    fontFamily: 'monospace',
  },
  userLabel: { color: '#00d4ff', textAlign: 'right' },
  jarvisLabel: { color: 'rgba(255,255,255,0.4)' },
  text: { fontSize: 14, lineHeight: 20 },
  userText: { color: '#e0f7ff', textAlign: 'right' },
  jarvisText: { color: 'rgba(255,255,255,0.85)' },
});
