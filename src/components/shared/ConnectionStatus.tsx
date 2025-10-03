import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAgent } from '../../context/AgentContext';

interface ConnectionStatusProps {
  visible?: boolean;
  onRetry?: () => void;
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  visible = true,
  onRetry
}) => {
  const { theme } = useTheme();
  const { connectionState, error } = useAgent();
  const [fadeAnim] = useState(new Animated.Value(0));
  const [showStatus, setShowStatus] = useState(false);

  // Determine if status should be shown
  useEffect(() => {
    const shouldShow = visible && (
      connectionState === 'CONNECTING' ||
      connectionState === 'RECONNECTING' ||
      connectionState === 'FAILED' ||
      error !== null
    );

    if (shouldShow !== showStatus) {
      setShowStatus(shouldShow);

      if (shouldShow) {
        // Fade in
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      } else {
        // Fade out
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }
    }
  }, [visible, connectionState, error, showStatus, fadeAnim]);

  if (!showStatus) {
    return null;
  }

  const getStatusConfig = () => {
    switch (connectionState) {
      case 'CONNECTING':
      case 'RECONNECTING':
        return {
          color: theme.colors.connecting,
          text: connectionState === 'RECONNECTING' ? 'Reconnecting...' : 'Connecting...',
          icon: '🔄',
          showRetry: false,
        };
      case 'FAILED':
        return {
          color: theme.colors.failed,
          text: error || 'Connection failed',
          icon: '❌',
          showRetry: true,
        };
      default:
        return {
          color: theme.colors.text,
          text: 'Unknown status',
          icon: '❓',
          showRetry: false,
        };
    }
  };

  const config = getStatusConfig();

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    }
    // You could implement auto-reconnect logic here
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: config.color + '15', // Add transparency
          borderColor: config.color,
          opacity: fadeAnim,
        }
      ]}
    >
      <View style={styles.statusContainer}>
        <Text style={styles.icon}>{config.icon}</Text>
        <Text style={[styles.statusText, { color: config.color }]}>
          {config.text}
        </Text>
        {config.showRetry && (
          <TouchableOpacity
            style={[styles.retryButton, { borderColor: config.color }]}
            onPress={handleRetry}
          >
            <Text style={[styles.retryText, { color: config.color }]}>
              Retry
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    borderBottomWidth: 1,
    zIndex: 1000,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 8,
  },
  icon: {
    fontSize: 16,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  retryButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 60,
    alignItems: 'center',
  },
  retryText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default ConnectionStatus;