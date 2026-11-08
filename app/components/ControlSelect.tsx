"use client";

import { CaretDown, Check } from "@phosphor-icons/react";
import { Button, Label, ListBox, ListBoxItem, Popover, Select, SelectValue } from "react-aria-components";
import styles from "./CatalogControls.module.css";

export default function ControlSelect({ label, value, onChange, disabled = false, options }: {
  label: string; value: string; onChange: (value: string) => void; disabled?: boolean;
  options: { id: string; label: string }[];
}) {
  return <Select className={styles.select} selectedKey={value} onSelectionChange={key => { if (key !== null) onChange(String(key)); }} isDisabled={disabled}>
    <Label>{label}</Label>
    <Button className={styles.selectTrigger}><SelectValue /><CaretDown aria-hidden="true" /></Button>
    <Popover className={`${styles.popover} ${styles.selectPopover}`} offset={8} placement="bottom end">
      <ListBox className={styles.list} items={options}>
        {option => <ListBoxItem id={option.id} textValue={option.label} className={styles.selectOption}>
          {({isSelected}) => <><span>{option.label}</span><Check aria-hidden="true" style={{visibility:isSelected?"visible":"hidden"}} /></>}
        </ListBoxItem>}
      </ListBox>
    </Popover>
  </Select>;
}
