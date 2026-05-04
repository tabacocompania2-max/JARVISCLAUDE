import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, Text } from 'react-native';
import { JarvisStatus } from '../hooks/useJarvis';

interface Props {
  status: JarvisStatus;
}

export function JarvisOrb({ status }: Props) {
  const pulse1 = useRef(new Animated.Value(1)).current;
  const pulse2 = useRef(new Animated.Value(1)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  // Rotation animation (always running)
  useEffect(() => {
    Animated.loop(
      Animated.timing(rotate, {
        toValue: 1,
        duration: 12000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  // Status-based animations
  useEffect(() => {
    if (status === 'listening') {
      // Fast pulsing orb
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse1, { toValue: 1.25, duration: 400, useNativeDriver: true }),
          Animated.timing(pulse1, { toValue: 0.95, duration: 400, useNativeDriver: true }),
        ])
      ).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(glow, { toValue: 1, duration: 600, useNativeDriver: false }),
          Animated.timing(glow, { toValue: 0.3, duration: 600, useNativeDriver: false }),
        ])
      ).start();
    } else if (status === 'thinking') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse1, { toValue: 1.1, duration: 700, useNativeDriver: true }),
          Animated.timing(pulse1, { toValue: 0.98, duration: 700, useNativeDriver: true }),
        ])
      ).start();
      Animated.timing(glow, { toValue: 0.6, duration: 300, useNativeDriver: false }).start();
    } else if (status === 'speaking') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse2, { toValue: 1.15, duration: 350, useNativeDriver: true }),
          Animated.timing(pulse2, { toValue: 1.0, duration: 350, useNativeDriver: true }),
        ])
      ).start();
      Animated.timing(glow, { toValue: 0.8, duration: 300, useNativeDriver: false }).start();
    } else {
      // idle / error — calm
      pulse1.stopAnimation();
      pulse2.stopAnimation();
      Animated.spring(pulse1, { toValue: 1, useNativeDriver: true }).start();
      Animated.spring(pulse2, { toValue: 1, useNativeDriver: true }).start();
      Animated.timing(glow, { toValue: 0.15, duration: 800, useNativeDriver: false }).start();
    }
  }, [status]);

  const rotateInterp = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const glowColor = glow.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(0, 212, 255, 0)', 'rgba(0, 212, 255, 0.6)'],
  });

  const statusLabel: Record<JarvisStatus, string> = {
    idle: 'EN ESPERA',
    listening: 'ESCUCHANDO',
    thinking: 'PENSANDO',
    speaking: 'HABLANDO',
    error: 'ERROR',
  };

  const statusColor: Record<JarvisStatus, string> = {
    idle: '#4a9eff',
    listening: '#00ff88',
    thinking: '#f5a623',
    speaking: '#00d4ff',
    error: '#ff4444',
  };

  return (
    <View style={styles.container}>
      {/* Outer rotating ring */}
      <Animated.View style={[styles.outerRing, { transform: [{ rotate: rotateInterp }] }]}>
        {[0, 60, 120, 180, 240, 300].map(deg => (
          <View key={deg} style={[styles.ringDot, { transform: [{ rotate: `${deg}deg` }, { translateY: -95 }] }]} />
        ))}
      </Animated.View>

      {/* Glow halo */}
      <Animated.View style={[styles.glowHalo, { backgroundColor: glowColor }]} />

      {/* Middle ring */}
      <View style={styles.middleRing} />

      {/* Inner orb with pulse */}
      <Animated.View style={[styles.innerOrb, { transform: [{ scale: pulse1 }] }]}>
        <Animated.View style={[styles.coreOrb, { transform: [{ scale: pulse2 }] }]}>
          {/* Center symbol */}
          <View style={styles.coreSymbol}>
            <View style={[styles.crossH, { backgroundColor: statusColor[status] }]} />
            <View style={[styles.crossV, { backgroundColor: statusColor[status] }]} />
            <View style={[styles.centerDot, { backgroundColor: statusColor[status] }]} />
          </View>
        </Animated.View>
      </Animated.View>

      {/* Status label */}
      <View style={styles.statusRow}>
        <View style={[styles.statusDot, { backgroundColor: statusColor[status] }]} />
        <Text style={[styles.statusText, { color: statusColor[status] }]}>
          {statusLabel[status]}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerRing: {
    position: 'absolute',
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringDot: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(0,212,255,0.5)',
  },
  glowHalo: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
  },
  middleRing: {
    position: 'absolute',
    width: 155,
    height: 155,
    borderRadius: 77.5,
    borderWidth: 1,
    borderColor: 'rgba(0,212,255,0.25)',
  },
  innerOrb: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(0,212,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,212,255,0.3)',
  },
  coreOrb: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(0,40,80,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(0,212,255,0.6)',
    shadowColor: '#00d4ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 10,
  },
  coreSymbol: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crossH: {
    position: 'absolute',
    width: 28,
    height: 2,
    borderRadius: 1,
    opacity: 0.6,
  },
  crossV: {
    position: 'absolute',
    width: 2,
    height: 28,
    borderRadius: 1,
    opacity: 0.6,
  },
  centerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusRow: {
    position: 'absolute',
    bottom: -32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 3,
    fontFamily: 'monospace',
  },
});
