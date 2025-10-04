import React, { useEffect, useState, useRef } from 'react';
import { View, Text, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAgent } from '../../context/AgentContext';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';

interface ConnectionStatusProps {
  onRetry?: () => void;
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ onRetry }) => {
  const { connectionState, error } = useAgent();
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const shouldBeVisible =
      connectionState === 'CONNECTING' ||
      connectionState === 'RECONNECTING' ||
      connectionState === 'FAILED';

    if (shouldBeVisible !== isVisible) {
      setIsVisible(shouldBeVisible);
      Animated.timing(anim, {
        toValue: shouldBeVisible ? 1 : 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [connectionState, isVisible, anim]);

  if (!isVisible) {
    return null;
  }

  const getConfig = () => {
    switch (connectionState) {
      case 'CONNECTING':
      case 'RECONNECTING':
        return {
          variant: 'default' as const,
          text: connectionState === 'RECONNECTING' ? 'Reconnecting...' : 'Connecting...',
          icon: '🔄',
          showRetry: false,
        };
      case 'FAILED':
        return {
          variant: 'destructive' as const,
          text: error || 'Connection failed',
          icon: '❌',
          showRetry: !!onRetry,
        };
      default: // Should not happen if visibility logic is correct
        return {
          variant: 'default' as const,
          text: 'Unknown status',
          icon: '❓',
          showRetry: false,
        };
    }
  };

  const config = getConfig();

  const containerClasses = cn(
    'absolute top-0 left-0 right-0 z-50 border-b',
    {
      'bg-warning/10 border-warning': config.variant === 'default',
      'bg-destructive/10 border-destructive': config.variant === 'destructive',
    }
  );

  const textClasses = cn('text-sm font-semibold', {
    'text-warning': config.variant === 'default',
    'text-destructive': config.variant === 'destructive',
  });

  return (
    <Animated.View
      style={[{ paddingTop: insets.top, opacity: anim, transform: [{
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [-50, 0],
        })
      }] }]}
      className={containerClasses}
    >
      <View className="flex-row items-center justify-center gap-2 px-4 py-2">
        <Text className="text-base">{config.icon}</Text>
        <Text className={cn(textClasses, 'flex-1')}>{config.text}</Text>
        {config.showRetry && (
          <Button
            variant={config.variant}
            size="sm"
            onPress={onRetry}
            className="h-auto rounded-full px-3 py-1"
          >
            Retry
          </Button>
        )}
      </View>
    </Animated.View>
  );
};

export default ConnectionStatus;