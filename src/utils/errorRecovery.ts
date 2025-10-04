import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AppError,
  ErrorType,
  ErrorContext,
  ErrorCategory,
  RecoveryStrategy,
  ErrorSeverity,
  CircuitBreakerState,
  ErrorRecoveryConfig,
  ErrorRecoveryStats,
  RecoveryActionResult,
  ErrorListener,
  ErrorRecoveryManager,
  matchErrorType,
  createErrorContext,
  ERROR_TYPES,
} from '../types/error.types';

/**
 * Comprehensive Error Recovery Manager with Circuit Breaker Pattern
 *
 * Features:
 * - Error classification and categorization
 * - Automatic retry with different strategies
 * - Circuit breaker pattern to prevent cascading failures
 * - Error monitoring and analytics
 * - User-friendly error messages and recovery guidance
 */
export class ErrorRecoverySystem implements ErrorRecoveryManager {
  private errors: Map<string, AppError> = new Map();
  private circuitBreakers: Map<ErrorCategory, CircuitBreakerState> = new Map();
  private listeners: Set<ErrorListener> = new Set();
  private config: ErrorRecoveryConfig;
  private retryTimers: Map<string, NodeJS.Timeout> = new Map();
  private stats: ErrorRecoveryStats;
  private static readonly STORAGE_KEY = '@bakebot_error_recovery';
  private static readonly CIRCUIT_BREAKER_KEY = '@bakebot_circuit_breakers';

  constructor(config?: Partial<ErrorRecoveryConfig>) {
    this.config = {
      circuitBreaker: {
        threshold: 5,           // 5 failures before opening circuit
        timeoutMs: 30000,       // Wait 30 seconds before attempting again
        resetAfterMs: 300000,   // Reset failure count after 5 minutes
        ...config?.circuitBreaker,
      },
      retention: {
        errorHistoryHours: 24,
        maxErrorsInMemory: 100,
        persistCriticalErrors: true,
        ...config?.retention,
      },
      retry: {
        defaultMaxRetries: 3,
        defaultBaseDelay: 1000,
        defaultMaxDelay: 30000,
        jitterFactor: 0.25,
        ...config?.retry,
      },
      monitoring: {
        enableAnalytics: true,
        enableLogging: true,
        logLevel: 'warn',
        maxLogEntries: 1000,
        ...config?.monitoring,
      },
      ...config,
    };

    this.stats = this.initializeStats();
    this.initializeCircuitBreakers();
    this.loadPersistedData();
  }

  /**
   * Handle a new error with automatic recovery
   */
  async handleError(error: Error | string, context: ErrorContext): Promise<AppError> {
    const errorType = matchErrorType(error);
    const appError: AppError = {
      id: this.generateErrorId(),
      type: errorType,
      originalError: error,
      context,
      timestamp: new Date(),
      attemptCount: 0,
      isPermanentFailure: false,
      metadata: {
        errorMessage: typeof error === 'string' ? error : error.message,
        errorStack: typeof error === 'object' ? error.stack : undefined,
      },
    };

    // Store the error
    this.errors.set(appError.id, appError);
    this.updateStats(appError);

    // Check circuit breaker
    if (this.isCircuitBreakerOpen(errorType.category)) {
      appError.isPermanentFailure = true;
      appError.metadata!.circuitBreakerOpen = true;
      this.logError('Circuit breaker open for category', errorType.category, appError);
      this.notifyErrorOccurred(appError);
      return appError;
    }

    // Check if error is permanent
    if (errorType.isPermanent) {
      appError.isPermanentFailure = true;
      this.logError('Permanent error detected', errorType.id, appError);
      this.notifyErrorOccurred(appError);
      this.persistError(appError);
      return appError;
    }

    // Log error
    this.logError('Error occurred', errorType.id, appError);

    // Notify listeners
    this.notifyErrorOccurred(appError);

    // Start recovery process
    if (errorType.canAutoRecover) {
      await this.startRecovery(appError);
    }

    // Persist if critical
    if (errorType.severity === 'critical' && this.config.retention.persistCriticalErrors) {
      this.persistError(appError);
    }

    return appError;
  }

  /**
   * Manually recover a specific error
   */
  async recoverError(errorId: string): Promise<RecoveryActionResult> {
    const error = this.errors.get(errorId);
    if (!error) {
      return {
        success: false,
        error: undefined,
        action: 'recover_error',
        timestamp: new Date(),
        duration: 0,
        userMessage: 'Error not found',
      };
    }

    const startTime = Date.now();
    this.logError('Manual recovery initiated', error.type.id, error);

    try {
      const result = await this.executeRecovery(error, 'manual_retry');
      const duration = Date.now() - startTime;

      if (result.success) {
        this.notifyErrorRecovered(error, result);
        await this.removeError(errorId);
      }

      return { ...result, duration };
    } catch (recoveryError) {
      const duration = Date.now() - startTime;
      this.logError('Manual recovery failed', error.type.id, error, recoveryError);

      return {
        success: false,
        error,
        action: 'recover_error',
        timestamp: new Date(),
        duration,
        userMessage: 'Recovery failed. Please try again later.',
      };
    }
  }

  /**
   * Retry a specific error with optional strategy override
   */
  async retryError(errorId: string, strategy?: RecoveryStrategy): Promise<boolean> {
    const error = this.errors.get(errorId);
    if (!error || error.isPermanentFailure) {
      return false;
    }

    // Override strategy if provided
    if (strategy) {
      error.type = { ...error.type, recoveryStrategy: strategy };
    }

    // Check if we can retry
    if (error.attemptCount >= error.type.maxRetries) {
      error.isPermanentFailure = true;
      this.notifyErrorPermanent(error);
      return false;
    }

    return this.startRecovery(error);
  }

  /**
   * Mark an error as permanently failed
   */
  async markErrorPermanent(errorId: string): Promise<void> {
    const error = this.errors.get(errorId);
    if (error) {
      error.isPermanentFailure = true;
      this.notifyErrorPermanent(error);
      this.persistError(error);
    }
  }

  /**
   * Get error history
   */
  getErrorHistory(categoryId?: ErrorCategory): AppError[] {
    const errors = Array.from(this.errors.values());

    if (categoryId) {
      return errors.filter(error => error.type.category === categoryId);
    }

    return errors.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get currently active errors
   */
  getActiveErrors(): AppError[] {
    return Array.from(this.errors.values())
      .filter(error => !error.isPermanentFailure)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get circuit breaker state
   */
  getCircuitBreakerState(category?: ErrorCategory): CircuitBreakerState {
    if (category) {
      return this.circuitBreakers.get(category) || this.createCircuitBreaker(category);
    }

    // Return overall state (most critical)
    const states = Array.from(this.circuitBreakers.values());
    const openStates = states.filter(state => state.isOpen);

    if (openStates.length > 0) {
      return openStates[0];
    }

    return {
      isOpen: false,
      failureCount: 0,
      lastFailureTime: new Date(),
      nextAttemptTime: new Date(),
      threshold: this.config.circuitBreaker.threshold,
      timeoutMs: this.config.circuitBreaker.timeoutMs,
    };
  }

  /**
   * Get recovery statistics
   */
  getStats(): ErrorRecoveryStats {
    return { ...this.stats };
  }

  /**
   * Clear error history
   */
  async clearErrorHistory(olderThanHours: number = 24): Promise<void> {
    const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    let removedCount = 0;

    for (const [id, error] of this.errors.entries()) {
      if (error.timestamp < cutoffTime) {
        this.cancelRetryTimer(id);
        this.errors.delete(id);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      await this.persistErrors();
      this.updateStats();
      this.logInfo(`Cleared ${removedCount} old errors from history`);
    }
  }

  /**
   * Reset circuit breaker
   */
  resetCircuitBreaker(category?: ErrorCategory): void {
    if (category) {
      const breaker = this.circuitBreakers.get(category);
      if (breaker) {
        breaker.isOpen = false;
        breaker.failureCount = 0;
        breaker.nextAttemptTime = new Date();
        this.notifyCircuitBreakerStateChange(breaker);
        this.logInfo(`Circuit breaker reset for category: ${category}`);
      }
    } else {
      // Reset all circuit breakers
      for (const breaker of this.circuitBreakers.values()) {
        breaker.isOpen = false;
        breaker.failureCount = 0;
        breaker.nextAttemptTime = new Date();
      }
      this.logInfo('All circuit breakers reset');
    }
  }

  /**
   * Add error listener
   */
  addListener(listener: ErrorListener): void {
    this.listeners.add(listener);
  }

  /**
   * Remove error listener
   */
  removeListener(listener: ErrorListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Start recovery process for an error
   */
  private async startRecovery(error: AppError): Promise<boolean> {
    if (error.isPermanentFailure || error.attemptCount >= error.type.maxRetries) {
      return false;
    }

    // Cancel existing retry timer
    this.cancelRetryTimer(error.id);

    // Calculate delay based on strategy
    const delay = this.calculateRetryDelay(error);
    error.nextRetryAt = new Date(Date.now() + delay);
    error.attemptCount++;

    // Schedule retry
    const timerId = setTimeout(() => {
      this.executeRecovery(error, 'scheduled_retry');
    }, delay);

    this.retryTimers.set(error.id, timerId);

    this.logInfo(`Recovery scheduled for error ${error.id} (attempt ${error.attemptCount}/${error.type.maxRetries}) in ${delay}ms`);
    return true;
  }

  /**
   * Execute recovery action
   */
  private async executeRecovery(error: AppError, trigger: string): Promise<RecoveryActionResult> {
    const startTime = Date.now();

    try {
      // Update retry metadata
      if (error.metadata) {
        error.metadata.lastRetryAt = new Date();
        error.metadata.retryTrigger = trigger;
      }

      // Execute recovery based on strategy
      let success = false;
      let action = '';

      switch (error.type.recoveryStrategy) {
        case 'immediate_retry':
          success = await this.executeImmediateRetry(error);
          action = 'immediate_retry';
          break;

        case 'exponential_backoff':
          success = await this.executeExponentialBackoff(error);
          action = 'exponential_backoff_retry';
          break;

        case 'linear_retry':
          success = await this.executeLinearRetry(error);
          action = 'linear_retry';
          break;

        case 'restart_session':
          success = await this.executeSessionRestart(error);
          action = 'session_restart';
          break;

        case 'graceful_degradation':
          success = await this.executeGracefulDegradation(error);
          action = 'graceful_degradation';
          break;

        case 'user_intervention':
          return {
            success: false,
            error,
            action: 'user_intervention_required',
            timestamp: new Date(),
            duration: Date.now() - startTime,
            requiresUserAction: true,
            userMessage: error.type.userMessage,
          };

        default:
          success = false;
          action = 'no_recovery_strategy';
      }

      const duration = Date.now() - startTime;
      const result: RecoveryActionResult = {
        success,
        error,
        action,
        timestamp: new Date(),
        duration,
        requiresUserAction: false,
        userMessage: success ? 'Operation completed successfully' : error.type.userMessage,
      };

      if (success) {
        // Update circuit breaker on success
        this.recordSuccess(error.type.category);
        this.notifyErrorRecovered(error, result);
        await this.removeError(error.id);
      } else {
        // Update circuit breaker on failure
        this.recordFailure(error.type.category);

        // Check if we should try again
        if (error.attemptCount < error.type.maxRetries && !this.isCircuitBreakerOpen(error.type.category)) {
          await this.startRecovery(error);
        } else {
          error.isPermanentFailure = true;
          this.notifyErrorPermanent(error);
        }
      }

      return result;
    } catch (recoveryError) {
      const duration = Date.now() - startTime;
      this.recordFailure(error.type.category);

      return {
        success: false,
        error,
        action: 'recovery_exception',
        timestamp: new Date(),
        duration,
        userMessage: 'Recovery process failed',
      };
    }
  }

  /**
   * Recovery strategy implementations
   */
  private async executeImmediateRetry(error: AppError): Promise<boolean> {
    // For immediate retry, we typically retry the original operation
    // This would be implemented by the component that owns the error
    return Math.random() > 0.3; // 70% success rate for simulation
  }

  private async executeExponentialBackoff(error: AppError): Promise<boolean> {
    // Simulate exponential backoff recovery
    const delay = error.type.baseDelay * Math.pow(error.type.backoffMultiplier, error.attemptCount - 1);
    await new Promise(resolve => setTimeout(resolve, Math.min(delay, error.type.maxDelay)));
    return Math.random() > 0.2; // 80% success rate
  }

  private async executeLinearRetry(error: AppError): Promise<boolean> {
    // Simulate linear retry recovery
    await new Promise(resolve => setTimeout(resolve, error.type.baseDelay));
    return Math.random() > 0.25; // 75% success rate
  }

  private async executeSessionRestart(error: AppError): Promise<boolean> {
    // Simulate session restart
    await new Promise(resolve => setTimeout(resolve, 3000));
    return Math.random() > 0.15; // 85% success rate
  }

  private async executeGracefulDegradation(error: AppError): Promise<boolean> {
    // Graceful degradation always succeeds but may have reduced functionality
    return true;
  }

  /**
   * Circuit breaker management
   */
  private initializeCircuitBreakers(): void {
    const categories: ErrorCategory[] = [
      'network', 'permission', 'hardware', 'service', 'session', 'media', 'validation', 'system'
    ];

    categories.forEach(category => {
      this.circuitBreakers.set(category, this.createCircuitBreaker(category));
    });
  }

  private createCircuitBreaker(category: ErrorCategory): CircuitBreakerState {
    return {
      isOpen: false,
      failureCount: 0,
      lastFailureTime: new Date(),
      nextAttemptTime: new Date(),
      threshold: this.config.circuitBreaker.threshold,
      timeoutMs: this.config.circuitBreaker.timeoutMs,
    };
  }

  private isCircuitBreakerOpen(category: ErrorCategory): boolean {
    const breaker = this.circuitBreakers.get(category);
    if (!breaker) return false;

    if (breaker.isOpen) {
      // Check if timeout has passed
      if (Date.now() >= breaker.nextAttemptTime.getTime()) {
        // Reset to half-open state
        breaker.isOpen = false;
        breaker.failureCount = Math.floor(breaker.threshold / 2);
        this.notifyCircuitBreakerStateChange(breaker);
        return false;
      }
      return true;
    }

    return false;
  }

  private recordSuccess(category: ErrorCategory): void {
    const breaker = this.circuitBreakers.get(category);
    if (breaker && breaker.failureCount > 0) {
      breaker.failureCount = Math.max(0, breaker.failureCount - 1);
      if (breaker.failureCount === 0 && breaker.isOpen) {
        breaker.isOpen = false;
        this.notifyCircuitBreakerStateChange(breaker);
      }
    }
  }

  private recordFailure(category: ErrorCategory): void {
    const breaker = this.circuitBreakers.get(category);
    if (breaker) {
      breaker.failureCount++;
      breaker.lastFailureTime = new Date();

      if (breaker.failureCount >= breaker.threshold && !breaker.isOpen) {
        breaker.isOpen = true;
        breaker.nextAttemptTime = new Date(Date.now() + breaker.timeoutMs);
        this.notifyCircuitBreakerStateChange(breaker);
        this.logError(`Circuit breaker opened for category: ${category}`, 'CIRCUIT_BREAKER');
      }
    }
  }

  /**
   * Retry delay calculation
   */
  private calculateRetryDelay(error: AppError): number {
    const { baseDelay, maxDelay, backoffMultiplier } = error.type;
    const exponentialDelay = baseDelay * Math.pow(backoffMultiplier, error.attemptCount - 1);
    const clampedDelay = Math.min(exponentialDelay, maxDelay);

    // Add jitter
    const jitter = clampedDelay * this.config.retry.jitterFactor * (Math.random() * 2 - 1);
    return Math.max(0, clampedDelay + jitter);
  }

  /**
   * Statistics management
   */
  private initializeStats(): ErrorRecoveryStats {
    return {
      totalErrors: 0,
      errorsByCategory: {
        network: 0,
        permission: 0,
        hardware: 0,
        service: 0,
        session: 0,
        media: 0,
        validation: 0,
        system: 0,
        user_action: 0,
        unknown: 0,
      },
      errorsBySeverity: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0,
      },
      recoverySuccessRate: 0,
      averageRecoveryTime: 0,
      circuitBreakerActivations: 0,
      activeErrors: 0,
      permanentFailures: 0,
      autoRecoveredErrors: 0,
      userRecoveredErrors: 0,
      lastUpdated: new Date(),
    };
  }

  private updateStats(newError?: AppError): void {
    if (newError) {
      this.stats.totalErrors++;
      this.stats.errorsByCategory[newError.type.category]++;
      this.stats.errorsBySeverity[newError.type.severity]++;

      if (newError.isPermanentFailure) {
        this.stats.permanentFailures++;
      } else {
        this.stats.activeErrors++;
      }
    }

    // Update derived stats
    const totalRecovered = this.stats.autoRecoveredErrors + this.stats.userRecoveredErrors;
    const totalAttempted = this.stats.totalErrors - this.stats.permanentFailures;
    this.stats.recoverySuccessRate = totalAttempted > 0 ? totalRecovered / totalAttempted : 0;

    this.stats.activeErrors = Array.from(this.errors.values()).filter(e => !e.isPermanentFailure).length;
    this.stats.lastUpdated = new Date();
  }

  /**
   * Persistence
   */
  private async persistError(error: AppError): Promise<void> {
    try {
      const errorsToPersist = Array.from(this.errors.values())
        .filter(e => e.type.severity === 'critical' || e.isPermanentFailure)
        .slice(-this.config.retention.maxErrorsInMemory);

      await AsyncStorage.setItem(ErrorRecoverySystem.STORAGE_KEY, JSON.stringify(errorsToPersist));
    } catch (persistError) {
      this.logError('Failed to persist error', 'PERSISTENCE', persistError as Error);
    }
  }

  private async persistErrors(): Promise<void> {
    try {
      const errors = Array.from(this.errors.values());
      await AsyncStorage.setItem(ErrorRecoverySystem.STORAGE_KEY, JSON.stringify(errors));
    } catch (error) {
      this.logError('Failed to persist errors', 'PERSISTENCE', error as Error);
    }
  }

  private async loadPersistedData(): Promise<void> {
    try {
      const [errorsData, circuitBreakersData] = await Promise.all([
        AsyncStorage.getItem(ErrorRecoverySystem.STORAGE_KEY),
        AsyncStorage.getItem(ErrorRecoverySystem.CIRCUIT_BREAKER_KEY),
      ]);

      // Load errors
      if (errorsData) {
        const errors = JSON.parse(errorsData) as AppError[];
        errors.forEach(error => {
          error.timestamp = new Date(error.timestamp);
          if (error.nextRetryAt) {
            error.nextRetryAt = new Date(error.nextRetryAt);
          }
          this.errors.set(error.id, error);
        });
      }

      // Load circuit breakers
      if (circuitBreakersData) {
        const breakers = JSON.parse(circuitBreakersData) as Record<string, CircuitBreakerState>;
        Object.entries(breakers).forEach(([category, state]) => {
          state.lastFailureTime = new Date(state.lastFailureTime);
          state.nextAttemptTime = new Date(state.nextAttemptTime);
          this.circuitBreakers.set(category as ErrorCategory, state);
        });
      }

      this.updateStats();
    } catch (error) {
      this.logError('Failed to load persisted data', 'PERSISTENCE', error as Error);
    }
  }

  /**
   * Utility methods
   */
  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private cancelRetryTimer(errorId: string): void {
    const timerId = this.retryTimers.get(errorId);
    if (timerId) {
      clearTimeout(timerId);
      this.retryTimers.delete(errorId);
    }
  }

  private async removeError(errorId: string): Promise<void> {
    this.cancelRetryTimer(errorId);
    this.errors.delete(errorId);
    this.updateStats();
  }

  /**
   * Notification methods
   */
  private notifyErrorOccurred(error: AppError): void {
    this.listeners.forEach(listener => {
      try {
        listener.onErrorOccurred(error);
      } catch (listenerError) {
        this.logError('Error in listener', 'LISTENER_ERROR', listenerError as Error);
      }
    });
  }

  private notifyErrorRecovered(error: AppError, result: RecoveryActionResult): void {
    this.listeners.forEach(listener => {
      try {
        listener.onErrorRecovered(error, result);
      } catch (listenerError) {
        this.logError('Error in listener', 'LISTENER_ERROR', listenerError as Error);
      }
    });
  }

  private notifyErrorPermanent(error: AppError): void {
    this.listeners.forEach(listener => {
      try {
        listener.onErrorPermanent(error);
      } catch (listenerError) {
        this.logError('Error in listener', 'LISTENER_ERROR', listenerError as Error);
      }
    });
  }

  private notifyCircuitBreakerStateChange(state: CircuitBreakerState): void {
    this.stats.circuitBreakerActivations++;
    this.listeners.forEach(listener => {
      try {
        listener.onCircuitBreakerStateChange(state);
      } catch (listenerError) {
        this.logError('Error in listener', 'LISTENER_ERROR', listenerError as Error);
      }
    });

    // Persist circuit breaker state
    this.persistCircuitBreakers();
  }

  private async persistCircuitBreakers(): Promise<void> {
    try {
      const breakers: Record<string, CircuitBreakerState> = {};
      this.circuitBreakers.forEach((state, category) => {
        breakers[category] = state;
      });
      await AsyncStorage.setItem(ErrorRecoverySystem.CIRCUIT_BREAKER_KEY, JSON.stringify(breakers));
    } catch (error) {
      this.logError('Failed to persist circuit breakers', 'PERSISTENCE', error as Error);
    }
  }

  /**
   * Logging methods
   */
  private logError(message: string, context: string, error?: Error | AppError, additionalInfo?: any): void {
    if (!this.config.monitoring.enableLogging) return;

    const logLevel = this.config.monitoring.logLevel;
    if (logLevel === 'error') {
      console.error(`[ErrorRecovery:${context}] ${message}`, error, additionalInfo);
    } else if (logLevel === 'warn' || logLevel === 'info' || logLevel === 'debug') {
      console.warn(`[ErrorRecovery:${context}] ${message}`, error, additionalInfo);
    }
  }

  private logInfo(message: string): void {
    if (this.config.monitoring.enableLogging && this.config.monitoring.logLevel !== 'error') {
      console.log(`[ErrorRecovery:INFO] ${message}`);
    }
  }

  /**
   * Cleanup method
   */
  cleanup(): void {
    // Cancel all retry timers
    for (const timerId of this.retryTimers.values()) {
      clearTimeout(timerId);
    }
    this.retryTimers.clear();

    // Clear listeners
    this.listeners.clear();

    // Clear errors
    this.errors.clear();

    this.logInfo('Error recovery system cleaned up');
  }
}

// Singleton instance
export const errorRecoverySystem = new ErrorRecoverySystem();

// Helper functions for easy integration
export const handleError = (error: Error | string, operation: string, component: string, additionalData?: Record<string, any>) => {
  const context = createErrorContext(operation, component, additionalData);
  return errorRecoverySystem.handleError(error, context);
};

export const recoverError = (errorId: string) => errorRecoverySystem.recoverError(errorId);
export const retryError = (errorId: string, strategy?: RecoveryStrategy) => errorRecoverySystem.retryError(errorId, strategy);
export const getErrorStats = () => errorRecoverySystem.getStats();
export const getActiveErrors = () => errorRecoverySystem.getActiveErrors();
export const addErrorListener = (listener: ErrorListener) => errorRecoverySystem.addListener(listener);
export const removeErrorListener = (listener: ErrorListener) => errorRecoverySystem.removeListener(listener);