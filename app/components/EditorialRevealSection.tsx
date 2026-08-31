"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { revealOnce } from "@/app/lib/public-motion";

type EditorialRevealSectionProps = {
  children: ReactNode;
  className: string;
  labelledBy: string;
  delay?: number;
};

export default function EditorialRevealSection({
  children,
  className,
  labelledBy,
  delay = 0,
}: EditorialRevealSectionProps) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.section className={className} aria-labelledby={labelledBy} {...revealOnce(reducedMotion, delay)}>
      {children}
    </motion.section>
  );
}
