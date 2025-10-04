const { Colors } = require('./src/theme/colors');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./App.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ...Colors,
        border: Colors.border,
        input: Colors.border,
        ring: Colors.primary,
        background: Colors.background,
        foreground: Colors.text,
        primary: {
          DEFAULT: Colors.primary,
          foreground: '#FFFFFF',
        },
        secondary: {
          DEFAULT: Colors.secondary,
          foreground: '#FFFFFF',
        },
        destructive: {
          DEFAULT: Colors.error,
          foreground: '#FFFFFF',
        },
        muted: {
          DEFAULT: Colors.textMuted,
          foreground: Colors.textSecondary,
        },
        accent: {
          DEFAULT: Colors.primaryLight,
          foreground: Colors.text,
        },
        popover: {
          DEFAULT: Colors.background,
          foreground: Colors.text,
        },
        card: {
          DEFAULT: Colors.backgroundSecondary,
          foreground: Colors.text,
        },
        // Custom colors from theme
        agentMessage: {
          DEFAULT: Colors.agentMessage,
          dark: Colors.agentMessageDark,
        },
        voiceActive: Colors.voiceActive,
        voiceInactive: Colors.voiceInactive,
      },
    },
  },
  plugins: [],
};