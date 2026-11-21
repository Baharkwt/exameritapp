import { Redirect } from 'expo-router';

import { useAuth } from '@/features/auth/auth-provider';

/**
 * Guarded (Stack.Protected) routes are "unmatched" while signed out, e.g. right
 * after sign-out when the URL is still "/". Send the user to the right place
 * instead of showing the "Unmatched Route" screen.
 */
export default function NotFound() {
  const { user } = useAuth();
  return <Redirect href={user ? '/' : '/login'} />;
}
