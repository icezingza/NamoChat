import { useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, GitBranch, Pencil, RefreshCw, X } from 'lucide-react';
import { cn, formatTime } from '../../lib/utils';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/input';
import type { ChatMessage } from '../../stores/chat-store';

interface MessageBubbleProps {
  message: ChatMessage;
  isStreaming: boolean;
  isLastAssistant: boolean;
  onEdit: (content: string) => void;
  onRegenerate: () => void;
  onFork: () => void;
}

export const MessageBubble = ({
  message,
  isStreaming,
  isLastAssistant,
  onEdit,
  onRegenerate,
  onFork,
}: MessageBubbleProps) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const isUser = message.role === 'user';

  return (
    <div className={cn('group flex animate-message-in', isUser ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-[85%] sm:max-w-[75%]')}>
        <div
          className={cn(
            'rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm',
            isUser
              ? 'rounded-br-md bg-accent-500 text-white'
              : 'rounded-bl-md bg-surface-800 text-zinc-100 ring-1 ring-surface-700',
          )}
        >
          {editing ? (
            <div className="w-64 sm:w-80">
              <Textarea rows={4} value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
              <div className="mt-2 flex justify-end gap-1">
                <Button variant="ghost" size="icon" onClick={() => setEditing(false)}>
                  <X size={14} />
                </Button>
                <Button
                  size="icon"
                  onClick={() => {
                    onEdit(draft);
                    setEditing(false);
                  }}
                >
                  <Check size={14} />
                </Button>
              </div>
            </div>
          ) : (
            <>
              {message.imageUrl && (
                <img src={message.imageUrl} alt="" className="mb-2 max-h-72 rounded-xl" />
              )}
              <div className="prose-chat break-words">
                <Markdown remarkPlugins={[remarkGfm]}>{message.content}</Markdown>
              </div>
              {isStreaming && (
                <span className="mt-1 inline-flex gap-1">
                  <span className="typing-dot inline-block h-1.5 w-1.5 rounded-full bg-accent-400" />
                  <span className="typing-dot inline-block h-1.5 w-1.5 rounded-full bg-accent-400" />
                  <span className="typing-dot inline-block h-1.5 w-1.5 rounded-full bg-accent-400" />
                </span>
              )}
            </>
          )}
        </div>
        <div
          className={cn(
            'mt-1 flex items-center gap-1 text-[10px] text-zinc-600',
            isUser ? 'justify-end' : 'justify-start',
          )}
        >
          <span>{formatTime(message.createdAt)}</span>
          {!isStreaming && !editing && (
            <span className="flex opacity-0 transition-opacity group-hover:opacity-100">
              <button
                className="p-1 text-zinc-500 hover:text-zinc-200"
                title="Edit"
                onClick={() => {
                  setDraft(message.content);
                  setEditing(true);
                }}
              >
                <Pencil size={11} />
              </button>
              {isLastAssistant && (
                <button
                  className="p-1 text-zinc-500 hover:text-zinc-200"
                  title="Regenerate"
                  onClick={onRegenerate}
                >
                  <RefreshCw size={11} />
                </button>
              )}
              <button
                className="p-1 text-zinc-500 hover:text-zinc-200"
                title="Branch from here"
                onClick={onFork}
              >
                <GitBranch size={11} />
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
