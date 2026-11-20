import { ChevronLeft, Settings2 } from 'lucide-react';
import { useAgentStore } from '@/stores/agent';
import { IconButton } from './ui';

export function Header() {
  const route = useAgentStore((s) => s.route);
  const setRoute = useAgentStore((s) => s.setRoute);
  const newTask = useAgentStore((s) => s.newTask);
  const settings = useAgentStore((s) => s.settings);
  const providers = useAgentStore((s) => s.providers);
  const hasKey = useAgentStore((s) => s.hasKey);
  const active = providers.find((p) => p.id === settings.activeProviderId);
  const dot = !active ? 'var(--faint)' : hasKey[active.id] ? 'var(--success)' : 'var(--warn)';

  const goBack = () => {
    if (route === 'settings') setRoute('home');
    else newTask();
  };

  return (
    <header className="flex h-11 shrink-0 items-center gap-1 border-b border-line bg-chrome px-2">
      {route !== 'home' ? (
        <IconButton label="Back" onClick={goBack}>
          <ChevronLeft size={16} />
        </IconButton>
      ) : null}


      {route !== 'settings' ? (
        <div className="ml-auto flex items-center gap-0.5">
          <button
            onClick={() => setRoute('settings')}
            className="focus-ring flex h-7 max-w-[150px] items-center gap-1.5 rounded-sm px-1.5 text-caption text-muted transition-colors hover:bg-raised hover:text-fg"
            title={active ? `Model: ${active.model}` : 'Model settings'}
          >
            <span
              aria-hidden
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: dot }}
            />
            <span className="truncate">{active ? active.model : 'Connect a model'}</span>
          </button>
          <IconButton label="Settings" onClick={() => setRoute('settings')}>
            <Settings2 size={15} />
          </IconButton>
        </div>
      ) : null}
    </header>
  );
}
