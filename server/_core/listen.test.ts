import { createServer } from "http";
import { afterEach, describe, expect, test } from "vitest";
import { listenOrFail, resolveListenOptions } from "./listen";

describe("resolveListenOptions", () => {
  test("defaults to loopback and port 3000", () => {
    expect(resolveListenOptions({})).toEqual({ host: "127.0.0.1", port: 3000 });
  });

  test("HOST is env-overridable", () => {
    expect(resolveListenOptions({ HOST: "0.0.0.0", PORT: "8080" })).toEqual({
      host: "0.0.0.0",
      port: 8080,
    });
  });

  test("blank HOST falls back to 127.0.0.1", () => {
    expect(resolveListenOptions({ HOST: "  " })).toEqual({ host: "127.0.0.1", port: 3000 });
  });

  test("rejects an invalid PORT", () => {
    expect(() => resolveListenOptions({ PORT: "nope" })).toThrow(/Invalid PORT/);
  });

  test("rejects trailing junk, decimals, zero and out-of-range PORT", () => {
    for (const bad of ["3000abc", "8080.5", "0", "65536", "-1", ""]) {
      expect(() => resolveListenOptions({ PORT: bad })).toThrow(/Invalid PORT/);
    }
  });
});

describe("listenOrFail", () => {
  const servers: ReturnType<typeof createServer>[] = [];
  afterEach(async () => {
    await Promise.all(
      // Only close servers that actually bound; closing the rejected one throws
      // ERR_SERVER_NOT_RUNNING and used to fail this suite in teardown.
      servers.splice(0).filter((s) => s.listening).map(
        (s) =>
          new Promise<void>((resolve, reject) => {
            s.close((err) => (err ? reject(err) : resolve()));
          }),
      ),
    );
  });

  test("fails if PORT is busy and does not hop", async () => {
    const holder = createServer();
    servers.push(holder);
    await listenOrFail(holder, { host: "127.0.0.1", port: 0 });
    const addr = holder.address();
    if (!addr || typeof addr === "string") throw new Error("expected tcp address");
    const busy = createServer();
    servers.push(busy);
    await expect(listenOrFail(busy, { host: "127.0.0.1", port: addr.port })).rejects.toThrow(
      /is busy.*refusing to port-hop/,
    );
  });
});
