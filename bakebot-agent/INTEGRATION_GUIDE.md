# BakeBot Agent Integration Guide

This guide explains how to integrate the BakeBot LiveKit agent with the frontend React Native application.

## Architecture Overview

```
Frontend (React Native)    ←→    LiveKit Cloud    ←→    BakeBot Agent (Python)
     (User App)                   (Infrastructure)        (AI Backend)
```

## Message Flow

### 1. Text Messages
```
Frontend: MessageInput → AgentContext.sendMessage()
          ↓
LiveKit: Data channel (reliable)
          ↓
Agent: DataChannelMessage → TextMessage → GoogleAI → Response
          ↓
LiveKit: Data channel (reliable)
          ↓
Frontend: MessageBubble update
```

### 2. Voice Messages
```
Frontend: VoiceControls → AudioService → LiveKit audio track
          ↓
LiveKit: Audio stream
          ↓
Agent: VoiceAssistant → STT → GoogleAI → TTS → Audio response
          ↓
LiveKit: Audio stream
          ↓
Frontend: Audio playback
```

### 3. Image Messages
```
Frontend: ImagePicker → ProcessingService → Base64
          ↓
LiveKit: Data channel (reliable)
          ↓
Agent: ImageMessage → GoogleAI Vision → Response
          ↓
LiveKit: Data channel (reliable)
          ↓
Frontend: MessageBubble with image
```

## Configuration

### Environment Variables

**Backend (.env):**
```bash
LIVEKIT_URL=wss://your-livekit-cloud-url.livekit.cloud
LIVEKIT_API_KEY=your-livekit-api-key
LIVEKIT_API_SECRET=your-livekit-api-secret
GOOGLE_API_KEY=your-google-ai-api-key
GOOGLE_PROJECT_ID=your-google-cloud-project-id
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json
```

**Frontend (environment variables or secure storage):**
```typescript
// In your frontend config
const config = {
  LIVEKIT_URL: 'wss://your-livekit-cloud-url.livekit.cloud',
  API_BASE_URL: 'https://your-token-service.com', // For generating tokens
}
```

## Session Management

The agent supports three session types:

### 1. Text Session
- Messages sent via data channel
- Agent responds via data channel
- No audio processing

### 2. Voice Push-to-Talk (PTT)
- User presses button to record
- Audio sent via LiveKit audio tracks
- Agent responds with voice and text

### 3. Voice Voice Activity Detection (VAD)
- Continuous audio monitoring
- Agent detects when user speaks
- Natural conversation flow

## Message Format

### Data Channel Message Schema
```typescript
interface DataChannelMessage {
  type: 'text' | 'image' | 'control';
  payload: {
    content?: string;        // For text messages
    data?: string;          // Base64 image data
    caption?: string;       // Image caption
    action?: string;        // Control actions (start_session, end_session)
    session_type?: string;  // text, voice-ptt, voice-vad
    status?: string;        // Response status
  };
  timestamp: number;
  message_id: string;
}
```

## Frontend Integration Points

### 1. Token Generation
Create a secure endpoint to generate LiveKit tokens:

```typescript
// Example API endpoint
POST /api/token
{
  "user_id": "user123",
  "room_name": "bakebot-session"
}

// Response
{
  "token": "eyJ...",
  "url": "wss://your-livekit-cloud-url.livekit.cloud"
}
```

### 2. Agent Context Updates
Update `AgentContext.tsx` to send proper session management:

```typescript
// When starting a session
const startSession = async (type: SessionType, voiceMode?: string) => {
  const message = {
    type: 'control',
    payload: {
      action: 'start_session',
      session_type: type,
      voice_mode: voiceMode,
      user_id: userId,
      turn_detection: type === 'voice-ptt' ? 'client' : 'server'
    },
    timestamp: Date.now(),
    message_id: generateId()
  };

  await sendMessage(message);
};
```

### 3. Image Processing
Ensure image messages include proper metadata:

```typescript
// When sending images
const sendImage = async (imageData: string, caption?: string) => {
  const message = {
    type: 'image',
    payload: {
      data: imageData,  // Base64
      caption: caption,
      metadata: {
        width: imageWidth,
        height: imageHeight,
        mimeType: 'image/jpeg',
        size: imageSize
      }
    },
    timestamp: Date.now(),
    message_id: generateId()
  };

  await sendMessage(message);
};
```

## Testing the Integration

### 1. Local Testing
```bash
# Backend
cd bakebot-agent
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # Edit with your keys
python main.py
```

### 2. Frontend Testing
Update your frontend to connect to the local agent:
```typescript
// In useLiveKit hook
const connect = async () => {
  const token = await getToken();  // Generate or use test token
  await liveKitService.connect(localLiveKitUrl, token);
};
```

### 3. End-to-End Testing
1. Deploy agent to LiveKit Cloud
2. Update frontend with production URL
3. Test all three session types
4. Verify message flow in both directions

## Troubleshooting

### Common Issues

**1. Connection Failed**
- Check LiveKit URL and credentials
- Verify token generation
- Check network connectivity

**2. No Audio**
- Verify microphone permissions
- Check audio track publishing
- Ensure agent has voice assistant configured

**3. Messages Not Received**
- Check data channel setup
- Verify message format
- Check agent message handlers

**4. Image Analysis Fails**
- Verify Google AI API key
- Check image size and format
- Ensure proper base64 encoding

### Debug Logs

**Backend:**
```python
# Enable debug logging
import logging
logging.basicConfig(level=logging.DEBUG)
```

**Frontend:**
```typescript
// Add logging to AgentContext
console.log('Sending message:', message);
console.log('Received message:', data);
```

## Deployment

### 1. Deploy Agent
```bash
cd bakebot-agent
./deploy.sh
```

### 2. Update Frontend
Update frontend configuration with production LiveKit URL

### 3. Monitor
Check LiveKit Cloud dashboard for agent status and room connections

## Security Considerations

1. **Token Security**: Always generate tokens server-side
2. **API Keys**: Never expose API keys in frontend
3. **Data Validation**: Validate all incoming messages
4. **Rate Limiting**: Implement rate limiting on token generation
5. **Error Handling**: Don't expose internal errors to users

## Performance Optimization

1. **Audio Quality**: Adjust sample rates and bitrates
2. **Image Compression**: Optimize image sizes before transmission
3. **Connection Pooling**: Reuse connections where possible
4. **Caching**: Cache AI responses for common queries
5. **Scaling**: Use LiveKit Cloud for automatic scaling