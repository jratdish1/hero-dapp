import type { Server } from "http";

export type ListenOptions = {
  host: string;
  port: number;
};

/**
 * Bind address for the HTTP server.
 * HOST defaults to 127.0.0.1 (loopback) and is env-overridable.
 * PORT defaults to 3000. The process must fail if that port is busy — no port-hopping.
 */
export function resolveListenOptions(env: NodeJS.ProcessEnv = process.env): ListenOptions {
  const host = (env.HOST && env.HOST.trim()) || "127.0.0.1";
  const raw = String(env.PORT ?? "3000").trim();
  // Digits only: parseInt would silently accept "3000abc" or "8080.5".
  const port = /^\d+$/.test(raw) ? Number(raw) : Number.NaN;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT: ${raw}`);
  }
  return { host, port };
}

export function listenOrFail(server: Server, options: ListenOptions): Promise<void> {
  const { host, port } = options;
  return new Promise((resolve, reject) => {
    const onError = (err: NodeJS.ErrnoException) => {
      server.off("listening", onListening);
      if (err.code === "EADDRINUSE") {
        reject(new Error(`PORT ${port} is busy on ${host}; refusing to port-hop`));
        return;
      }
      reject(err);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, host);
  });
}
