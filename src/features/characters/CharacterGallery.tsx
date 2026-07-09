import { useRef } from 'react';
import { Plus, Upload, MessageCircle } from 'lucide-react';
import { useCharacterStore } from '../../stores/character-store';
import { useChatStore } from '../../stores/chat-store';
import { useUiStore } from '../../stores/ui-store';
import { Button } from '../../components/ui/button';
import { pickGreeting, type CharacterCard } from '../../core/character/character';

const CharacterTile = ({ character }: { character: CharacterCard }) => {
  const navigate = useUiStore((s) => s.navigate);
  const createChat = useChatStore((s) => s.createChat);

  return (
    <div
      className="group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl bg-surface-800 ring-1 ring-surface-700 transition-transform hover:-translate-y-0.5 hover:ring-accent-500/50"
      onClick={() => navigate({ name: 'profile', characterId: character.id })}
    >
      <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-gradient-to-br from-accent-500/25 via-surface-800 to-rose-flame/15">
        {character.avatarUrl ? (
          <img src={character.avatarUrl} alt={character.name} className="h-full w-full object-cover" />
        ) : (
          <span className="text-5xl font-bold text-accent-400/70">{character.name.slice(0, 1)}</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="font-semibold text-zinc-50">{character.name}</h3>
        <p className="line-clamp-2 text-xs text-zinc-400">{character.tagline || character.description}</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {character.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded-full bg-surface-700 px-2 py-0.5 text-[10px] text-zinc-400">
              {tag}
            </span>
          ))}
        </div>
      </div>
      <Button
        size="sm"
        className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100"
        onClick={(event) => {
          event.stopPropagation();
          const chat = createChat(character.id, pickGreeting(character), character.name);
          navigate({ name: 'chat', chatId: chat.id });
        }}
      >
        <MessageCircle size={14} /> Chat
      </Button>
    </div>
  );
};

export const CharacterGallery = () => {
  const characters = useCharacterStore((s) => s.characters);
  const importFromJson = useCharacterStore((s) => s.importFromJson);
  const navigate = useUiStore((s) => s.navigate);
  const fileInput = useRef<HTMLInputElement>(null);

  const handleImportFile = async (file: File) => {
    try {
      const card = importFromJson(JSON.parse(await file.text()));
      navigate({ name: 'profile', characterId: card.id });
    } catch (error) {
      alert(`Import failed: ${(error as Error).message}`);
    }
  };

  return (
    <div className="mx-auto max-w-4xl p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Characters</h1>
          <p className="text-xs text-zinc-500">Pick a soul to talk to</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
            <Upload size={14} /> Import
          </Button>
          <Button size="sm" onClick={() => navigate({ name: 'editor' })}>
            <Plus size={14} /> New
          </Button>
        </div>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleImportFile(file);
          event.target.value = '';
        }}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {characters.map((character) => (
          <CharacterTile key={character.id} character={character} />
        ))}
      </div>
    </div>
  );
};
