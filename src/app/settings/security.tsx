import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, View } from 'react-native';

import { changePassword, deactivateAccount, updatePreferences } from '@/api/support';
import { AppText, Button, Screen, TextField } from '@/components/ui/kit';
import { useAuth } from '@/features/auth/auth-provider';
import { radius, space, useColors } from '@/theme';

export default function SecuritySettingsScreen() {
  const c = useColors();
  const { signOut } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const pwdMut = useMutation({
    mutationFn: () =>
      changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    onSuccess: (res) => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Success', res.message || 'Password updated successfully.');
    },
    onError: (err: Error) => {
      Alert.alert('Failed to update password', err.message);
    },
  });

  const prefMut = useMutation({
    mutationFn: (enabled: boolean) =>
      updatePreferences({ notification_enabled: enabled }),
    onError: (err: Error) => {
      Alert.alert('Could not save preference', err.message);
    },
  });

  const deactivateMut = useMutation({
    mutationFn: () => deactivateAccount(),
    onSuccess: async () => {
      await signOut();
    },
    onError: (err: Error) => {
      Alert.alert('Error', err.message);
    },
  });

  const handlePasswordSubmit = () => {
    if (newPassword.length < 6) {
      Alert.alert('Invalid Password', 'New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Mismatch', 'New password and confirmation do not match.');
      return;
    }
    pwdMut.mutate();
  };

  return (
    <Screen>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={c.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <AppText variant="heading">Security & Preferences</AppText>
          <AppText variant="small" muted>
            Manage password, alerts & account status
          </AppText>
        </View>
      </View>

      {/* Preferences Card */}
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1 }}>
            <AppText style={{ fontWeight: '600' }}>Exam & Test Notifications</AppText>
            <AppText variant="small" muted>
              Receive exam date updates and daily quiz reminders
            </AppText>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={(val) => {
              setNotificationsEnabled(val);
              prefMut.mutate(val);
            }}
          />
        </View>
      </View>

      {/* Change Password Card */}
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border, gap: space.md }]}>
        <AppText variant="heading">Change Password</AppText>
        <TextField
          label="Current Password"
          placeholder="Enter current password"
          secureTextEntry
          value={currentPassword}
          onChangeText={setCurrentPassword}
        />
        <TextField
          label="New Password (min 6 characters)"
          placeholder="Enter new password"
          secureTextEntry
          value={newPassword}
          onChangeText={setNewPassword}
        />
        <TextField
          label="Confirm New Password"
          placeholder="Re-enter new password"
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />
        <Button
          title="Update Password"
          disabled={!currentPassword || !newPassword || !confirmPassword}
          loading={pwdMut.isPending}
          onPress={handlePasswordSubmit}
        />
      </View>

      {/* Danger Zone */}
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.danger, gap: space.sm }]}>
        <AppText style={{ fontWeight: '700', color: c.danger }}>Deactivate Account</AppText>
        <AppText variant="small" muted>
          Deactivating your student account will disable login until reactivated by support.
        </AppText>
        <Button
          title="Deactivate My Account"
          variant="outline"
          loading={deactivateMut.isPending}
          onPress={() =>
            Alert.alert(
              'Deactivate Account?',
              'Are you sure you want to deactivate your Examerit student account?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Deactivate',
                  style: 'destructive',
                  onPress: () => deactivateMut.mutate(),
                },
              ],
            )
          }
        />
      </View>
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
  card: {
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: space.md,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
});
