import { ChevronLeft, Settings2 } from 'lucide-react';
import { useAgentStore } from '@/stores/agent';
import { IconButton, OrbMark } from './ui';

export function Header() {
  const route = useAgentStore((s) => s.route);
  const setRoute = useAgentStore((s) => s.setRoute);
  const newTask = useAgentStore((s) => s.newTask);
  const settings = useAgentStore((s) => s.settings);
  const providers = useAgentStore((s) => s.providers);
  const active = providers.find((p) => p.id === settings.activeProviderId);

  const goBack = () => {
    if (route === 'settings') setRoute('home');
    else newTask();
  };

  return (
    <header className="flex h-[52px] shrink-0 items-center justify-between border-b border-[var(--border)] px-3">
      <div className="flex min-w-0 items-center gap-1.5">
        {route !== 'home' ? (
          <IconButton label="Back" onClick={goBack}>
            <ChevronLeft size={17} />
          </IconButton>
        ) : null}
        <button
          className="flex items-center gap-2 rounded-lg px-1 py-1 transition-opacity hover:opacity-80"
          onClick={() => {
            if (route !== 'home') setRoute('home');
          }}
          aria-label="ORBIT home"
        >
          <OrbMark size={16} />
          <span className="text-[11.5px] font-semibold tracking-[0.2em] text-[var(--text)]">ORBIT</span>
        </button>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setRoute('settings')}
          className="flex max-w-[150px] items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--panel)] px-2.5 py-[3px] text-[11px] text-[var(--muted)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text)]"
          title="Model settings"
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: active ? 'var(--success)' : 'var(--faint)' }}
          />
          <span className="truncate">{active ? active.model : 'Connect a model'}</span>
        </button>
        <IconButton label="Settings" onClick={() => setRoute('settings')}>
          <Settings2 size={16} />
        </IconButton>
      </div>
    </header>
  );
}
