import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  createVoiceSubmission,
  getVoiceSubmissions,
  getVoiceSuggestions,
  toggleSuggestionVote,
  type VoiceSubmissionCategory,
} from '@/api/support';
import {
  AppText,
  Button,
  EmptyView,
  ErrorView,
  LoadingView,
  Screen,
  TextField,
} from '@/components/ui/kit';
import { radius, space, useColors } from '@/theme';

const CATEGORIES: { key: VoiceSubmissionCategory; label: string }[] = [
  { key: 'suggestion', label: 'Suggestion' },
  { key: 'report_problem', label: 'Report Bug' },
  { key: 'request_content', label: 'Request Exam / Test' },
  { key: 'technical_issue', label: 'Technical Issue' },
  { key: 'feedback', label: 'General Feedback' },
];

export default function HelpScreen() {
  const c = useColors();
  const qc = useQueryClient();

  const [tab, setTab] = useState<'submit' | 'tickets' | 'community'>('submit');
  const [category, setCategory] = useState<VoiceSubmissionCategory>('suggestion');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);

  const ticketsQ = useQuery({
    queryKey: ['voice-submissions'],
    queryFn: getVoiceSubmissions,
    enabled: tab === 'tickets',
  });

  const suggestionsQ = useQuery({
    queryKey: ['voice-suggestions'],
    queryFn: () => getVoiceSuggestions('popular'),
    enabled: tab === 'community',
  });

  const submitMut = useMutation({
    mutationFn: () =>
      createVoiceSubmission({
        category,
        title: title.trim(),
        description: description.trim(),
        isPublic: category === 'suggestion' ? isPublic : false,
      }),
    onSuccess: (res) => {
      setTitle('');
      setDescription('');
      qc.invalidateQueries({ queryKey: ['voice-submissions'] });
      qc.invalidateQueries({ queryKey: ['voice-suggestions'] });
      Alert.alert(
        'Submitted',
        res.submission?.ticket_number
          ? `Ticket ${res.submission.ticket_number} has been logged.`
          : 'Your feedback has been submitted to the Examerit team.',
      );
      setTab('tickets');
    },
    onError: (err: Error) => {
      Alert.alert('Submission Failed', err.message);
    },
  });

  const voteMut = useMutation({
    mutationFn: (id: string) => toggleSuggestionVote(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['voice-suggestions'] }),
  });

  const tickets = ticketsQ.data ?? [];
  const suggestions = suggestionsQ.data ?? [];

  return (
    <Screen>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={c.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <AppText variant="heading">Help & Student Voice</AppText>
          <AppText variant="small" muted>
            Report issues, request mock tests, or vote on features
          </AppText>
        </View>
      </View>

      {/* Tabs */}
      <View style={[styles.tabRow, { backgroundColor: c.surface, borderColor: c.border }]}>
        {(
          [
            { key: 'submit', label: 'New Ticket' },
            { key: 'tickets', label: 'My Tickets' },
            { key: 'community', label: 'Ideas' },
          ] as const
        ).map((item) => {
          const active = tab === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => setTab(item.key)}
              style={[styles.tabBtn, active && { backgroundColor: c.primary }]}>
              <AppText
                variant="small"
                style={{
                  fontWeight: '700',
                  color: active ? c.primaryText : c.text,
                }}>
                {item.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      {tab === 'submit' ? (
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border, gap: space.md }]}>
          <View>
            <AppText variant="small" muted style={{ marginBottom: 6 }}>
              Category
            </AppText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: space.xs }}>
                {CATEGORIES.map((cat) => {
                  const active = category === cat.key;
                  return (
                    <Pressable
                      key={cat.key}
                      onPress={() => setCategory(cat.key)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: active ? c.primary : c.bg,
                          borderColor: active ? c.primary : c.border,
                        },
                      ]}>
                      <AppText
                        variant="small"
                        style={{
                          color: active ? c.primaryText : c.text,
                          fontWeight: '600',
                        }}>
                        {cat.label}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </View>

          <TextField
            label="Subject / Title"
            placeholder="Brief summary of your request or issue"
            value={title}
            onChangeText={setTitle}
          />

          <TextField
            label="Description"
            placeholder="Share details (exam name, test name, or steps to reproduce)..."
            value={description}
            onChangeText={setDescription}
            multiline
            style={{ minHeight: 100, textAlignVertical: 'top' }}
          />

          {category === 'suggestion' ? (
            <Pressable
              onPress={() => setIsPublic((v) => !v)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <Ionicons
                name={isPublic ? 'checkbox' : 'square-outline'}
                size={20}
                color={c.primary}
              />
              <AppText variant="small">
                Allow other students to view and upvote this suggestion
              </AppText>
            </Pressable>
          ) : null}

          <Button
            title="Submit to Examerit Team"
            disabled={title.trim().length < 3 || description.trim().length < 5}
            loading={submitMut.isPending}
            onPress={() => submitMut.mutate()}
          />
        </View>
      ) : tab === 'tickets' ? (
        ticketsQ.isLoading ? (
          <LoadingView />
        ) : ticketsQ.isError ? (
          <ErrorView message={ticketsQ.error.message} onRetry={() => ticketsQ.refetch()} />
        ) : tickets.length === 0 ? (
          <EmptyView
            title="No tickets submitted"
            message="Any bug reports, content requests, or feedback you submit will be tracked here."
          />
        ) : (
          <View style={{ gap: space.sm }}>
            {tickets.map((t) => (
              <View
                key={t.id}
                style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
                <View style={styles.rowBetween}>
                  <AppText variant="small" style={{ color: c.primary, fontWeight: '700' }}>
                    {t.ticket_number || t.category.toUpperCase()}
                  </AppText>
                  <AppText variant="small" muted>
                    {t.status}
                  </AppText>
                </View>
                <AppText style={{ fontWeight: '700', marginTop: 4 }}>{t.title}</AppText>
                <AppText variant="small" muted style={{ marginTop: 4 }}>
                  {t.description}
                </AppText>
              </View>
            ))}
          </View>
        )
      ) : suggestionsQ.isLoading ? (
        <LoadingView />
      ) : suggestionsQ.isError ? (
        <ErrorView message={suggestionsQ.error.message} onRetry={() => suggestionsQ.refetch()} />
      ) : suggestions.length === 0 ? (
        <EmptyView
          title="No public suggestions yet"
          message="Be the first student to suggest a new feature or exam series!"
        />
      ) : (
        <View style={{ gap: space.sm }}>
          {suggestions.map((s) => (
            <View
              key={s.id}
              style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <AppText style={{ fontWeight: '700' }}>{s.title}</AppText>
                  <AppText variant="small" muted style={{ marginTop: 2 }}>
                    {s.description}
                  </AppText>
                </View>
                <Pressable
                  onPress={() => voteMut.mutate(s.id)}
                  style={[
                    styles.voteBox,
                    {
                      backgroundColor: s.has_voted ? c.primary : c.bg,
                      borderColor: s.has_voted ? c.primary : c.border,
                    },
                  ]}>
                  <Ionicons
                    name="caret-up"
                    size={16}
                    color={s.has_voted ? c.primaryText : c.text}
                  />
                  <AppText
                    variant="small"
                    style={{
                      fontWeight: '700',
                      color: s.has_voted ? c.primaryText : c.text,
                    }}>
                    {s.upvotes_count ?? 0}
                  </AppText>
                </Pressable>
              </View>
            </View>
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
  tabRow: {
    flexDirection: 'row',
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 4,
    marginBottom: space.md,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: space.sm,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  chip: {
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
  voteBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    minWidth: 48,
  },
});
