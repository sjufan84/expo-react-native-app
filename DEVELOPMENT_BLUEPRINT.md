# BakeBot Mobile App - AI Agent Development Specification

## Executive Summary
BakeBot is a React Native mobile application featuring a real-time AI sous chef powered by LiveKit. This specification provides explicit, unambiguous instructions for AI agent implementation, focusing on technical precision and complete functional requirements.

## Developer Notes
- For now assume that we are using Google for all agentic interactions / models
- For more detailed LiveKit documentation, visit https://docs.livekit.io/llms.txt and find the relevant
link / information.
- After completing a task, update the DEVELOPMENT_STATUS.md file with the title of the task,
any relevant notes, issues encountered, etc.
- Use Zod for any schemas and type safety if possible


## Technology Stack - Explicit Requirements
- **Framework:** React Native (latest stable version)
- **Styling:** NativeWind for Tailwind CSS support + shadcn/ui components (adapted for React Native)
- **Real-time Communication:** LiveKit React Native SDK
- **AI Agent Backend:** LiveKit Agent framework (BakeBot)
- **State Management:** React Context API with useContext, useState, useReducer hooks
- **Image Handling:** react-native-image-picker library
- **Audio:** LiveKit's built-in audio handling
- **Navigation:** React Navigation v6+

## Functional Requirements

### FR-1: Application Initialization
**Objective:** Create a functional React Native application with proper configuration.

**Implementation Requirements:**
1. Initialize React Native project with TypeScript enabled
2. Install and configure NativeWind following official documentation
3. Set up React Navigation with the following structure:
   - Stack Navigator as root
   - Tab Navigator for main app sections (if applicable)
   - Modal presentation for settings/image preview
4. Create a theme configuration file with:
   - Color tokens (primary, secondary, background, text, error, success)
   - Typography scale (headings, body, captions)
   - Spacing system (consistent padding/margin values)
   - Border radius values
5. Implement platform-specific configurations (iOS Info.plist, Android AndroidManifest.xml)

**Success Criteria:**
- App launches without errors on iOS and Android
- Navigation transitions work smoothly
- Theme is consistently applied across all screens

---

### FR-2: LiveKit Integration
**Objective:** Establish real-time bidirectional communication with BakeBot agent.

**Implementation Requirements:**

1. **Install LiveKit SDK:**
   ```bash
   npm install @livekit/react-native @livekit/react-native-webrtc
   ```

2. **Create LiveKitService class with the following methods:**
   - `connect(url: string, token: string): Promise<Room>`
   - `disconnect(): Promise<void>`
   - `getConnectionState(): ConnectionState`
   - `publishAudioTrack(track: LocalAudioTrack): void`
   - `subscribeToParticipant(participantSid: string): void`

3. **Implement connection state management:**
   - States: DISCONNECTED, CONNECTING, CONNECTED, RECONNECTING, FAILED
   - Emit state changes via event emitter or callback
   - Implement exponential backoff for reconnection (max 5 attempts)

4. **Create custom hook: `useLiveKit`**
   ```typescript
   interface UseLiveKitReturn {
     room: Room | null;
     connectionState: ConnectionState;
     error: Error | null;
     connect: (token: string) => Promise<void>;
     disconnect: () => Promise<void>;
   }
   ```

5. **Handle platform permissions:**
   - Request microphone permission before connecting
   - Request camera permission before image capture
   - Display rationale messages if permission denied
   - Handle permission results asynchronously

**Success Criteria:**
- Successful connection to LiveKit room with valid token
- Automatic reconnection on network interruption
- Proper cleanup of resources on disconnect
- No memory leaks during connection lifecycle

---

### FR-3: Voice Communication
**Objective:** Enable real-time voice input and output with the agent.

**Implementation Requirements:**

1. **Audio Input (User → Agent):**
   - Create LocalAudioTrack from microphone input
   - Publish audio track to LiveKit room upon connection
   - Implement two modes:
     - **Push-to-Talk:** Record only when button pressed
     - **Continuous:** Always recording (with VAD if available)
   - Display visual feedback: animated waveform or pulsing indicator

2. **Audio Output (Agent → User):**
   - Subscribe to remote participant's audio track
   - Play audio automatically through device speakers/headphones
   - Implement audio focus handling (pause on phone call, resume after)

3. **Create VoiceControls component:**
   ```typescript
   interface VoiceControlsProps {
     mode: 'push-to-talk' | 'continuous';
     isRecording: boolean;
     isMuted: boolean;
     onToggleMute: () => void;
     onToggleRecording: () => void;
     onModeChange: (mode: 'push-to-talk' | 'continuous') => void;
   }
   ```

4. **Visual Audio Feedback:**
   - Real-time audio level visualization (0-100 scale)
   - Different colors for: silent, speaking, listening
   - Smooth animations using React Native Reanimated

5. **Error Handling:**
   - Handle microphone access denial
   - Handle audio playback failures
   - Display user-friendly error messages

**Success Criteria:**
- Voice recorded and transmitted with <500ms latency
- Audio plays clearly without distortion
- Visual feedback accurately reflects audio state
- Mute/unmute functions work correctly

---

### FR-4: Text Chat Interface
**Objective:** Provide traditional text-based communication with the agent.

**Implementation Requirements:**

1. **Data Structure for Messages:**
   ```typescript
   interface Message {
     id: string;
     sender: 'user' | 'agent';
     content: string;
     timestamp: Date;
     status: 'sending' | 'sent' | 'failed';
     type: 'text' | 'image';
     imageUri?: string;
   }
   ```

2. **Message List Component:**
   - Use FlatList with `inverted` prop for chat-style scrolling
   - Implement `keyExtractor` using message id
   - Render message bubbles with different styles for user vs. agent
   - Show timestamps (formatted as "HH:mm" if today, "MMM DD" if older)
   - Auto-scroll to bottom on new message
   - Implement pull-to-refresh for loading history (if applicable)

3. **Message Input Component:**
   - TextInput with multiline support
   - Send button (disabled when input empty)
   - Character count display (optional)
   - Handle keyboard: use KeyboardAvoidingView
   - Clear input after sending

4. **Text Communication Flow:**
   - User types message → Press send
   - Message added to local state with status "sending"
   - Send message via LiveKit data channel:
     ```typescript
     room.localParticipant.publishData(
       encoder.encode(JSON.stringify({ type: 'text', content: message })),
       DataPacket_Kind.RELIABLE
     );
     ```
   - Update status to "sent" on confirmation
   - Listen for agent responses on data channel
   - Add agent messages to chat history

5. **Typing Indicators:**
   - Send typing events when user is typing
   - Display "BakeBot is typing..." when agent is formulating response
   - Use debouncing (500ms) to avoid excessive events

**Success Criteria:**
- Messages send reliably without duplication
- Chat history displays correctly with proper styling
- Keyboard behavior doesn't obscure input
- Typing indicators work accurately

---

### FR-5: Image Upload and Sharing
**Objective:** Allow users to capture or select images to share with the agent.

**Implementation Requirements:**

1. **Install Image Picker:**
   ```bash
   npm install react-native-image-picker
   ```

2. **Image Selection Options:**
   - Create ImagePicker service with methods:
     - `openCamera(): Promise<ImageResult>`
     - `openGallery(): Promise<ImageResult>`
   - Handle permissions for camera and photo library
   - Return image with: uri, width, height, fileSize, type

3. **Image Processing:**
   - Compress images before sending:
     - Max dimension: 1920px
     - Quality: 80%
     - Format: JPEG
   - Use react-native-image-resizer or similar library
   - Calculate and display file size

4. **Image Preview:**
   - Show selected image in modal before sending
   - Allow user to add optional text caption
   - Show compression progress if applicable
   - Options: Send, Retake/Reselect, Cancel

5. **Image Transmission:**
   - Convert image to base64 or upload to storage service
   - Send via LiveKit data channel in chunks if large:
     ```typescript
     const imageData = {
       type: 'image',
       data: base64String,
       metadata: { width, height, mimeType }
     };
     ```
   - Show upload progress indicator
   - Handle upload failures with retry option

6. **Image Display in Chat:**
   - Render images inline in message list
   - Support tap to view fullscreen
   - Show loading placeholder while image loads
   - Cache images to avoid re-downloading

**Success Criteria:**
- Images captured from camera successfully
- Images selected from gallery successfully
- Compressed images maintain acceptable quality
- Images transmitted and displayed correctly in chat
- Fullscreen image viewer works properly

---

I'll help you revise FR-6 to address the multimodal communication challenge. Based on the LiveKit documentation, here's my analysis and recommendation:

## Key Technical Considerations

LiveKit Agents supports multiple communication modes:
- **Voice**: Real-time audio via STT/TTS pipeline
- **Text**: Text streams for chat-style communication
- **Vision**: Image/video input for visual context
- **Data**: For file/image attachments

The challenge is making these modes work seamlessly together without creating UI confusion or technical conflicts.

## Revised FR-6: Multimodal Communication Interface

### Design Philosophy
Create a unified communication interface that adapts based on user input rather than forcing mode selection upfront.

### Technical Implementation

**1. Simultaneous Input Channels**
```
- Audio input: Always listening (with visual indicator)
- Text input: Always available in chat interface
- Image attachment: Button/drag-drop available at all times
```

**2. Agent Processing Strategy**
The LiveKit agent should handle inputs through a unified pipeline:
- Text messages → Direct to LLM (bypasses STT)
- Voice → STT → LLM → TTS (standard voice pipeline)
- Images → Vision model + context to LLM
- All modalities share the same conversation context

**3. Response Mode Intelligence**
The agent responds based on how the user communicated:
- User spoke → Agent responds with voice
- User typed → Agent responds with text (optional: also speak)
- User sent image → Agent analyzes and responds in the same mode user initiated

**4. UI/UX Pattern**

```
┌─────────────────────────────────┐
│  Session View                   │
│  ┌───────────────────────────┐  │
│  │ Conversation History      │  │
│  │ (shows text + audio msgs) │  │
│  └───────────────────────────┘  │
│                                 │
│  [📎] [Type message...] [🎤]   │
│   ↑         ↑            ↑     │
│  Image    Text        Voice    │
└─────────────────────────────────┘
```

**5. Context Preservation**
- All interactions (voice, text, images) append to a unified conversation history
- Agent maintains full context regardless of input mode
- Visual indicator shows which mode is currently active

### Implementation Steps

**Phase 1: Core Infrastructure**
- Set up LiveKit room with data channels enabled
- Configure agent with both voice pipeline and text stream handlers
- Implement vision input handling (image attachment via data streams)

**Phase 2: Input Handling**
- Wire up microphone permission and continuous VAD
- Add text input with real-time send
- Implement image upload via byte streams
- Ensure all three inputs can be active simultaneously

**Phase 3: Agent Logic**
- Build message router that directs inputs to appropriate pipeline
- Implement context merging across all modalities
- Add response mode selection logic
- Handle interruptions gracefully (e.g., user speaks while agent is typing)

**Phase 4: User Experience**
- Visual feedback for active input mode
- Conversation history showing all message types
- Smooth transitions between modes
- Clear indicators of agent processing state

### Key LiveKit Features to Use

- **Text Streams** (`home/client/data/text-streams.md`): For text chat
- **Byte Streams** (`home/client/data/byte-streams.md`): For image attachments
- **Vision** (`agents/build/vision.md`): For image analysis
- **Audio Pipeline**: Standard STT→LLM→TTS
- **Events** (`home/client/events.md`): For coordinating state

### Edge Cases to Handle

1. **Simultaneous Input**: User speaks while typing → Voice takes priority
2. **Mode Switching**: User switches mid-conversation → Context preserved
3. **Image + Text**: User sends image with caption → Both processed together
4. **Interruptions**: User interrupts agent speech with text → Agent stops and processes text

### Benefits of This Approach

- **No Mode Switching**: User never has to explicitly choose a mode
- **Natural Flow**: Communicate however feels natural in the moment
- **Full Context**: Agent "remembers" everything regardless of modality
- **Accessibility**: Users can use whatever input method works best for them

---

### FR-7: User Interface Components
**Objective:** Create elegant, intuitive UI components with consistent styling.

**Implementation Requirements:**

1. **Adapt shadcn/ui Components for React Native:**
   - Button: Touchable component with variants (primary, secondary, ghost)
   - Card: Container with elevation/shadow
   - Avatar: Circular image component for user/agent
   - Badge: Small status indicators
   - Alert: Message display for errors/success
   - Spinner: Loading indicator

2. **Create Custom Components:**

   **a) MessageBubble:**
   ```typescript
   interface MessageBubbleProps {
     message: Message;
     isUser: boolean;
     showAvatar: boolean;
     showTimestamp: boolean;
   }
   ```
   - Rounded corners (user: bottom-right sharp, agent: bottom-left sharp)
   - Background colors: user (primary), agent (secondary)
   - Text color: high contrast with background
   - Padding: 12px horizontal, 8px vertical
   - Max width: 80% of screen width

   **b) VoiceWaveform:**
   ```typescript
   interface VoiceWaveformProps {
     audioLevel: number; // 0-100
     isActive: boolean;
     color: string;
   }
   ```
   - Display 5-7 animated bars
   - Bar height varies with audio level
   - Smooth animations (60fps)
   - Pulsing effect when active

   **c) ConnectionStatusBanner:**
   ```typescript
   interface ConnectionStatusProps {
     status: ConnectionState;
     onRetry: () => void;
   }
   ```
   - Fixed position at top of screen
   - Color coded: green (connected), yellow (connecting), red (failed)
   - Auto-hide when connected after 2 seconds
   - Show retry button when failed

3. **Screen Layouts:**

   **a) ChatScreen:**
   - Header: App title, connection status, settings button
   - Body: Message list (majority of screen)
   - Footer: Input area with mode selector
   - No overlapping elements

   **b) EmptyState (no messages):**
   - Centered illustration or icon
   - Welcome message: "Hi! I'm BakeBot, your virtual sous chef."
   - Suggested prompts: "Ask me about...", "Show me how to..."
   - Fade in animation on first load

4. **Animations and Transitions:**
   - Message appearance: Fade in + slide up (200ms)
   - Mode switching: Cross-fade (150ms)
   - Button press: Scale down to 0.95 (100ms)
   - Loading states: Shimmer effect
   - Use React Native Reanimated for performance

5. **Responsive Design:**
   - Support portrait and landscape orientations
   - Adapt layout for tablets (wider message bubbles, split screen)
   - Handle notch/safe areas (use SafeAreaView)
   - Adjust font sizes for accessibility settings

**Success Criteria:**
- UI is visually consistent across all screens
- All interactions feel smooth (60fps)
- Components are reusable and well-typed
- Layout adapts properly to different screen sizes
- Animations enhance rather than distract

---

### FR-7.5: LiveKit Interaction Readiness Review
**Objective:** Validate and sign off the end-to-end readiness of all LiveKit-powered interactions across frontend and backend so users experience seamless conversations with BakeBot.

**Notes:** Use `DEVELOPMENT_STATUS.md` to align on what is already complete (FR-2 through FR-7 and backend work) and to capture any gaps, defects, or follow-ups discovered during this review.

**Implementation Requirements:**

1. **Cross-Document Alignment**
   - Review `DEVELOPMENT_STATUS.md` to confirm current completion states and recent fixes.
   - Create a short delta list of anything implemented in code that is missing from the blueprint or status, and vice versa.

2. **Frontend Verification (App → LiveKit)**
   - Connection lifecycle: connect, reconnect (exponential backoff), disconnect; verify `ConnectionStatus` banner timing and colors.
   - Audio pipeline: publish `LocalAudioTrack`, subscribe to agent audio, audio focus handling, mute/unmute, PTT and VAD behavior, waveform accuracy and update cadence.
   - Text pipeline: reliable data channel send/receive, message status transitions (sending → sent → failed with retry), typing indicators debounce, ordering and timestamp formatting, keyboard handling.
   - Image pipeline: permission flows, selection (camera/gallery), compression settings (≤1920px, 80% JPEG), base64/chunking transmit, progress UI, inline display and fullscreen viewer with caching.
   - Session management: start/end/update control messages, `voice-ptt` vs `voice-vad` vs `text` defaults (turn detection modes), session-aware UI (input vs voice controls), safe-area layout, End Session flows.
   - Permissions and errors: microphone/camera/photo library rationale and deep links; verify all error messages have recovery actions.

3. **Backend Verification (Agent ↔ LiveKit)**
   - Room join and track handling: agent subscribes/publishes as expected; stable under reconnect.
   - DataChannel contract: conforms to `DataChannelMessage` schema (text, image, control), tolerant to unknown optional fields; control messages update session state correctly.
   - Voice pipeline: STT → LLM → TTS loop; handles interruptions (barge-in) and restarts cleanly; target median round-trip latency ≤500ms on local network.
   - Vision pipeline: receives image + caption + metadata, performs analysis, returns response with appropriate modality.
   - Error handling: graceful degradation, structured logging without secrets, retry policies for transient failures.

4. **Protocol & Schema Contracts**
   - Freeze the message schema used on data channels (keys, types, optional fields) and document it in both frontend and backend repos.
   - Add versioning or capability flags if needed for future compatibility.

5. **End-to-End Test Plan (Manual + Automated)**
   - Manual scenarios on Android and iOS dev clients: initial connect; text-only chat; PTT flow; VAD flow; image+caption; switch modalities mid-session; interrupt agent speech with text and with voice; network loss → auto-reconnect; offline queuing and resend.
   - Measure: time-to-connect, first-response latency (text and audio), reconnection time, and error rates. Record in a lightweight report.
   - Add smoke tests that mock LiveKit Room/Participant to simulate: data channel send/receive, audio publish/subscribe, session start/end control messages.

6. **Documentation & Sign-off**
   - Update `DEVELOPMENT_STATUS.md` with test results, issues found, fixes applied, and remaining action items with owners and priority.
   - Capture known limitations and mitigations; confirm no P0/P1 issues remain for core flows.

**Success Criteria:**
- All FR-3 through FR-6 user flows pass on both Android and iOS using the dev client.
- Median voice round-trip latency ≤500ms on local Wi‑Fi and ≤1s on LTE; no noticeable audio artifacts.
- Seamless modality switching within a single session (text ↔ voice ↔ image) without context loss.
- Reconnection restores prior state; queued messages are sent after reconnect; no duplicate deliveries.
- Frontend and backend share a finalized, documented data channel schema; unknown/extra fields do not break either side.
- No critical (P0/P1) defects open; all issues are tracked with clear owners and timelines.

---

### FR-8: Error Handling and Edge Cases
**Objective:** Handle all error scenarios gracefully with clear user feedback.

**Implementation Requirements:**

1. **Network Errors:**
   - Detect connection loss during active session
   - Display: "Connection lost. Trying to reconnect..." banner
   - Queue messages sent while offline
   - Send queued messages after reconnection
   - Show permanent error if reconnection fails after 5 attempts

2. **Permission Errors:**
   - Microphone denied: Show alert with instructions to enable in settings
   - Camera denied: Same as above
   - Provide deep link to app settings

3. **Audio Errors:**
   - Microphone in use by another app: "Microphone unavailable. Close other apps and try again."
   - Audio playback failure: "Unable to play audio. Check your device volume."
   - Bluetooth device disconnected: Automatically switch to device speaker

4. **Image Errors:**
   - Image too large: Auto-compress or show "Image too large" message
   - Upload failure: Show retry button
   - Unsupported format: "Please select a JPG or PNG image"

5. **Agent Errors:**
   - Agent unavailable: "BakeBot is temporarily unavailable. Please try again."
   - Agent timeout (no response in 30s): "Taking longer than expected..."
   - Malformed response: Log error, show generic error message to user

6. **Input Validation:**
   - Empty text message: Disable send button
   - Text too long: Show character limit warning
   - Invalid image: Show format/size requirements

7. **Timeout Handling:**
   - Connection timeout: 10 seconds
   - Message send timeout: 30 seconds
   - Image upload timeout: 60 seconds
   - Show timeout-specific error messages

8. **Error Recovery:**
   - All errors should have a clear recovery action:
     - "Retry" button
     - "Go to Settings" button
     - "Dismiss" option
   - Log all errors for debugging (but not sensitive data)

**Success Criteria:**
- No crashes due to error conditions
- All error messages are user-friendly
- Users always have a path forward from error states
- Errors are logged appropriately for debugging

---

### FR-9: Performance Optimization
**Objective:** Ensure app performs smoothly on a range of devices.

**Implementation Requirements:**

1. **Message List Optimization:**
   - Use `FlatList` with `windowSize` prop set to 10
   - Implement `getItemLayout` for consistent item heights
   - Use `removeClippedSubviews={true}` on Android
   - Memoize message components with `React.memo`

2. **Image Optimization:**
   - Lazy load images (only load when visible in viewport)
   - Use `react-native-fast-image` for caching and performance
   - Implement progressive loading (blur placeholder → full image)
   - Cache compressed images locally

3. **Animation Performance:**
   - Use `useNativeDriver: true` for all animations
   - Avoid animating layout properties (width, height)
   - Prefer transform and opacity animations
   - Limit simultaneous animations to 3-4

4. **State Management:**
   - Debounce rapid state updates (e.g., typing indicators)
   - Use `useCallback` for event handlers passed as props
   - Use `useMemo` for expensive computations
   - Avoid deeply nested state objects

5. **Bundle Size:**
   - Enable Hermes JavaScript engine
   - Remove unused dependencies
   - Use code splitting where possible
   - Optimize images in assets folder

6. **Memory Management:**
   - Clean up listeners on component unmount
   - Abort pending network requests on unmount
   - Limit conversation history in memory (e.g., last 100 messages)
   - Dispose of audio/video resources properly

**Success Criteria:**
- App startup time <3 seconds
- Smooth scrolling at 60fps with 50+ messages
- Memory usage stays under 150MB
- No memory leaks during extended use

---

### FR-10: Testing Requirements
**Objective:** Ensure code quality and reliability through automated testing.

**Implementation Requirements:**

1. **Unit Tests (Jest):**
   - Test all utility functions (100% coverage)
   - Test custom hooks with @testing-library/react-hooks
   - Test state management logic
   - Mock LiveKit SDK for isolated tests
   - Target: >80% overall code coverage

2. **Component Tests:**
   - Test component rendering with various props
   - Test user interactions (button presses, text input)
   - Test error states
   - Use @testing-library/react-native
   - Snapshot tests for UI components

3. **Integration Tests:**
   - Test full message sending flow (text, voice, image)
   - Test connection/disconnection scenarios
   - Test mode switching
   - Mock network requests and LiveKit interactions

4. **Manual Test Cases:**
   Document test cases for:
   - Connection to LiveKit on both iOS and Android
   - Voice communication quality
   - Image upload from camera and gallery
   - App behavior on network interruption
   - Permission handling
   - Background/foreground transitions

5. **Device Testing Matrix:**
   Test on:
   - iOS: iPhone SE (older), iPhone 14 (newer)
   - Android: Low-end device (2GB RAM), High-end device
   - Tablets: iPad, Android tablet
   - OS versions: iOS 14+, Android 10+

**Success Criteria:**
- All unit and component tests pass
- Integration tests cover critical user flows
- Manual testing completes without critical issues
- App functions on all devices in test matrix

---

## Non-Functional Requirements

### NFR-1: Security
- All LiveKit tokens must be generated server-side and never exposed in client code
- Use HTTPS for all network requests
- No sensitive data (tokens, API keys) in logs or error messages
- Validate all data received from agent before displaying
- Implement certificate pinning for production (optional but recommended)

### NFR-2: Accessibility
- All interactive elements have accessible labels
- Support for screen readers (VoiceOver, TalkBack)
- Minimum touch target size: 44x44 points
- Color contrast ratio: 4.5:1 for text, 3:1 for UI components
- Support dynamic type (font scaling)

### NFR-3: Localization Readiness
- All user-facing strings externalized to language files
- Use i18n library (e.g., react-i18next)
- Support RTL layouts (if targeting RTL languages)
- Date/time formatting based on locale

### NFR-4: Offline Behavior
- Display clear offline indicator
- Queue messages when offline, send when online
- Show cached conversation history
- Disable voice features when offline
- Prevent image uploads when offline

### NFR-5: Battery Optimization
- Suspend LiveKit connection when app backgrounded >5 minutes
- Reduce audio quality in low battery mode
- Stop animations when app not visible
- Use efficient image formats (WebP where supported)

---

## Backend Architecture (LiveKit Agent)

### Backend Framework and Infrastructure

**LiveKit Agent Framework:**
- **Framework**: LiveKit Agents Framework for Python
- **Deployment**: LiveKit Cloud with automatic scaling
- **Containerization**: Docker with health checks
- **Language**: Python 3.11+ with async/await patterns

**Agent Capabilities:**
- **Multimodal Processing**: Text, voice (STT/TTS), and image analysis
- **Real-time Communication**: Low-latency audio streaming and data channels
- **Session Management**: Dynamic session types (text, voice-ptt, voice-vad)
- **Context Preservation**: Conversation history across all modalities
- **Error Handling**: Comprehensive error recovery and logging

**AI Service Integration:**
- **LLM**: Google Gemini 1.5 Flash for text generation
- **Vision**: Google Gemini 1.5 Pro for image analysis
- **STT**: Google Cloud Speech-to-Text with VAD
- **TTS**: Google Cloud Text-to-Speech with optimized voice settings

**Backend Project Structure:**
```
bakebot-agent/
├── main.py                 # Agent entry point and worker setup
├── agent/
│   ├── __init__.py
│   └── bakebot_agent.py    # Core agent implementation
├── services/
│   ├── google_ai_service.py # Google AI integration (LLM + Vision)
│   └── speech_service.py    # Google Cloud STT/TTS
├── models/
│   └── schemas.py          # Pydantic models and types
├── utils/                  # Utility functions
├── Dockerfile             # Production containerization
├── deploy.sh              # LiveKit Cloud deployment
├── test_agent.py          # Local testing suite
└── requirements.txt       # Python dependencies
```

### Backend API Specification

**Data Channel Message Format:**
```typescript
interface DataChannelMessage {
  type: 'text' | 'image' | 'control';
  payload: {
    // Text messages
    content?: string;

    // Image messages
    data?: string;              // Base64 encoded image
    caption?: string;
    metadata?: {
      width: number;
      height: number;
      mimeType: string;
      size: number;
    };

    // Control messages
    action?: 'start_session' | 'end_session';
    session_type?: 'text' | 'voice-ptt' | 'voice-vad';
    voice_mode?: 'push-to-talk' | 'continuous';
    user_id?: string;
    turn_detection?: 'client' | 'server' | 'none';
    status?: string;
  };
  timestamp: number;
  message_id: string;
}
```

**Session Types:**
1. **Text Session**: Pure text-based chat with no audio processing
2. **Voice Push-to-Talk**: Manual recording control with client-side turn detection
3. **Voice VAD**: Continuous monitoring with server-side voice activity detection

**Backend Endpoints:**
- **Connection**: LiveKit room connection with authentication
- **Data Channels**: Reliable transmission for text, images, and control messages
- **Audio Streams**: Real-time audio input/output with <500ms latency
- **Image Processing**: Base64 transmission with compression optimization

### Backend Development Workflow

**Local Development:**
```bash
# Setup environment
cd bakebot-agent
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # Configure API keys

# Run tests
python test_agent.py

# Start local agent
python main.py
```

**Production Deployment:**
```bash
# Deploy to LiveKit Cloud
./deploy.sh

# Monitor logs via LiveKit Cloud dashboard
# Scale automatically based on room connections
```

**Backend Testing Strategy:**
- Unit tests for AI service integration
- Integration tests for LiveKit communication
- End-to-end tests with frontend
- Load testing for concurrent sessions
- Error handling and recovery validation

### Backend Configuration

**Environment Variables:**
```bash
# LiveKit Configuration
LIVEKIT_URL=wss://your-livekit-cloud-url.livekit.cloud
LIVEKIT_API_KEY=your-livekit-api-key
LIVEKIT_API_SECRET=your-livekit-api-secret

# Google AI Configuration
GOOGLE_API_KEY=your-google-ai-api-key
GOOGLE_PROJECT_ID=your-google-cloud-project-id
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json

# Agent Configuration
AGENT_NAME=BakeBot
AGENT_VERSION=1.0.0
DEBUG=false
```

**Docker Configuration:**
- Base: Python 3.11 slim
- Security: Non-root user execution
- Health: Liveness probe and error handling
- Performance: Optimized for concurrent sessions

---

## Configuration and Environment

### Environment Variables Required:
```
LIVEKIT_URL=wss://your-livekit-server.com
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret (server-side only)
API_BASE_URL=https://your-backend-api.com
```

### Platform-Specific Configuration:

**iOS (Info.plist):**
```xml
<key>NSMicrophoneUsageDescription</key>
<string>BakeBot needs microphone access to hear your cooking questions</string>
<key>NSCameraUsageDescription</key>
<string>BakeBot needs camera access to see your cooking</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>BakeBot needs photo access to help with your recipes</string>
```

**Android (AndroidManifest.xml):**
```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.INTERNET" />
```

---

## Project Structure

```
bakebot-app/
├── src/
│   ├── components/
│   │   ├── ui/                    # Base UI components (Button, Card, etc.)
│   │   ├── chat/
│   │   │   ├── MessageList.tsx
│   │   │   ├── MessageBubble.tsx
│   │   │   ├── MessageInput.tsx
│   │   │   └── TypingIndicator.tsx
│   │   ├── voice/
│   │   │   ├── VoiceControls.tsx
│   │   │   ├── VoiceWaveform.tsx
│   │   │   └── AudioVisualizer.tsx
│   │   ├── image/
│   │   │   ├── ImagePicker.tsx
│   │   │   ├── ImagePreview.tsx
│   │   │   └── ImageViewer.tsx
│   │   └── shared/
│   │       ├── ConnectionStatus.tsx
│   │       ├── EmptyState.tsx
│   │       └── ErrorBoundary.tsx
│   ├── screens/
│   │   ├── ChatScreen.tsx
│   │   ├── OnboardingScreen.tsx
│   │   └── SettingsScreen.tsx
│   ├── services/
│   │   ├── LiveKitService.ts
│   │   ├── ImageService.ts
│   │   ├── AudioService.ts
│   │   └── StorageService.ts
│   ├── hooks/
│   │   ├── useLiveKit.ts
│   │   ├── useVoice.ts
│   │   ├── useChat.ts
│   │   └── useImagePicker.ts
│   ├── context/
│   │   ├── AgentContext.tsx
│   │   └── ThemeContext.tsx
│   ├── utils/
│   │   ├── formatters.ts
│   │   ├── validators.ts
│   │   └── constants.ts
│   ├── types/
│   │   ├── message.types.ts
│   │   ├── livekit.types.ts
│   │   └── api.types.ts
│   └── theme/
│       ├── colors.ts
│       ├── typography.ts
│       └── spacing.ts
├── __tests__/
├── ios/
├── android/
├── assets/
├── App.tsx
├── package.json
└── tsconfig.json
```

---

## Critical Implementation Notes for AI Agents

### 1. Explicit Function Signatures
All functions must have explicit TypeScript types. Example:
```typescript
// CORRECT
function sendMessage(content: string, type: MessageType): Promise<void> {
  // implementation
}

// INCORRECT (avoid implicit any)
function sendMessage(content, type) {
  // implementation
}
```

### 2. Error Handling Pattern
Always use try-catch blocks for async operations:
```typescript
try {
  const result = await someAsyncOperation();
  // handle success
} catch (error) {
  console.error('Operation failed:', error);
  // show user-friendly error message
  // provide recovery action
}
```

### 3. State Updates
Never mutate state directly:
```typescript
// CORRECT
setMessages([...messages, newMessage]);

// INCORRECT
messages.push(newMessage);
setMessages(messages);
```

### 4. Cleanup Pattern
Always cleanup in useEffect:
```typescript
useEffect(() => {
  const subscription = someService.subscribe();
  
  return () => {
    subscription.unsubscribe();
  };
}, [dependencies]);
```

### 5. LiveKit Data Channel Format
All data sent through LiveKit must follow this format:
```typescript
interface DataChannelMessage {
  type: 'text' | 'image' | 'control';
  payload: any;
  timestamp: number;
  messageId: string;
}
```

### 6. Testing Mocks
Provide mock implementations for:
- LiveKit Room and Participant objects
- Image picker results
- Network responses
- Audio playback events

---

## Validation Checklist

Before considering any feature complete, verify:
- [ ] TypeScript compiles without errors
- [ ] All props have explicit types
- [ ] Error boundaries wrap risky components
- [ ] Loading states are shown during async operations
- [ ] Empty states are displayed when no data
- [ ] All user actions have visual feedback
- [ ] Network failures are handled gracefully
- [ ] Memory leaks are prevented (cleanup in useEffect)
- [ ] Accessibility labels are present
- [ ] Component works on both iOS and Android

---

## Success Criteria - Complete Application

The application is considered complete when:
1. User can connect to BakeBot via LiveKit successfully
2. User can communicate via voice with <500ms latency
3. User can send text messages with delivery confirmation
4. User can share images from camera or gallery
5. All three modes work simultaneously without conflicts
6. UI is responsive and smooth (60fps)
7. Errors display helpful messages with recovery options
8. App handles network interruptions gracefully
9. App passes all unit, component, and integration tests
10. App functions correctly on iOS 14+ and Android 10+

---

## Glossary

- **LiveKit Room:** Virtual space where client and agent communicate
- **Track:** Stream of audio, video, or data in LiveKit
- **Participant:** Client or agent in a LiveKit room
- **Data Channel:** Mechanism for sending non-audio/video data (text, images)
- **VAD (Voice Activity Detection):** Detecting when user is speaking
- **Push-to-Talk:** Recording only when button is pressed
- **Multimodal:** Supporting multiple input types (voice, text, image)
