export const APP_CONFIG = {
  name: 'BakeBot',
  version: '1.0.0',
  description: 'Your AI Sous Chef',
} as const;

export const LIVEKIT_CONFIG = {
  url: 'wss://your-livekit-server.com', // Will be configured via environment variables
  reconnectAttempts: 5,
  reconnectDelay: 1000, // ms
  connectionTimeout: 10000, // ms
} as const;

export const AUDIO_CONFIG = {
  sampleRate: 44100,
  channels: 1,
  bitRate: 128000,
  bufferSize: 4096,
  maxRecordingDuration: 60000, // 1 minute in ms
} as const;

export const IMAGE_CONFIG = {
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 0.8,
  format: 'jpeg',
  maxFileSize: 5 * 1024 * 1024, // 5MB
} as const;

export const CHAT_CONFIG = {
  maxMessageLength: 1000,
  typingIndicatorDelay: 500, // ms
  messageTimeout: 30000, // ms
  maxHistorySize: 100,
} as const;

export const UI_CONFIG = {
  animationDuration: {
    fast: 150,
    normal: 200,
    slow: 300,
  },
  debounceDelay: 300,
  longPressDelay: 500,
} as const;

export const ERROR_MESSAGES = {
  network: 'Network connection lost. Please check your internet connection.',
  microphone: 'Microphone access is required for voice communication.',
  camera: 'Camera access is required to share images.',
  connection: 'Unable to connect to BakeBot. Please try again.',
  timeout: 'Connection timed out. Please try again.',
  imageTooLarge: 'Image is too large. Please select a smaller image.',
  unsupportedFormat: 'Unsupported file format. Please use JPG or PNG.',
  generic: 'Something went wrong. Please try again.',
} as const;

export const PERMISSIONS = {
  microphone: {
    title: 'Microphone Access',
    message: 'BakeBot needs microphone access to hear your cooking questions',
    button: 'Allow Microphone',
  },
  camera: {
    title: 'Camera Access',
    message: 'BakeBot needs camera access to see your cooking',
    button: 'Allow Camera',
  },
  photoLibrary: {
    title: 'Photo Library Access',
    message: 'BakeBot needs photo access to help with your recipes',
    button: 'Allow Photos',
  },
} as const;