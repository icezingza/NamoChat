import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, FastForward, Heart, Image as ImageIcon, PanelRight, Send, Square, X } from 'lucide-react';
import { useChatStore } from '../../stores/chat-store';
import { useCharacterStore } from '../../stores/character-store';
import { useUiStore } from '../../stores/ui-store';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/input';
import { MessageBubble } from './MessageBubble';
import { ChatSidePanel } from './ChatSidePanel';
import { sendMessage, regenerateLast, continueChat, stopStreaming } from '../../stores/chat-pipeline';
import { RelationshipEngine, DEFAULT_STAGES } from '../../core/relationship/relationship-engine';
import { generateId } from '../../lib/utils';

const WINDOW_SIZE = 60;

export const ChatScreen = ({ chatId }: { chatId: string }) => {
  const chat = useChatStore((s) => s.chats.find((c) => c.id === chatId));
  const streamingMessageId = useChatStore((s) => s.streamingMessageId);
  const updateMessageContent = useChatStore((s) => s.updateMessageContent);
  const characters = useCharacterStore((s) => s.characters);
  const navigate = useUiStore((s) => s.navigate);
  const appendMessage = useChatStore((s) => s.appendMessage);
  const forkChat = useChatStore((s) => s.forkChat);
  const [input, setInput] = useState('');
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  // Windowed render: only the most recent messages are mounted; older ones
  // load on demand so very long chats stay smooth (Performance, priority 5).
  const [visibleCount, setVisibleCount] = useState(WINDOW_SIZE);
  const scrollAnchor = useRef<HTMLDivElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);

  const character = characters.find((c) => c.id === chat?.characterId);
  const isStreaming = streamingMessageId !== null;

  const lastMessageContent = chat?.messages[chat.messages.length - 1]?.content;
  useEffect(() => {
    scrollAnchor.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat?.messages.length, lastMessageContent]);

  if (!chat) {
    return <div className="p-8 text-center text-zinc-500">Chat not found.</div>;
  }

  const relationshipEngine = new RelationshipEngine(character?.stages ?? DEFAULT_STAGES);
  const stage = relationshipEngine.stageOf(chat.relationship);
  const lastAssistantId = [...chat.messages].reverse().find((m) => m.role === 'assistant')?.id;

  const submit = () => {
    if (isStreaming || !character) return;
    const text = input.trim();
    // An image-only turn is allowed; a text turn drives the model.
    if (!text && !pendingImage) return;
    if (pendingImage) {
      appendMessage(chat.id, {
        id: generateId(),
        role: 'user',
        content: text,
        imageUrl: pendingImage,
        createdAt: Date.now(),
      });
      setPendingImage(null);
      setInput('');
      // The model still receives the text (image is a local visual for now).
      if (text) void sendMessage(chat.id, text, characters, { userAlreadyAppended: true });
      return;
    }
    setInput('');
    void sendMessage(chat.id, text, characters);
  };

  const attachImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setPendingImage(String(reader.result));
    reader.readAsDataURL(file);
  };

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-surface-800 bg-surface-950/80 px-3 py-2 backdrop-blur">
        <Button variant="ghost" size="icon" onClick={() => navigate({ name: 'chats' })}>
          <ArrowLeft size={18} />
        </Button>
        <button
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          onClick={() => character && navigate({ name: 'profile', characterId: character.id })}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-accent-500/40 to-rose-flame/30 font-bold text-white">
            {character?.avatarUrl ? (
              <img src={character.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              (character?.name ?? '?').slice(0, 1)
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{character?.name ?? 'Unknown'}</p>
            <p className="flex items-center gap-1 text-[10px] text-zinc-500">
              <Heart size={9} className="text-rose-flame" />
              {stage.name} · affinity {(chat.relationship.affinity * 100).toFixed(0)}%
            </p>
          </div>
        </button>
        <div className="flex gap-0.5" title="valence / arousal / trust / passion / resonance">
          {(['valence', 'arousal', 'trust', 'passion', 'resonance'] as const).map((key) => (
            <div key={key} className="flex h-8 w-1.5 items-end overflow-hidden rounded-full bg-surface-800">
              <div
                className="w-full rounded-full bg-gradient-to-t from-accent-500 to-rose-flame"
                style={{ height: `${chat.affect[key] * 100}%` }}
              />
            </div>
          ))}
        </div>
        <Button variant="ghost" size="icon" title="Memory & timeline" onClick={() => setPanelOpen(true)}>
          <PanelRight size={18} />
        </Button>
      </header>

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
        {chat.messages.length > visibleCount && (
          <div className="flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setVisibleCount((count) => count + WINDOW_SIZE)}
            >
              Load {Math.min(WINDOW_SIZE, chat.messages.length - visibleCount)} earlier messages
            </Button>
          </div>
        )}
        {chat.messages.slice(-visibleCount).map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            isStreaming={message.id === streamingMessageId}
            isLastAssistant={message.id === lastAssistantId}
            onEdit={(content) => updateMessageContent(chat.id, message.id, content)}
            onRegenerate={() => void regenerateLast(chat.id, characters)}
            onFork={() => {
              const fork = forkChat(chat.id, message.id);
              if (fork) navigate({ name: 'chat', chatId: fork.id });
            }}
          />
        ))}
        <div ref={scrollAnchor} />
      </div>

      {/* Composer */}
      <div className="border-t border-surface-800 bg-surface-950/80 p-3 backdrop-blur">
        {pendingImage && (
          <div className="relative mb-2 inline-block">
            <img src={pendingImage} alt="" className="max-h-24 rounded-lg" />
            <button
              className="absolute -right-2 -top-2 rounded-full bg-surface-700 p-1 text-zinc-300"
              onClick={() => setPendingImage(null)}
            >
              <X size={12} />
            </button>
          </div>
        )}
        <input
          ref={imageInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) attachImage(file);
            e.target.value = '';
          }}
        />
        <div className="flex items-end gap-2">
          <Button
            variant="outline"
            size="icon"
            title="Attach image"
            disabled={isStreaming}
            onClick={() => imageInput.current?.click()}
          >
            <ImageIcon size={16} />
          </Button>
          <Button
            variant="outline"
            size="icon"
            title="Continue the scene"
            disabled={isStreaming}
            onClick={() => void continueChat(chat.id, characters)}
          >
            <FastForward size={16} />
          </Button>
          <Textarea
            rows={1}
            className="max-h-32 min-h-10 flex-1 py-2.5"
            placeholder={`Message ${character?.name ?? ''}…`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
          />
          {isStreaming ? (
            <Button variant="danger" size="icon" title="Stop" onClick={stopStreaming}>
              <Square size={15} />
            </Button>
          ) : (
            <Button
              size="icon"
              title="Send"
              disabled={!input.trim() && !pendingImage}
              onClick={submit}
            >
              <Send size={16} />
            </Button>
          )}
        </div>
      </div>

      {panelOpen && <ChatSidePanel chatId={chat.id} onClose={() => setPanelOpen(false)} />}
    </div>
  );
};
