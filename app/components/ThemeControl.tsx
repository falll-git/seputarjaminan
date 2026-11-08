"use client";

import { Desktop, Moon, Sun } from "@phosphor-icons/react";
import { Radio, RadioGroup } from "react-aria-components";
import { normalizeTheme } from "@/app/lib/theme";
import { useTheme } from "./ThemeProvider";
import styles from "./ThemeControl.module.css";

export default function ThemeControl({ className = "" }: { className?: string }) {
  const { preference, ready, choose } = useTheme();
  return (
    <RadioGroup className={`${styles.control} ${className}`} aria-label="Tema tampilan" orientation="horizontal" value={preference} isDisabled={!ready} onChange={value => choose(normalizeTheme(value))} data-preference={preference}>
      <span className={styles.indicator} aria-hidden="true" />
      {([{ value: "light", label: "Terang", Icon: Sun }, { value: "dark", label: "Gelap", Icon: Moon }, { value: "system", label: "Ikuti perangkat", Icon: Desktop }] as const).map(({ value, label, Icon }) => (
        <Radio key={value} value={value} aria-label={label} className={styles.option}>
          <Icon aria-hidden="true" /><span className={styles.tooltip} aria-hidden="true">{label}</span>
        </Radio>
      ))}
    </RadioGroup>
  );
}
