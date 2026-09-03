/**
 * Root layout — theme, database provider, and stack navigation.
 */

import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import 'react-native-reanimated';

import { DatabaseProvider, useDatabase } from '@/providers/DatabaseProvider';
import { bootstrapMonetization } from '@/monetization/bootstrap';
import { colors, spacing, typography } from '@/theme/tokens';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <DatabaseProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <DatabaseGate>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="project/form"
              options={{ title: 'Проект', presentation: 'modal' }}
            />
            <Stack.Screen
              name="project/[id]"
              options={{ title: 'Проект' }}
            />
            <Stack.Screen
              name="project/knit/[id]"
              options={{ headerShown: false, gestureEnabled: false }}
            />
            <Stack.Screen
              name="project/documents/[documentId]"
              options={{ headerShown: false, presentation: 'modal' }}
            />
            <Stack.Screen
              name="project/diary/[id]"
              options={{ title: 'Дневник проекта' }}
            />
            <Stack.Screen
              name="project/statistics/[id]"
              options={{ title: 'Статистика' }}
            />
            <Stack.Screen
              name="project/rules/form"
              options={{ title: 'Действия по рядам', presentation: 'modal' }}
            />
            <Stack.Screen
              name="yarn/form"
              options={{ title: 'Пряжа', presentation: 'modal' }}
            />
            <Stack.Screen
              name="yarn/[id]"
              options={{ title: 'Пряжа' }}
            />
            <Stack.Screen
              name="backup"
              options={{ title: 'Резервная копия' }}
            />
            <Stack.Screen
              name="calculators"
              options={{ headerShown: false }}
            />
          </Stack>
        </DatabaseGate>
      </ThemeProvider>
    </DatabaseProvider>
  );
}

/** Shows loading or error state while the database initializes. */
function DatabaseGate({ children }: { children: React.ReactNode }) {
  const { ready, error, settingsRepository } = useDatabase();

  // Boot analytics/ads once the local DB is ready
  useEffect(() => {
    if (!ready || !settingsRepository) return;
    void bootstrapMonetization(settingsRepository);
  }, [ready, settingsRepository]);

  if (error) {
    return (
      <View style={styles.gate}>
        <Text style={styles.gateTitle}>Не удалось открыть базу данных</Text>
        <Text style={styles.gateMessage}>
          Перезапустите приложение. Если проблема повторится, обратитесь в поддержку.
        </Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={styles.gate}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.gateMessage}>Загрузка…</Text>
      </View>
    );
  }

  return children;
}

const styles = StyleSheet.create({
  gate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  gateTitle: {
    ...typography.subtitle,
    color: colors.text,
    textAlign: 'center',
  },
  gateMessage: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
