import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, StyleSheet, Switch, View } from 'react-native';

import { changePassword, deactivateAccount, updatePreferences } from '@/api/support';
import { AppText, Button, Card, Screen, ScreenHeader, TextField } from '@/components/ui/kit';
import { useAuth } from '@/features/auth/auth-provider';
import { space, useColors } from '@/theme';

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
      <ScreenHeader title="Security & preferences" subtitle="Password, alerts and account" />

      {/* Preferences Card */}
      <Card style={{ marginBottom: space.md }}>
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
      </Card>

      {/* Change Password Card */}
      <Card style={{ gap: space.md, marginBottom: space.md }}>
        <AppText variant="heading">Change password</AppText>
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
      </Card>

      {/* Danger Zone */}
      <Card style={{ gap: space.sm, borderWidth: 1.5, borderColor: c.danger }}>
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
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
});
