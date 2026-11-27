import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Screen, ScreenHeader, Segmented } from '@/components/ui/kit';
import { GrammarPanel } from '@/features/english-hub/GrammarPanel';
import { useGrammarHub, useVocabularyHub } from '@/features/english-hub/useEnglishHub';
import { VocabPanel } from '@/features/english-hub/VocabPanel';
import { haptic } from '@/lib/haptics';
import { space } from '@/theme';

export type HubTab = 'vocabulary' | 'grammar';

export function EnglishHubScreen({ defaultTab = 'vocabulary' }: { defaultTab?: HubTab }) {
  const params = useLocalSearchParams<{ tab?: string; view?: string }>();
  const paramKey = params.tab ?? '';
  const paramTab: HubTab =
    params.tab === 'grammar'
      ? 'grammar'
      : params.tab === 'vocabulary'
        ? 'vocabulary'
        : defaultTab;

  const [tabOverride, setTabOverride] = useState<{ key: string; tab: HubTab } | null>(null);
  const mainTab = tabOverride?.key === paramKey ? tabOverride.tab : paramTab;

  const vocab = useVocabularyHub();
  const grammar = useGrammarHub();

  const refreshing = vocab.isRefetching || grammar.isRefetching;
  const onRefresh = () => {
    vocab.refetch();
    grammar.refetch();
  };

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <ScreenHeader
        title="English Hub"
        subtitle="Vocabulary, spaced revision and grammar"
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/learn'))}
      />

      <Segmented
        options={[
          { key: 'vocabulary', label: 'Vocabulary' },
          { key: 'grammar', label: 'Grammar' },
        ]}
        value={mainTab}
        onChange={(next) => {
          haptic.select();
          setTabOverride({ key: paramKey, tab: next });
        }}
      />

      <View style={{ marginTop: space.md }}>
        {mainTab === 'vocabulary' ? (
          <VocabPanel initialView={params.view} />
        ) : (
          <GrammarPanel />
        )}
      </View>
    </Screen>
  );
}
