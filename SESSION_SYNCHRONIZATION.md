# Session Synchronization Implementation

## Overview

This document describes the implementation of session state synchronization between the frontend AgentContext and LiveKit room state. This addresses P1 priority issues from FR-7.5 review regarding session management consistency.

## Architecture

### Core Components

1. **LiveKitService** - Enhanced with session management capabilities
2. **AgentContext** - Integrated with session sync events
3. **useLiveKit Hook** - Provides session synchronization methods
4. **useVoice Hook** - Syncs voice state with session state
5. **Session Types** - Enhanced type definitions for sync

### Key Features

- **Bidirectional Sync**: Frontend session state ↔ LiveKit room state
- **Real-time Validation**: Automatic consistency checks every 5 seconds
- **Turn Detection Integration**: Proper configuration for PTT/VAD modes
- **Connection Recovery**: Session state handling during network interruptions
- **Auto-correction**: Automatic fixes for detected inconsistencies

## Session State Management

### Session Config Structure

```typescript
interface SessionConfig {
  type: SessionType;           // 'text' | 'voice-ptt' | 'voice-vad' | null
  state: SessionState;         // 'idle' | 'active' | 'ending' | 'syncing' | 'error'
  startedAt: Date | null;
  voiceMode?: 'push-to-talk' | 'continuous';
  isMuted?: boolean;
  turnDetection?: 'server' | 'client' | 'none';

  // Synchronization fields
  roomId?: string;
  lastSyncAt?: Date;
  syncAttempts?: number;
  inconsistencyDetected?: boolean;
  voiceActivityEnabled?: boolean;
}
```

### Session States

- **idle**: No active session
- **active**: Session is running and synchronized
- **syncing**: Session is being synchronized
- **ending**: Session is being terminated
- **error**: Session has synchronization issues

## Turn Detection Configuration

### Session Type Mapping

| Session Type | Turn Detection | Voice Mode | Voice Activity |
|--------------|----------------|------------|----------------|
| text         | none           | N/A        | false          |
| voice-ptt    | client         | push-to-talk | true         |
| voice-vad    | server         | continuous  | true          |

### LiveKit Room Configuration

```typescript
interface LiveKitRoomConfig {
  sessionId: string;
  sessionType: SessionType;
  turnDetection: 'server' | 'client' | 'none';
  voiceActivityEnabled: boolean;
  adaptiveStream: boolean;
  dynacast: boolean;
  audioSettings: {
    echoCancellation: boolean;
    noiseSuppression: boolean;
    autoGainControl: boolean;
  };
}
```

## Synchronization Flow

### Session Start

1. Frontend creates `SessionConfig` with appropriate settings
2. `LiveKitService.setSessionConfig()` configures room settings
3. Room microphone enabled/disabled based on session type
4. Initial sync performed after 1 second delay
5. Validation monitoring started (every 10 seconds)

### Real-time Validation

1. **Connection Check**: Verify room connection matches session state
2. **Room ID Check**: Ensure session roomId matches actual room name
3. **Voice Session Check**: Verify microphone state for voice sessions
4. **Turn Detection Check**: Validate turn detection mode matches session type

### Connection Interruption Handling

1. Room events detected (Disconnected, Reconnecting, Reconnected)
2. Session state updated to 'syncing' or 'error'
3. Sync events emitted to AgentContext
4. Auto-correction applied on reconnection
5. Validation resumed after stable connection

### Error Recovery

1. Inconsistencies detected during validation
2. Corrections calculated and applied automatically
3. Session state updated with sync metadata
4. Frontend notified via sync events
5. User alerted for critical issues

## API Reference

### LiveKitService Methods

```typescript
// Session management
setSessionConfig(session: SessionConfig): void
getSessionConfig(): SessionConfig | null
syncSessionState(trigger?: string): void
validateSessionState(): SessionValidationResult
setSessionSyncEnabled(enabled: boolean): void

// Session sync events
setSessionSyncEventCallback(callback: (event: SessionSyncEvent) => void): void
```

### useLiveKit Hook Methods

```typescript
// Session synchronization
setSessionConfig: (session: SessionConfig) => void
getSessionConfig: () => SessionConfig | null
syncSessionState: (trigger?: string) => void
validateSessionState: () => SessionValidationResult
setSessionSyncEnabled: (enabled: boolean) => void
```

### AgentContext Methods

```typescript
// Session synchronization
syncSessionWithRoom: () => void
validateAndCorrectSession: () => void
```

## Session Sync Events

```typescript
interface SessionSyncEvent {
  type: 'session_state_sync' | 'room_state_change' | 'connection_interruption' | 'session_inconsistency';
  payload: {
    sessionId: string;
    frontendState: SessionConfig;
    roomState?: Partial<SessionConfig>;
    timestamp: number;
    trigger: string;
  };
}
```

### Event Types

- **session_state_sync**: Session synchronized with room state
- **room_state_change**: LiveKit room state changed
- **connection_interruption**: Network interruption detected
- **session_inconsistency**: Inconsistency detected and corrected

## Testing

### Session Synchronization Tests

The implementation includes comprehensive test utilities in `src/utils/sessionSyncTest.ts`:

```typescript
// Run quick validation
await runQuickSessionTest();

// Custom test scenarios
const tester = new SessionSynchronizationTester();
tester.addScenario(customScenario);
const results = await tester.runAllTests();
```

### Test Scenarios

1. **Basic Session Sync**: Verifies fundamental synchronization
2. **Voice Session with Turn Detection**: Tests voice session configuration
3. **Connection Interruption Recovery**: Validates network interruption handling
4. **Session State Validation**: Tests auto-correction capabilities

## Implementation Details

### Validation Logic

```typescript
validateSessionState(): SessionValidationResult {
  const inconsistencies: string[] = [];
  const corrections: Partial<SessionConfig> = {};

  // Check connection state vs session state
  if (roomState === 'DISCONNECTED' && sessionState === 'active') {
    inconsistencies.push('Session active but room disconnected');
    corrections.state = 'error';
  }

  // Check turn detection configuration
  const expectedTurnDetection = getExpectedTurnDetection(sessionType);
  if (session.turnDetection !== expectedTurnDetection) {
    inconsistencies.push(`Turn detection mismatch: expected ${expectedTurnDetection}, got ${session.turnDetection}`);
    corrections.turnDetection = expectedTurnDetection;
  }

  return {
    isValid: inconsistencies.length === 0,
    inconsistencies,
    corrections,
    needsResync: inconsistencies.length > 0,
  };
}
```

### Auto-correction

```typescript
syncSessionState(trigger: string = 'manual'): void {
  const validation = this.validateSessionState();

  if (validation.needsResync) {
    // Apply corrections
    const updatedSession = {
      ...this.currentSession,
      ...validation.corrections,
      lastSyncAt: new Date(),
      syncAttempts: (this.currentSession.syncAttempts || 0) + 1,
      inconsistencyDetected: true,
    };

    this.currentSession = updatedSession;

    // Emit sync event
    this.emitSessionSyncEvent('session_state_sync', trigger);
  }
}
```

## Best Practices

1. **Enable Session Sync**: Always keep session synchronization enabled
2. **Monitor Validation**: Listen for sync events and log inconsistencies
3. **Handle Errors Gracefully**: Implement proper error handling for sync failures
4. **Test Network Scenarios**: Validate behavior during connection interruptions
5. **Use Type Safety**: Leverage TypeScript types for session configurations

## Troubleshooting

### Common Issues

1. **Session Not Syncing**: Check if `sessionSyncEnabled` is true
2. **Validation Failures**: Review console logs for specific inconsistencies
3. **Connection Issues**: Verify LiveKit room state matches session state
4. **Turn Detection Errors**: Ensure session type matches turn detection mode

### Debug Logging

Enable debug logging to monitor synchronization:

```typescript
// In development mode
if (__DEV__) {
  console.log('Session sync event:', syncEvent);
  console.log('Session validation result:', validation);
}
```

## Future Enhancements

1. **Metrics Collection**: Add session sync performance metrics
2. **Advanced Recovery**: Implement more sophisticated error recovery
3. **Session Analytics**: Track session sync patterns and issues
4. **Real-time Monitoring**: Add dashboard for session state monitoring
5. **Automated Testing**: Integrate session sync tests into CI/CD pipeline

## Files Modified

- `src/types/message.types.ts` - Enhanced session types
- `src/services/LiveKitService.ts` - Added session management
- `src/hooks/useLiveKit.ts` - Added session sync methods
- `src/context/AgentContext.tsx` - Integrated sync events
- `src/hooks/useVoice.ts` - Added session state sync
- `src/utils/sessionSyncTest.ts` - Test utilities (new)

## Dependencies

No additional dependencies required. The implementation uses existing LiveKit and React Native dependencies.