# Building Your Expo Dev Client

## Why You Need This

**Expo Go** doesn't support native modules like `@livekit/react-native`. You need to build a **custom dev client** that includes all the native code.

---

## Quick Start (Choose One Method)

### **Method 1: EAS Build (Cloud - Easiest)** ✅ Recommended

This builds your app in the cloud without needing Android Studio or Xcode installed.

#### Step 1: Install EAS CLI
```bash
npm install -g eas-cli
```

#### Step 2: Login to Expo
```bash
eas login
```

#### Step 3: Configure EAS
```bash
eas build:configure
```

**Note:** The project includes a `.npmrc` file with `legacy-peer-deps=true` to handle peer dependency conflicts during EAS builds.

#### Step 4: Build for Android (Development Build)
```bash
eas build --profile development --platform android
```

Or for iOS:
```bash
eas build --profile development --platform ios
```

#### Step 5: Install the Build
- EAS will provide a QR code or download link
- Install the APK on your Android device or the app on your iOS device
- This is your custom dev client with LiveKit support!

#### Step 6: Start Development
```bash
npm start
```
- Use the custom dev client app you just installed (NOT Expo Go)
- Scan the QR code with your custom client

---

### **Method 2: Local Build (Requires Android Studio/Xcode)**

#### For Android:

1. **Prebuild the native code:**
```bash
npx expo prebuild --platform android
```

2. **Run on Android:**
```bash
npm run android
```

This will:
- Generate the native Android project
- Install dependencies
- Build and run on your connected device/emulator

#### For iOS:

1. **Prebuild the native code:**
```bash
npx expo prebuild --platform ios
```

2. **Install CocoaPods dependencies:**
```bash
cd ios && pod install && cd ..
```

3. **Run on iOS:**
```bash
npm run ios
```

---

## What's the Difference?

| Feature | Expo Go | Custom Dev Client |
|---------|---------|-------------------|
| Native Modules | ❌ No | ✅ Yes |
| LiveKit Support | ❌ No | ✅ Yes |
| Build Required | ❌ No | ✅ Yes (once) |
| Fast Refresh | ✅ Yes | ✅ Yes |
| OTA Updates | ✅ Yes | ✅ Yes |

---

## Troubleshooting

### "No development build found"
- Make sure you're using the custom dev client app, not Expo Go
- The app icon will say "expo-react-native-app" (or your app name)

### Build fails
- Run `npx expo-doctor` to check for issues
- Make sure you're logged into EAS: `eas whoami`

### Can't scan QR code
- Make sure your phone and computer are on the same network
- Try running `npm start --tunnel`

---

## Next Steps After Building

Once you have your custom dev client installed:

1. ✅ LiveKit will work
2. ✅ All native modules will work
3. ✅ You still get fast refresh and hot reloading
4. ✅ You can develop just like with Expo Go, but with full native support

---

## Important Notes

- ⚠️ You need to rebuild the dev client only when:
  - Adding/removing native modules
  - Changing native configuration
  - Updating native dependencies

- ✅ For regular code changes (TypeScript, components, etc.):
  - Just use `npm start` - no rebuild needed!
  - Fast refresh works just like Expo Go

---

## Recommended: Use EAS Build

I highly recommend **Method 1 (EAS Build)** because:
- ✅ No need to install Android Studio or Xcode
- ✅ Builds happen in the cloud
- ✅ Free tier available
- ✅ Much easier to set up
- ✅ Works on any computer (Windows, Mac, Linux)

