import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AffectVector } from '../core/emotion/emotion-engine';
import { createInitialAffect } from '../core/emotion/emotion-engine';
import type { RelationshipState } from '../core/relationship/relationship-engine';
import { createInitialRelationship } from '../core/relationship/relationship-engine';
import type { RelationshipVector } from '../core/relationship/relationship-vector';
import type { RelationshipEvent } from '../core/relationship/relationship-events';
import type { MemoryRecordProps } from '../core/memory/memory-record';
import type { TimelineEvent } from '../core/timeline/story-timeline';
import { generateId } from '../lib/utils';
import { guardedStorage } from './settings-store';
import { MemoryEngine } from '../core/memory/memory-engine';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
  createdAt: number;
}

export interface Chat {
  id: string;
  characterId: string;
  title: string;
  messages: ChatMessage[];
  affect: AffectVector;
  relationship: RelationshipState;
  // Relationship Engine v0.2 (feature-flagged, optional for backward compat).
  // Seeded lazily from `relationship` on first v2 turn; the ledger is the audit
  // trail. Absent on legacy chats until migrated.
  relationshipV2?: RelationshipVector;
  relationshipLedger?: RelationshipEvent[];
  memories: MemoryRecordProps[];
  timeline: TimelineEvent[];
  createdAt: number;
  updatedAt: number;
}

export interface ChatExport {
  version: 1;
  app: 'namochat';
  chats: Chat[];
}

interface ChatState {
  chats: Chat[];
  activeChatId: string | null;
  streamingMessageId: string | null;

  createChat: (characterId: string, firstMessage: string, title: string) => Chat;
  deleteChat: (chatId: string) => void;
  setActiveChat: (chatId: string | null) => void;
  appendMessage: (chatId: string, message: ChatMessage) => void;
  updateMessageContent: (chatId: string, messageId: string, content: string) => void;
  removeMessagesFrom: (chatId: string, messageId: string) => void;
  setStreamingMessageId: (messageId: string | null) => void;
  patchChat: (chatId: string, patch: Partial<Chat>) => void;
  pinMemory: (chatId: string, memoryId: string) => void;
  forgetMemory: (chatId: string, memoryId: string) => void;
  addWorldMemory: (chatId: string, content: string) => void;
  addTimelineEvent: (chatId: string, event: TimelineEvent) => void;
  forkChat: (chatId: string, messageId: string) => Chat | null;
  exportChats: () => string;
  importChats: (json: unknown) => number;
}

const touch = (chat: Chat): Chat => ({ ...chat, updatedAt: Date.now() });

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      chats: [],
      activeChatId: null,
      streamingMessageId: null,

      createChat: (characterId, firstMessage, title) => {
        const chat: Chat = {
          id: generateId(),
          characterId,
          title,
          messages: [
            { id: generateId(), role: 'assistant', content: firstMessage, createdAt: Date.now() },
          ],
          affect: createInitialAffect(),
          relationship: createInitialRelationship(),
          memories: [],
          timeline: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((state) => ({ chats: [chat, ...state.chats], activeChatId: chat.id }));
        return chat;
      },

      deleteChat: (chatId) =>
        set((state) => ({
          chats: state.chats.filter((c) => c.id !== chatId),
          activeChatId: state.activeChatId === chatId ? null : state.activeChatId,
        })),

      setActiveChat: (chatId) => set({ activeChatId: chatId }),

      appendMessage: (chatId, message) =>
        set((state) => ({
          chats: state.chats.map((chat) =>
            chat.id === chatId ? touch({ ...chat, messages: [...chat.messages, message] }) : chat,
          ),
        })),

      updateMessageContent: (chatId, messageId, content) =>
        set((state) => ({
          chats: state.chats.map((chat) =>
            chat.id === chatId
              ? touch({
                  ...chat,
                  messages: chat.messages.map((m) => (m.id === messageId ? { ...m, content } : m)),
                })
              : chat,
          ),
        })),

      // Removes the given message and everything after it (regenerate support).
      removeMessagesFrom: (chatId, messageId) =>
        set((state) => ({
          chats: state.chats.map((chat) => {
            if (chat.id !== chatId) return chat;
            const index = chat.messages.findIndex((m) => m.id === messageId);
            return index < 0 ? chat : touch({ ...chat, messages: chat.messages.slice(0, index) });
          }),
        })),

      setStreamingMessageId: (streamingMessageId) => set({ streamingMessageId }),

      patchChat: (chatId, patch) =>
        set((state) => ({
          chats: state.chats.map((chat) =>
            chat.id === chatId ? touch({ ...chat, ...patch }) : chat,
          ),
        })),

      pinMemory: (chatId, memoryId) =>
        set((state) => ({
          chats: state.chats.map((chat) => {
            if (chat.id !== chatId) return chat;
            const engine = new MemoryEngine(chat.memories);
            engine.pin(memoryId);
            return touch({ ...chat, memories: engine.toProps() });
          }),
        })),

      forgetMemory: (chatId, memoryId) =>
        set((state) => ({
          chats: state.chats.map((chat) => {
            if (chat.id !== chatId) return chat;
            const engine = new MemoryEngine(chat.memories);
            engine.forgetOne(memoryId);
            return touch({ ...chat, memories: engine.toProps() });
          }),
        })),

      addWorldMemory: (chatId, content) =>
        set((state) => ({
          chats: state.chats.map((chat) => {
            if (chat.id !== chatId || !content.trim()) return chat;
            const engine = new MemoryEngine(chat.memories);
            // World memories are pinned high so they survive weighting.
            engine.remember({
              id: generateId(),
              chatId: chat.id,
              role: 'world',
              content: content.trim(),
              emotionWeight: 0.9,
              timestamp: Date.now(),
            });
            return touch({ ...chat, memories: engine.toProps() });
          }),
        })),

      addTimelineEvent: (chatId, event) =>
        set((state) => ({
          chats: state.chats.map((chat) =>
            chat.id === chatId ? touch({ ...chat, timeline: [...chat.timeline, event] }) : chat,
          ),
        })),

      // Fork: a new chat carrying history up to and including messageId, plus
      // the affect/relationship/memory/timeline snapshot — for branching.
      forkChat: (chatId, messageId) => {
        const source = get().chats.find((c) => c.id === chatId);
        if (!source) return null;
        const cutoff = source.messages.findIndex((m) => m.id === messageId);
        if (cutoff < 0) return null;
        const forkId = generateId();
        const fork: Chat = {
          ...source,
          id: forkId,
          title: `${source.title} (branch)`,
          messages: source.messages.slice(0, cutoff + 1).map((m) => ({ ...m })),
          // Remap chatId so per-chat recall works in the branch; world memories
          // stay role='world' and remain shared.
          memories: source.memories.map((m) => ({
            ...m,
            chatId: m.role === 'world' ? m.chatId : forkId,
          })),
          timeline: source.timeline.map((event) => ({ ...event, chatId: forkId })),
          // Branch inherits the relationship snapshot + ledger up to the fork,
          // then diverges independently (RELATIONSHIP_SEQUENCE_DIAGRAM §4, B1).
          relationshipV2: source.relationshipV2 ? { ...source.relationshipV2 } : undefined,
          relationshipLedger: source.relationshipLedger?.map((event) => ({
            ...event,
            scopeId: forkId,
          })),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((state) => ({ chats: [fork, ...state.chats], activeChatId: fork.id }));
        return fork;
      },

      exportChats: () => {
        const payload: ChatExport = { version: 1, app: 'namochat', chats: get().chats };
        return JSON.stringify(payload, null, 2);
      },

      importChats: (json) => {
        if (typeof json !== 'object' || json === null) throw new Error('Invalid chat export file.');
        const payload = json as Partial<ChatExport>;
        if (payload.app !== 'namochat' || !Array.isArray(payload.chats)) {
          throw new Error('Not a NamoChat export file.');
        }
        const incoming = payload.chats;
        set((state) => {
          const existingIds = new Set(state.chats.map((c) => c.id));
          const fresh = incoming.filter((c) => !existingIds.has(c.id));
          return { chats: [...fresh, ...state.chats] };
        });
        return incoming.length;
      },
    }),
    {
      name: 'namochat:chats',
      storage: createJSONStorage(() => guardedStorage),
      partialize: (state) => ({ chats: state.chats, activeChatId: state.activeChatId }),
    },
  ),
);
