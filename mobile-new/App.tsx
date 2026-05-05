import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, Platform } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { JarvisScreen } from './src/screens/JarvisScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';

type Tab = 'jarvis' | 'settings';

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <MainLayout />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function MainLayout() {
  const [activeTab, setActiveTab] = React.useState<Tab>('jarvis');
  const insets = useSafeAreaInsets();

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#050A14" />

      {/* Screen */}
      <View style={styles.screen}>
        {activeTab === 'jarvis' ? <JarvisScreen /> : <SettingsScreen />}
      </View>

      {/* Tab Bar */}
      <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TabItem
          label="JARVIS"
          icon="◉"
          active={activeTab === 'jarvis'}
          onPress={() => setActiveTab('jarvis')}
        />
        <TabItem
          label="CONFIG"
          icon="⚙"
          active={activeTab === 'settings'}
          onPress={() => setActiveTab('settings')}
        />
      </View>
    </>
  );
}

function TabItem({ label, icon, active, onPress }: {
  label: string; icon: string; active: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.tabItem} onPress={onPress} activeOpacity={0.7}>
      <Text style={[styles.tabIcon, active && styles.tabIconActive]}>{icon}</Text>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
      {active && <View style={styles.tabIndicator} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050A14' },
  screen: { flex: 1 },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#080F1E',
    borderTopWidth: 1,
    borderColor: 'rgba(0,212,255,0.1)',
    paddingTop: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    position: 'relative',
    paddingVertical: 4,
  },
  tabIcon: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.2)',
  },
  tabIconActive: {
    color: '#00d4ff',
  },
  tabLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
    color: 'rgba(255,255,255,0.2)',
    fontFamily: 'monospace',
  },
  tabLabelActive: {
    color: '#00d4ff',
  },
  tabIndicator: {
    position: 'absolute',
    top: -9,
    width: 24,
    height: 2,
    backgroundColor: '#00d4ff',
    borderRadius: 1,
  },
});
