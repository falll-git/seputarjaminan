"use client";

import { WifiSlash } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

export default function ConnectivityNotice() {
  const [online, setOnline] = useState(true);

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
    <aside className="connectivity-notice" role="status" aria-live="polite">
      <WifiSlash aria-hidden="true" />
      <span>
        <strong>Koneksi internet terputus.</strong>
        Halaman yang sudah terbuka tetap dapat dibaca, tetapi data baru belum bisa dimuat.
      </span>
    </aside>
  );
}
