import React from 'react';
import { View, Text } from 'react-native';
import { useAgent } from '../../context/AgentContext';
import { useVoice } from '../../hooks/useVoice';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';

interface VoiceSessionControlsProps {
  onEndSession: () => void;
}

const VoiceSessionControls: React.FC<VoiceSessionControlsProps> = ({ onEndSession }) => {
  const { session, updateSession } = useAgent();
  const voice = useVoice();

  const formatDuration = (startTime: Date | null): string => {
    if (!startTime) return '0:00';
    const seconds = Math.floor((Date.now() - startTime.getTime()) / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleToggleMute = () => {
    const newMutedState = !session.isMuted;
    updateSession({ isMuted: newMutedState });
    voice.toggleMute(newMutedState);
  };

  const handleToggleVoiceMode = () => {
    const newMode = session.voiceMode === 'push-to-talk' ? 'continuous' : 'push-to-talk';
    updateSession({ voiceMode: newMode });
    voice.setVoiceMode(newMode);
  };

  return (
    <View
      className={cn(
        'flex-row items-center justify-between px-4 py-3',
        'border-t border-border bg-backgroundSecondary',
        'dark:border-borderDark dark:bg-backgroundSecondaryDark'
      )}
    >
      <View className="flex-row items-center gap-3">
        <View className="h-2.5 w-2.5 rounded-full bg-success" />
        <View>
          <Text className="text-sm font-semibold text-text dark:text-textDark">
            {session.type === 'voice-ptt' ? 'Voice (PTT)' : 'Voice (VAD)'}
          </Text>
          <Text className="text-xs text-textSecondary dark:text-textSecondaryDark">
            {formatDuration(session.startedAt)}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center gap-2">
        <Button
          variant={session.isMuted ? 'destructive' : 'outline'}
          size="icon"
          onPress={handleToggleMute}
          className="h-10 w-10 rounded-full"
        >
          <Text className={cn('text-lg', !session.isMuted && 'text-text dark:text-textDark')}>
            {session.isMuted ? '🔇' : '🎤'}
          </Text>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onPress={handleToggleVoiceMode}
          className="h-10 rounded-full px-3"
        >
          <Text className="text-xs font-bold text-text dark:text-textDark">
            {session.voiceMode === 'push-to-talk' ? 'PTT' : 'VAD'}
          </Text>
        </Button>

        <Button
          variant="destructive"
          size="sm"
          onPress={onEndSession}
          className="h-10 rounded-full px-4"
        >
          <Text className="text-sm font-semibold text-white">End</Text>
        </Button>
      </View>
    </View>
  );
};

export default VoiceSessionControls;