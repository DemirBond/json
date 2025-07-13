import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type AuthContextType = {
  isAuthenticated: boolean;
  isLoading: boolean;
  confirmationUrl: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
  clearConfirmationUrl: () => void;
  getToken: () => Promise<string | null>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmationUrl, setConfirmationUrl] = useState<string | null>(null);

  useEffect(() => {
    // Check if user is already logged in
    checkLoginStatus();
  }, []);

  const checkLoginStatus = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      setIsAuthenticated(!!token);
    } catch (error) {
      console.error('Error checking login status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch('https://cvdevaluator-api-alpha.azurewebsites.net/api/Account/authenticate', {
        method: 'POST',
        headers: {
          'accept': '*/*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          Email: email,
          Password: password
        })
      });

      if (!response.ok) {
        throw new Error('Login failed');
      }

      const data = await response.json();

      console.log('Login Response:', {
        status: response.status,
        statusText: response.statusText,
        data: data
      });
      
      // Store the token from the nested structure
      await AsyncStorage.setItem('userToken', data.Data.JWToken);
      await AsyncStorage.setItem('userEmail', data.Data.Email);
      await AsyncStorage.setItem('userName', data.Data.UserName);
      
      setIsAuthenticated(true);
      return true;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const register = async (name: string, email: string, password: string): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await fetch('https://cvdevaluator-api-alpha.azurewebsites.net/api/Account/register', {
        method: 'POST',
        headers: {
          'accept': '*/*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          Email: email,
          UserName: name,
          Password: password,
          ConfirmPassword: password
        })
      });

      const data = await response.json();
      console.log('Registration Response:', {
        status: response.status,
        statusText: response.statusText,
        data: data
      });

      if (!response.ok) {
        console.error('Registration Error Details:', {
          status: response.status,
          statusText: response.statusText,
          errorData: data
        });
        
        return {
          success: false,
          message: data.Message || 'Registration failed. Please try again.'
        };
      }

      // Store the entire message
      setConfirmationUrl(data.Message);
      
      return {
        success: true,
        message: data.Message
      };
    } catch (error) {
      console.error('Registration Error:', {
        error: error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      return {
        success: false,
        message: 'An unexpected error occurred during registration. Please try again.'
      };
    }
  };

  const logout = async (): Promise<void> => {
    try {
      // Remove the token
      await AsyncStorage.removeItem('userToken');
      await AsyncStorage.removeItem('userEmail');
      await AsyncStorage.removeItem('userName');
      
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const clearConfirmationUrl = () => {
    setConfirmationUrl(null);
  };

  const getToken = async (): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem('userToken');
    } catch (error) {
      console.error('Error getting token:', error);
      return null;
    }
  };

  return (
    <AuthContext.Provider value={{ 
      isAuthenticated, 
      isLoading, 
      confirmationUrl,
      login, 
      register, 
      logout,
      clearConfirmationUrl,
      getToken
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 