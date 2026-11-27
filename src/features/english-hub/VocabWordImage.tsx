import { Image, type ImageStyle } from 'expo-image';
import { useState } from 'react';
import { StyleProp } from 'react-native';

import type { VocabWord } from '@/api/englishHub';
import { resolveMediaUrl } from '@/lib/config';
import { radius, useColors } from '@/theme';

const THEME_IMAGES: Record<string, string> = {
  nature: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&auto=format&fit=crop&q=80',
  business: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&auto=format&fit=crop&q=80',
  emotion: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=800&auto=format&fit=crop&q=80',
  science: 'https://images.unsplash.com/photo-1532094349884-543559c17b64?w=800&auto=format&fit=crop&q=80',
  history: 'https://images.unsplash.com/photo-1461360370896-922624d12aa1?w=800&auto=format&fit=crop&q=80',
  government: 'https://images.unsplash.com/photo-1529154166925-574a0236a4f4?w=800&auto=format&fit=crop&q=80',
  economy: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&auto=format&fit=crop&q=80',
  leadership: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&auto=format&fit=crop&q=80',
  banking: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&auto=format&fit=crop&q=80',
  ssc: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800&auto=format&fit=crop&q=80',
  upsc: 'https://images.unsplash.com/photo-1529154166925-574a0236a4f4?w=800&auto=format&fit=crop&q=80',
  railway: 'https://images.unsplash.com/photo-1474487548417-781cb6d646b3?w=800&auto=format&fit=crop&q=80',
  defence: 'https://images.unsplash.com/photo-1530988836461-f46b6d8e4e3c?w=800&auto=format&fit=crop&q=80',
  default: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800&auto=format&fit=crop&q=80',
};

export function getContextualWordImageUrl(word?: Partial<VocabWord> | null): string {
  const cat = word?.examCategory?.toLowerCase();
  if (cat && THEME_IMAGES[cat]) return THEME_IMAGES[cat];
  const combined = `${word?.meaning ?? ''} ${word?.word ?? ''}`.toLowerCase();
  const pairs: [string[], string][] = [
    [['nature', 'plant', 'grow', 'forest', 'tree', 'earth', 'mountain', 'river'], 'nature'],
    [['feel', 'emotion', 'love', 'fear', 'joy', 'anger', 'empathy', 'hope'], 'emotion'],
    [['science', 'technology', 'data', 'research', 'experiment', 'analysis'], 'science'],
    [['history', 'ancient', 'tradition', 'heritage', 'culture', 'era'], 'history'],
    [['market', 'trade', 'profit', 'wealth', 'finance', 'economic', 'fiscal'], 'economy'],
    [['government', 'policy', 'law', 'parliament', 'democracy', 'constitution'], 'government'],
    [['lead', 'leader', 'strength', 'power', 'resilient', 'courage', 'bold'], 'leadership'],
    [['strategy', 'plan', 'business', 'executive', 'negotiate', 'acumen'], 'business'],
  ];
  for (const [keywords, key] of pairs) {
    if (keywords.some((k) => combined.includes(k))) return THEME_IMAGES[key];
  }
  return THEME_IMAGES.default;
}

export function VocabWordImage({
  word,
  imageUrl,
  height = 160,
  width = '100%',
  borderRadius = radius.md,
  fallbackToTheme = true,
  style,
}: {
  word?: Partial<VocabWord> | null;
  imageUrl?: string | null;
  height?: number;
  width?: number | `${number}%`;
  borderRadius?: number;
  fallbackToTheme?: boolean;
  style?: StyleProp<ImageStyle>;
}) {
  const c = useColors();
  const [failedPrimary, setFailedPrimary] = useState<string | null>(null);
  const [failedFallback, setFailedFallback] = useState(false);

  const primaryUri = resolveMediaUrl(imageUrl ?? word?.imageUrl);
  const fallbackUri = fallbackToTheme ? getContextualWordImageUrl(word) : undefined;
  const activeUri =
    primaryUri && failedPrimary !== primaryUri
      ? primaryUri
      : !failedFallback
        ? fallbackUri
        : undefined;

  if (!activeUri) return null;

  return (
    <Image
      source={{ uri: activeUri }}
      contentFit="cover"
      transition={180}
      accessibilityLabel={word?.word ? `Visual for ${word.word}` : 'Vocabulary visual'}
      onError={() => {
        if (primaryUri && activeUri === primaryUri) {
          setFailedPrimary(primaryUri);
        } else {
          setFailedFallback(true);
        }
      }}
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: c.skeleton,
        },
        style,
      ]}
    />
  );
}
