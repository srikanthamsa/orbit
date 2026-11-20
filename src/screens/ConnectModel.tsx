import { OrbMark, providerName } from '@/components/ui';

const PROVIDERS = ['OpenAI', 'Anthropic', 'Gemini', 'DeepSeek'];

export function ConnectModel({
  provider,
  onConnect,
}: {
  provider?: string;
  onConnect: () => void;
}) {
  const addingKey = !!provider;
  const target = provider ? providerName(provider) : 'your provider';

  const steps = addingKey
    ? [
        {
          title: `Paste your ${target} key`,
          detail: 'Kept in this browser. Session-only by default.',
        },
        {
          title: 'Test the connection',
          detail: 'One request checks the key and the model name.',
        },
        {
          title: 'Ask for anything',
          detail: 'ORBIT reads the page you are on and asks before anything sensitive.',
        },
      ]
    : [
        {
          title: 'Choose a provider',
          detail: `${PROVIDERS.slice(0, -1).join(', ')} or ${PROVIDERS[PROVIDERS.length - 1]} — plus any compatible endpoint.`,
        },
        {
          title: 'Paste your key',
          detail: 'Kept in this browser. Session-only by default.',
        },
        {
          title: 'Ask for anything',
          detail: 'ORBIT reads the page you are on and asks before anything sensitive.',
        },
      ];

  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <div className="flex min-h-full flex-col justify-center px-6 py-8">
        <div className="mx-auto w-full max-w-[288px]">
          <div className="relative mx-auto flex h-24 w-24 items-center justify-center">
            <span className="orb-halo" aria-hidden />
            <span className="orb-halo orb-halo-2" aria-hidden />
            <OrbMark size={50} className="animate-orb-pulse" />
          </div>

          <h1 className="animate-fade-up mt-6 text-center text-display font-semibold text-fg">
            {addingKey ? `Add your ${target} key` : 'Bring your own model.'}
          </h1>
          <p
            className="animate-fade-up mt-1.5 text-center text-caption leading-[1.5] text-muted"
            style={{ animationDelay: '60ms' }}
          >
            No account. No ORBIT server. The key goes from this browser straight to your provider.
          </p>

          <ol className="mt-6 space-y-3">
            {steps.map((step, index) => (
              <li
                key={step.title}
                className="animate-fade-up flex items-start gap-2.5"
                style={{ animationDelay: `${140 + index * 90}ms` }}
              >
                <span
                  aria-hidden
                  className="mt-[1px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border border-line bg-surface text-[10px] font-semibold tabular-nums text-muted"
                >
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-label leading-[17px] text-fg">{step.title}</span>
                  <span className="mt-0.5 block text-micro leading-[1.5] text-faint">
                    {step.detail}
                  </span>
                </span>
              </li>
            ))}
          </ol>

          <div
            className="animate-fade-up mt-6 flex justify-center"
            style={{ animationDelay: `${140 + steps.length * 90}ms` }}
          >
            <button type="button" className="uv-btn" onClick={onConnect}>
              <span className="uv-btn__wrapper">
                <span className="uv-btn__label">
                  {addingKey ? 'Add your key' : 'Connect a model'}
                </span>
                {Array.from({ length: 12 }, (_, i) => (
                  <span
                    key={i}
                    aria-hidden
                    className={`uv-btn__circle uv-btn__circle-${i + 1}`}
                  />
                ))}
              </span>
            </button>
          </div>

          <p
            className="animate-fade-up mt-3 text-center text-micro leading-[1.5] text-faint"
            style={{ animationDelay: `${200 + steps.length * 90}ms` }}
          >
            The key stays in this browser. Usage limits are your provider's.
          </p>
        </div>
      </div>
    </div>
  );
}
