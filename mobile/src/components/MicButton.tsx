import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, TouchableOpacity, View, Text } from 'react-native';

interface Props {
  isListening: boolean;
  isThinking: boolean;
  onPress: () => void;
}

export function MicButton({ isListening, isThinking, onPress }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const ringScale = useRef(new Animated.Value(1)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isListening) {
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(ringScale, { toValue: 1.8, duration: 800, useNativeDriver: true }),
            Animated.timing(ringOpacity, { toValue: 0, duration: 800, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(ringScale, { toValue: 1, duration: 0, useNativeDriver: true }),
            Animated.timing(ringOpacity, { toValue: 0.6, duration: 0, useNativeDriver: true }),
          ]),
        ])
      ).start();
      Animated.spring(scale, { toValue: 0.92, useNativeDriver: true }).start();
    } else {
      ringScale.stopAnimation();
      ringOpacity.stopAnimation();
      Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
      Animated.timing(ringOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }
  }, [isListening]);

  const bgColor = isListening ? '#ff3b3b' : isThinking ? '#f5a623' : '#00d4ff';
  const label = isListening ? 'Toca para enviar' : isThinking ? '...' : 'Mantén para hablar';

  return (
    <View style={styles.wrapper}>
      {/* Ripple ring */}
      <Animated.View
        style={[
          styles.ring,
          { transform: [{ scale: ringScale }], opacity: ringOpacity, borderColor: bgColor },
        ]}
      />

      <TouchableOpacity onPress={onPress} disabled={isThinking} activeOpacity={0.8}>
        <Animated.View style={[styles.button, { backgroundColor: bgColor, transform: [{ scale }] }]}>
          {isThinking ? (
            <ThinkingDots />
          ) : isListening ? (
            <SendIcon />
          ) : (
            <MicIcon />
          )}
        </Animated.View>
      </TouchableOpacity>

      <Text style={[styles.label, { color: bgColor }]}>{label}</Text>
    </View>
  );
}

function MicIcon() {
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: 18, height: 26, borderRadius: 9, borderWidth: 2.5, borderColor: '#050A14' }} />
      <View style={{ width: 28, height: 14, borderTopLeftRadius: 14, borderTopRightRadius: 14, borderWidth: 2.5, borderColor: '#050A14', marginTop: 2 }} />
      <View style={{ width: 2.5, height: 8, backgroundColor: '#050A14', marginTop: 0 }} />
    </View>
  );
}

function SendIcon() {
  return (
    <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 0, height: 0, borderLeftWidth: 22, borderTopWidth: 11, borderBottomWidth: 11, borderLeftColor: '#050A14', borderTopColor: 'transparent', borderBottomColor: 'transparent' }} />
    </View>
  );
}

function ThinkingDots() {
  return (
    <View style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
      {[0, 1, 2].map(i => (
        <View key={i} style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#050A14' }} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: 12,
  },
  ring: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
  },
  button: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00d4ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 15,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontFamily: 'monospace',
  },
});
