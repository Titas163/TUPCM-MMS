import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, Settings } from '../types';

interface AppState {
  user: User | null;
  setUser: (user: User | null) => void;
  language: 'en' | 'bn';
  setLanguage: (lang: 'en' | 'bn') => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  settings: Settings | null;
  setSettings: (settings: Settings | null) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      language: 'bn',
      setLanguage: (language) => set({ language }),
      theme: 'light',
      setTheme: (theme) => set({ theme }),
      settings: null,
      setSettings: (settings) => set({ settings }),
      isLoading: true,
      setIsLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: 'madrasa-storage',
      partialize: (state) => ({ language: state.language, theme: state.theme }), // Only persist language and theme locally
    }
  )
);
