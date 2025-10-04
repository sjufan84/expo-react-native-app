# Session Management System

## Overview

The session management system dynamically configures the app's behavior and UI based on how the user initiates interaction with the AI agent. This ensures optimal configuration for different interaction modes (text, voice with push-to-talk, or voice with VAD).

## Session Types

### 1. **Text Session** (`'text'`)
- **Triggered by**: Sending a text message
- **Configuration**: Text-to-text communication only
- **Turn Detection**: None
- **UI**: Standard text input with send button

### 2. **Voice Push-to-Talk** (`'voice-ptt'`)
- **Triggered by**: Pressing and holding the microphone button
- **Configuration**: Voice input/output with client-side turn detection
- **Turn Detection**: Client-side (user controls when to speak by holding button)
- **UI**: Voice session controls with mute, mode toggle, and end session buttons

### 3. **Voice VAD** (`'voice-vad'`)
- **Triggered by**: Tapping microphone in continuous mode
- **Configuration**: Voice input/output with server-side voice activity detection
- **Turn Detection**: Server-side (automatic detection of when user is speaking)
- **UI**: Voice session controls with mute, mode toggle, and end session buttons

## Session States

- **`idle`**: No active session
- **`active`**: Session is currently running
- **`ending`**: Session is being terminated

## Architecture

### Type Definitions (`src/types/message.types.ts`)

```typescript
export type SessionType = 'text' | 'voice-ptt' | 'voice-vad' | null;
export type SessionState = 'idle' | 'active' | 'ending';

export interface SessionConfig {
  type: SessionType;
  state: SessionState;
  startedAt: Date | null;
  voiceMode?: 'push-to-talk' | 'continuous';
  isMuted?: boolean;
  turnDetection?: 'server' | 'client' | 'none';
}
```

### Context Management (`src/context/AgentContext.tsx`)

The `AgentContext` now includes:

**New State:**
- `session: SessionConfig` - Current session configuration

**New Actions:**
- `START_SESSION` - Initializes a new session
- `END_SESSION` - Terminates the current session
- `UPDATE_SESSION` - Updates session configuration

**New Methods:**
- `startSession(type: SessionType, voiceMode?: 'push-to-talk' | 'continuous')` - Start a new session
- `endSession()` - End the current session
- `updateSession(updates: Partial<SessionConfig>)` - Update session settings

### Session Initialization Flow

#### Text Session
```typescript
// User types a message
await sendMessage(content, 'text');
// ↓ Automatically starts text session if idle
dispatch({ type: 'START_SESSION', payload: { type: 'text' } });
```

#### Voice Session (Push-to-Talk)
```typescript
// User presses and holds microphone
if (session.state === 'idle') {
  await startSession('voice-ptt', 'push-to-talk');
}
// ↓ Configures LiveKit with client-side turn detection
```

#### Voice Session (VAD)
```typescript
// User taps microphone in continuous mode
await startSession('voice-vad', 'continuous');
// ↓ Configures LiveKit with server-side turn detection
```

## UI Components

### SessionIndicator (`src/components/shared/SessionIndicator.tsx`)

Displays current session status in the header:
- Shows session type icon (💬 for text, 🎙️/🔴 for voice)
- Animated pulse during active sessions
- Session label (e.g., "Text Session", "Push to Talk", "Recording...")
- Color-coded status indicator

**Props:**
- `sessionType: SessionType` - Current session type
- `sessionState: SessionState` - Current session state
- `isRecording?: boolean` - Whether audio is being recorded

### VoiceSessionControls (`src/components/voice/VoiceSessionControls.tsx`)

Controls for active voice sessions:
- **Session Info**: Shows session duration and type
- **Mute Toggle**: Mute/unmute microphone
- **Mode Toggle**: Switch between PTT and VAD
- **End Button**: Terminate the session

**Features:**
- Real-time duration counter
- Visual indicators for mute state
- Prominent end session button

### MultimodalInput (Enhanced)

Now session-aware:
- **Pre-session**: Shows text input + voice/image buttons
- **Text session**: Normal text input behavior
- **Voice session**: Hidden (replaced by VoiceSessionControls)
- **Auto-initialization**: Starts appropriate session on first interaction

## Implementation Details

### Automatic Session Start

Sessions start automatically based on user action:

```typescript
// In sendMessage callback
if (state.session.state === 'idle' && type === 'text') {
  await startSession('text');
}

// In voice recording handler
if (session.state === 'idle') {
  await startSession('voice-ptt', 'push-to-talk');
}
```

### Session Cleanup

Sessions are properly cleaned up:
- When user explicitly ends session
- When disconnecting from agent
- Voice resources are released
- State is reset to idle

### LiveKit Configuration

Session type determines LiveKit room configuration:

```typescript
// In startSession
if (type === 'voice-ptt' || type === 'voice-vad') {
  // Enable audio tracks
  // Configure turn detection
  turnDetection: type === 'voice-ptt' ? 'client' : 'server'
}
```

## User Experience

### Session Lifecycle

1. **Idle State**
   - User sees standard chat interface
   - Can choose text or voice input
   - No session indicator shown

2. **Session Start**
   - User sends first message or starts recording
   - Session type determined by action
   - UI adapts to session type
   - Session indicator appears in header

3. **Active Session**
   - Optimized UI for session type
   - Real-time feedback (recording, typing, etc.)
   - Session controls available
   - Duration displayed

4. **Session End**
   - User taps "End" button
   - Resources cleaned up
   - UI returns to idle state
   - Ready for new session

### Visual Feedback

- **Session Indicator**: Always visible in header during active session
- **Recording Indicator**: Pulsing animation during voice recording
- **Duration Counter**: Shows elapsed session time
- **Mute Status**: Clear visual indication of mute state
- **Session Type**: Icon and label show current mode

## Development Mode

Sessions work in development mode without LiveKit:
- Simulated voice recording
- Mock audio data
- All UI features functional
- Easy testing of session flows

## Future Enhancements

1. **Session History**: Track past sessions
2. **Session Resume**: Resume interrupted sessions
3. **Multi-modal Sessions**: Switch between text and voice in same session
4. **Session Sharing**: Share session transcripts
5. **Session Analytics**: Track session metrics

## Best Practices

1. **Always check session state** before starting new session
2. **Clean up resources** when ending sessions
3. **Provide clear visual feedback** during state transitions
4. **Handle errors gracefully** during session operations
5. **Test all session types** in development mode

## API Reference

### startSession
```typescript
await startSession(
  type: 'text' | 'voice-ptt' | 'voice-vad',
  voiceMode?: 'push-to-talk' | 'continuous'
): Promise<void>
```

### endSession
```typescript
await endSession(): Promise<void>
```

### updateSession
```typescript
updateSession(updates: {
  isMuted?: boolean;
  voiceMode?: 'push-to-talk' | 'continuous';
}): void
```

## Testing

Test each session type:

### Text Session
1. Type a message
2. Verify session indicator shows "Text Session"
3. Send message
4. Session should remain active for subsequent messages

### Voice PTT Session
1. Press and hold microphone
2. Verify session starts as "Voice (PTT)"
3. Verify voice controls appear
4. Release to send
5. Test mute toggle
6. End session

### Voice VAD Session
1. Switch to continuous mode
2. Tap microphone
3. Verify session starts as "Voice (VAD)"
4. Tap again to stop
5. Test mode switching
6. End session

