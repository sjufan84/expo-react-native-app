/* eslint-disable no-undef */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Alert,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAgent } from '../context/AgentContext';
import { useVoice } from '../hooks/useVoice';
import { ThemeProvider } from '../context/ThemeContext';
import VoiceControls from '../components/voice/VoiceControls';
import ConnectionStatus from '../components/shared/ConnectionStatus';
import MessageBubble from '../components/chat/MessageBubble';
import MessageInput from '../components/chat/MessageInput';
import { Message } from '../types/message.types';

const ChatScreen: React.FC = () => {
  const { theme } = useTheme();
  const { isConnected, connectionState, agentStatus, connect, sendMessage } = useAgent();
  const voice = useVoice();
  const [messages, setMessages] = useState<Message[]>([]);
  const [showVoiceControls, setShowVoiceControls] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isAgentTyping, setIsAgentTyping] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();

  // Note: Audio initialization will be handled when we have actual LiveKit room connection
  // For now, we'll simulate voice functionality

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  // Add a message to the chat
  const addMessage = useCallback((content: string, sender: 'user' | 'agent', type: 'text' | 'image' | 'voice' = 'text', status: 'sending' | 'sent' | 'failed' = 'sent') => {
    const newMessage: Message = {
      id: Date.now().toString(),
      sender,
      content,
      timestamp: new Date(),
      status,
      type,
    };
    setMessages(prev => [...prev, newMessage]);

    // Auto-scroll to new message
    scrollToBottom();
  }, [scrollToBottom]);

  // Send text message via LiveKit
  const sendTextMessage = useCallback(async (text: string) => {
    if (!isConnected) {
      Alert.alert('Not Connected', 'Please wait for the connection to be established.');
      return;
    }

    // Add message with "sending" status
    const userMessage: Message = {
      id: Date.now().toString(),
      sender: 'user',
      content: text,
      timestamp: new Date(),
      status: 'sending',
      type: 'text',
    };
    setMessages(prev => [...prev, userMessage]);
    scrollToBottom();

    try {
      // Send message via LiveKit
      await sendMessage(text, 'text');

      // Update message status to "sent"
      setMessages(prev =>
        prev.map(msg =>
          msg.id === userMessage.id
            ? { ...msg, status: 'sent' as const }
            : msg
        )
      );

      // Simulate agent response (for demo purposes)
      // In real implementation, this would come from the agent via LiveKit
      setTimeout(() => {
        addMessage(`I received your message: "${text}". How can I help you with that?`, 'agent', 'text');
      }, 1000 + Math.random() * 2000); // Random delay between 1-3 seconds

    } catch (error) {
      console.error('Failed to send message:', error);
      // Update message status to "failed"
      setMessages(prev =>
        prev.map(msg =>
          msg.id === userMessage.id
            ? { ...msg, status: 'failed' as const }
            : msg
        )
      );
      Alert.alert('Send Failed', 'Failed to send message. Please try again.');
    }
  }, [isConnected, sendMessage, addMessage, scrollToBottom]);

  // Handle typing indicators
  const handleTypingStart = useCallback(() => {
    if (!isTyping) {
      setIsTyping(true);
      // Send typing indicator to agent (for demo purposes)
      // In real implementation, this would be sent via LiveKit
    }
  }, [isTyping]);

  const handleTypingEnd = useCallback(() => {
    if (isTyping) {
      setIsTyping(false);
    }
  }, [isTyping]);

  // Handle voice recording completion - add voice message when recording stops
  useEffect(() => {
    const wasRecording = voice.isRecording;

    return () => {
      // When recording stops, add a voice message
      if (wasRecording && !voice.isRecording) {
        addMessage('Voice message recorded', 'user', 'voice');

        // Simulate agent response
        setTimeout(() => {
          addMessage('I heard your voice message! How can I help with your cooking?', 'agent');
        }, 1000);
      }
    };
  }, [voice.isRecording, addMessage]);

  // Handle settings button press
  const handleSettingsPress = () => {
    // Navigate to settings (to be implemented)
    Alert.alert('Settings', 'Settings screen coming soon!');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar
        barStyle={theme.colors.background === '#ffffff' ? 'dark-content' : 'light-content'}
        backgroundColor={theme.colors.background}
      />

      {/* Connection Status Banner */}
      <ConnectionStatus
        onRetry={() => {
          if (!isConnected) {
            // For now, we'll show an alert since connect() requires a token
            Alert.alert('Connection', 'LiveKit connection requires a server token. Please implement backend authentication.');
          }
        }}
      />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          BakeBot
        </Text>
        <TouchableOpacity style={styles.settingsButton} onPress={handleSettingsPress}>
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
              <TouchableOpacity
                style={[styles.promptButton, { backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border }]}
                onPress={() => sendTextMessage("How do I make perfect sourdough?")}
              >
                <Text style={[styles.promptText, { color: theme.colors.text }]}>
                  "How do I make perfect sourdough?"
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.promptButton, { backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border }]}
                onPress={() => sendTextMessage("Show me your bread technique")}
              >
                <Text style={[styles.promptText, { color: theme.colors.text }]}>
                  "Show me your bread technique"
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <MessageBubble
                message={item}
                isUser={item.sender === 'user'}
                showAvatar={true}
                showTimestamp={true}
                onPress={() => {
                  // Handle message press (e.g., copy, reply)
                  console.log('Message pressed:', item);
                }}
                onLongPress={() => {
                  Alert.alert(
                    'Message Options',
                    `From: ${item.sender === 'user' ? 'You' : 'BakeBot'}\nTime: ${item.timestamp.toLocaleTimeString()}`,
                    [
                      { text: 'Copy', onPress: () => console.log('Copy message') },
                      { text: 'Delete', onPress: () => console.log('Delete message'), style: 'destructive' },
                      { text: 'Cancel', style: 'cancel' },
                    ]
                  );
                }}
              />
            )}
            style={styles.messagesList}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => {
              // Auto-scroll when content size changes
              if (messages.length > 0) {
                scrollToBottom();
              }
            }}
          />
        )}

        {/* Agent typing indicator */}
        {isAgentTyping && (
          <View style={[styles.typingIndicator, { backgroundColor: theme.colors.backgroundSecondary }]}>
            <Text style={[styles.typingText, { color: theme.colors.textSecondary }]}>
              👨‍🍳 BakeBot is typing
              <Text style={styles.typingDots}>.</Text>
              <Text style={styles.typingDots}>.</Text>
              <Text style={styles.typingDots}>.</Text>
            </Text>
          </View>
        )}

        {/* Voice recording indicator */}
        {voice.isRecording && (
          <View style={[styles.recordingIndicator, { backgroundColor: theme.colors.backgroundSecondary }]}>
            <Text style={[styles.recordingText, { color: theme.colors.text }]}>
              🎤 Recording... {Math.floor(voice.recordingDuration / 1000)}s
            </Text>
            <Text style={[styles.recordingHint, { color: theme.colors.textSecondary }]}>
              {voice.voiceMode === 'push-to-talk' ? 'Release to send' : 'Tap to stop'}
            </Text>
          </View>
        )}
      </View>

      {/* Input Area */}
      {showVoiceControls ? (
        <VoiceControls
          mode={voice.voiceMode}
          onModeChange={(mode) => voice.setVoiceMode(mode)}
          showModeSelector={true}
          compact={false}
        />
      ) : (
        <MessageInput
          onSendMessage={sendTextMessage}
          onTypingStart={handleTypingStart}
          onTypingEnd={handleTypingEnd}
          placeholder="Ask BakeBot about cooking..."
          maxLength={1000}
          disabled={!isConnected}
        />
      )}

      {/* Voice mode toggle when voice controls are hidden */}
      {!showVoiceControls && (
        <View style={[styles.voiceToggleRow, { borderTopColor: theme.colors.border, paddingBottom: Math.max(insets.bottom + 8, 20) }]}>
          <TouchableOpacity
            style={[
              styles.voiceToggle,
              voice.voiceMode === 'push-to-talk' && {
                backgroundColor: theme.colors.primary,
              }
            ]}
            onPress={() => {
              voice.setVoiceMode('push-to-talk');
              setShowVoiceControls(true);
            }}
          >
            <Text style={[
              styles.voiceToggleText,
              { color: voice.voiceMode === 'push-to-talk' ? 'white' : theme.colors.text }
            ]}>
              🎙️ Push to Talk
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.voiceToggle,
              voice.voiceMode === 'continuous' && {
                backgroundColor: theme.colors.primary,
              }
            ]}
            onPress={() => {
              voice.setVoiceMode('continuous');
              setShowVoiceControls(true);
            }}
          >
            <Text style={[
              styles.voiceToggleText,
              { color: voice.voiceMode === 'continuous' ? 'white' : theme.colors.text }
            ]}>
              🔄 Continuous
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.collapseButton, { backgroundColor: theme.colors.backgroundSecondary }]}
            onPress={() => setShowVoiceControls(false)}
          >
            <Text style={[styles.collapseButtonText, { color: theme.colors.textSecondary }]}>
              ▼
            </Text>
          </TouchableOpacity>
        </View>
      )}
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
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    gap: 8,
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  typingText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  typingDots: {
    fontSize: 14,
    fontStyle: 'italic',
    opacity: 0.6,
  },
    recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  recordingText: {
    fontSize: 14,
    fontWeight: '600',
  },
  recordingHint: {
    fontSize: 12,
  },
    voiceToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    gap: 8,
  },
  voiceToggle: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignItems: 'center',
  },
  voiceToggleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  collapseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  collapseButtonText: {
    fontSize: 12,
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