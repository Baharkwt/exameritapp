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

import { radius, space, TOUCH, useColors } from '@/theme';

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
  ...props
}: TextInputProps & { label: string; error?: string | null }) {
  const c = useColors();
  return (
    <View style={{ marginBottom: space.md }}>
      <Text style={[styles.label, { color: c.text }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={c.textMuted}
        {...props}
        style={[
          styles.input,
          {
            backgroundColor: c.inputBg,
            color: c.text,
            borderColor: error ? c.danger : c.border,
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
  title: { fontSize: 23, fontWeight: '700', letterSpacing: -0.2 },
  heading: { fontSize: 17, fontWeight: '700' },
  body: { fontSize: 15.5, lineHeight: 22 },
  small: { fontSize: 13, lineHeight: 18 },
  button: {
    minHeight: TOUCH + 4,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.md,
  },
  buttonText: { fontSize: 15.5, fontWeight: '600' },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  input: {
    minHeight: TOUCH + 4,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    fontSize: 16,
  },
  banner: { borderWidth: 1, borderRadius: radius.md, padding: space.sm, marginBottom: space.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.lg },
});
