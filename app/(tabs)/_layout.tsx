import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import { Pressable } from 'react-native';
import { useAuth } from '@/lib/auth';
import { useColors } from '@/lib/theme';

type IconName = keyof typeof Ionicons.glyphMap;
const icon = (name: IconName) => ({ color, size }: { color: string; size: number }) => <Ionicons name={name} color={color} size={size} />;

export default function TabsLayout() {
  const c = useColors();
  const router = useRouter();
  const { profile } = useAuth();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: c.surface },
        headerTintColor: c.fg,
        headerTitleStyle: { fontWeight: '800' },
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.line },
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.muted,
        sceneStyle: { backgroundColor: c.bg },
        headerRight: () => (
          <Pressable accessibilityLabel="Your profile" onPress={() => profile && router.push(`/profile/${profile.username}`)} style={{ paddingHorizontal: 16 }}>
            <Ionicons name="person-circle-outline" size={26} color={c.fg} />
          </Pressable>
        ),
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Tonight', tabBarIcon: icon('dice-outline') }} />
      <Tabs.Screen name="shelf" options={{ title: 'My shelf', tabBarIcon: icon('library-outline') }} />
      <Tabs.Screen name="scan" options={{ title: 'Scan', tabBarIcon: icon('camera-outline') }} />
      <Tabs.Screen name="discover" options={{ title: 'Discover', tabBarIcon: icon('sparkles-outline') }} />
      <Tabs.Screen name="forums" options={{ title: 'Forums', tabBarIcon: icon('chatbubbles-outline') }} />
    </Tabs>
  );
}
