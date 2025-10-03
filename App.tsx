import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider } from './src/context/ThemeContext';
import { AgentProvider } from './src/context/AgentContext';
import ChatScreen from './src/screens/ChatScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Stack = createStackNavigator();

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AgentProvider>
        <NavigationContainer>
          <StatusBar style="auto" />
          <Stack.Navigator
            initialRouteName="Chat"
            screenOptions={{
              headerShown: false,
              gestureEnabled: true,
              gestureDirection: 'horizontal',
              animationTypeForReplace: 'push',
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen
              name="Chat"
              component={ChatScreen}
              options={{
                title: 'BakeBot',
                headerStyle: {
                  elevation: 0,
                  shadowOpacity: 0,
                },
              }}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{
                title: 'Settings',
                presentation: 'modal',
                headerStyle: {
                  elevation: 0,
                  shadowOpacity: 0,
                },
              }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </AgentProvider>
    </ThemeProvider>
  );
};

export default App;
