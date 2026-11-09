import type { SessionUser } from "./types";

type SSEClient = {
  id: number;
  stationId: number | null;
  isAdmin: boolean;
  send: (chunk: string) => void;
  close: () => void;
};

type Bus = {
  clients: Map<number, SSEClient>;
  nextId: number;
};

const globalForBus = globalThis as unknown as { __metroBus?: Bus };

function bus(): Bus {
  if (!globalForBus.__metroBus) globalForBus.__metroBus = { clients: new Map(), nextId: 1 };
  return globalForBus.__metroBus;
}

export function activeSSECount(): number {
  return bus().clients.size;
}

export function createEventStream(user: SessionUser): Response {
  const b = bus();
  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let client: SSEClient | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const id = b.nextId++;
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          /* stream closed */
        }
      };
      client = {
        id,
        stationId: user.stationId,
        isAdmin: user.role === "admin",
        send,
        close: () => {
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        },
      };
      b.clients.set(id, client);
      send(`retry: 3000\n\n`);
      send(`event: ready\ndata: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`);
      heartbeat = setInterval(() => {
        send(`: heartbeat ${Date.now()}\n\n`);
      }, 25000);
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      if (client) b.clients.delete(client.id);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

/**
 * Broadcast to connected clients. `stationIds` limits delivery to those stations;
 * omit/undefined sends to every station (admins always receive events).
 */
export function broadcast(event: Record<string, unknown>, stationIds?: number[]) {
  const payload = JSON.stringify({ ...event, at: new Date().toISOString() });
  const target = stationIds ? new Set(stationIds) : null;
  for (const client of bus().clients.values()) {
    if (client.isAdmin) {
      client.send(`event: message\ndata: ${payload}\n\n`);
      continue;
    }
    if (client.stationId == null) continue;
    if (target && !target.has(client.stationId)) continue;
    client.send(`event: message\ndata: ${payload}\n\n`);
  }
}
