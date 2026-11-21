import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated2, {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { ReactNode, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextProps,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { elevation, radius, space, TOUCH, useColors } from '@/theme';

/** Compact, high-density, keyboard-safe mobile screen container. */
export function Screen({
  children,
  scroll = true,
  padded = true,
  style,
  refreshing,
  onRefresh,
}: {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  style?: ViewStyle;
  /** Pass both to enable pull-to-refresh. */
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const pad = {
    paddingTop: insets.top + 8,
    paddingBottom: insets.bottom + 14,
    paddingHorizontal: padded ? 16 : 0,
  };
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[pad, { flexGrow: 1 }, style]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={!!refreshing}
                onRefresh={onRefresh}
                tintColor={c.primary}
                colors={[c.primary]}
              />
            ) : undefined
          }>
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, pad, style]}>{children}</View>
      )}
    </KeyboardAvoidingView>
  );
}

export function AppText({
  children,
  variant = 'body',
  muted,
  style,
  ...rest
}: TextProps & {
  children: ReactNode;
  variant?: 'title' | 'heading' | 'body' | 'small';
  muted?: boolean;
}) {
  const c = useColors();
  return (
    <Text {...rest} style={[styles[variant], { color: muted ? c.textMuted : c.text }, style]}>
      {children}
    </Text>
  );
}

export function Button({
  title,
  onPress,
  loading,
  disabled,
  variant = 'primary',
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'outline' | 'danger';
}) {
  const c = useColors();
  const off = disabled || loading;
  const bg = variant === 'primary' ? c.primary : variant === 'danger' ? c.danger : 'transparent';
  const fg = variant === 'outline' ? c.text : variant === 'danger' ? '#FFFFFF' : c.primaryText;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: bg,
          borderColor: variant === 'outline' ? c.border : bg,
          opacity: off ? 0.55 : pressed ? 0.85 : 1,
        },
      ]}>
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function TextField({
  label,
  error,
  style,
  onFocus,
  onBlur,
  ...props
}: TextInputProps & { label: string; error?: string | null }) {
  const c = useColors();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ marginBottom: space.md }}>
      <Text style={[styles.label, { color: c.textMuted }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={c.textMuted}
        {...props}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          styles.input,
          {
            backgroundColor: c.inputBg,
            color: c.text,
            borderColor: error ? c.danger : focused ? c.primary : c.border,
            borderWidth: focused || error ? 1.5 : 1,
          },
          style,
        ]}
      />
      {error ? <Text accessibilityLiveRegion="polite" style={[styles.small, { color: c.danger, marginTop: 4 }]}>{error}</Text> : null}
    </View>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  const c = useColors();
  return (
    <View
      accessibilityRole="alert"
      style={[styles.banner, { backgroundColor: c.dangerBg, borderColor: c.danger }]}>
      <Text style={{ color: c.danger, fontSize: 14 }}>{message}</Text>
    </View>
  );
}

export function Skeleton({
  height = 16,
  width = '100%',
  radiusPx = radius.sm,
  style,
}: {
  height?: number;
  width?: ViewStyle['width'];
  radiusPx?: number;
  style?: ViewStyle;
}) {
  const c = useColors();
  const [opacity] = useState(() => new Animated.Value(0.5));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <Animated.View
      style={[{ height, width, borderRadius: radiusPx, backgroundColor: c.skeleton, opacity }, style]}
    />
  );
}

/** Full-screen placeholder shaped like a typical card list. */
export function LoadingView() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
      style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top + 16, paddingHorizontal: 16, gap: 12 }}>
      <Skeleton height={26} width="55%" />
      <Skeleton height={14} width="35%" />
      <Skeleton height={84} radiusPx={radius.md} style={{ marginTop: 8 }} />
      <Skeleton height={64} radiusPx={radius.md} />
      <Skeleton height={64} radiusPx={radius.md} />
      <Skeleton height={64} radiusPx={radius.md} />
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.center}>
      <AppText variant="heading">Something went wrong</AppText>
      <AppText muted style={{ textAlign: 'center', marginVertical: space.sm }}>
        {message}
      </AppText>
      {onRetry ? <Button title="Try again" onPress={onRetry} variant="outline" /> : null}
    </View>
  );
}

export function EmptyView({ title, message }: { title: string; message?: string }) {
  return (
    <View style={styles.center}>
      <AppText variant="heading">{title}</AppText>
      {message ? (
        <AppText muted style={{ textAlign: 'center', marginTop: 4 }}>
          {message}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.xl,
    marginBottom: space.sm,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 36,
    borderRadius: radius.pill,
  },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, alignSelf: 'flex-start' },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.4 },
  heading: { fontSize: 17, fontWeight: '700' },
  body: { fontSize: 15.5, lineHeight: 22 },
  small: { fontSize: 13, lineHeight: 18 },
  button: {
    minHeight: TOUCH + 6,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.md,
  },
  buttonText: { fontSize: 15.5, fontWeight: '600' },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 6 },
  input: {
    minHeight: TOUCH + 8,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: space.md,
    fontSize: 16,
  },
  banner: { borderWidth: 1, borderRadius: radius.md, padding: space.sm, marginBottom: space.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.lg },
});

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/** Elevated surface. Pass onPress to make it a pressable card with press feedback. */
export function Card({
  children,
  onPress,
  style,
  tone = 'surface',
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  tone?: 'surface' | 'hero' | 'soft';
  accessibilityLabel?: string;
}) {
  const c = useColors();
  const bg = tone === 'hero' ? c.hero : tone === 'soft' ? c.primarySoft : c.surface;
  const base: ViewStyle = {
    backgroundColor: bg,
    borderRadius: radius.xl,
    padding: space.lg,
    ...(tone === 'surface' ? elevation(c, 1) : null),
  };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <PressableCard base={base} style={style} onPress={onPress} accessibilityLabel={accessibilityLabel}>
      {children}
    </PressableCard>
  );
}

const APressable = Animated2.createAnimatedComponent(Pressable);

function PressableCard({
  base,
  style,
  onPress,
  accessibilityLabel,
  children,
}: {
  base: ViewStyle;
  style?: ViewStyle;
  onPress: () => void;
  accessibilityLabel?: string;
  children: ReactNode;
}) {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <APressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onPressIn={() => {
        scale.set(withSpring(0.97, { damping: 18, stiffness: 300 }));
      }}
      onPressOut={() => {
        scale.set(withSpring(1, { damping: 14, stiffness: 260 }));
      }}
      style={[base, style, anim]}>
      {children}
    </APressable>
  );
}

export function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  const c = useColors();
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: c.text }]}>{title}</Text>
      {action && onAction ? (
        <Pressable accessibilityRole="link" onPress={onAction} hitSlop={10}>
          <Text style={{ color: c.primary, fontWeight: '700', fontSize: 13 }}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  icon,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
}) {
  const c = useColors();
  const fg = selected ? c.primaryText : c.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: selected ? c.primary : c.surface, opacity: pressed ? 0.85 : 1 },
        selected ? null : elevation(c, 1),
      ]}>
      {icon ? <Ionicons name={icon} size={14} color={fg} /> : null}
      <Text style={{ color: fg, fontWeight: '600', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

export function Badge({
  label,
  tone = 'primary',
}: {
  label: string;
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'muted';
}) {
  const c = useColors();
  const map = {
    primary: [c.primarySoft, c.primary],
    success: [c.successBg, c.successFg],
    warning: [c.warningBg, c.warningFg],
    danger: [c.dangerBg, c.dangerFg],
    info: [c.infoBg, c.infoFg],
    muted: [c.skeleton, c.textMuted],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={{ color: fg, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.4 }}>{label.toUpperCase()}</Text>
    </View>
  );
}

export function IconTile({
  icon,
  color,
  bg,
  size = 44,
}: {
  icon: IconName;
  color: string;
  bg: string;
  size?: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.36,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Ionicons name={icon} size={size * 0.46} color={color} />
    </View>
  );
}

export function ProgressBar({
  value,
  color,
  track,
  height = 8,
}: {
  /** 0..1 */
  value: number;
  color?: string;
  track?: string;
  height?: number;
}) {
  const c = useColors();
  const pct = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const w = useSharedValue(0);
  useEffect(() => {
    w.set(withTiming(pct, { duration: 700 }));
  }, [pct, w]);
  const fill = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
      style={{ height, borderRadius: height, backgroundColor: track ?? c.skeleton, overflow: 'hidden' }}>
      <Animated2.View style={[{ height: '100%', borderRadius: height, backgroundColor: color ?? c.primary }, fill]} />
    </View>
  );
}

const ACircle = Animated2.createAnimatedComponent(Circle);

/** Circular progress with animated fill. Children render centered inside. */
export function ProgressRing({
  value,
  size = 96,
  stroke = 10,
  color,
  track,
  children,
}: {
  /** 0..1 */
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: ReactNode;
}) {
  const c = useColors();
  const pct = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const p = useSharedValue(0);
  useEffect(() => {
    p.set(withTiming(pct, { duration: 900 }));
  }, [pct, p]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: circ * (1 - p.value) }));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track ?? c.skeleton} strokeWidth={stroke} fill="none" />
        <ACircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color ?? c.primary}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circ} ${circ}`}
          animatedProps={props}
          fill="none"
        />
      </Svg>
      {children}
    </View>
  );
}

export function StatTile({
  label,
  value,
  icon,
  color,
  bg,
  onPress,
}: {
  label: string;
  value: string | number;
  icon: IconName;
  color: string;
  bg: string;
  onPress?: () => void;
}) {
  const c = useColors();
  return (
    <Card onPress={onPress} style={{ flex: 1, padding: space.md, gap: 8 }} accessibilityLabel={`${label}: ${value}`}>
      <IconTile icon={icon} color={color} bg={bg} size={34} />
      <View>
        <Text style={{ color: c.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.4 }}>{value}</Text>
        <Text style={{ color: c.textMuted, fontSize: 12, fontWeight: '600' }}>{label}</Text>
      </View>
    </Card>
  );
}

/** Pill-style segmented control. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
}) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: c.skeleton, borderRadius: radius.pill, padding: 4 }}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.key)}
            style={[
              { flex: 1, height: 38, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
              on ? { backgroundColor: c.surface, ...elevation(c, 1) } : null,
            ]}>
            <Text style={{ color: on ? c.text : c.textMuted, fontWeight: '800', fontSize: 13 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Brand header used on auth screens. */
export function AuthHeader({ title, subtitle }: { title: string; subtitle: string }) {
  const c = useColors();
  return (
    <View style={{ marginBottom: space.xxl, gap: space.sm }}>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 18,
          backgroundColor: c.hero,
          alignItems: 'center',
          justifyContent: 'center',
          ...elevation(c, 2),
        }}>
        <Ionicons name="school" size={28} color={c.heroText} />
      </View>
      <Text style={{ color: c.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.8, marginTop: space.md }}>{title}</Text>
      <Text style={{ color: c.textMuted, fontSize: 15, lineHeight: 21 }}>{subtitle}</Text>
    </View>
  );
}

/** Back button + title + optional right action, used by pushed (non-tab) screens. */
export function ScreenHeader({
  title,
  subtitle,
  right,
  onBack,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onBack?: () => void;
}) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.lg }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}
        style={[
          { width: 40, height: 40, borderRadius: 20, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' },
          elevation(c, 1),
        ]}>
        <Ionicons name="arrow-back" size={20} color={c.text} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.text, fontSize: 21, fontWeight: '800', letterSpacing: -0.4 }} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ color: c.textMuted, fontSize: 12.5, fontWeight: '600' }} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}
