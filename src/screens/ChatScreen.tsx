import React, { useCallback, useRef } from 'react';
import {
  View,
  Text,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Alert,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAgent } from '../context/AgentContext';
import { useTheme } from '../context/ThemeContext';
import ConnectionStatus from '../components/shared/ConnectionStatus';
import MessageBubble from '../components/chat/MessageBubble';
import MultimodalInput from '../components/chat/MultimodalInput';
import SessionIndicator from '../components/shared/SessionIndicator';
import VoiceSessionControls from '../components/voice/VoiceSessionControls';
import TypingIndicator from '../components/chat/TypingIndicator';
import EmptyState from '../components/shared/EmptyState';
import { Message } from '../types/message.types';
import { useVoice } from '../hooks/useVoice';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useColorScheme } from 'nativewind';

const ChatScreen: React.FC = () => {
  const { theme } = useTheme();
  const { isConnected, sendMessage, session, endSession, typingState, sendAgentTypingIndicator, messages, addMessage, updateMessageStatus } = useAgent();
  const { colorScheme } = useColorScheme();
  const voice = useVoice();
  const flatListRef = useRef<FlatList>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  const handleSendMessage = useCallback(async (text: string) => {
    if (!isConnected) {
      Alert.alert('Not Connected', 'Please wait for connection.');
      return;
    }
    const tempId = `msg_${Date.now()}`;
    addMessage({
      id: tempId,
      sender: 'user',
      content: text,
      timestamp: new Date(),
      status: 'sending',
      type: 'text',
    });
    scrollToBottom();

    try {
      await sendMessage(text, 'text');
<<<<<<< HEAD

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

      // Show agent typing indicator
      setTimeout(() => {
        sendAgentTypingIndicator(true);
      }, 500); // Start typing after 500ms

      // Send actual response after typing period
      setTimeout(() => {
        addMessage(`I received your message: "${text}". How can I help you with that?`, 'agent', 'text');
        sendAgentTypingIndicator(false); // Stop typing indicator
      }, 1500 + Math.random() * 2000); // Random delay between 1.5-3.5 seconds

=======
      updateMessageStatus(tempId, 'sent');
>>>>>>> 945da23834d50220991d0f9469e1e334868cbf0d
    } catch (error) {
      console.error('Failed to send message:', error);
      updateMessageStatus(tempId, 'failed');
      Alert.alert('Send Failed', 'Could not send message. Please try again.');
    }
  }, [isConnected, sendMessage, addMessage, updateMessageStatus, scrollToBottom]);

  const handleSendVoiceMessage = useCallback(() => {
    addMessage({
      id: `msg_${Date.now()}`,
      sender: 'user',
      content: 'Voice message',
      timestamp: new Date(),
      status: 'sent',
      type: 'voice',
    });
  }, [addMessage]);

<<<<<<< HEAD
  // Handle typing indicators - these are now handled by the AgentContext and MultimodalInput
  const handleTypingStart = useCallback(() => {
    // This callback is mainly for legacy compatibility
    // Actual typing indicators are now managed through AgentContext
    console.log('User typing started');
  }, []);

  const handleTypingEnd = useCallback(() => {
    // This callback is mainly for legacy compatibility
    // Actual typing indicators are now managed through AgentContext
    console.log('User typing ended');
  }, []);

  // Handle settings button press
  const handleSettingsPress = () => {
    // Navigate to settings (to be implemented)
    Alert.alert('Settings', 'Settings screen coming soon!');
  };
=======
  const suggestedPrompts = [
    { text: "How do I make perfect sourdough?", action: () => handleSendMessage("How do I make perfect sourdough?") },
    { text: "Show me your bread technique", action: () => handleSendMessage("Show me your bread technique") },
  ];
>>>>>>> 945da23834d50220991d0f9469e1e334868cbf0d

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-backgroundDark" edges={['top', 'bottom']}>
      <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
      <ConnectionStatus onRetry={() => Alert.alert('Retry', 'Implement retry logic.')} />

      <View className="flex-row items-center justify-between px-4 py-2 border-b border-border dark:border-borderDark">
        <View className="flex-row items-center gap-3">
          <Text className="text-xl font-bold text-text dark:text-textDark">BakeBot</Text>
          <SessionIndicator sessionType={session.type} sessionState={session.state} isRecording={voice.isRecording} />
        </View>
        <View className="flex-row items-center gap-2">
          {session.state === 'active' && <Button variant="destructive" size="sm" onPress={endSession}>End</Button>}
          <Button variant="ghost" size="icon" onPress={() => Alert.alert('Settings', 'Settings screen coming soon!')}>
            <Text className="text-xl">⚙️</Text>
          </Button>
        </View>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.select({ ios: 0, android: -500 })}
      >
        <View className="flex-1 justify-between">
          {messages.length === 0 ? (
            <EmptyState
              title="👋 Welcome to BakeBot!"
              subtitle="I'm your AI sous chef. How can I help you today?"
              prompts={suggestedPrompts}
            />
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <MessageBubble message={item} isUser={item.sender === 'user'} />
              )}
              contentContainerStyle={{ paddingVertical: 8, gap: 4 }}
              onContentSizeChange={scrollToBottom}
              onLayout={scrollToBottom}
              showsVerticalScrollIndicator={false}
            />
          )}

<<<<<<< HEAD
          {/* Typing Indicators */}
          <TypingIndicator
            typingState={typingState}
            showUserTyping={false} // Hide user typing indicator in chat (it's shown in input)
            isUser={false}
          />
=======
          {session.isAgentTyping && (
            <View className="px-4 pb-1 self-start">
               <Badge label="BakeBot is typing..." variant="secondary" className="bg-agentMessage dark:bg-agentMessageDark" />
            </View>
          )}
>>>>>>> 945da23834d50220991d0f9469e1e334868cbf0d
        </View>

        {session.state === 'active' && (session.type === 'voice-ptt' || session.type === 'voice-vad') ? (
          <VoiceSessionControls onEndSession={endSession} />
        ) : (
          <MultimodalInput
            onSendMessage={handleSendMessage}
            onSendVoiceMessage={handleSendVoiceMessage}
            placeholder="Ask BakeBot..."
            disabled={!isConnected}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

<<<<<<< HEAD
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
=======
export default ChatScreen;
>>>>>>> 945da23834d50220991d0f9469e1e334868cbf0d
