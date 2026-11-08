// Transaction-only FIFO for the installed PrismaPg adapter; see docs/prisma-pg-serialization.md.
// Wrap public driver-adapter methods; never patch Prisma or pg private members.
import type { SqlDriverAdapter, SqlDriverAdapterFactory, Transaction } from "@prisma/driver-adapter-utils";

type Method = (...args: never[]) => unknown;
type MethodWrapper = (key: PropertyKey, original: Method) => Method;
const transactionMethods = new Set<PropertyKey>([
  "queryRaw", "executeRaw", "createSavepoint", "rollbackToSavepoint",
  "releaseSavepoint", "commit", "rollback",
]);

function requireObject(value: unknown): object {
  if (typeof value !== "object" || value === null) {
    throw new TypeError("PRISMA_ADAPTER_OBJECT_REQUIRED");
  }
  return value;
}

// Original receivers preserve private fields and stock nested method calls.
// Cache by original identity so stable methods remain stable without hiding edits.
function boundProxy<T extends object>(target: T, wrap: MethodWrapper): T {
  const methods = new Map<PropertyKey, { original: Method; wrapped: Method }>();
  return new Proxy(target, {
    get(originalTarget, key) {
      const value = Reflect.get(originalTarget, key, originalTarget);
      if (typeof value !== "function") return value;
      const cached = methods.get(key);
      if (cached?.original === value) return cached.wrapped;
      const original = value as Method;
      const wrapped = wrap(key, original);
      methods.set(key, { original, wrapped });
      return wrapped;
    },
  });
}

function serializedTransaction(transaction: Transaction): Transaction {
  requireObject(transaction);
  let tail: Promise<void> = Promise.resolve();
  let terminalRequested = false;
  return boundProxy(transaction, (key, original) => {
    if (!transactionMethods.has(key)) return original.bind(transaction);
    return (...args: unknown[]) => {
      if (terminalRequested) {
        return Promise.reject(new Error("PRISMA_TRANSACTION_ALREADY_FINALIZING"));
      }
      if (key === "commit" || key === "rollback") terminalRequested = true;
      const result = tail.then(() => Reflect.apply(original, transaction, args));
      // Keep rejection on the returned result. Only the private scheduling tail
      // recovers, allowing later queued work and rollback after a query failure.
      tail = result.then(() => undefined, () => undefined);
      return result;
    };
  });
}

function wrappedAdapter(adapter: SqlDriverAdapter): SqlDriverAdapter {
  requireObject(adapter);
  return boundProxy(adapter, (key, original) => key === "startTransaction"
    ? async (...args: unknown[]) => serializedTransaction(
      await Reflect.apply(original, adapter, args) as Transaction,
    )
    : original.bind(adapter));
}

/**
 * Preserve the factory and pool interface; serialize only each transaction.
 * Stock adapter methods retain their original receiver. In particular, a
 * savepoint or UDT parser using the supplied original queryable can make an
 * awaited nested call without waiting on its own queue slot. A custom parser
 * closing over and re-entering this proxy is NOT a supported reentrant use.
 */
export function serializeAdapterTransactions<T extends SqlDriverAdapterFactory>(factory: T): T {
  requireObject(factory);
  if (typeof Reflect.get(factory, "connect", factory) !== "function") {
    throw new TypeError("PRISMA_ADAPTER_CONNECT_REQUIRED");
  }
  return boundProxy(factory, (key, original) =>
    key === "connect" || key === "connectToShadowDb"
      ? async (...args: unknown[]) => wrappedAdapter(
        await Reflect.apply(original, factory, args) as SqlDriverAdapter,
      )
      : original.bind(factory));
}
