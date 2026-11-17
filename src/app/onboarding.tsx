import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { getCategories, getExams } from '@/api/catalog';
import { toApiError } from '@/api/client';
import {
  addStudentTarget,
  getStudentCategories,
  getStudentTargets,
  removeStudentTarget,
  replaceStudentCategories,
} from '@/api/student';
import { getMe, PreparationLevel, updateMe } from '@/api/users';
import { AppText, Button, ErrorBanner, ErrorView, LoadingView, Screen, TextField } from '@/components/ui/kit';
import { radius, space, useColors } from '@/theme';

const PREP_LEVELS: { key: PreparationLevel; label: string; desc: string }[] = [
  { key: 'just_starting', label: 'Just Starting', desc: 'Exploring syllabus & basics' },
  { key: 'beginner', label: 'Beginner', desc: 'Covered 10–30% of syllabus' },
  { key: 'intermediate', label: 'Intermediate', desc: 'Practising topic & sectional tests' },
  { key: 'advanced', label: 'Advanced', desc: 'Taking full mocks & revising' },
];

const POPULAR_STATES = [
  'Andhra Pradesh',
  'Bihar',
  'Delhi',
  'Gujarat',
  'Haryana',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Tamil Nadu',
  'Telangana',
  'Uttar Pradesh',
  'West Bengal',
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function OnboardingScreen() {
  const c = useColors();
  const qc = useQueryClient();

  const catsQ = useQuery({ queryKey: ['categories'], queryFn: getCategories });
  const examsQ = useQuery({
    queryKey: ['exams', 'withCategory'],
    queryFn: () => getExams({ withCategory: true }),
  });
  const myCatsQ = useQuery({ queryKey: ['student-categories'], queryFn: getStudentCategories });
  const myTargetsQ = useQuery({ queryKey: ['student-targets'], queryFn: getStudentTargets });
  const meQ = useQuery({ queryKey: ['me'], queryFn: getMe });

  const [selectedCatsOverride, setSelectedCatsOverride] = useState<string[] | null>(null);
  const [selectedTargetsOverride, setSelectedTargetsOverride] = useState<
    { examId: string; categoryId: string; name: string }[] | null
  >(null);
  const [prepLevelOverride, setPrepLevelOverride] = useState<PreparationLevel | null>(null);
  const [stateNameOverride, setStateNameOverride] = useState<string | null>(null);
  const [ busy, setBusy ] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCats = useMemo(
    () => selectedCatsOverride ?? (myCatsQ.data?.categories ?? []).map((x) => x.categoryId),
    [selectedCatsOverride, myCatsQ.data],
  );
  const selectedTargets = useMemo(
    () =>
      selectedTargetsOverride ??
      (myTargetsQ.data ?? []).map((t) => ({ examId: t.id, categoryId: t.category, name: t.name })),
    [selectedTargetsOverride, myTargetsQ.data],
  );
  const prepLevel: PreparationLevel = prepLevelOverride ?? meQ.data?.preparationLevel ?? 'just_starting';
  const stateName = stateNameOverride ?? meQ.data?.state ?? '';
  const startDate = meQ.data?.preparationStartDate
    ? String(meQ.data.preparationStartDate).slice(0, 10)
    : todayIso();

  const availableCategories = useMemo(
    () => (catsQ.data ?? []).filter((cat) => cat.exam_count > 0),
    [catsQ.data],
  );

  const examsForSelectedCategories = useMemo(() => {
    const all = examsQ.data ?? [];
    const filtered = selectedCats.length
      ? all.filter((e) => e.category_id && selectedCats.includes(e.category_id))
      : all;
    const seen = new Set<string>();
    return filtered.filter((e) => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });
  }, [examsQ.data, selectedCats]);

  if (catsQ.isLoading || examsQ.isLoading || myCatsQ.isLoading || myTargetsQ.isLoading || meQ.isLoading) {
    return <LoadingView />;
  }
  if (catsQ.isError || examsQ.isError) {
    return (
      <ErrorView
        message={(catsQ.error ?? examsQ.error)?.message ?? 'Failed to load catalog'}
        onRetry={() => {
          catsQ.refetch();
          examsQ.refetch();
        }}
      />
    );
  }

  function toggleCategory(catId: string) {
    setSelectedCatsOverride(
      selectedCats.includes(catId)
        ? selectedCats.filter((id) => id !== catId)
        : [...selectedCats, catId],
    );
  }

  function toggleTarget(exam: { id: string; name: string; category_id?: string }) {
    const catId = exam.category_id ?? selectedCats[0] ?? 'banking';
    if (selectedTargets.some((t) => t.examId === exam.id)) {
      setSelectedTargetsOverride(selectedTargets.filter((t) => t.examId !== exam.id));
      return;
    }
    if (selectedTargets.length >= 3) {
      setError('You can select up to 3 target exams.');
      return;
    }
    setError(null);
    setSelectedTargetsOverride([...selectedTargets, { examId: exam.id, categoryId: catId, name: exam.name }]);
  }

  async function saveAll() {
    if (selectedCats.length === 0) {
      setError('Select at least 1 exam category.');
      return;
    }
    if (selectedTargets.length === 0) {
      setError('Select at least 1 target exam (up to 3).');
      return;
    }
    if (!stateName.trim()) {
      setError('Enter or select your state.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const source = myCatsQ.data?.onboardingCompleted ? 'header_selector' : 'onboarding';
      await replaceStudentCategories(selectedCats, source);

      // Sync target exams (max 3 enforced on backend)
      const existingIds = new Set((myTargetsQ.data ?? []).map((t) => t.id));
      const desiredIds = new Set(selectedTargets.map((t) => t.examId));

      for (const old of myTargetsQ.data ?? []) {
        if (!desiredIds.has(old.id)) {
          await removeStudentTarget(old.id);
        }
      }
      for (const t of selectedTargets) {
        if (!existingIds.has(t.examId)) {
          await addStudentTarget({ examId: t.examId, categoryId: t.categoryId });
        }
      }

      await updateMe({
        targetExam: selectedTargets[0]?.name ?? null,
        preparationLevel: prepLevel,
        preparationStartDate: /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? startDate : todayIso(),
        state: stateName.trim(),
      });

      await Promise.all([
        qc.invalidateQueries({ queryKey: ['student-categories'] }),
        qc.invalidateQueries({ queryKey: ['student-targets'] }),
        qc.invalidateQueries({ queryKey: ['me'] }),
        qc.invalidateQueries({ queryKey: ['personalized-alerts'] }),
      ]);

      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/');
      }
    } catch (e) {
      setError(toApiError(e).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <AppText variant="title">Your Exam Goals</AppText>
          <AppText muted>Choose categories, up to 3 target exams, and your prep profile.</AppText>
        </View>
        {router.canGoBack() ? (
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="close" size={26} color={c.text} />
          </Pressable>
        ) : null}
      </View>

      {error ? <ErrorBanner message={error} /> : null}

      {/* Step 1: Categories */}
      <AppText variant="heading" style={styles.sectionTitle}>
        1. Exam Categories ({selectedCats.length} selected)
      </AppText>
      <View style={styles.chipGrid}>
        {availableCategories.map((cat) => {
          const active = selectedCats.includes(cat.id);
          return (
            <Pressable
              key={cat.id}
              onPress={() => toggleCategory(cat.id)}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? c.primary : c.surface,
                  borderColor: active ? c.primary : c.border,
                },
              ]}>
              <AppText
                variant="small"
                style={{ color: active ? c.primaryText : c.text, fontWeight: '600' }}>
                {cat.name} ({cat.exam_count})
              </AppText>
            </Pressable>
          );
        })}
      </View>

      {/* Step 2: Target Exams */}
      <AppText variant="heading" style={styles.sectionTitle}>
        2. Target Exams ({selectedTargets.length}/3 — first is Primary)
      </AppText>
      {selectedTargets.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.sm }}>
          {selectedTargets.map((t, idx) => (
            <Pressable
              key={t.examId}
              onPress={() => toggleTarget({ id: t.examId, name: t.name, category_id: t.categoryId })}
              style={[
                styles.chip,
                { backgroundColor: c.primary, borderColor: c.primary, flexDirection: 'row', gap: 6 },
              ]}>
              <AppText variant="small" style={{ color: c.primaryText, fontWeight: '700' }}>
                {idx === 0 ? '★ ' : `${idx + 1}. `}
                {t.name}
              </AppText>
              <Ionicons name="close-circle" size={16} color={c.primaryText} />
            </Pressable>
          ))}
        </View>
      ) : null}

      <ScrollView
        horizontal={false}
        style={[styles.examPickerBox, { backgroundColor: c.surface, borderColor: c.border }]}
        nestedScrollEnabled>
        <View style={styles.chipGrid}>
          {examsForSelectedCategories.slice(0, 60).map((exam) => {
            const active = selectedTargets.some((t) => t.examId === exam.id);
            return (
              <Pressable
                key={`${exam.category_id ?? 'all'}-${exam.id}`}
                onPress={() => toggleTarget(exam)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? c.primary : c.bg,
                    borderColor: active ? c.primary : c.border,
                  },
                ]}>
                <AppText
                  variant="small"
                  style={{ color: active ? c.primaryText : c.text, fontWeight: active ? '700' : '500' }}>
                  {exam.name}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* Step 3: Preparation Level */}
      <AppText variant="heading" style={styles.sectionTitle}>
        3. Preparation Stage
      </AppText>
      <View style={{ gap: space.sm }}>
        {PREP_LEVELS.map((lvl) => {
          const active = prepLevel === lvl.key;
          return (
            <Pressable
              key={lvl.key}
              onPress={() => setPrepLevelOverride(lvl.key)}
              style={[
                styles.levelCard,
                {
                  backgroundColor: c.surface,
                  borderColor: active ? c.primary : c.border,
                  borderWidth: active ? 2 : 1,
                },
              ]}>
              <View style={{ flex: 1 }}>
                <AppText style={{ fontWeight: '600' }}>{lvl.label}</AppText>
                <AppText variant="small" muted>
                  {lvl.desc}
                </AppText>
              </View>
              <Ionicons
                name={active ? 'radio-button-on' : 'radio-button-off'}
                size={22}
                color={active ? c.primary : c.textMuted}
              />
            </Pressable>
          );
        })}
      </View>

      {/* Step 4: State & Start Date */}
      <AppText variant="heading" style={styles.sectionTitle}>
        4. Your State
      </AppText>
      <TextField
        label="State / UT"
        placeholder="e.g. Maharashtra"
        value={stateName}
        onChangeText={setStateNameOverride}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: space.lg }}>
        <View style={{ flexDirection: 'row', gap: space.xs }}>
          {POPULAR_STATES.map((st) => (
            <Pressable
              key={st}
              onPress={() => setStateNameOverride(st)}
              style={[
                styles.chip,
                {
                  backgroundColor: stateName === st ? c.primary : c.surface,
                  borderColor: stateName === st ? c.primary : c.border,
                },
              ]}>
              <AppText
                variant="small"
                style={{ color: stateName === st ? c.primaryText : c.text }}>
                {st}
              </AppText>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <Button title="Save Exam Preferences" onPress={saveAll} loading={busy} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: space.md,
    gap: space.sm,
  },
  sectionTitle: {
    marginTop: space.lg,
    marginBottom: space.sm,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  examPickerBox: {
    maxHeight: 220,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.sm,
  },
  levelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space.md,
    borderRadius: radius.md,
    gap: space.sm,
  },
});
