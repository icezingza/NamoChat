import { MessageSquare, Settings, Sparkles } from 'lucide-react';
import { useUiStore, type View } from './stores/ui-store';
import { CharacterGallery } from './features/characters/CharacterGallery';
import { CharacterProfile } from './features/characters/CharacterProfile';
import { CharacterEditor } from './features/characters/CharacterEditor';
import { ChatList } from './features/chat/ChatList';
import { ChatScreen } from './features/chat/ChatScreen';
import { SettingsScreen } from './features/settings/SettingsScreen';
import { cn } from './lib/utils';

const renderView = (view: View) => {
  switch (view.name) {
    case 'home':
      return <CharacterGallery />;
    case 'chats':
      return <ChatList />;
    case 'chat':
      return <ChatScreen chatId={view.chatId} />;
    case 'profile':
      return <CharacterProfile characterId={view.characterId} />;
    case 'editor':
      return <CharacterEditor characterId={view.characterId} />;
    case 'settings':
      return <SettingsScreen />;
  }
};

const NavItem = ({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={cn(
      'flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
      active ? 'text-accent-400' : 'text-zinc-500 hover:text-zinc-300',
    )}
  >
    {icon}
    {label}
  </button>
);

export const App = () => {
  const view = useUiStore((s) => s.view);
  const navigate = useUiStore((s) => s.navigate);
  const isChatOpen = view.name === 'chat';

  return (
    <div className="flex h-full flex-col">
      {/* Keyed by view kind so each screen fades in on navigation. Chats keep a
          stable key so streaming into a chat doesn't replay the transition. */}
      <main key={view.name} className="animate-view-in min-h-0 flex-1 overflow-y-auto">
        {renderView(view)}
      </main>
      {/* Bottom nav — hidden while a chat is open so the composer owns the bottom edge */}
      {!isChatOpen && (
        <nav className="flex border-t border-surface-800 bg-surface-950/90 pb-[env(safe-area-inset-bottom)] backdrop-blur">
          <NavItem
            icon={<Sparkles size={18} />}
            label="Characters"
            active={view.name === 'home' || view.name === 'profile' || view.name === 'editor'}
            onClick={() => navigate({ name: 'home' })}
          />
          <NavItem
            icon={<MessageSquare size={18} />}
            label="Chats"
            active={view.name === 'chats'}
            onClick={() => navigate({ name: 'chats' })}
          />
          <NavItem
            icon={<Settings size={18} />}
            label="Settings"
            active={view.name === 'settings'}
            onClick={() => navigate({ name: 'settings' })}
          />
        </nav>
      )}
    </div>
  );
};
