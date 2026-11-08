import { setTimeout as delay } from "node:timers/promises";
import { ApiError } from "./errors.js";

// The callback must contain database work only: a rolled-back transaction can
// repeat, but transport nonces and external side effects must not be replayed.
export async function retryTransaction<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await operation(); }
    catch (error) {
      const code = (error as { code?: string }).code;
      if (code !== "P2034" && code !== "P2002") throw error;
      if (attempt === 3) {
        if (code === "P2002") throw new ApiError(409, "EVENT_CONFLICT", "Identitas data sudah digunakan.");
        throw new ApiError(503, "TRANSACTION_BUSY", "Data sedang diperbarui. Silakan ulangi dengan nonce baru.", { retryable: true, retryAfterSeconds: 1 });
      }
      await delay(15 * 2 ** attempt + Math.floor(Math.random() * 15));
    }
  }
}
