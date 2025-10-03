# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Development
- `npm install --legacy-peer-deps` - Install dependencies (use legacy peer deps for this project)
- `npm start` - Start development server for custom dev client
- `npm run android` - Build and run on Android
- `npm run ios` - Build and run on iOS (macOS only)
- `npm run web` - Run in web browser

### Build and Prebuild
- `npm run prebuild` - Generate native code
- `npm run prebuild:clean` - Clean and regenerate native code

### Code Quality
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint errors automatically
- `npm run format` - Format code with Prettier
- `npm run type-check` - Run TypeScript type checking

## Architecture Overview

This is an Expo React Native app with LiveKit integration for real-time voice/video communication. The app uses a modern architecture with TypeScript, React Navigation, and context-based state management.

### Key Architecture Components

**Context Providers:**
- `AgentContext` (src/context/AgentContext.tsx) - Manages chat messages, connection state, and agent interactions using useReducer
- `ThemeContext` (src/context/ThemeContext.tsx) - Handles light/dark theme switching

**LiveKit Integration:**
- `LiveKitService` (src/services/LiveKitService.ts) - Singleton service class for LiveKit room management
- `useLiveKit` hook (src/hooks/useLiveKit.ts) - React hook wrapping LiveKit functionality
- Uses LiveKit for real-time audio/video and data channel messaging

**Navigation:**
- Stack navigation with Chat and Settings screens
- React Navigation stack with gesture-based animations
- No header shown, custom screen configurations

**State Management:**
- Context-based state with useReducer pattern for agent/chat state
- Message management with status tracking (sending, sent, failed)
- Connection state management through LiveKit integration

**Key Features:**
- Multi-modal input support (text, voice, image)
- Real-time messaging via LiveKit data channels
- Permission handling for microphone and camera
- Connection status monitoring and reconnection logic
- TypeScript throughout for type safety

### Project Structure

```
src/
├── components/          # Reusable UI components
├── context/            # React context providers (Agent, Theme)
├── hooks/              # Custom React hooks (useLiveKit, useVoice)
├── screens/            # Screen components (ChatScreen, SettingsScreen)
├── services/           # Service classes (LiveKitService, AudioService, PermissionService)
├── types/              # TypeScript type definitions
└── utils/              # Utility functions and constants
```

### Important Notes

**LiveKit Dependencies:**
- This app uses native LiveKit modules and CANNOT run on Expo Go
- Custom development client required - see BUILD_INSTRUCTIONS.md
- Requires microphone and camera permissions

**Message Types:**
- Supports text, image, and voice messages
- Data channel messaging for real-time communication
- Message status tracking (sending, sent, failed)

**Connection Management:**
- Automatic reconnection with exponential backoff
- Connection state monitoring and error handling
- Permission handling before connection

**Development Setup:**
- Must use `npm install --legacy-peer-deps` due to dependency conflicts
- EAS Build available for cloud-based development builds
- Local development requires Android Studio/Xcode setup