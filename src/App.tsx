import { useEffect } from 'react';
import { MotionConfig } from 'framer-motion';
import { X } from 'lucide-react';
import { useAgentStore } from '@/stores/agent';
import { Header } from '@/components/Header';
import { OrbMark } from '@/components/ui';
import { Home } from '@/screens/Home';
import { Workspace } from '@/screens/Workspace';
import { Settings } from '@/screens/Settings';

export default function App() {
  const hydrated = useAgentStore((s) => s.hydrated);
  const route = useAgentStore((s) => s.route);
  const error = useAgentStore((s) => s.error);
  const dismissError = useAgentStore((s) => s.dismissError);
  const hydrate = useAgentStore((s) => s.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  if (!hydrated) {
    return (
      <div className="flex h-full items-center justify-center">
        <OrbMark size={26} className="animate-breathe" />
      </div>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
    <div className="relative flex h-full flex-col">
      <Header />
      <main className="relative min-h-0 flex-1">
        {route === 'home' ? <Home /> : route === 'task' ? <Workspace /> : <Settings />}
      </main>
      {error && route !== 'task' ? (
        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-40 animate-rise">
          <div className="pointer-events-auto flex items-start gap-2 rounded-md border border-danger-line bg-field p-2.5 shadow-pop">
            <p className="flex-1 text-caption leading-[1.5] text-fg">{error}</p>
            <button
              onClick={dismissError}
              aria-label="Dismiss"
              className="text-faint transition-colors hover:text-fg"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      ) : null}
    </div>
    </MotionConfig>
  );
}
