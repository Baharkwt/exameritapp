import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/api/support';
import { AppText, EmptyView, ErrorView, LoadingView, Screen } from '@/components/ui/kit';
import { radius, space, useColors } from '@/theme';

export default function NotificationsScreen() {
  const c = useColors();
  const qc = useQueryClient();

  const notifQ = useQuery({
    queryKey: ['notifications'],
    queryFn: getNotifications,
  });

  const markReadMut = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllMut = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  if (notifQ.isLoading) return <LoadingView />;
  if (notifQ.isError) {
    return <ErrorView message={notifQ.error.message} onRetry={() => notifQ.refetch()} />;
  }

  const notifications = notifQ.data?.notifications ?? [];
  const unread = notifQ.data?.unread ?? 0;

  return (
    <Screen>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={c.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <AppText variant="heading">Notifications</AppText>
          <AppText variant="small" muted>
            {unread > 0 ? `${unread} unread updates` : 'All caught up'}
          </AppText>
        </View>
        {unread > 0 ? (
          <Pressable
            onPress={() => markAllMut.mutate()}
            disabled={markAllMut.isPending}
            style={[styles.readAllBtn, { borderColor: c.border, backgroundColor: c.surface }]}>
            <AppText variant="small" style={{ color: c.primary, fontWeight: '600' }}>
              Mark all read
            </AppText>
          </Pressable>
        ) : null}
      </View>

      {notifications.length === 0 ? (
        <EmptyView
          title="No notifications yet"
          message="Exam alerts, test reminders, and result updates will appear here."
        />
      ) : (
        <View style={{ gap: space.sm }}>
          {notifications.map((n) => (
            <Pressable
              key={n.id}
              onPress={() => {
                if (!n.is_read) {
                  markReadMut.mutate(n.id);
                }
              }}
              style={[
                styles.card,
                {
                  backgroundColor: c.surface,
                  borderColor: n.is_read ? c.border : c.primary,
                },
              ]}>
              <View style={styles.rowBetween}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                  {!n.is_read ? (
                    <View style={[styles.unreadDot, { backgroundColor: c.primary }]} />
                  ) : null}
                  <AppText style={{ fontWeight: n.is_read ? '600' : '700', flex: 1 }}>
                    {n.title}
                  </AppText>
                </View>
                <AppText variant="small" muted>
                  {new Date(n.created_at).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </AppText>
              </View>
              {n.body ? (
                <AppText variant="small" muted style={{ marginTop: 4 }}>
                  {n.body}
                </AppText>
              ) : null}
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginBottom: space.md,
  },
  backBtn: {
    padding: 6,
  },
  readAllBtn: {
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  card: {
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

