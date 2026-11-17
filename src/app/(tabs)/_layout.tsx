import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors } from '@/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const tab = (title: string, icon: IconName, activeIcon: IconName) => ({
  title,
  tabBarIcon: ({ color, focused }: { color: ColorValue; size: number; focused: boolean }) => (
    <Ionicons name={focused ? activeIcon : icon} color={color as string} size={20} />
  ),
});

export default function TabsLayout() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: {
          backgroundColor: c.surface,
          borderTopColor: c.border,
          height: 50 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 4),
          paddingTop: 4,
        },
        tabBarLabelStyle: { fontSize: 10.5, fontWeight: '600' },
      }}>
      <Tabs.Screen name="index" options={tab('Home', 'home-outline', 'home')} />
      <Tabs.Screen name="tests" options={tab('Tests', 'document-text-outline', 'document-text')} />
      <Tabs.Screen name="learn" options={tab('Learn', 'book-outline', 'book')} />
      <Tabs.Screen name="analytics" options={tab('Stats', 'stats-chart-outline', 'stats-chart')} />
      <Tabs.Screen name="profile" options={tab('Account', 'person-outline', 'person')} />
    </Tabs>
  );
}
