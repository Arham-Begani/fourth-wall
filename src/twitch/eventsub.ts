import type { TwitchIdentity } from "./auth";
export type ChatJoin = { id: string; name: string; color: string };
export function parseJoin(event: Record<string, unknown>): ChatJoin | null {
  const message = event.message as { text?: unknown } | undefined;
  if (typeof message?.text !== "string" || !/^!join\s*$/i.test(message.text))
    return null;
  if (
    typeof event.chatter_user_id !== "string" ||
    typeof event.chatter_user_name !== "string"
  )
    return null;
  return {
    id: event.chatter_user_id,
    name: event.chatter_user_name.slice(0, 24),
    color: typeof event.color === "string" ? event.color : "",
  };
}
export class JoinGate {
  private messages = new Set<string>();
  private users = new Map<string, number>();
  accept(messageId: string, userId: string, now: number) {
    if (!messageId || this.messages.has(messageId)) return false;
    this.messages.add(messageId);
    if (this.messages.size > 1000)
      this.messages.delete(this.messages.values().next().value!);
    if (now - (this.users.get(userId) ?? -Infinity) < 10000) return false;
    this.users.set(userId, now);
    if (this.users.size > 2000)
      for (const [id, at] of this.users)
        if (now - at > 60000) this.users.delete(id);
    return true;
  }
}
export type ConnectionStatus =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "error";
export class TwitchChat {
  private socket?: WebSocket;
  private sockets = new Set<WebSocket>();
  private stopped = false;
  private retry = 0;
  private watchdog?: ReturnType<typeof setTimeout>;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private keepalive = 15000;
  private gate = new JoinGate();
  onJoin?: (join: ChatJoin) => void;
  onStatus?: (status: ConnectionStatus, detail?: string) => void;
  constructor(private identity: TwitchIdentity) {}
  connect() {
    this.stopped = false;
    this.open("wss://eventsub.wss.twitch.tv/ws", false);
  }
  private open(url: string, migration: boolean) {
    if (this.stopped) return;
    this.onStatus?.(this.retry || migration ? "reconnecting" : "connecting");
    const previous = this.socket;
    const socket = new WebSocket(url);
    this.sockets.add(socket);
    this.socket = socket;
    const arm = () => {
      if (socket !== this.socket || this.stopped) return;
      clearTimeout(this.watchdog);
      this.watchdog = setTimeout(() => {
        socket.close();
        this.scheduleReconnect();
      }, this.keepalive + 3000);
    };
    arm();
    socket.onmessage = async (event) => {
      if (this.stopped) return;
      arm();
      try {
        const body = JSON.parse(event.data);
        const type = body.metadata?.message_type;
        if (type === "session_welcome") {
          this.keepalive =
            (body.payload.session.keepalive_timeout_seconds || 10) * 1000;
          if (!migration) {
            const response = await fetch(
              "https://api.twitch.tv/helix/eventsub/subscriptions",
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${this.identity.token}`,
                  "Client-Id": this.identity.clientId,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  type: "channel.chat.message",
                  version: "1",
                  condition: {
                    broadcaster_user_id: this.identity.userId,
                    user_id: this.identity.userId,
                  },
                  transport: {
                    method: "websocket",
                    session_id: body.payload.session.id,
                  },
                }),
                signal: AbortSignal.timeout(8000),
              },
            );
            if (!response.ok)
              throw new Error(
                response.status === 401 || response.status === 403
                  ? "Twitch authorization expired. Disconnect and connect again."
                  : `Twitch could not subscribe to chat (${response.status}). Try reconnecting.`,
              );
          }
          if (this.stopped || socket !== this.socket) return;
          if (migration && previous) {
            previous.onclose = null;
            previous.close();
            this.sockets.delete(previous);
          }
          this.retry = 0;
          arm();
          this.onStatus?.("connected");
        } else if (
          type === "notification" &&
          body.metadata.subscription_type === "channel.chat.message"
        ) {
          const join = parseJoin(body.payload.event);
          if (
            join &&
            this.gate.accept(body.metadata.message_id, join.id, Date.now())
          )
            this.onJoin?.(join);
        } else if (type === "session_reconnect") {
          const next = new URL(body.payload.session.reconnect_url);
          if (
            next.protocol !== "wss:" ||
            next.hostname !== "eventsub.wss.twitch.tv"
          )
            throw new Error(
              "Twitch supplied an unexpected reconnect destination.",
            );
          this.open(next.href, true);
        } else if (type === "revocation")
          throw new Error(
            "Twitch revoked chat access. Disconnect and authorize again.",
          );
      } catch (error) {
        this.disconnect();
        this.onStatus?.(
          "error",
          error instanceof Error
            ? error.message
            : "Twitch sent an invalid message. Reconnect to try again.",
        );
      }
    };
    socket.onclose = () => {
      this.sockets.delete(socket);
      if (socket === this.socket) this.scheduleReconnect();
    };
    socket.onerror = () => {
      if (socket === this.socket) {
        socket.close();
        this.scheduleReconnect();
      }
    };
  }
  private scheduleReconnect() {
    if (this.stopped || this.reconnectTimer) return;
    clearTimeout(this.watchdog);
    if (this.retry >= 6) {
      this.disconnect();
      this.onStatus?.(
        "error",
        "Twitch is unreachable. Check your connection, then reconnect.",
      );
      return;
    }
    this.onStatus?.("reconnecting");
    const delay = Math.min(30000, 1000 * 2 ** this.retry++);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      for (const socket of this.sockets) {
        socket.onclose = null;
        socket.close();
      }
      this.sockets.clear();
      this.open("wss://eventsub.wss.twitch.tv/ws", false);
    }, delay);
  }
  disconnect() {
    this.stopped = true;
    clearTimeout(this.watchdog);
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;
    for (const socket of this.sockets) {
      socket.onclose = null;
      socket.close();
    }
    this.sockets.clear();
    this.onStatus?.("disconnected");
  }
}
