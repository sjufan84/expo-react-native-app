// Navigation types
export type RootStackParamList = {
  Home: undefined;
  Profile: undefined;
  Settings: undefined;
};

export type TabParamList = {
  HomeTab: undefined;
  ProfileTab: undefined;
  SettingsTab: undefined;
};

// Common types
export interface User {
  id: string;
  name: string;
  email: string;
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}
