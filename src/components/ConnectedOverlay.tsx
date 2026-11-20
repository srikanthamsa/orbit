import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { OrbMark } from './ui';

const RING = 62;
const CIRCUMFERENCE = 2 * Math.PI * RING;
const HOLD_MS = 2500;

/**
 * The moment a key is verified: light forms around the mark, blooms once, then
 * the whole layer settles away. Motion for every entrance and exit, one static
 * CSS gradient for the light itself so nothing animates on the main thread
 * beyond transform and opacity.
 */
export function ConnectedOverlay({
  provider,
  model,
  onDone,
}: {
  provider: string;
  model: string;
  onDone: () => void;
}) {
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setClosing(true), HOLD_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!closing) return;
    const timer = window.setTimeout(onDone, 300);
    return () => window.clearTimeout(timer);
  }, [closing, onDone]);

  return createPortal(
    <motion.div
      role="status"
      aria-live="polite"
      onClick={() => setClosing(true)}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden"
      style={{ background: 'var(--canvas)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: closing ? 0 : 1 }}
      transition={{ duration: closing ? 0.3 : 0.22, ease: 'easeOut' }}
    >
      <div className="done-spot" aria-hidden />

      <motion.div
        className="relative flex h-[168px] w-[168px] items-center justify-center"
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ scale: closing ? 0.985 : 1, opacity: closing ? 0 : 1 }}
        transition={{ type: 'spring', visualDuration: 0.55, bounce: 0.16 }}
      >
        <svg viewBox="0 0 168 168" className="absolute inset-0 h-full w-full" aria-hidden>
          <circle cx="84" cy="84" r={RING} fill="none" stroke="var(--line)" strokeWidth="1" />
          <motion.circle
            cx="84"
            cy="84"
            r={RING}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            initial={{ strokeDashoffset: CIRCUMFERENCE, rotate: -90 }}
            animate={{ strokeDashoffset: 0 }}
            transition={{ duration: 0.95, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
            style={{ transformOrigin: 'center' }}
          />
        </svg>

        <motion.span
          aria-hidden
          className="done-bloom absolute inset-[26px] rounded-full"
          initial={{ scale: 0.55, opacity: 0 }}
          animate={{ scale: 1.75, opacity: [0, 0.7, 0] }}
          transition={{ duration: 1.2, delay: 0.55, ease: 'easeOut' }}
        />

        <motion.div
          className="relative overflow-hidden rounded-full"
          initial={{ scale: 0.82, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', visualDuration: 0.5, bounce: 0.22, delay: 0.2 }}
        >
          <OrbMark size={52} className="done-orb" />
          <motion.span
            aria-hidden
            className="done-sheen pointer-events-none absolute inset-0"
            initial={{ x: '-160%' }}
            animate={{ x: '160%' }}
            transition={{ duration: 1.1, delay: 0.62, ease: [0.4, 0, 0.2, 1] }}
          />
        </motion.div>
      </motion.div>

      <motion.div
        className="mt-7 px-6 text-center"
        initial={{ opacity: 0, clipPath: 'inset(0 0 100% 0)' }}
        animate={{ opacity: 1, clipPath: 'inset(0 0 0% 0)' }}
        transition={{ duration: 0.5, delay: 0.72, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="text-[19px] font-semibold tracking-[-0.02em] text-fg">All set</p>
        <motion.p
          className="mt-1 text-caption text-muted"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.95 }}
        >
          {provider} · {model}
        </motion.p>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
