# Expo React Native App with LiveKit

A modern React Native app built with Expo, TypeScript, React Navigation, and LiveKit for real-time voice/video communication.

## 🚀 Features

- **Expo SDK 54** - Latest Expo framework with Dev Client
- **LiveKit Integration** - Real-time audio/video communication
- **TypeScript** - Full type safety
- **React Navigation** - Stack navigation with Chat and Settings screens
- **Theme System** - Light/Dark mode support
- **ESLint & Prettier** - Code quality and formatting
- **Modern Project Structure** - Organized folders and files

## 📁 Project Structure

```
src/
├── components/          # Reusable UI components
├── screens/            # Screen components
├── navigation/         # Navigation configuration
├── types/             # TypeScript type definitions
├── utils/             # Utility functions
└── hooks/             # Custom React hooks
```

## 🛠️ Development Setup

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Expo CLI (`npm install -g @expo/cli`)
- **For Android**: Android Studio or a physical device
- **For iOS**: Xcode (macOS only) or a physical device

### ⚠️ Important: Dev Client Required

**This app uses LiveKit (native module) and CANNOT run on Expo Go.**

You must build a custom development client. See **[BUILD_INSTRUCTIONS.md](./BUILD_INSTRUCTIONS.md)** for detailed steps.

### Quick Start

#### Option 1: Local Development (Requires Android Studio/Xcode)

1. Install dependencies:
```bash
npm install --legacy-peer-deps
```

2. Run on Android:
```bash
npm run android
```

3. Run on iOS (macOS only):
```bash
npm run ios
```

#### Option 2: EAS Build (Cloud - No local setup needed)

1. Install EAS CLI:
```bash
npm install -g eas-cli
```

2. Build development client:
```bash
eas login
eas build:configure
eas build --profile development --platform android
```

3. Install the built APK/IPA on your device

4. Start development:
```bash
npm start
```

For detailed instructions, see **[BUILD_INSTRUCTIONS.md](./BUILD_INSTRUCTIONS.md)**

## 📱 Available Scripts

- `npm start` - Start dev server for custom dev client
- `npm run start:go` - Start for Expo Go (won't work with LiveKit)
- `npm run android` - Build and run on Android
- `npm run ios` - Build and run on iOS
- `npm run web` - Run in web browser
- `npm run prebuild` - Generate native code
- `npm run prebuild:clean` - Clean and regenerate native code
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint errors
- `npm run format` - Format code with Prettier
- `npm run type-check` - Run TypeScript type checking

## 🎯 Getting Started

1. The app starts with a Home screen
2. Navigate to Profile and Settings screens using the buttons
3. Each screen demonstrates different UI patterns and navigation

## 📦 Key Dependencies

### Core
- `expo` - Expo SDK 54
- `expo-dev-client` - Custom development builds
- `react-navigation` - Navigation library
- `react-native-screens` - Native screen optimization
- `react-native-safe-area-context` - Safe area handling

### LiveKit
- `@livekit/react-native` - LiveKit React Native SDK
- `@livekit/react-native-webrtc` - WebRTC support
- `livekit-client` - LiveKit client for E2EE

### Animation & UI
- `react-native-reanimated` - Advanced animations
- `react-native-worklets` - Worklets support
- `react-native-gesture-handler` - Gesture handling

## 🔧 Development Tools

- **ESLint** - Code linting with TypeScript support
- **Prettier** - Code formatting
- **TypeScript** - Type safety and better development experience

## 📱 Platform Support

- ✅ iOS
- ✅ Android
- ✅ Web

## 🚀 Next Steps

1. Add your custom components to `src/components/`
2. Create new screens in `src/screens/`
3. Add navigation routes in `src/navigation/`
4. Define types in `src/types/`
5. Add utility functions in `src/utils/`
6. Create custom hooks in `src/hooks/`

Happy coding! 🎉
