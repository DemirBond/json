import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

export default function ConfirmationScreen() {
  const { confirmationUrl, clearConfirmationUrl } = useAuth();

  const handleContinue = () => {
    clearConfirmationUrl();
    router.replace('/(auth)/login');
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <MaterialIcons name="email" size={64} color="#4CAF50" />
        <Text style={styles.title}>Registration Successful!</Text>
        
        <View style={styles.messageContainer}>
          <Text style={styles.message}>
            {confirmationUrl}
          </Text>
        </View>

        <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
          <Text style={styles.continueButtonText}>Continue to Login</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
    textAlign: 'center',
  },
  messageContainer: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    width: '100%',
  },
  message: {
    fontSize: 14,
    color: '#333333',
    textAlign: 'center',
    lineHeight: 20,
  },
  continueButton: {
    marginTop: 20,
    padding: 12,
  },
  continueButtonText: {
    color: '#2196F3',
    fontWeight: 'bold',
  },
}); 