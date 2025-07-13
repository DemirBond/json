import { View, Text, StyleSheet, Image } from 'react-native';
import { useEffect } from 'react';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../contexts/AuthContext';

export default function SplashScreen() {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    // Navigate to appropriate screen after 2 seconds
    const timer = setTimeout(() => {
      if (isAuthenticated) {
        router.replace('/(tabs)');
      } else {
        router.replace('/(auth)/login');
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [isAuthenticated]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Image
        source={require('../assets/icons/logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.title}>CVD Evaluator</Text>
      <Text style={styles.subtitle}>Your Health Companion</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#4A90E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 200,
    height: 200,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 20,
  },
  subtitle: {
    fontSize: 18,
    color: '#FFFFFF',
    opacity: 0.8,
  },
}); 