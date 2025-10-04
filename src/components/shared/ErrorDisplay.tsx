import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Vibration,
  StyleSheet,
  Animated,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAgent } from '../../context/AgentContext';
import {
  AppError,
  ErrorSeverity,
  ErrorCategory,
  RecoveryStrategy,
  CircuitBreakerState,
  RecoveryActionResult,
} from '../../types/error.types';

interface ErrorDisplayProps {
  visible?: boolean;
  maxHeight?: number;
  showOnlyCritical?: boolean;
  allowManualRecovery?: boolean;
}

interface ErrorItemProps {
  error: AppError;
  onRecover: (errorId: string) => Promise<RecoveryActionResult>;
  onRetry: (errorId: string) => Promise<boolean>;
  onDismiss: (errorId: string) => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

/**
 * Individual error item component
 */
const ErrorItem: React.FC<ErrorItemProps> = ({
  error,
  onRecover,
  onRetry,
  onDismiss,
  isExpanded = false,
  onToggleExpand,
}) => {
  const theme = useTheme();
  const [isRecovering, setIsRecovering] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const fadeAnim = React.useRef(new Animated.Value(1)).current;

  const getSeverityColor = (severity: ErrorSeverity) => {
    switch (severity) {
      case 'critical':
        return theme.colors.error;
      case 'high':
        return theme.colors.error;
      case 'medium':
        return theme.colors.warning;
      case 'low':
        return theme.colors.info;
      default:
        return theme.colors.text;
    }
  };

  const getCategoryIcon = (category: ErrorCategory) => {
    switch (category) {
      case 'network':
        return '🌐';
      case 'permission':
        return '🔒';
      case 'hardware':
        return '📱';
      case 'service':
        return '⚙️';
      case 'session':
        return '🔄';
      case 'media':
        return '📷';
      case 'validation':
        return '⚠️';
      case 'system':
        return '💻';
      case 'user_action':
        return '👤';
      default:
        return '❓';
    }
  };

  const handleRecover = async () => {
    if (isRecovering || isRetrying) return;

    setIsRecovering(true);
    Vibration.vibrate(50);

    try {
      const result = await onRecover(error.id);

      if (result.success) {
        // Animate out on success
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          onDismiss(error.id);
        });
      } else {
        // Show failure message
        Alert.alert('Recovery Failed', result.userMessage || 'Unable to recover from this error automatically.');
      }
    } catch (error) {
      Alert.alert('Recovery Error', 'An error occurred during recovery process.');
    } finally {
      setIsRecovering(false);
    }
  };

  const handleRetry = async () => {
    if (isRecovering || isRetrying) return;

    setIsRetrying(true);
    Vibration.vibrate(50);

    try {
      const success = await onRetry(error.id);

      if (success) {
        // Animate out on success
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          onDismiss(error.id);
        });
      } else {
        Alert.alert('Retry Failed', 'Retry attempt failed. You may need to try again later.');
      }
    } catch (error) {
      Alert.alert('Retry Error', 'An error occurred during retry.');
    } finally {
      setIsRetrying(false);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const canRecover = error.type.canAutoRecover && !error.isPermanentFailure;
  const canRetry = !error.isPermanentFailure && error.attemptCount < error.type.maxRetries;

  return (
    <Animated.View
      style={[
        styles.errorItem,
        {
          backgroundColor: theme.colors.card,
          borderColor: getSeverityColor(error.type.severity),
          opacity: fadeAnim,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.errorHeader}
        onPress={onToggleExpand}
        activeOpacity={0.7}
      >
        <View style={styles.errorHeaderLeft}>
          <Text style={styles.categoryIcon}>{getCategoryIcon(error.type.category)}</Text>
          <View style={styles.errorTitleContainer}>
            <Text
              style={[
                styles.errorTitle,
                { color: theme.colors.text, fontWeight: '600' },
              ]}
              numberOfLines={1}
            >
              {error.type.id.replace(/_/g, ' ').toUpperCase()}
            </Text>
            <Text
              style={[
                styles.errorTime,
                { color: theme.colors.textSecondary },
              ]}
            >
              {formatTime(error.timestamp)}
            </Text>
          </View>
        </View>

        <View style={styles.errorHeaderRight}>
          {error.attemptCount > 0 && (
            <View style={styles.attemptBadge}>
              <Text style={[styles.attemptText, { color: theme.colors.text }]}>
                {error.attemptCount}/{error.type.maxRetries}
              </Text>
            </View>
          )}
          <Text style={[styles.expandIcon, { color: theme.colors.textSecondary }]}>
            {isExpanded ? '▼' : '▶'}
          </Text>
        </View>
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.errorDetails}>
          <Text
            style={[
              styles.errorMessage,
              { color: theme.colors.text },
            ]}
          >
            {error.type.userMessage}
          </Text>

          <View style={styles.errorMeta}>
            <Text style={[styles.metaText, { color: theme.colors.textSecondary }]}>
              Category: {error.type.category}
            </Text>
            <Text style={[styles.metaText, { color: theme.colors.textSecondary }]}>
              Severity: {error.type.severity}
            </Text>
            {error.context.operation && (
              <Text style={[styles.metaText, { color: theme.colors.textSecondary }]}>
                Operation: {error.context.operation}
              </Text>
            )}
          </View>

          {(canRecover || canRetry) && (
            <View style={styles.actionButtons}>
              {canRecover && (
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    styles.recoverButton,
                    { backgroundColor: theme.colors.primary },
                  ]}
                  onPress={handleRecover}
                  disabled={isRecovering}
                >
                  <Text style={[styles.actionButtonText, { color: theme.colors.background }]}>
                    {isRecovering ? 'Recovering...' : 'Recover'}
                  </Text>
                </TouchableOpacity>
              )}

              {canRetry && (
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    styles.retryButton,
                    { backgroundColor: theme.colors.secondary },
                  ]}
                  onPress={handleRetry}
                  disabled={isRetrying}
                >
                  <Text style={[styles.actionButtonText, { color: theme.colors.background }]}>
                    {isRetrying ? 'Retrying...' : 'Retry'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {error.isPermanentFailure && (
            <View style={styles.permanentErrorContainer}>
              <Text style={[styles.permanentErrorText, { color: theme.colors.error }]}>
                ⚠️ This error requires manual intervention
              </Text>
            </View>
          )}
        </View>
      )}
    </Animated.View>
  );
};

/**
 * Main Error Display Component
 */
export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  visible = true,
  maxHeight = 300,
  showOnlyCritical = false,
  allowManualRecovery = true,
}) => {
  const theme = useTheme();
  const { activeErrors, recoverError, retryError, clearActiveErrors } = useAgent();
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());
  const [showDetails, setShowDetails] = useState(false);

  // Filter errors based on props
  const filteredErrors = activeErrors.filter(error => {
    if (showOnlyCritical) {
      return error.type.severity === 'critical' || error.type.severity === 'high';
    }
    return true;
  });

  const hasCriticalErrors = activeErrors.some(error =>
    error.type.severity === 'critical' || error.type.severity === 'high'
  );

  const toggleErrorExpansion = (errorId: string) => {
    setExpandedErrors(prev => {
      const newSet = new Set(prev);
      if (newSet.has(errorId)) {
        newSet.delete(errorId);
      } else {
        newSet.add(errorId);
      }
      return newSet;
    });
  };

  const handleDismissError = (errorId: string) => {
    setExpandedErrors(prev => {
      const newSet = new Set(prev);
      newSet.delete(errorId);
      return newSet;
    });
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear All Errors',
      'Are you sure you want to clear all error history?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: clearActiveErrors,
        },
      ]
    );
  };

  if (!visible || filteredErrors.length === 0) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Error Summary Bar */}
      <TouchableOpacity
        style={[
          styles.summaryBar,
          {
            backgroundColor: hasCriticalErrors ? theme.colors.error : theme.colors.warning,
          },
        ]}
        onPress={() => setShowDetails(!showDetails)}
        activeOpacity={0.8}
      >
        <View style={styles.summaryContent}>
          <Text style={[styles.summaryText, { color: theme.colors.background }]}>
            {hasCriticalErrors ? '⚠️' : '⚡'} {filteredErrors.length} error{filteredErrors.length !== 1 ? 's' : ''}
            {hasCriticalErrors && ' (Critical)'}
          </Text>
          <Text style={[styles.summarySubtext, { color: theme.colors.background }]}>
            Tap to {showDetails ? 'hide' : 'show'} details
          </Text>
        </View>
        <Text style={[styles.summaryArrow, { color: theme.colors.background }]}>
          {showDetails ? '▼' : '▶'}
        </Text>
      </TouchableOpacity>

      {/* Error Details */}
      {showDetails && (
        <View style={styles.detailsContainer}>
          <View style={styles.detailsHeader}>
            <Text style={[styles.detailsTitle, { color: theme.colors.text }]}>
              Error Details
            </Text>
            {allowManualRecovery && (
              <TouchableOpacity
                style={[
                  styles.clearAllButton,
                  { backgroundColor: theme.colors.error },
                ]}
                onPress={handleClearAll}
              >
                <Text style={[styles.clearAllText, { color: theme.colors.background }]}>
                  Clear All
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <ScrollView
            style={[styles.errorsList, { maxHeight }]}
            showsVerticalScrollIndicator={true}
          >
            {filteredErrors.map(error => (
              <ErrorItem
                key={error.id}
                error={error}
                onRecover={recoverError}
                onRetry={retryError}
                onDismiss={handleDismissError}
                isExpanded={expandedErrors.has(error.id)}
                onToggleExpand={() => toggleErrorExpansion(error.id)}
              />
            ))}
          </ScrollView>

          {filteredErrors.length === 0 && (
            <View style={styles.noErrorsContainer}>
              <Text style={[styles.noErrorsText, { color: theme.colors.textSecondary }]}>
                No active errors
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

/**
 * Compact Error Indicator for Status Bar
 */
export const ErrorIndicator: React.FC<{ onPress?: () => void }> = ({ onPress }) => {
  const theme = useTheme();
  const { activeErrors } = useAgent();

  const criticalErrors = activeErrors.filter(error =>
    error.type.severity === 'critical' || error.type.severity === 'high'
  );

  if (activeErrors.length === 0) {
    return null;
  }

  return (
    <TouchableOpacity
      style={[
        styles.indicator,
        {
          backgroundColor: criticalErrors.length > 0 ? theme.colors.error : theme.colors.warning,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.indicatorText, { color: theme.colors.background }]}>
        {criticalErrors.length > 0 ? '!' : '⚡'} {activeErrors.length}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  summaryBar: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryContent: {
    flex: 1,
  },
  summaryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  summarySubtext: {
    fontSize: 12,
    opacity: 0.8,
    marginTop: 2,
  },
  summaryArrow: {
    fontSize: 16,
    fontWeight: '600',
  },
  detailsContainer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingBottom: 8,
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  clearAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  clearAllText: {
    fontSize: 12,
    fontWeight: '600',
  },
  errorsList: {
    paddingHorizontal: 16,
  },
  errorItem: {
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden',
  },
  errorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  errorHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  errorTitleContainer: {
    flex: 1,
  },
  errorTitle: {
    fontSize: 14,
  },
  errorTime: {
    fontSize: 12,
    marginTop: 2,
  },
  errorHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  attemptBadge: {
    backgroundColor: 'rgba(0,0,0,0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  attemptText: {
    fontSize: 10,
    fontWeight: '600',
  },
  expandIcon: {
    fontSize: 12,
  },
  errorDetails: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  errorMessage: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  errorMeta: {
    marginBottom: 12,
  },
  metaText: {
    fontSize: 12,
    marginBottom: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  recoverButton: {
    // backgroundColor set by theme
  },
  retryButton: {
    // backgroundColor set by theme
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  permanentErrorContainer: {
    backgroundColor: 'rgba(255,0,0,0.1)',
    padding: 8,
    borderRadius: 6,
  },
  permanentErrorText: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  noErrorsContainer: {
    padding: 40,
    alignItems: 'center',
  },
  noErrorsText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  indicator: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: -2,
    right: -2,
    zIndex: 1,
  },
  indicatorText: {
    fontSize: 10,
    fontWeight: '700',
  },
});

export default ErrorDisplay;