import { useState } from 'react';
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react';
import { useCharacterStore } from '../../stores/character-store';
import { useUiStore } from '../../stores/ui-store';
import { Button } from '../../components/ui/button';
import { Input, Label, Textarea } from '../../components/ui/input';
import type { CharacterCard } from '../../core/character/character';
import type { LoreEntry } from '../../core/lore/lore-engine';
import { generateId } from '../../lib/utils';

const emptyCard = (): CharacterCard => ({
  id: generateId(),
  name: '',
  tagline: '',
  description: '',
  personality: '',
  scenario: '',
  firstMessage: '',
  tags: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

export const CharacterEditor = ({ characterId }: { characterId?: string }) => {
  const existing = useCharacterStore((s) => s.characters.find((c) => c.id === characterId));
  const upsertCharacter = useCharacterStore((s) => s.upsertCharacter);
  const navigate = useUiStore((s) => s.navigate);
  const [card, setCard] = useState<CharacterCard>(existing ?? emptyCard());
  const [error, setError] = useState('');

  const patch = (fields: Partial<CharacterCard>) => setCard((c) => ({ ...c, ...fields }));

  const greetings = card.alternateGreetings ?? [];
  const lore = card.lorebook ?? [];

  const setGreeting = (index: number, value: string) =>
    patch({ alternateGreetings: greetings.map((g, i) => (i === index ? value : g)) });
  const addGreeting = () => patch({ alternateGreetings: [...greetings, ''] });
  const removeGreeting = (index: number) =>
    patch({ alternateGreetings: greetings.filter((_, i) => i !== index) });

  const setLore = (index: number, fields: Partial<LoreEntry>) =>
    patch({ lorebook: lore.map((entry, i) => (i === index ? { ...entry, ...fields } : entry)) });
  const addLore = () =>
    patch({ lorebook: [...lore, { id: generateId(), keys: [], content: '', alwaysActive: false }] });
  const removeLore = (index: number) => patch({ lorebook: lore.filter((_, i) => i !== index) });

  const save = () => {
    try {
      upsertCharacter(card);
      navigate({ name: 'profile', characterId: card.id });
    } catch (validationError) {
      setError((validationError as Error).message);
    }
  };

  return (
    <div className="mx-auto max-w-2xl p-4">
      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => navigate({ name: 'home' })}>
          <ArrowLeft size={18} />
        </Button>
        <h1 className="font-semibold">{existing ? `Edit ${existing.name}` : 'New character'}</h1>
        <Button size="sm" onClick={save}>
          <Save size={14} /> Save
        </Button>
      </div>

      {error && (
        <p className="mb-3 rounded-xl bg-rose-flame/10 px-3 py-2 text-xs text-rose-flame">{error}</p>
      )}

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Name *</Label>
            <Input value={card.name} onChange={(e) => patch({ name: e.target.value })} placeholder="Rin" />
          </div>
          <div>
            <Label>Tagline</Label>
            <Input
              value={card.tagline}
              onChange={(e) => patch({ tagline: e.target.value })}
              placeholder="One-line hook"
            />
          </div>
        </div>
        <div>
          <Label>Avatar URL</Label>
          <Input
            value={card.avatarUrl ?? ''}
            onChange={(e) => patch({ avatarUrl: e.target.value || undefined })}
            placeholder="https://… or data:image/…"
          />
        </div>
        <div>
          <Label>Description</Label>
          <Textarea
            rows={4}
            value={card.description}
            onChange={(e) => patch({ description: e.target.value })}
            placeholder="Who is this character?"
          />
        </div>
        <div>
          <Label>Personality</Label>
          <Textarea
            rows={2}
            value={card.personality}
            onChange={(e) => patch({ personality: e.target.value })}
          />
        </div>
        <div>
          <Label>Scenario</Label>
          <Textarea rows={2} value={card.scenario} onChange={(e) => patch({ scenario: e.target.value })} />
        </div>
        <div>
          <Label>First message *</Label>
          <Textarea
            rows={3}
            value={card.firstMessage}
            onChange={(e) => patch({ firstMessage: e.target.value })}
            placeholder="*she looks up* Oh. You again."
          />
        </div>
        <div>
          <Label>Example dialogue</Label>
          <Textarea
            rows={3}
            value={card.exampleDialogue ?? ''}
            onChange={(e) => patch({ exampleDialogue: e.target.value || undefined })}
          />
        </div>

        {/* Alternate greetings — varied openers for new chats */}
        <details className="rounded-xl bg-surface-800 ring-1 ring-surface-700">
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-zinc-300">
            Alternate greetings ({greetings.length})
          </summary>
          <div className="space-y-2 p-3 pt-0">
            {greetings.map((greeting, index) => (
              <div key={index} className="flex gap-2">
                <Textarea
                  rows={2}
                  value={greeting}
                  onChange={(e) => setGreeting(index, e.target.value)}
                  placeholder="An alternate opening message"
                />
                <Button variant="danger" size="icon" onClick={() => removeGreeting(index)}>
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addGreeting}>
              <Plus size={13} /> Add greeting
            </Button>
          </div>
        </details>

        {/* System-prompt override — full authorial control (Character Consistency) */}
        <details className="rounded-xl bg-surface-800 ring-1 ring-surface-700">
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-zinc-300">
            Advanced: system-prompt override
          </summary>
          <div className="p-3 pt-0">
            <Textarea
              rows={4}
              value={card.systemPromptOverride ?? ''}
              onChange={(e) => patch({ systemPromptOverride: e.target.value || undefined })}
              placeholder="Leave blank to use the default preamble. Supports {{char}} and {{user}}."
            />
            <p className="mt-1 text-[10px] text-zinc-500">
              When set, this replaces the default opening instruction. Character/personality/scenario
              are still appended below it.
            </p>
          </div>
        </details>

        {/* Lorebook — keyword-triggered world knowledge (Roleplay quality) */}
        <details className="rounded-xl bg-surface-800 ring-1 ring-surface-700">
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-zinc-300">
            World lore ({lore.length})
          </summary>
          <div className="space-y-3 p-3 pt-0">
            {lore.map((entry, index) => (
              <div key={entry.id} className="rounded-lg bg-surface-900 p-2.5 ring-1 ring-surface-700">
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                    <input
                      type="checkbox"
                      checked={entry.alwaysActive ?? false}
                      onChange={(e) => setLore(index, { alwaysActive: e.target.checked })}
                      className="accent-[#a855f7]"
                    />
                    Always active (world fact)
                  </label>
                  <Button variant="danger" size="icon" onClick={() => removeLore(index)}>
                    <Trash2 size={13} />
                  </Button>
                </div>
                {!entry.alwaysActive && (
                  <Input
                    className="mb-1.5"
                    value={entry.keys.join(', ')}
                    onChange={(e) =>
                      setLore(index, {
                        keys: e.target.value.split(',').map((k) => k.trim()).filter(Boolean),
                      })
                    }
                    placeholder="Trigger keywords (comma-separated)"
                  />
                )}
                <Textarea
                  rows={2}
                  value={entry.content}
                  onChange={(e) => setLore(index, { content: e.target.value })}
                  placeholder="Knowledge injected when triggered"
                />
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addLore}>
              <Plus size={13} /> Add lore entry
            </Button>
          </div>
        </details>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Tags (comma-separated)</Label>
            <Input
              value={card.tags.join(', ')}
              onChange={(e) =>
                patch({ tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })
              }
            />
          </div>
          <div>
            <Label>Reply language</Label>
            <Input
              value={card.language ?? ''}
              onChange={(e) => patch({ language: e.target.value || undefined })}
              placeholder="th / en / …"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
