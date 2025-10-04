import React, { useState, useCallback, useRef } from 'react';
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
import ConnectionStatus from '../components/shared/ConnectionStatus';
import MessageBubble from '../components/chat/MessageBubble';
import MultimodalInput from '../components/chat/MultimodalInput';
import SessionIndicator from '../components/shared/SessionIndicator';
import VoiceSessionControls from '../components/voice/VoiceSessionControls';
import EmptyState from '../components/shared/EmptyState';
import { Message } from '../types/message.types';
import { useVoice } from '../hooks/useVoice';
import { Button } from '../components/ui/Button';
import { cn } from '../utils/cn';
import { Badge } from '../components/ui/Badge';
import { useColorScheme } from 'nativewind';

const ChatScreen: React.FC = () => {
  const { isConnected, sendMessage, session, endSession, messages, addMessage, updateMessageStatus } = useAgent();
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
      updateMessageStatus(tempId, 'sent');
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

  const suggestedPrompts = [
    { text: "How do I make perfect sourdough?", action: () => handleSendMessage("How do I make perfect sourdough?") },
    { text: "Show me your bread technique", action: () => handleSendMessage("Show me your bread technique") },
  ];

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

          {session.isAgentTyping && (
            <View className="px-4 pb-1 self-start">
               <Badge label="BakeBot is typing..." variant="secondary" className="bg-agentMessage dark:bg-agentMessageDark" />
            </View>
          )}
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

export default ChatScreen;