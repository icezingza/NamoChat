import { ArrowLeft, Download, MessageCircle, Pencil, Trash2 } from 'lucide-react';
import { useCharacterStore } from '../../stores/character-store';
import { useChatStore } from '../../stores/chat-store';
import { useUiStore } from '../../stores/ui-store';
import { Button } from '../../components/ui/button';
import { exportCharacterCard, pickGreeting } from '../../core/character/character';
import { downloadFile } from '../../lib/utils';

export const CharacterProfile = ({ characterId }: { characterId: string }) => {
  const character = useCharacterStore((s) => s.characters.find((c) => c.id === characterId));
  const deleteCharacter = useCharacterStore((s) => s.deleteCharacter);
  const createChat = useChatStore((s) => s.createChat);
  const chats = useChatStore((s) => s.chats);
  const navigate = useUiStore((s) => s.navigate);

  if (!character) {
    return (
      <div className="p-8 text-center text-zinc-500">
        Character not found.
        <Button variant="ghost" className="mx-auto mt-4" onClick={() => navigate({ name: 'home' })}>
          Back
        </Button>
      </div>
    );
  }

  const characterChats = chats.filter((c) => c.characterId === character.id);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="relative h-52 overflow-hidden bg-gradient-to-br from-accent-500/30 via-surface-900 to-rose-flame/20">
        {character.avatarUrl && (
          <img
            src={character.avatarUrl}
            alt={character.name}
            className="h-full w-full object-cover opacity-70"
          />
        )}
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-3 top-3 bg-surface-950/50 backdrop-blur"
          onClick={() => navigate({ name: 'home' })}
        >
          <ArrowLeft size={18} />
        </Button>
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-surface-950 to-transparent p-4 pt-12">
          <h1 className="text-2xl font-bold">{character.name}</h1>
          <p className="text-sm text-accent-400">{character.tagline}</p>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <div className="flex flex-wrap gap-1.5">
          {character.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-surface-700 px-2.5 py-1 text-xs text-zinc-300">
              {tag}
            </span>
          ))}
        </div>

        <section className="rounded-2xl bg-surface-800 p-4 ring-1 ring-surface-700">
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">About</h2>
          <p className="whitespace-pre-wrap text-sm text-zinc-300">{character.description}</p>
        </section>

        {character.scenario && (
          <section className="rounded-2xl bg-surface-800 p-4 ring-1 ring-surface-700">
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Scenario</h2>
            <p className="whitespace-pre-wrap text-sm text-zinc-300">{character.scenario}</p>
          </section>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => {
              const chat = createChat(character.id, pickGreeting(character), character.name);
              navigate({ name: 'chat', chatId: chat.id });
            }}
          >
            <MessageCircle size={16} /> Start new chat
          </Button>
          <Button variant="outline" onClick={() => navigate({ name: 'editor', characterId: character.id })}>
            <Pencil size={14} /> Edit
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              downloadFile(`${character.name.toLowerCase()}.namochat.json`, exportCharacterCard(character))
            }
          >
            <Download size={14} /> Export
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (confirm(`Delete ${character.name}? Chats with them remain but become read-only.`)) {
                deleteCharacter(character.id);
                navigate({ name: 'home' });
              }
            }}
          >
            <Trash2 size={14} /> Delete
          </Button>
        </div>

        {characterChats.length > 0 && (
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Continue a chat
            </h2>
            <div className="space-y-2">
              {characterChats.map((chat) => (
                <button
                  key={chat.id}
                  className="block w-full rounded-xl bg-surface-800 p-3 text-left ring-1 ring-surface-700 transition-colors hover:ring-accent-500/50"
                  onClick={() => navigate({ name: 'chat', chatId: chat.id })}
                >
                  <p className="line-clamp-1 text-sm text-zinc-300">
                    {chat.messages[chat.messages.length - 1]?.content ?? ''}
                  </p>
                  <p className="mt-1 text-[10px] text-zinc-500">
                    {chat.messages.length} messages · {new Date(chat.updatedAt).toLocaleDateString()}
                  </p>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
