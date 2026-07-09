import { create } from 'zustand';

export type View =
  | { name: 'home' }
  | { name: 'chats' }
  | { name: 'chat'; chatId: string }
  | { name: 'profile'; characterId: string }
  | { name: 'editor'; characterId?: string }
  | { name: 'settings' };

interface UiState {
  view: View;
  navigate: (view: View) => void;
}

export const useUiStore = create<UiState>((set) => ({
  view: { name: 'home' },
  navigate: (view) => set({ view }),
}));
