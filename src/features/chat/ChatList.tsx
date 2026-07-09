import { useRef, useState } from 'react';
import { Download, Search, Trash2, Upload } from 'lucide-react';
import { useChatStore } from '../../stores/chat-store';
import { useCharacterStore } from '../../stores/character-store';
import { useUiStore } from '../../stores/ui-store';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { downloadFile } from '../../lib/utils';

export const ChatList = () => {
  const chats = useChatStore((s) => s.chats);
  const deleteChat = useChatStore((s) => s.deleteChat);
  const exportChats = useChatStore((s) => s.exportChats);
  const importChats = useChatStore((s) => s.importChats);
  const characters = useCharacterStore((s) => s.characters);
  const navigate = useUiStore((s) => s.navigate);
  const [query, setQuery] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const needle = query.trim().toLowerCase();
  const filtered = needle
    ? chats.filter(
        (chat) =>
          chat.title.toLowerCase().includes(needle) ||
          chat.messages.some((m) => m.content.toLowerCase().includes(needle)),
      )
    : chats;

  return (
    <div className="mx-auto max-w-2xl p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Chats</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadFile('namochat-export.json', exportChats())}
            disabled={chats.length === 0}
          >
            <Download size={14} /> Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
            <Upload size={14} /> Import
          </Button>
        </div>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (file) {
            try {
              importChats(JSON.parse(await file.text()));
            } catch (error) {
              alert(`Import failed: ${(error as Error).message}`);
            }
          }
          event.target.value = '';
        }}
      />

      <div className="relative mb-3">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <Input
          className="pl-9"
          placeholder="Search chats…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {filtered.length === 0 && (
        <p className="py-12 text-center text-sm text-zinc-500">
          {chats.length === 0 ? 'No chats yet — pick a character to begin.' : 'No matches.'}
        </p>
      )}

      <div className="space-y-2">
        {filtered.map((chat) => {
          const character = characters.find((c) => c.id === chat.characterId);
          const last = chat.messages[chat.messages.length - 1];
          return (
            <div
              key={chat.id}
              className="group flex cursor-pointer items-center gap-3 rounded-2xl bg-surface-800 p-3 ring-1 ring-surface-700 transition-colors hover:ring-accent-500/50"
              onClick={() => navigate({ name: 'chat', chatId: chat.id })}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-accent-500/40 to-rose-flame/30 text-lg font-bold text-white">
                {character?.avatarUrl ? (
                  <img src={character.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  (character?.name ?? chat.title).slice(0, 1)
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-zinc-100">{character?.name ?? chat.title}</p>
                <p className="line-clamp-1 text-xs text-zinc-500">{last?.content}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="opacity-0 group-hover:opacity-100"
                onClick={(event) => {
                  event.stopPropagation();
                  if (confirm('Delete this chat?')) deleteChat(chat.id);
                }}
              >
                <Trash2 size={15} className="text-rose-flame" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
