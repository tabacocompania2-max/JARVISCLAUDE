import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  USER_NAME: 'jarvis:userName',
  USER_LEVEL: 'jarvis:level',
  HISTORY: 'jarvis:history',
};

export interface UserSettings {
  userName: string;
  level: string;
}

export async function getUserSettings(): Promise<UserSettings> {
  const [name, level] = await Promise.all([
    AsyncStorage.getItem(KEYS.USER_NAME),
    AsyncStorage.getItem(KEYS.USER_LEVEL),
  ]);
  return {
    userName: name ?? 'Estudiante',
    level: level ?? 'Beginner',
  };
}

export async function saveUserSettings(settings: UserSettings): Promise<void> {
  await AsyncStorage.multiSet([
    [KEYS.USER_NAME, settings.userName],
    [KEYS.USER_LEVEL, settings.level],
  ]);
}

export async function clearHistory(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.HISTORY);
}
