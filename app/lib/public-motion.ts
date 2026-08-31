export const PUBLIC_MOTION_DURATION = {
  fast: 0.18,
  standard: 0.28,
  slow: 0.4,
} as const;

export const PUBLIC_MOTION_EASE = [0.22, 1, 0.36, 1] as const;

export function pressFeedback(reducedMotion: boolean | null) {
  return {
    whileTap: reducedMotion ? undefined : { scale: 0.985 },
    transition: {
      duration: PUBLIC_MOTION_DURATION.fast,
      ease: PUBLIC_MOTION_EASE,
    },
  };
}

export function revealOnce(reducedMotion: boolean | null, delay = 0) {
  return {
    initial: reducedMotion ? { opacity: 0 } : { opacity: 0, y: 16 },
    whileInView: reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.18 },
    transition: {
      duration: PUBLIC_MOTION_DURATION.slow,
      delay: reducedMotion ? 0 : delay,
      ease: PUBLIC_MOTION_EASE,
    },
  };
}
