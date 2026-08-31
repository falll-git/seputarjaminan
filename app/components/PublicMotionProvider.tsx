"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { PUBLIC_MOTION_DURATION, PUBLIC_MOTION_EASE } from "@/app/lib/public-motion";

export default function PublicMotionProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig
      reducedMotion="user"
      transition={{ duration: PUBLIC_MOTION_DURATION.standard, ease: PUBLIC_MOTION_EASE }}
    >
      {children}
    </MotionConfig>
  );
}
