import { useState } from 'react';
import { Pin, Trash2, X, Plus, Clock, Brain, Globe } from 'lucide-react';
import { useChatStore } from '../../stores/chat-store';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { MemoryEngine } from '../../core/memory/memory-engine';
import { eventsForChat } from '../../core/timeline/story-timeline';
import { generateId } from '../../lib/utils';

type Tab = 'memory' | 'timeline';

export const ChatSidePanel = ({ chatId, onClose }: { chatId: string; onClose: () => void }) => {
  const chat = useChatStore((s) => s.chats.find((c) => c.id === chatId));
  const pinMemory = useChatStore((s) => s.pinMemory);
  const forgetMemory = useChatStore((s) => s.forgetMemory);
  const addWorldMemory = useChatStore((s) => s.addWorldMemory);
  const addTimelineEvent = useChatStore((s) => s.addTimelineEvent);
  const [tab, setTab] = useState<Tab>('memory');
  const [worldNote, setWorldNote] = useState('');
  const [milestone, setMilestone] = useState('');

  if (!chat) return null;

  const memories = new MemoryEngine(chat.memories).listFor(chatId);
  const events = eventsForChat(chat.timeline, chatId);

  return (
    <div className="absolute inset-0 z-20 flex justify-end bg-surface-950/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-sm flex-col bg-surface-900 shadow-2xl ring-1 ring-surface-700 animate-message-in"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-surface-800 px-4 py-3">
          <div className="flex gap-1">
            <button
              className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium ${tab === 'memory' ? 'bg-accent-500/20 text-accent-400' : 'text-zinc-400'}`}
              onClick={() => setTab('memory')}
            >
              <Brain size={13} /> Memory
            </button>
            <button
              className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium ${tab === 'timeline' ? 'bg-accent-500/20 text-accent-400' : 'text-zinc-400'}`}
              onClick={() => setTab('timeline')}
            >
              <Clock size={13} /> Timeline
            </button>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X size={18} />
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto p-3">
          {tab === 'memory' ? (
            <>
              <div className="mb-3 flex gap-2">
                <Input
                  value={worldNote}
                  onChange={(e) => setWorldNote(e.target.value)}
                  placeholder="Add a world fact the character always knows…"
                />
                <Button
                  size="icon"
                  onClick={() => {
                    addWorldMemory(chatId, worldNote);
                    setWorldNote('');
                  }}
                  disabled={!worldNote.trim()}
                >
                  <Plus size={16} />
                </Button>
              </div>
              {memories.length === 0 && (
                <p className="py-8 text-center text-xs text-zinc-500">No memories yet.</p>
              )}
              <div className="space-y-2">
                {memories.map((memory) => (
                  <div
                    key={memory.id}
                    className="rounded-xl bg-surface-800 p-2.5 text-xs ring-1 ring-surface-700"
                  >
                    <div className="mb-1 flex items-center gap-1.5">
                      {memory.role === 'world' ? (
                        <Globe size={11} className="text-accent-400" />
                      ) : (
                        <span className="text-[10px] uppercase text-zinc-500">{memory.role}</span>
                      )}
                      <div className="ml-auto flex items-center gap-1">
                        <span className="text-[10px] text-zinc-600" title="emotion weight">
                          {(memory.emotionWeight * 100).toFixed(0)}%
                        </span>
                        <button
                          className="p-1 text-zinc-500 hover:text-accent-400"
                          title="Pin (raise weight)"
                          onClick={() => pinMemory(chatId, memory.id)}
                        >
                          <Pin size={12} />
                        </button>
                        <button
                          className="p-1 text-zinc-500 hover:text-rose-flame"
                          title="Forget"
                          onClick={() => forgetMemory(chatId, memory.id)}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                    <p className="line-clamp-3 text-zinc-300">{memory.content}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="mb-3 flex gap-2">
                <Input
                  value={milestone}
                  onChange={(e) => setMilestone(e.target.value)}
                  placeholder="Pin a story milestone…"
                />
                <Button
                  size="icon"
                  onClick={() => {
                    if (!milestone.trim()) return;
                    addTimelineEvent(chatId, {
                      id: generateId(),
                      chatId,
                      kind: 'milestone',
                      title: milestone.trim(),
                      timestamp: Date.now(),
                    });
                    setMilestone('');
                  }}
                  disabled={!milestone.trim()}
                >
                  <Plus size={16} />
                </Button>
              </div>
              {events.length === 0 && (
                <p className="py-8 text-center text-xs text-zinc-500">No story events yet.</p>
              )}
              <ol className="relative space-y-3 border-l border-surface-700 pl-4">
                {events.map((event) => (
                  <li key={event.id} className="relative">
                    <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-accent-500 ring-2 ring-surface-900" />
                    <p className="text-xs font-medium text-zinc-200">{event.title}</p>
                    {event.detail && <p className="text-[11px] text-zinc-500">{event.detail}</p>}
                    <p className="text-[10px] text-zinc-600">
                      {new Date(event.timestamp).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
