import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { CatalogExam, getCategories, getCategoryExamGroups, getExams } from '@/api/catalog';
import { toApiError } from '@/api/client';
import { addStudentTarget, getStudentCategories, getStudentTargets, removeStudentTarget } from '@/api/student';
import { AppText, Card, Chip, EmptyView, ErrorBanner, ErrorView, LoadingView, Screen, ScreenHeader } from '@/components/ui/kit';
import { haptic } from '@/lib/haptics';
import { elevation, radius, space, useColors } from '@/theme';

export default function AllExamsScreen() {
  const c = useColors();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ category?: string }>();

  const catsQ = useQuery({ queryKey: ['categories'], queryFn: getCategories });
  const myCatsQ = useQuery({ queryKey: ['student-categories'], queryFn: getStudentCategories });
  const myTargetsQ = useQuery({ queryKey: ['student-targets'], queryFn: getStudentTargets });

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const activeCategory = useMemo(() => {
    if (selectedCategory) return selectedCategory;
    if (params.category) return params.category;
    const firstStudentCat = myCatsQ.data?.categories[0]?.categoryId;
    if (firstStudentCat) return firstStudentCat;
    return catsQ.data?.find((cat) => cat.exam_count > 0)?.id ?? '';
  }, [selectedCategory, params.category, myCatsQ.data, catsQ.data]);

  const examsQ = useQuery({
    queryKey: ['exams', activeCategory || 'all'],
    queryFn: () => getExams(activeCategory ? { category: activeCategory } : undefined),
    enabled: !!catsQ.data,
  });

  const groupsQ = useQuery({
    queryKey: ['exam-groups', activeCategory],
    queryFn: () => getCategoryExamGroups(activeCategory),
    enabled: !!activeCategory,
  });

  const categories = useMemo(
    () => (catsQ.data ?? []).filter((cat) => cat.exam_count > 0),
    [catsQ.data],
  );

  const filteredExams = useMemo(() => {
    const list = examsQ.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((e) => e.name.toLowerCase().includes(q));
  }, [examsQ.data, search]);

  const groupedSections = useMemo(() => {
    const groups = groupsQ.data ?? [];
    if (!activeCategory || groups.length === 0) {
      return [{ id: 'all', title: 'All Exams', exams: filteredExams }];
    }
    const sections: { id: string; title: string; exams: CatalogExam[] }[] = [];
    for (const g of groups) {
      const items = filteredExams.filter((e) => e.exam_group_id === g.id);
      if (items.length > 0) {
        sections.push({ id: String(g.id), title: g.name, exams: items });
      }
    }
    const ungrouped = filteredExams.filter((e) => !e.exam_group_id);
    if (ungrouped.length > 0) {
      sections.push({
        id: 'other',
        title: sections.length > 0 ? 'Other Exams' : 'Exams',
        exams: ungrouped,
      });
    }
    return sections;
  }, [activeCategory, groupsQ.data, filteredExams]);

  const targetIds = useMemo(
    () => new Set((myTargetsQ.data ?? []).map((t) => t.id)),
    [myTargetsQ.data],
  );

  async function toggleTarget(exam: CatalogExam) {
    setError(null);
    try {
      if (targetIds.has(exam.id)) {
        await removeStudentTarget(exam.id);
      } else {
        const catId = exam.category_id || activeCategory || myCatsQ.data?.categories[0]?.categoryId || 'banking';
        await addStudentTarget({ examId: exam.id, categoryId: catId });
      }
      await qc.invalidateQueries({ queryKey: ['student-targets'] });
    } catch (e) {
      setError(toApiError(e).message);
    }
  }

  if (catsQ.isLoading) return <LoadingView />;
  if (catsQ.isError) return <ErrorView message={catsQ.error.message} onRetry={() => catsQ.refetch()} />;

  return (
    <Screen>
      <ScreenHeader title="All exams" subtitle="Star up to 3 target exams" />

      {error ? <ErrorBanner message={error} /> : null}

      {/* Search bar */}
      <View style={[styles.searchBox, { backgroundColor: c.surface }, elevation(c, 1)]}>
        <Ionicons name="search-outline" size={18} color={c.textMuted} />
        <TextInput
          placeholder="Search SBI PO, SSC CGL, IBPS..."
          placeholderTextColor={c.textMuted}
          value={search}
          onChangeText={setSearch}
          style={[styles.searchInput, { color: c.text }]}
        />
        {search ? (
          <Pressable onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={c.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -16, marginVertical: space.sm }}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingVertical: 6 }}>
        {categories.map((cat) => (
          <Chip
            key={cat.id}
            label={`${cat.name} · ${cat.exam_count}`}
            selected={activeCategory === cat.id}
            onPress={() => setSelectedCategory(cat.id)}
          />
        ))}
      </ScrollView>

      {/* Exam sections */}
      {examsQ.isLoading ? (
        <LoadingView />
      ) : examsQ.isError ? (
        <ErrorView message={examsQ.error.message} onRetry={() => examsQ.refetch()} />
      ) : groupedSections.length === 0 || filteredExams.length === 0 ? (
        <EmptyView title="No exams found" message="Try another search term or category." />
      ) : (
        <View style={{ gap: space.lg }}>
          {groupedSections.map((section) => (
            <View key={section.id} style={{ gap: space.sm }}>
              <Text style={{ color: c.text, fontSize: 17, fontWeight: '800', letterSpacing: -0.3 }}>{section.title}</Text>
              {section.exams.map((exam) => {
                const isTarget = targetIds.has(exam.id);
                return (
                  <Card
                    key={exam.id}
                    onPress={() =>
                      router.push({
                        pathname: '/exams/[id]',
                        params: { id: exam.id, name: exam.name, category: activeCategory },
                      })
                    }
                    style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md }}>
                    <View style={[styles.avatar, { backgroundColor: c.primarySoft }]}>
                      <AppText style={{ fontWeight: '700', color: c.primary }}>
                        {exam.name.slice(0, 2).toUpperCase()}
                      </AppText>
                    </View>
                    <View style={{ flex: 1 }}>
                      <AppText style={{ fontWeight: '600' }}>{exam.name}</AppText>
                      {exam.exam_group_name ? (
                        <AppText variant="small" muted>
                          {exam.exam_group_name}
                        </AppText>
                      ) : null}
                    </View>
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        haptic.light();
                        toggleTarget(exam);
                      }}
                      hitSlop={10}
                      style={{ paddingHorizontal: space.xs }}>
                      <Ionicons
                        name={isTarget ? 'star' : 'star-outline'}
                        size={22}
                        color={isTarget ? c.star : c.textMuted}
                      />
                    </Pressable>
                    <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
                  </Card>
                );
              })}
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginBottom: space.md,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    height: 48,
    gap: space.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 8,
  },
  catChip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  examCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: space.md,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
