import { Message, ImageData } from '../types/message.types';
import { IMAGE_CONFIG, CHAT_CONFIG } from './constants';

export const isValidMessage = (message: Partial<Message>): message is Message => {
  return !!(
    message.id &&
    message.sender &&
    message.content &&
    message.timestamp &&
    message.status &&
    message.type
  );
};

export const validateImageFile = (image: ImageData): string | null => {
  if (image.fileSize > IMAGE_CONFIG.maxFileSize) {
    return `Image size must be less than ${Math.round(IMAGE_CONFIG.maxFileSize / (1024 * 1024))}MB`;
  }

  if (image.width > IMAGE_CONFIG.maxWidth || image.height > IMAGE_CONFIG.maxHeight) {
    return `Image dimensions must be less than ${IMAGE_CONFIG.maxWidth}x${IMAGE_CONFIG.maxHeight} pixels`;
  }

  const supportedFormats = ['image/jpeg', 'image/png', 'image/jpg'];
  if (!supportedFormats.includes(image.type.toLowerCase())) {
    return 'Only JPEG and PNG images are supported';
  }

  return null;
};

export const validateTextMessage = (content: string): string | null => {
  if (!content || content.trim().length === 0) {
    return 'Message cannot be empty';
  }

  if (content.length > CHAT_CONFIG.maxMessageLength) {
    return `Message cannot exceed ${CHAT_CONFIG.maxMessageLength} characters`;
  }

  return null;
};

export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const isValidUrl = (url: string): boolean => {
  try {
    // Use a simple regex check instead of URL constructor for React Native compatibility
    const urlRegex = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)$/;
    return urlRegex.test(url);
  } catch {
    return false;
  }
};

export const sanitizeHtml = (html: string): string => {
  // Basic HTML sanitization - in a real app, use a proper library like DOMPurify
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
};

export const validateConnectionState = (state: string): boolean => {
  const validStates = ['DISCONNECTED', 'CONNECTING', 'CONNECTED', 'RECONNECTING', 'FAILED'];
  return validStates.includes(state);
};

export const validateInputMode = (mode: string): boolean => {
  const validModes = ['voice', 'text', 'image'];
  return validModes.includes(mode);
};