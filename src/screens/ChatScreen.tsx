
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Alert,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAgent } from '../context/AgentContext';
import { ThemeProvider } from '../context/ThemeContext';
import ConnectionStatus from '../components/shared/ConnectionStatus';
import MessageBubble from '../components/chat/MessageBubble';
import MultimodalInput from '../components/chat/MultimodalInput';
import SessionIndicator from '../components/shared/SessionIndicator';
import VoiceSessionControls from '../components/voice/VoiceSessionControls';
import { Message } from '../types/message.types';
import { useVoice } from '../hooks/useVoice';

const ChatScreen: React.FC = () => {
  const { theme } = useTheme();
  const { isConnected, sendMessage, session, endSession } = useAgent();
  const voice = useVoice();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isAgentTyping, setIsAgentTyping] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();

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
  const handleSendMessage = useCallback(async (text: string) => {
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

  // Handle sending a voice message
  const handleSendVoiceMessage = useCallback(() => {
    addMessage('Voice message sent', 'user', 'voice');
    // Simulate agent response
    setTimeout(() => {
      addMessage('I heard your voice message! How can I help with your cooking?', 'agent');
    }, 1000);
  }, [addMessage]);

  // Handle typing indicators
  const handleTypingStart = useCallback(() => {
    if (!isTyping) {
      setIsTyping(true);
      // In a real implementation, you would send a typing event to the agent here
    }
  }, [isTyping]);

  const handleTypingEnd = useCallback(() => {
    if (isTyping) {
      setIsTyping(false);
    }
  }, [isTyping]);

  // Handle settings button press
  const handleSettingsPress = () => {
    // Navigate to settings (to be implemented)
    Alert.alert('Settings', 'Settings screen coming soon!');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }] } edges={['top','bottom']}>
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
      <View style={[styles.header, { borderBottomColor: theme.colors.border, paddingTop: Math.max(insets.top * 0.25, 4) }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            BakeBot
          </Text>
          <SessionIndicator
            sessionType={session.type}
            sessionState={session.state}
            isRecording={voice.isRecording}
          />
        </View>
        <View style={styles.headerRight}>
          {session.state === 'active' && (
            <TouchableOpacity
              style={[styles.endSessionButton, { backgroundColor: theme.colors.error }]}
              onPress={endSession}
              activeOpacity={0.85}
            >
              <Text style={styles.endSessionText}>End</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.settingsButton} onPress={handleSettingsPress}>
            <Text style={[styles.settingsText, { color: theme.colors.textSecondary }]}>
              ⚙️
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Messages Area */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : -insets.bottom}
      >
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
                  onPress={() => handleSendMessage("How do I make perfect sourdough?")}
                >
                  <Text style={[styles.promptText, { color: theme.colors.text }]}>
                    "How do I make perfect sourdough?"
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.promptButton, { backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border }]}
                  onPress={() => handleSendMessage("Show me your bread technique")}
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
              onContentSizeChange={scrollToBottom}
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
        </View>

        {/* Voice Session Controls */}
        {session.state === 'active' && (session.type === 'voice-ptt' || session.type === 'voice-vad') && (
          <View style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
            <VoiceSessionControls onEndSession={endSession} />
          </View>
        )}

        {/* Input */}
        {session.state !== 'active' || session.type === 'text' ? (
          <MultimodalInput
            onSendMessage={handleSendMessage}
            onSendVoiceMessage={handleSendVoiceMessage}
            onTypingStart={handleTypingStart}
            onTypingEnd={handleTypingEnd}
            placeholder="Ask BakeBot..."
            maxLength={1000}
            disabled={!isConnected}
          />
        ) : null}
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  endSessionButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  endSessionText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 12,
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