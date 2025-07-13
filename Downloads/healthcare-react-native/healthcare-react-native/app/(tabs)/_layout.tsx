// app/(tabs)/_layout.tsx
import { Tabs, router, Href } from 'expo-router'; // Import Href if needed for other router calls
import React from 'react';
import { Platform, TouchableOpacity, Text, StyleSheet, View, ViewStyle, TextStyle, GestureResponderEvent } from 'react-native'; // Import necessary style types
import { IconSymbol } from '@/components/ui/IconSymbol';

import { HapticTab } from '@/components/HapticTab';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '../../contexts/AuthContext';

// Define a type for the tabBarIcon props
interface TabBarIconProps {
  color: string;
  focused: boolean;
}

export default function TabLayout() {
  const colorScheme = useColorScheme() ?? 'light';
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme].tint,
        headerShown: false, 
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: {
          height: 60, 
          paddingBottom: Platform.OS === 'ios' ? 5 : 8, 
          paddingTop: 8,
          backgroundColor: colorScheme === 'dark' ? Colors.dark.background : Colors.light.background,
        },
      }}>
      <Tabs.Screen
        name="index" 
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }: TabBarIconProps) => ( // Typed props
            <IconSymbol size={focused ? 30 : 28} name="house.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="add-evaluation-tab-dummy" 
        listeners={{
          tabPress: (e: GestureResponderEvent | any) => { // Typed event or any if specific type is complex/unknown
            e.preventDefault(); 
            router.push({ pathname: '/add-evaluation' }); 
          },
        }}
        options={{
          title: 'Add',
          tabBarIcon: ({ color, focused }: TabBarIconProps) => ( // Typed props, color might not be used here
            <View style={styles.addTabButton as ViewStyle}> {/* Cast style */}
              <IconSymbol size={focused ? 32 : 30} name="plus" color={"#FFFFFF"} />
            </View>
          ),
          tabBarLabel: () => <Text style={{ color: Colors[colorScheme].tint, fontSize: 10 }}>Add</Text>,
        }}
      />
      <Tabs.Screen
        name="profile" 
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }: TabBarIconProps) => ( // Typed props
            <IconSymbol size={focused ? 30 : 28} name="person.fill" color={color} />
          ),
          headerShown: true, 
          headerTitle: 'Profile',
          headerStyle: { 
            backgroundColor: colorScheme === 'dark' ? Colors.dark.background : Colors.light.background,
          },
          headerTitleStyle: {
            color: colorScheme === 'dark' ? Colors.dark.text : Colors.light.text,
            fontWeight: 'bold',
          },
          headerRight: () => (
            // Cast the style prop for TouchableOpacity
            <TouchableOpacity onPress={handleLogout} style={styles.logoutButton as ViewStyle}>
              {/* Use the logoutTextStyle from StyleSheet directly */}
              <Text style={styles.logoutTextStyle}>Logout</Text>
            </TouchableOpacity>
          ),
        }}
      />
    </Tabs>
  );
}

// Define StyleSheet with explicit types for styles that are functions or complex
interface AppStyles {
  logoutButton: ViewStyle;
  logoutTextStyle: TextStyle; // Changed from a function to a direct style object
  addTabButton: ViewStyle;
}

const styles = StyleSheet.create<AppStyles>({
  logoutButton: {
    marginRight: 15,
    padding: 5,
  },
  // If logoutText color needs to be dynamic based on theme, it's better to apply it inline
  // or pass the color to a component. For simplicity, making it fixed or using ThemedText.
  // Here, we make it a simple TextStyle. The color will be determined by the ThemeProvider context if using ThemedText,
  // or you can set it dynamically inline.
  logoutTextStyle: { // Changed to a direct style object
    color: '#4A90E2', // Defaulting to a common link color, adjust as needed or use ThemedText
    fontSize: 16,
    fontWeight: 'bold',
  },
  addTabButton: { 
    backgroundColor: '#4A90E2', 
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Platform.OS === 'ios' ? 15 : 25, 
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});