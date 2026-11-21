import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { getStreak } from '@/api/dashboard';
import { getNotifications } from '@/api/support';
import { getMe, updateMe } from '@/api/users';
import {
  AppText,
  Button,
  Card,
  ErrorView,
  IconTile,
  LoadingView,
  Screen,
  TextField,
} from '@/components/ui/kit';
import { useAuth } from '@/features/auth/auth-provider';
import { space, useColors } from '@/theme';

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={{ paddingVertical: 6 }}>
      <AppText muted variant="small">
        {label}
      </AppText>
      <AppText style={{ fontWeight: '500' }}>{value || '—'}</AppText>
    </View>
  );
}

function MenuItem({
  icon,
  title,
  subtitle,
  badge,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  badge?: string | number | null;
  onPress: () => void;
}) {
  const c = useColors();
  return (
    <Card onPress={onPress} accessibilityLabel={title} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md }}>
      <IconTile icon={icon} color={c.primary} bg={c.primarySoft} size={40} />
      <View style={{ flex: 1 }}>
        <AppText style={{ fontWeight: '700' }}>{title}</AppText>
        <AppText variant="small" muted numberOfLines={1}>
          {subtitle}
        </AppText>
      </View>
      {badge ? (
        <View style={[styles.badge, { backgroundColor: c.danger }]}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 11 }}>{badge}</Text>
        </View>
      ) : null}
      <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
    </Card>
  );
}

export default function Profile() {
  const { signOut } = useAuth();
  const c = useColors();
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ['me'], queryFn: getMe });
  const streakQ = useQuery({ queryKey: ['streak'], queryFn: getStreak });
  const notifQ = useQuery({ queryKey: ['notifications'], queryFn: getNotifications });

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [stateName, setStateName] = useState('');

  const saveMut = useMutation({
    mutationFn: () =>
      updateMe({
        name: name.trim() || undefined,
        phone: phone.trim() || null,
        state: stateName.trim() || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me'] });
      setEditing(false);
      Alert.alert('Saved', 'Your profile details have been updated.');
    },
    onError: (err: Error) => {
      Alert.alert('Update Failed', err.message);
    },
  });

  if (q.isLoading) return <LoadingView />;
  if (q.isError) return <ErrorView message={q.error.message} onRetry={() => q.refetch()} />;
  const p = q.data!;
  const streak = streakQ.data;
  const unreadCount = notifQ.data?.unread ?? 0;

  const startEditing = () => {
    setName(p.name || '');
    setPhone(p.phone || '');
    setStateName(p.state || '');
    setEditing(true);
  };

  return (
    <Screen>
      <Card tone="hero" style={{ gap: space.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <View style={[styles.avatar, { backgroundColor: c.heroSoft }]}>
            <Text style={{ color: c.heroText, fontSize: 24, fontWeight: '800' }}>
              {(p.name || '?').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.heroText, fontSize: 20, fontWeight: '800', letterSpacing: -0.3 }} numberOfLines={1}>
              {p.name}
            </Text>
            <Text style={{ color: c.heroMuted, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>
              {p.email}
            </Text>
          </View>
          {!editing ? (
            <Ionicons name="create-outline" size={22} color={c.heroText} onPress={startEditing} accessibilityLabel="Edit profile" />
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {[
            ['🔥', 'Streak', `${streak?.currentStreak ?? 0}d`],
            ['🏆', 'Best', `${streak?.longestStreak ?? 0}d`],
            ['⭐', 'Points', `${streak?.totalPoints ?? 0}`],
          ].map(([emoji, label, value]) => (
            <View key={label} style={[styles.rewardStat, { backgroundColor: c.heroSoft }]}>
              <Text style={{ color: c.heroText, fontWeight: '800', fontSize: 17 }}>
                {emoji} {value}
              </Text>
              <Text style={{ color: c.heroMuted, fontSize: 11, fontWeight: '600' }}>{label}</Text>
            </View>
          ))}
        </View>
      </Card>
      <View style={{ height: space.md }} />

      {/* Profile Details or Inline Edit Form */}
      {editing ? (
        <Card style={{ gap: space.md, marginBottom: space.lg }}>
          <AppText variant="heading">Edit Profile</AppText>
          <TextField label="Full Name" value={name} onChangeText={setName} />
          <TextField
            label="Phone Number"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="+91 9876543210"
          />
          <TextField
            label="State / Region"
            value={stateName}
            onChangeText={setStateName}
            placeholder="e.g. Maharashtra, Delhi, Karnataka"
          />
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <Button title="Cancel" variant="outline" onPress={() => setEditing(false)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title="Save Changes"
                loading={saveMut.isPending}
                onPress={() => saveMut.mutate()}
              />
            </View>
          </View>
        </Card>
      ) : (
        <Card style={{ marginBottom: space.lg }}>
          <Row label="Phone" value={p.phone} />
          <Row label="Primary Target Exam" value={p.targetExam} />
          <Row label="State" value={p.state} />
          <Row label="Preparation Level" value={p.preparationLevel?.replace('_', ' ')} />
        </Card>
      )}

      {/* Navigation Links */}
      <View style={{ gap: space.sm, marginBottom: space.lg }}>
        <MenuItem
          icon="card-outline"
          title="Subscription & Plans"
          subtitle="Manage Pro Pass, coupons & payment history"
          onPress={() => router.push('/subscription')}
        />
        <MenuItem
          icon="journal-outline"
          title="Mistake Notebook & Revision"
          subtitle="Review wrong questions & spaced-repetition queue"
          onPress={() => router.push('/mistakes')}
        />
        <MenuItem
          icon="notifications-outline"
          title="Notifications"
          subtitle="Exam updates, test alerts & announcements"
          badge={unreadCount > 0 ? unreadCount : null}
          onPress={() => router.push('/notifications')}
        />
        <MenuItem
          icon="options-outline"
          title="Exam Goals & Categories"
          subtitle="Update your target exams and preparation stage"
          onPress={() => router.push('/onboarding')}
        />
        <MenuItem
          icon="chatbubbles-outline"
          title="Help & Student Voice"
          subtitle="Report bugs, request tests & vote on student ideas"
          onPress={() => router.push('/help')}
        />
        <MenuItem
          icon="shield-checkmark-outline"
          title="Security & Preferences"
          subtitle="Change password, notification settings & account"
          onPress={() => router.push('/settings/security')}
        />
      </View>

      <Button title="Sign out" variant="outline" onPress={signOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  rewardStat: { flex: 1, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, gap: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
});
