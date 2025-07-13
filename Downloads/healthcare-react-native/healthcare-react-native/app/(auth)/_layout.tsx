// app/(auth)/_layout.tsx
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      {/* This now correctly maps to app/(auth)/confirmation.tsx */}
      <Stack.Screen name="confirmation" /> 
    </Stack>
  );
}