import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import type { ProviderConfig } from '../core/providers/types';
import { PROVIDER_PRESETS } from '../core/providers/model-router';

// Guarded storage: failures degrade to in-memory (donor-repo pattern).
export const guardedStorage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value);
    } catch {
      // quota/private mode — keep working in-memory
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name);
    } catch {
      // ignore
    }
  },
};

interface SettingsState {
  userName: string;
  provider: ProviderConfig;
  setUserName: (name: string) => void;
  setProvider: (provider: ProviderConfig) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      userName: 'You',
      provider: {
        kind: 'mock',
        model: PROVIDER_PRESETS.mock.defaultModel,
        temperature: 0.85,
        maxOutputTokens: 1024,
      },
      setUserName: (userName) => set({ userName }),
      setProvider: (provider) => set({ provider }),
    }),
    { name: 'namochat:settings', storage: createJSONStorage(() => guardedStorage) },
  ),
);
