import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TextInput,
  TouchableOpacity, ScrollView, Alert
} from 'react-native';
import { saveUserSettings, getUserSettings } from '../services/storage';
import { API_BASE_URL } from '../services/api';

const LEVELS = ['Beginner', 'Elementary', 'Intermediate', 'Upper-Intermediate', 'Advanced'];

export function SettingsScreen() {
  const [name, setName] = useState('');
  const [level, setLevel] = useState('Beginner');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getUserSettings().then(s => {
      setName(s.userName);
      setLevel(s.level);
    });
  }, []);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Por favor ingresa tu nombre');
      return;
    }
    await saveUserSettings({ userName: name.trim(), level });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const testConnection = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/health`, { signal: AbortSignal.timeout(5000) });
      const data = await res.json();
      Alert.alert('✅ Conexión exitosa', `Servidor OK\nModelo: ${data.model}`);
    } catch {
      Alert.alert('❌ Sin conexión', `No se pudo conectar a:\n${API_BASE_URL}\n\nVerifica que el servidor esté corriendo y la IP sea correcta en src/services/api.ts`);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>

        <Text style={styles.title}>CONFIGURACIÓN</Text>
        <Text style={styles.titleSub}>JARVIS · English Coach</Text>

        {/* Profile */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PERFIL</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Tu nombre</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="¿Cómo te llamas?"
              placeholderTextColor="rgba(255,255,255,0.2)"
              autoCorrect={false}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Nivel de inglés</Text>
            <View style={styles.levelGrid}>
              {LEVELS.map(l => (
                <TouchableOpacity
                  key={l}
                  style={[styles.levelBtn, level === l && styles.levelBtnActive]}
                  onPress={() => setLevel(l)}
                >
                  <Text style={[styles.levelBtnText, level === l && styles.levelBtnTextActive]}>
                    {l}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Server */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SERVIDOR</Text>
          <View style={styles.serverBox}>
            <Text style={styles.serverLabel}>URL actual:</Text>
            <Text style={styles.serverUrl}>{API_BASE_URL}</Text>
            <Text style={styles.serverNote}>
              Para cambiar la URL, edita{'\n'}
              <Text style={styles.code}>mobile/src/services/api.ts</Text>
            </Text>
          </View>
          <TouchableOpacity style={styles.testBtn} onPress={testConnection}>
            <Text style={styles.testBtnText}>PROBAR CONEXIÓN</Text>
          </TouchableOpacity>
        </View>

        {/* How to use */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>¿CÓMO USAR JARVIS?</Text>
          <View style={styles.steps}>
            {[
              { icon: '🎙️', text: 'Toca el micrófono y habla en inglés o español' },
              { icon: '📤', text: 'Toca de nuevo para enviar tu mensaje' },
              { icon: '🤖', text: 'Jarvis responde y corrige tus errores' },
              { icon: '🔁', text: 'Repite la frase corregida para aprender' },
              { icon: '📝', text: 'Pide "palabras del día" para aprender vocabulario' },
              { icon: '🎵', text: 'Pide música o podcast para practicar listening' },
            ].map((s, i) => (
              <View key={i} style={styles.step}>
                <Text style={styles.stepIcon}>{s.icon}</Text>
                <Text style={styles.stepText}>{s.text}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Save button */}
        <TouchableOpacity style={[styles.saveBtn, saved && styles.saveBtnDone]} onPress={handleSave}>
          <Text style={styles.saveBtnText}>{saved ? '✓ GUARDADO' : 'GUARDAR CAMBIOS'}</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#050A14' },
  container: { padding: 24, gap: 28, paddingBottom: 48 },

  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#00d4ff',
    letterSpacing: 6,
    fontFamily: 'monospace',
  },
  titleSub: {
    fontSize: 11,
    color: 'rgba(0,212,255,0.4)',
    letterSpacing: 3,
    fontFamily: 'monospace',
    marginTop: -16,
  },

  section: {
    gap: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: 'rgba(0,212,255,0.1)',
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(0,212,255,0.6)',
    letterSpacing: 3,
    fontFamily: 'monospace',
  },

  field: { gap: 8 },
  label: { fontSize: 12, color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,212,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#fff',
    fontSize: 16,
  },

  levelGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  levelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  levelBtnActive: {
    borderColor: '#00d4ff',
    backgroundColor: 'rgba(0,212,255,0.12)',
  },
  levelBtnText: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
  levelBtnTextActive: { color: '#00d4ff', fontWeight: '700' },

  serverBox: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  serverLabel: { fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' },
  serverUrl: { fontSize: 14, color: '#00d4ff', fontFamily: 'monospace' },
  serverNote: { fontSize: 11, color: 'rgba(255,255,255,0.35)', lineHeight: 18, marginTop: 4 },
  code: { color: '#f5a623', fontFamily: 'monospace' },

  testBtn: {
    borderWidth: 1,
    borderColor: 'rgba(0,212,255,0.3)',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  testBtnText: { color: '#00d4ff', fontSize: 12, fontWeight: '700', letterSpacing: 2, fontFamily: 'monospace' },

  steps: { gap: 12 },
  step: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  stepIcon: { fontSize: 18, width: 24 },
  stepText: { flex: 1, fontSize: 14, color: 'rgba(255,255,255,0.65)', lineHeight: 20 },

  saveBtn: {
    backgroundColor: '#00d4ff',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#00d4ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  saveBtnDone: { backgroundColor: '#00c853' },
  saveBtnText: { color: '#050A14', fontSize: 14, fontWeight: '900', letterSpacing: 2, fontFamily: 'monospace' },
});
