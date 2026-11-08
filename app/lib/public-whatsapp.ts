/** Accept only the publication API's documented WhatsApp destination; never infer a phone. */
export function publicationWhatsappDestination(value: unknown): string | null {
  if (typeof value !== "string" || value !== value.trim()) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "wa.me" || url.port || url.username || url.password || url.hash) return null;
    if (!/^\/[1-9]\d{7,14}$/u.test(url.pathname)) return null;
    return `https://wa.me${url.pathname}`;
  } catch { return null; }
}

export function assetWhatsappHref(configuredUrl: unknown, title: string, reference: string, origin: string): string | null {
  const destination = publicationWhatsappDestination(configuredUrl);
  if (!destination || !/^SJ-[A-Z0-9]{8}$/u.test(reference)) return null;
  try {
    const site = new URL(origin);
    if (!["http:", "https:"].includes(site.protocol) || site.username || site.password) return null;
    const assetUrl = new URL(`/aset/${reference.toLowerCase()}`, site.origin);
    const message = `Halo Bapak/Ibu, saya ingin mengetahui informasi lebih lanjut tentang ${title} (${reference}).\n${assetUrl.href}`;
    const whatsapp = new URL(destination);
    whatsapp.searchParams.set("text", message);
    return whatsapp.href;
  } catch { return null; }
}
