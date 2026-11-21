import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pressable, Text, View } from 'react-native';

import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/api/support';
import { AppText, Card, EmptyView, ErrorView, IconTile, LoadingView, Screen, ScreenHeader } from '@/components/ui/kit';
import { space, useColors } from '@/theme';

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
      <ScreenHeader
        title="Notifications"
        subtitle={unread > 0 ? `${unread} unread` : 'All caught up'}
        right={
          unread > 0 ? (
            <Pressable accessibilityRole="button" onPress={() => markAllMut.mutate()} disabled={markAllMut.isPending} hitSlop={8}>
              <Text style={{ color: c.primary, fontWeight: '800', fontSize: 13 }}>Mark all read</Text>
            </Pressable>
          ) : null
        }
      />

      {notifications.length === 0 ? (
        <EmptyView
          title="No notifications yet"
          message="Exam alerts, test reminders, and result updates will appear here."
        />
      ) : (
        <View style={{ gap: space.sm }}>
          {notifications.map((n) => (
            <Card
              key={n.id}
              onPress={() => {
                if (!n.is_read) markReadMut.mutate(n.id);
              }}
              style={{ flexDirection: 'row', gap: space.md, padding: space.md, opacity: n.is_read ? 0.8 : 1 }}>
              <IconTile
                icon={n.is_read ? 'notifications-outline' : 'notifications'}
                color={n.is_read ? c.textMuted : c.primary}
                bg={n.is_read ? c.skeleton : c.primarySoft}
                size={40}
              />
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
                  <AppText style={{ fontWeight: n.is_read ? '600' : '800', flex: 1 }}>{n.title}</AppText>
                  <AppText variant="small" muted>
                    {new Date(n.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </AppText>
                </View>
                {n.body ? (
                  <AppText variant="small" muted>
                    {n.body}
                  </AppText>
                ) : null}
              </View>
              {!n.is_read ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.primary, marginTop: 6 }} /> : null}
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
