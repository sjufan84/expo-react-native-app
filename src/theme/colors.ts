export const Colors = {
  // Primary colors
  primary: '#2563eb',
  primaryDark: '#1d4ed8',
  primaryLight: '#3b82f6',

  // Secondary colors
  secondary: '#64748b',
  secondaryDark: '#475569',
  secondaryLight: '#94a3b8',

  // Background colors
  background: '#ffffff',
  backgroundDark: '#0f172a',
  backgroundSecondary: '#f8fafc',
  backgroundSecondaryDark: '#1e293b',

  // Text colors
  text: '#1e293b',
  textDark: '#f1f5f9',
  textSecondary: '#64748b',
  textSecondaryDark: '#94a3b8',
  textMuted: '#94a3b8',
  textMutedDark: '#64748b',

  // Status colors
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',

  // Connection status colors
  connected: '#22c55e',
  connecting: '#f59e0b',
  failed: '#ef4444',
  disconnected: '#64748b',

  // UI element colors
  border: '#e2e8f0',
  borderDark: '#334155',
  divider: '#f1f5f9',
  dividerDark: '#1e293b',

  // Shadow colors
  shadow: '#00000015',
  shadowDark: '#ffffff15',

  // Voice/audio colors
  voiceActive: '#22c55e',
  voiceInactive: '#64748b',
  voiceMuted: '#ef4444',

  // Message colors
  userMessage: '#2563eb',
  agentMessage: '#f1f5f9',
  userMessageDark: '#3b82f6',
  agentMessageDark: '#334155',
} as const;

export type ColorKeys = keyof typeof Colors;