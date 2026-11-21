import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { elevation, useColors } from '@/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const tab = (title: string, icon: IconName, activeIcon: IconName) => ({
  title,
  tabBarIcon: ({ color, focused }: { color: ColorValue; size: number; focused: boolean }) => (
    <Ionicons name={focused ? activeIcon : icon} color={color as string} size={23} />
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
          borderTopWidth: 0,
          height: 58 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 6),
          paddingTop: 8,
          ...elevation(c, 3),
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}>
      <Tabs.Screen name="index" options={tab('Home', 'home-outline', 'home')} />
      <Tabs.Screen name="tests" options={tab('Practice', 'create-outline', 'create')} />
      <Tabs.Screen name="learn" options={tab('Learn', 'book-outline', 'book')} />
      <Tabs.Screen name="analytics" options={tab('Progress', 'stats-chart-outline', 'stats-chart')} />
      <Tabs.Screen name="profile" options={tab('You', 'person-circle-outline', 'person-circle')} />
    </Tabs>
  );
}
