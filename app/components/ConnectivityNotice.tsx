"use client";

import { WifiSlash } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

export default function ConnectivityNotice() {
  const [online, setOnline] = useState(true);
  const notice = useRef<HTMLElement>(null);

  useEffect(() => {
    if (online || !notice.current) return;
    const update = () => document.documentElement.style.setProperty("--connectivity-notice-height", `${notice.current?.getBoundingClientRect().height ?? 0}px`);
    const observer = new ResizeObserver(update);
    observer.observe(notice.current);
    update();
    return () => { observer.disconnect(); document.documentElement.style.removeProperty("--connectivity-notice-height"); };
  }, [online]);

  useEffect(() => {
    const update = () => setOnline(window.navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (online) return null;

  return (
    <div className="connectivity-notice-space">
    <aside ref={notice} className="connectivity-notice" role="status" aria-live="polite">
      <WifiSlash aria-hidden="true" />
      <span>
        <strong>Koneksi internet terputus.</strong>
        Halaman yang sudah terbuka tetap dapat dibaca, tetapi data baru belum bisa dimuat.
      </span>
    </aside>
    </div>
  );
}
