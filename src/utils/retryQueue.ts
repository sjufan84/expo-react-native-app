import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  RetryQueueItem,
  RetryConfig,
  RetryQueueStats,
  RetryTrigger,
  Message,
  DataChannelMessage,
  RetryMetadata
} from '../types/message.types';

export class RetryQueue {
  private queue: Map<string, RetryQueueItem> = new Map();
  private processingTimers: Map<string, NodeJS.Timeout> = new Map();
  private config: RetryConfig;
  private static readonly STORAGE_KEY = '@bakebot_retry_queue';
  private isProcessing = false;
  private onRetryCallback?: (item: RetryQueueItem) => Promise<void>;
  private onUpdateCallback?: (stats: RetryQueueStats) => void;

  constructor(config?: Partial<RetryConfig>) {
    this.config = {
      baseDelay: 1000, // 1 second
      maxDelay: 30000, // 30 seconds
      backoffMultiplier: 2,
      maxAttempts: 3,
      jitterFactor: 0.25, // ±25% jitter
      ...config,
    };

    // Load persisted queue on initialization
    this.loadPersistedQueue();
  }

  /**
   * Set callback for retry attempts
   */
  setRetryCallback(callback: (item: RetryQueueItem) => Promise<void>): void {
    this.onRetryCallback = callback;
  }

  /**
   * Set callback for queue updates
   */
  setUpdateCallback(callback: (stats: RetryQueueStats) => void): void {
    this.onUpdateCallback = callback;
  }

  /**
   * Add a message to the retry queue
   */
  async addToQueue(
    message: Message,
    originalDataChannelMessage: DataChannelMessage,
    failureReason?: string
  ): Promise<void> {
    const retryItem: RetryQueueItem = {
      id: this.generateRetryId(message.id),
      message: {
        ...message,
        status: 'retrying',
        retryMetadata: this.createRetryMetadata(1)
      },
      originalDataChannelMessage,
      createdAt: new Date(),
      nextRetryAt: this.calculateNextRetryTime(1),
      attemptCount: 1,
      maxAttempts: this.config.maxAttempts,
      baseDelay: this.config.baseDelay,
      maxDelay: this.config.maxDelay,
      backoffMultiplier: this.config.backoffMultiplier,
      isPermanentFailure: false,
      failureReason,
    };

    this.queue.set(retryItem.id, retryItem);
    await this.persistQueue();
    this.scheduleRetry(retryItem);
    this.notifyUpdate();

    console.log(`🔄 Message ${message.id} added to retry queue (attempt ${retryItem.attemptCount}/${retryItem.maxAttempts})`);
  }

  /**
   * Manually retry a specific message
   */
  async retryMessage(messageId: string): Promise<boolean> {
    const retryItem = Array.from(this.queue.values()).find(item => item.message.id === messageId);

    if (!retryItem) {
      console.warn(`Message ${messageId} not found in retry queue`);
      return false;
    }

    if (retryItem.isPermanentFailure) {
      console.warn(`Message ${messageId} has permanent failure, cannot retry`);
      return false;
    }

    return this.processRetry(retryItem, 'manual_retry');
  }

  /**
   * Remove a message from the retry queue (e.g., after successful delivery)
   */
  async removeFromQueue(messageId: string): Promise<void> {
    const retryItem = Array.from(this.queue.values()).find(item => item.message.id === messageId);

    if (!retryItem) {
      return;
    }

    this.cancelScheduledRetry(retryItem.id);
    this.queue.delete(retryItem.id);
    await this.persistQueue();
    this.notifyUpdate();

    console.log(`✅ Message ${messageId} removed from retry queue (delivered successfully)`);
  }

  /**
   * Trigger retry for all pending items (e.g., after connection restored)
   */
  async triggerRetryForAll(trigger: RetryTrigger = 'connection_restored'): Promise<void> {
    console.log(`🔄 Triggering retry for all pending items (trigger: ${trigger})`);

    const pendingItems = Array.from(this.queue.values()).filter(
      item => !item.isPermanentFailure
    );

    for (const item of pendingItems) {
      // Adjust next retry time for connection restored trigger
      if (trigger === 'connection_restored') {
        item.nextRetryAt = new Date(Date.now() + 1000); // Retry after 1 second
        this.scheduleRetry(item);
      }
    }

    this.notifyUpdate();
  }

  /**
   * Get queue statistics
   */
  getStats(): RetryQueueStats {
    const items = Array.from(this.queue.values());
    const pendingItems = items.filter(item => !item.isPermanentFailure);
    const failedItems = items.filter(item => item.isPermanentFailure);
    const completedItems = items.filter(item => item.message.status === 'sent');

    const averageRetryCount = items.length > 0
      ? items.reduce((sum, item) => sum + item.attemptCount, 0) / items.length
      : 0;

    return {
      totalItems: items.length,
      pendingItems: pendingItems.length,
      failedItems: failedItems.length,
      completedItems: completedItems.length,
      averageRetryCount: Math.round(averageRetryCount * 10) / 10,
    };
  }

  /**
   * Get all retry items
   */
  getAllItems(): RetryQueueItem[] {
    return Array.from(this.queue.values());
  }

  /**
   * Get retry items for a specific message
   */
  getItemsForMessage(messageId: string): RetryQueueItem[] {
    return Array.from(this.queue.values()).filter(item => item.message.id === messageId);
  }

  /**
   * Clear the retry queue
   */
  async clearQueue(): Promise<void> {
    // Cancel all scheduled retries
    for (const timerId of this.processingTimers.values()) {
      clearTimeout(timerId);
    }
    this.processingTimers.clear();

    // Clear queue
    this.queue.clear();

    // Persist empty queue
    await this.persistQueue();
    this.notifyUpdate();

    console.log('🗑️ Retry queue cleared');
  }

  /**
   * Cleanup old and permanently failed items
   */
  async cleanup(olderThanHours: number = 24): Promise<void> {
    const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    let removedCount = 0;

    for (const [id, item] of this.queue.entries()) {
      if (item.createdAt < cutoffTime && item.isPermanentFailure) {
        this.cancelScheduledRetry(id);
        this.queue.delete(id);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      await this.persistQueue();
      this.notifyUpdate();
      console.log(`🧹 Cleaned up ${removedCount} old failed retry items`);
    }
  }

  /**
   * Process a retry attempt
   */
  private async processRetry(item: RetryQueueItem, trigger: RetryTrigger): Promise<boolean> {
    if (!this.onRetryCallback) {
      console.warn('No retry callback set, cannot process retry');
      return false;
    }

    try {
      console.log(`🔄 Retrying message ${item.message.id} (attempt ${item.attemptCount + 1}/${item.maxAttempts})`);

      // Update attempt count and metadata
      item.attemptCount++;
      item.message.retryMetadata = this.createRetryMetadata(item.attemptCount);

      // Call retry callback
      await this.onRetryCallback(item);

      return true;
    } catch (error) {
      console.error(`Retry attempt failed for message ${item.message.id}:`, error);

      // Check if we should retry again
      if (item.attemptCount >= item.maxAttempts) {
        item.isPermanentFailure = true;
        item.message.status = 'failed';
        item.message.retryMetadata!.isPermanentFailure = true;
        item.message.retryMetadata!.failureReason = 'Max retry attempts exceeded';

        console.log(`❌ Message ${item.message.id} marked as permanent failure`);
      } else {
        // Schedule next retry
        item.nextRetryAt = this.calculateNextRetryTime(item.attemptCount);
        this.scheduleRetry(item);
      }

      await this.persistQueue();
      this.notifyUpdate();

      return false;
    }
  }

  /**
   * Schedule a retry for a specific item
   */
  private scheduleRetry(item: RetryQueueItem): void {
    this.cancelScheduledRetry(item.id);

    const delay = item.nextRetryAt.getTime() - Date.now();

    if (delay <= 0) {
      // Retry immediately
      this.processRetry(item, 'scheduled_retry');
      return;
    }

    const timerId = setTimeout(() => {
      this.processRetry(item, 'scheduled_retry');
    }, delay);

    this.processingTimers.set(item.id, timerId);
  }

  /**
   * Cancel a scheduled retry
   */
  private cancelScheduledRetry(itemId: string): void {
    const timerId = this.processingTimers.get(itemId);
    if (timerId) {
      clearTimeout(timerId);
      this.processingTimers.delete(itemId);
    }
  }

  /**
   * Calculate next retry time with exponential backoff and jitter
   */
  private calculateNextRetryTime(attemptCount: number): Date {
    const exponentialDelay = this.config.baseDelay * Math.pow(this.config.backoffMultiplier, attemptCount - 1);
    const clampedDelay = Math.min(exponentialDelay, this.config.maxDelay);

    // Add jitter (± jitterFactor)
    const jitter = clampedDelay * this.config.jitterFactor * (Math.random() * 2 - 1);
    const finalDelay = Math.max(0, clampedDelay + jitter);

    return new Date(Date.now() + finalDelay);
  }

  /**
   * Create retry metadata for a message
   */
  private createRetryMetadata(attemptCount: number): RetryMetadata {
    return {
      attemptCount,
      maxAttempts: this.config.maxAttempts,
      lastAttemptAt: new Date(),
      baseDelay: this.config.baseDelay,
      maxDelay: this.config.maxDelay,
      backoffMultiplier: this.config.backoffMultiplier,
      isPermanentFailure: false,
    };
  }

  /**
   * Generate a unique retry ID
   */
  private generateRetryId(messageId: string): string {
    return `retry_${messageId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Persist queue to AsyncStorage
   */
  private async persistQueue(): Promise<void> {
    try {
      const serializedQueue = JSON.stringify(Array.from(this.queue.entries()));
      await AsyncStorage.setItem(RetryQueue.STORAGE_KEY, serializedQueue);
    } catch (error) {
      console.error('Failed to persist retry queue:', error);
    }
  }

  /**
   * Load persisted queue from AsyncStorage
   */
  private async loadPersistedQueue(): Promise<void> {
    try {
      const serializedQueue = await AsyncStorage.getItem(RetryQueue.STORAGE_KEY);
      if (!serializedQueue) {
        return;
      }

      const entries = JSON.parse(serializedQueue) as [string, RetryQueueItem][];

      // Convert date strings back to Date objects
      for (const [id, item] of entries) {
        item.createdAt = new Date(item.createdAt);
        item.nextRetryAt = new Date(item.nextRetryAt);
        item.message.timestamp = new Date(item.message.timestamp);

        if (item.message.retryMetadata) {
          item.message.retryMetadata.lastAttemptAt = new Date(item.message.retryMetadata.lastAttemptAt);
          if (item.message.retryMetadata.nextRetryAt) {
            item.message.retryMetadata.nextRetryAt = new Date(item.message.retryMetadata.nextRetryAt);
          }
        }

        this.queue.set(id, item);
      }

      // Reschedule pending retries
      for (const item of this.queue.values()) {
        if (!item.isPermanentFailure) {
          this.scheduleRetry(item);
        }
      }

      console.log(`📂 Loaded ${this.queue.size} items from persisted retry queue`);
    } catch (error) {
      console.error('Failed to load persisted retry queue:', error);
    }
  }

  /**
   * Notify update callback
   */
  private notifyUpdate(): void {
    if (this.onUpdateCallback) {
      this.onUpdateCallback(this.getStats());
    }
  }
}

// Singleton instance
export const retryQueue = new RetryQueue();