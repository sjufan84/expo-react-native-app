/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Comprehensive error recovery and retry system for BakeBot
 */

// Error categories for classification and recovery strategies
export type ErrorCategory =
  | 'network'           // Network connectivity issues
  | 'permission'        // Permission denied errors
  | 'hardware'          // Microphone/camera hardware issues
  | 'service'           // External service failures (LiveKit, AI)
  | 'session'           // Session management errors
  | 'media'             // Image/audio processing errors
  | 'validation'        // Data validation errors
  | 'system'            // System-level errors
  | 'user_action'       // Errors requiring user intervention
  | 'unknown';          // Unclassified errors

// Error severity levels for user experience prioritization
export type ErrorSeverity =
  | 'low'       // Non-critical, can retry automatically
  | 'medium'    // Affects functionality but app remains usable
  | 'high'      // Major impact, requires immediate attention
  | 'critical'; // App becomes unusable

// Error recovery strategies
export type RecoveryStrategy =
  | 'exponential_backoff'    // Retry with exponential backoff
  | 'linear_retry'           // Retry with fixed intervals
  | 'immediate_retry'        // Retry immediately once
  | 'circuit_breaker'        // Stop trying after threshold
  | 'user_intervention'      // Require user action
  | 'graceful_degradation'   // Fallback to limited functionality
  | 'restart_session'        // Restart current session
  | 'manual_retry_only';     // Only allow manual retries

// Error types with specific recovery policies
export interface ErrorType {
  id: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  recoveryStrategy: RecoveryStrategy;
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  userMessage: string;
  userActionRequired?: boolean;
  canAutoRecover: boolean;
  affectsConnectivity: boolean;
  affectsMedia: boolean;
  isPermanent: boolean;
  triggersCircuitBreaker: boolean;
}

// Specific error instances
export interface AppError {
  id: string;
  type: ErrorType;
  originalError: Error | string;
  context: ErrorContext;
  timestamp: Date;
  attemptCount: number;
  nextRetryAt?: Date;
  isPermanentFailure: boolean;
  metadata?: Record<string, any>;
}

// Error context for better classification and recovery
export interface ErrorContext {
  operation: string;
  component: string;
  userId?: string;
  sessionId?: string;
  messageId?: string;
  networkInfo?: NetworkInfo;
  deviceInfo?: DeviceInfo;
  sessionState?: string;
  additionalData?: Record<string, any>;
}

// Network information for error context
export interface NetworkInfo {
  isConnected: boolean;
  connectionType: string;
  isInternetReachable: boolean;
  strength?: number;
}

// Device information for error context
export interface DeviceInfo {
  platform: string;
  version: string;
  appVersion: string;
  hasMicrophone: boolean;
  hasCamera: boolean;
  storageAvailable: boolean;
  memoryUsage?: number;
}

// Circuit breaker state
export interface CircuitBreakerState {
  isOpen: boolean;
  failureCount: number;
  lastFailureTime: Date;
  nextAttemptTime: Date;
  threshold: number;
  timeoutMs: number;
}

// Error recovery configuration
export interface ErrorRecoveryConfig {
  circuitBreaker: {
    threshold: number;        // Number of failures before opening
    timeoutMs: number;        // Time to wait before attempting again
    resetAfterMs: number;     // Time after which to reset failure count
  };
  retention: {
    errorHistoryHours: number;    // How long to keep error history
    maxErrorsInMemory: number;    // Max errors to keep in memory
    persistCriticalErrors: boolean; // Whether to persist critical errors
  };
  retry: {
    defaultMaxRetries: number;
    defaultBaseDelay: number;
    defaultMaxDelay: number;
    jitterFactor: number;
  };
  monitoring: {
    enableAnalytics: boolean;
    enableLogging: boolean;
    logLevel: 'error' | 'warn' | 'info' | 'debug';
    maxLogEntries: number;
  };
}

// Error recovery statistics
export interface ErrorRecoveryStats {
  totalErrors: number;
  errorsByCategory: Record<ErrorCategory, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  recoverySuccessRate: number;
  averageRecoveryTime: number;
  circuitBreakerActivations: number;
  activeErrors: number;
  permanentFailures: number;
  autoRecoveredErrors: number;
  userRecoveredErrors: number;
  lastUpdated: Date;
}

// Error recovery action result
export interface RecoveryActionResult {
  success: boolean;
  error?: AppError;
  action: string;
  timestamp: Date;
  duration: number;
  nextAction?: string;
  requiresUserAction: boolean;
  userMessage?: string;
}

// Error listener interface
export interface ErrorListener {
  onErrorOccurred: (error: AppError) => void;
  onErrorRecovered: (error: AppError, result: RecoveryActionResult) => void;
  onErrorPermanent: (error: AppError) => void;
  onCircuitBreakerStateChange: (state: CircuitBreakerState) => void;
}

// Error recovery manager interface
export interface ErrorRecoveryManager {
  handleError: (error: Error | string, context: ErrorContext) => Promise<AppError>;
  recoverError: (errorId: string) => Promise<RecoveryActionResult>;
  retryError: (errorId: string, strategy?: RecoveryStrategy) => Promise<boolean>;
  markErrorPermanent: (errorId: string) => Promise<void>;
  getErrorHistory: (categoryId?: ErrorCategory) => AppError[];
  getActiveErrors: () => AppError[];
  getCircuitBreakerState: (category?: ErrorCategory) => CircuitBreakerState;
  getStats: () => ErrorRecoveryStats;
  clearErrorHistory: (olderThanHours?: number) => Promise<void>;
  resetCircuitBreaker: (category?: ErrorCategory) => void;
  addListener: (listener: ErrorListener) => void;
  removeListener: (listener: ErrorListener) => void;
}

// Predefined error types with their recovery policies
export const ERROR_TYPES: Record<string, ErrorType> = {
  // Network errors
  NETWORK_CONNECTION_LOST: {
    id: 'NETWORK_CONNECTION_LOST',
    category: 'network',
    severity: 'high',
    recoveryStrategy: 'exponential_backoff',
    maxRetries: 5,
    baseDelay: 2000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    userMessage: 'Network connection lost. Attempting to reconnect...',
    canAutoRecover: true,
    affectsConnectivity: true,
    affectsMedia: false,
    isPermanent: false,
    triggersCircuitBreaker: false,
  },

  NETWORK_TIMEOUT: {
    id: 'NETWORK_TIMEOUT',
    category: 'network',
    severity: 'medium',
    recoveryStrategy: 'exponential_backoff',
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    userMessage: 'Connection timed out. Retrying...',
    canAutoRecover: true,
    affectsConnectivity: true,
    affectsMedia: false,
    isPermanent: false,
    triggersCircuitBreaker: false,
  },

  // LiveKit service errors
  LIVEKIT_CONNECTION_FAILED: {
    id: 'LIVEKIT_CONNECTION_FAILED',
    category: 'service',
    severity: 'high',
    recoveryStrategy: 'exponential_backoff',
    maxRetries: 5,
    baseDelay: 3000,
    maxDelay: 60000,
    backoffMultiplier: 2,
    userMessage: 'Unable to connect to voice service. Retrying...',
    canAutoRecover: true,
    affectsConnectivity: true,
    affectsMedia: true,
    isPermanent: false,
    triggersCircuitBreaker: true,
  },

  LIVEKIT_ROOM_NOT_FOUND: {
    id: 'LIVEKIT_ROOM_NOT_FOUND',
    category: 'service',
    severity: 'high',
    recoveryStrategy: 'restart_session',
    maxRetries: 2,
    baseDelay: 5000,
    maxDelay: 15000,
    backoffMultiplier: 1.5,
    userMessage: 'Session room not found. Restarting session...',
    canAutoRecover: true,
    affectsConnectivity: true,
    affectsMedia: true,
    isPermanent: false,
    triggersCircuitBreaker: false,
  },

  LIVEKIT_TOKEN_EXPIRED: {
    id: 'LIVEKIT_TOKEN_EXPIRED',
    category: 'service',
    severity: 'high',
    recoveryStrategy: 'manual_retry_only',
    maxRetries: 1,
    baseDelay: 1000,
    maxDelay: 5000,
    backoffMultiplier: 1,
    userMessage: 'Session expired. Please reconnect.',
    userActionRequired: true,
    canAutoRecover: false,
    affectsConnectivity: true,
    affectsMedia: true,
    isPermanent: false,
    triggersCircuitBreaker: false,
  },

  // Permission errors
  MICROPHONE_PERMISSION_DENIED: {
    id: 'MICROPHONE_PERMISSION_DENIED',
    category: 'permission',
    severity: 'high',
    recoveryStrategy: 'user_intervention',
    maxRetries: 0,
    baseDelay: 0,
    maxDelay: 0,
    backoffMultiplier: 1,
    userMessage: 'Microphone permission is required for voice features.',
    userActionRequired: true,
    canAutoRecover: false,
    affectsConnectivity: false,
    affectsMedia: true,
    isPermanent: true,
    triggersCircuitBreaker: false,
  },

  CAMERA_PERMISSION_DENIED: {
    id: 'CAMERA_PERMISSION_DENIED',
    category: 'permission',
    severity: 'high',
    recoveryStrategy: 'user_intervention',
    maxRetries: 0,
    baseDelay: 0,
    maxDelay: 0,
    backoffMultiplier: 1,
    userMessage: 'Camera permission is required to share images.',
    userActionRequired: true,
    canAutoRecover: false,
    affectsConnectivity: false,
    affectsMedia: true,
    isPermanent: true,
    triggersCircuitBreaker: false,
  },

  // Hardware errors
  MICROPHONE_UNAVAILABLE: {
    id: 'MICROPHONE_UNAVAILABLE',
    category: 'hardware',
    severity: 'high',
    recoveryStrategy: 'graceful_degradation',
    maxRetries: 2,
    baseDelay: 2000,
    maxDelay: 5000,
    backoffMultiplier: 1,
    userMessage: 'Microphone is unavailable. You can still use text chat.',
    canAutoRecover: true,
    affectsConnectivity: false,
    affectsMedia: true,
    isPermanent: false,
    triggersCircuitBreaker: false,
  },

  CAMERA_UNAVAILABLE: {
    id: 'CAMERA_UNAVAILABLE',
    category: 'hardware',
    severity: 'medium',
    recoveryStrategy: 'graceful_degradation',
    maxRetries: 2,
    baseDelay: 2000,
    maxDelay: 5000,
    backoffMultiplier: 1,
    userMessage: 'Camera is unavailable. You can still use voice and text.',
    canAutoRecover: true,
    affectsConnectivity: false,
    affectsMedia: true,
    isPermanent: false,
    triggersCircuitBreaker: false,
  },

  // Media processing errors
  IMAGE_PROCESSING_FAILED: {
    id: 'IMAGE_PROCESSING_FAILED',
    category: 'media',
    severity: 'medium',
    recoveryStrategy: 'immediate_retry',
    maxRetries: 2,
    baseDelay: 1000,
    maxDelay: 3000,
    backoffMultiplier: 1,
    userMessage: 'Failed to process image. Retrying...',
    canAutoRecover: true,
    affectsConnectivity: false,
    affectsMedia: true,
    isPermanent: false,
    triggersCircuitBreaker: false,
  },

  IMAGE_TOO_LARGE: {
    id: 'IMAGE_TOO_LARGE',
    category: 'validation',
    severity: 'medium',
    recoveryStrategy: 'user_intervention',
    maxRetries: 0,
    baseDelay: 0,
    maxDelay: 0,
    backoffMultiplier: 1,
    userMessage: 'Image is too large. Please select a smaller image.',
    userActionRequired: true,
    canAutoRecover: false,
    affectsConnectivity: false,
    affectsMedia: false,
    isPermanent: true,
    triggersCircuitBreaker: false,
  },

  AUDIO_RECORDING_FAILED: {
    id: 'AUDIO_RECORDING_FAILED',
    category: 'media',
    severity: 'medium',
    recoveryStrategy: 'immediate_retry',
    maxRetries: 3,
    baseDelay: 1500,
    maxDelay: 5000,
    backoffMultiplier: 1.5,
    userMessage: 'Voice recording failed. Please try again.',
    canAutoRecover: true,
    affectsConnectivity: false,
    affectsMedia: true,
    isPermanent: false,
    triggersCircuitBreaker: false,
  },

  // Session management errors
  SESSION_SYNC_FAILED: {
    id: 'SESSION_SYNC_FAILED',
    category: 'session',
    severity: 'medium',
    recoveryStrategy: 'linear_retry',
    maxRetries: 3,
    baseDelay: 2000,
    maxDelay: 8000,
    backoffMultiplier: 1,
    userMessage: 'Session synchronization issues. Attempting to recover...',
    canAutoRecover: true,
    affectsConnectivity: false,
    affectsMedia: false,
    isPermanent: false,
    triggersCircuitBreaker: false,
  },

  SESSION_INVALID_STATE: {
    id: 'SESSION_INVALID_STATE',
    category: 'session',
    severity: 'high',
    recoveryStrategy: 'restart_session',
    maxRetries: 2,
    baseDelay: 3000,
    maxDelay: 10000,
    backoffMultiplier: 1,
    userMessage: 'Session state is invalid. Restarting session...',
    canAutoRecover: true,
    affectsConnectivity: true,
    affectsMedia: true,
    isPermanent: false,
    triggersCircuitBreaker: false,
  },

  // Data channel errors
  DATA_CHANNEL_FAILED: {
    id: 'DATA_CHANNEL_FAILED',
    category: 'service',
    severity: 'medium',
    recoveryStrategy: 'exponential_backoff',
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 15000,
    backoffMultiplier: 2,
    userMessage: 'Message delivery failed. Retrying...',
    canAutoRecover: true,
    affectsConnectivity: false,
    affectsMedia: false,
    isPermanent: false,
    triggersCircuitBreaker: false,
  },

  // Voice synthesis errors
  VOICE_SYNTHESIS_FAILED: {
    id: 'VOICE_SYNTHESIS_FAILED',
    category: 'service',
    severity: 'low',
    recoveryStrategy: 'graceful_degradation',
    maxRetries: 1,
    baseDelay: 1000,
    maxDelay: 2000,
    backoffMultiplier: 1,
    userMessage: 'Voice response unavailable. Showing text response.',
    canAutoRecover: true,
    affectsConnectivity: false,
    affectsMedia: true,
    isPermanent: false,
    triggersCircuitBreaker: false,
  },

  // System errors
  STORAGE_FULL: {
    id: 'STORAGE_FULL',
    category: 'system',
    severity: 'high',
    recoveryStrategy: 'user_intervention',
    maxRetries: 0,
    baseDelay: 0,
    maxDelay: 0,
    backoffMultiplier: 1,
    userMessage: 'Device storage is full. Please free up space.',
    userActionRequired: true,
    canAutoRecover: false,
    affectsConnectivity: false,
    affectsMedia: true,
    isPermanent: true,
    triggersCircuitBreaker: false,
  },

  MEMORY_LOW: {
    id: 'MEMORY_LOW',
    category: 'system',
    severity: 'medium',
    recoveryStrategy: 'graceful_degradation',
    maxRetries: 1,
    baseDelay: 2000,
    maxDelay: 5000,
    backoffMultiplier: 1,
    userMessage: 'Device memory is low. Some features may be limited.',
    canAutoRecover: true,
    affectsConnectivity: false,
    affectsMedia: true,
    isPermanent: false,
    triggersCircuitBreaker: false,
  },

  // Generic fallback
  UNKNOWN_ERROR: {
    id: 'UNKNOWN_ERROR',
    category: 'unknown',
    severity: 'medium',
    recoveryStrategy: 'immediate_retry',
    maxRetries: 2,
    baseDelay: 1000,
    maxDelay: 3000,
    backoffMultiplier: 1,
    userMessage: 'An unexpected error occurred. Retrying...',
    canAutoRecover: true,
    affectsConnectivity: false,
    affectsMedia: false,
    isPermanent: false,
    triggersCircuitBreaker: false,
  },
};

// Helper functions for error type matching
export function matchErrorType(error: Error | string): ErrorType {
  const errorMessage = typeof error === 'string' ? error.toLowerCase() : error.message.toLowerCase();

  // Network errors
  if (errorMessage.includes('network') || errorMessage.includes('connection') || errorMessage.includes('offline')) {
    if (errorMessage.includes('timeout')) return ERROR_TYPES.NETWORK_TIMEOUT;
    return ERROR_TYPES.NETWORK_CONNECTION_LOST;
  }

  // LiveKit errors
  if (errorMessage.includes('livekit') || errorMessage.includes('room') || errorMessage.includes('token')) {
    if (errorMessage.includes('not found')) return ERROR_TYPES.LIVEKIT_ROOM_NOT_FOUND;
    if (errorMessage.includes('token') && errorMessage.includes('expir')) return ERROR_TYPES.LIVEKIT_TOKEN_EXPIRED;
    if (errorMessage.includes('connect')) return ERROR_TYPES.LIVEKIT_CONNECTION_FAILED;
  }

  // Permission errors
  if (errorMessage.includes('permission') || errorMessage.includes('denied') || errorMessage.includes('unauthorized')) {
    if (errorMessage.includes('microphone') || errorMessage.includes('audio')) return ERROR_TYPES.MICROPHONE_PERMISSION_DENIED;
    if (errorMessage.includes('camera') || errorMessage.includes('photo')) return ERROR_TYPES.CAMERA_PERMISSION_DENIED;
  }

  // Hardware errors
  if (errorMessage.includes('microphone') && errorMessage.includes('unavailable')) return ERROR_TYPES.MICROPHONE_UNAVAILABLE;
  if (errorMessage.includes('camera') && errorMessage.includes('unavailable')) return ERROR_TYPES.CAMERA_UNAVAILABLE;

  // Media errors
  if (errorMessage.includes('image') && errorMessage.includes('process')) return ERROR_TYPES.IMAGE_PROCESSING_FAILED;
  if (errorMessage.includes('image') && errorMessage.includes('large')) return ERROR_TYPES.IMAGE_TOO_LARGE;
  if (errorMessage.includes('audio') || errorMessage.includes('record')) return ERROR_TYPES.AUDIO_RECORDING_FAILED;
  if (errorMessage.includes('voice') && errorMessage.includes('synthesis')) return ERROR_TYPES.VOICE_SYNTHESIS_FAILED;

  // Session errors
  if (errorMessage.includes('session') && errorMessage.includes('sync')) return ERROR_TYPES.SESSION_SYNC_FAILED;
  if (errorMessage.includes('session') && errorMessage.includes('state')) return ERROR_TYPES.SESSION_INVALID_STATE;

  // Data channel errors
  if (errorMessage.includes('data') && errorMessage.includes('channel')) return ERROR_TYPES.DATA_CHANNEL_FAILED;

  // System errors
  if (errorMessage.includes('storage') && errorMessage.includes('full')) return ERROR_TYPES.STORAGE_FULL;
  if (errorMessage.includes('memory') || errorMessage.includes('low')) return ERROR_TYPES.MEMORY_LOW;

  // Default fallback
  return ERROR_TYPES.UNKNOWN_ERROR;
}

export function createErrorContext(
  operation: string,
  component: string,
  additionalData?: Record<string, any>
): ErrorContext {
  return {
    operation,
    component,
    timestamp: new Date().toISOString(),
    ...additionalData,
  } as ErrorContext;
}