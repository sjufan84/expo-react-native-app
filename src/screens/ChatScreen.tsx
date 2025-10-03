import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { ThemeProvider } from '../context/ThemeContext';
import { Message } from '../types/message.types';

const ChatScreen: React.FC = () => {
  const { theme } = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar
        barStyle={theme.colors.background === '#ffffff' ? 'dark-content' : 'light-content'}
        backgroundColor={theme.colors.background}
      />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          BakeBot
        </Text>
        <TouchableOpacity style={styles.settingsButton}>
          <Text style={[styles.settingsText, { color: theme.colors.textSecondary }]}>
            ⚙️
          </Text>
        </TouchableOpacity>
      </View>

      {/* Messages Area */}
      <View style={[styles.messagesContainer, { backgroundColor: theme.colors.background }]}>
        {messages.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyStateTitle, { color: theme.colors.text }]}>
              👋 Welcome to BakeBot!
            </Text>
            <Text style={[styles.emptyStateSubtitle, { color: theme.colors.textSecondary }]}>
              I'm your AI sous chef. How can I help you today?
            </Text>
            <View style={styles.suggestedPrompts}>
              <TouchableOpacity style={[styles.promptButton, { backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border }]}>
                <Text style={[styles.promptText, { color: theme.colors.text }]}>
                  "How do I make perfect sourdough?"
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.promptButton, { backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border }]}>
                <Text style={[styles.promptText, { color: theme.colors.text }]}>
                  "Show me your bread technique"
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <Text style={[styles.placeholderText, { color: theme.colors.textMuted }]}>
            Messages will appear here...
          </Text>
        )}
      </View>

      {/* Input Area */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.inputContainer, { borderTopColor: theme.colors.border }]}
      >
        <View style={[styles.inputRow, { backgroundColor: theme.colors.backgroundSecondary }]}>
          <TouchableOpacity style={styles.attachButton}>
            <Text style={styles.attachIcon}>📷</Text>
          </TouchableOpacity>

          <View style={[styles.textInputContainer, { backgroundColor: theme.colors.background }]}>
            <Text style={[styles.placeholderText, { color: theme.colors.textMuted }]}>
              Type a message...
            </Text>
          </View>

          <TouchableOpacity style={[styles.voiceButton, { backgroundColor: theme.colors.voiceInactive }]}>
            <Text style={styles.voiceIcon}>🎤</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.sendButton, { backgroundColor: theme.colors.primary }]}>
            <Text style={styles.sendIcon}>➤</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  settingsButton: {
    padding: 8,
  },
  settingsText: {
    fontSize: 20,
  },
  messagesContainer: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
  },
  suggestedPrompts: {
    gap: 12,
  },
  promptButton: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 16,
  },
  promptText: {
    fontSize: 14,
    textAlign: 'center',
  },
  placeholderText: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  inputContainer: {
    borderTopWidth: 1,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
  },
  attachButton: {
    padding: 8,
  },
  attachIcon: {
    fontSize: 20,
  },
  textInputContainer: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    minHeight: 44,
  },
  voiceButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceIcon: {
    fontSize: 18,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendIcon: {
    fontSize: 16,
    color: 'white',
    fontWeight: '700',
  },
});

// Wrapper component with ThemeProvider
const ChatScreenWithTheme: React.FC = () => {
  return (
    <ThemeProvider>
      <ChatScreen />
    </ThemeProvider>
  );
};

export default ChatScreenWithTheme;