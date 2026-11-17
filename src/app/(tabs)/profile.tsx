import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { getStreak } from '@/api/dashboard';
import { getNotifications } from '@/api/support';
import { getMe, updateMe } from '@/api/users';
import {
  AppText,
  Button,
  ErrorView,
  LoadingView,
  Screen,
  TextField,
} from '@/components/ui/kit';
import { useAuth } from '@/features/auth/auth-provider';
import { radius, space, useColors } from '@/theme';

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
    <Pressable
      onPress={onPress}
      style={[styles.menuRow, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={[styles.iconWrap, { backgroundColor: c.bg }]}>
        <Ionicons name={icon} size={20} color={c.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <AppText style={{ fontWeight: '600' }}>{title}</AppText>
        <AppText variant="small" muted>
          {subtitle}
        </AppText>
      </View>
      {badge ? (
        <View style={[styles.badge, { backgroundColor: c.primary }]}>
          <AppText variant="small" style={{ color: c.primaryText, fontWeight: '700', fontSize: 11 }}>
            {badge}
          </AppText>
        </View>
      ) : null}
      <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
    </Pressable>
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
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <AppText variant="title">{p.name}</AppText>
          <AppText variant="small" muted>
            {p.email}
          </AppText>
        </View>
        {!editing ? (
          <Pressable
            onPress={startEditing}
            style={[styles.editBtn, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Ionicons name="create-outline" size={16} color={c.primary} />
            <AppText variant="small" style={{ color: c.primary, fontWeight: '600' }}>
              Edit
            </AppText>
          </Pressable>
        ) : null}
      </View>

      {/* Streak & XP Rewards Card */}
      <View style={[styles.rewardsCard, { backgroundColor: c.surface, borderColor: c.border }]}>
        <View style={styles.rewardStat}>
          <AppText variant="small" muted>
            🔥 Streak
          </AppText>
          <AppText variant="heading">{streak?.currentStreak ?? 0}d</AppText>
        </View>
        <View style={styles.rewardStat}>
          <AppText variant="small" muted>
            🏆 Best Streak
          </AppText>
          <AppText variant="heading">{streak?.longestStreak ?? 0}d</AppText>
        </View>
        <View style={styles.rewardStat}>
          <AppText variant="small" muted>
            ⭐ XP Points
          </AppText>
          <AppText variant="heading" style={{ color: c.primary }}>
            {streak?.totalPoints ?? 0}
          </AppText>
        </View>
      </View>

      {/* Profile Details or Inline Edit Form */}
      {editing ? (
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border, gap: space.md }]}>
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
        </View>
      ) : (
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Row label="Phone" value={p.phone} />
          <Row label="Primary Target Exam" value={p.targetExam} />
          <Row label="State" value={p.state} />
          <Row label="Preparation Level" value={p.preparationLevel?.replace('_', ' ')} />
        </View>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.md,
    gap: space.sm,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  rewardsCard: {
    flexDirection: 'row',
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: space.md,
  },
  rewardStat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  card: {
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: space.lg,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: space.sm,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
});
