import { afterEach, describe, expect, it, vi } from "vitest";
import { parseJoin, JoinGate, TwitchChat } from "../src/twitch/eventsub";
import { validateToken } from "../src/twitch/auth";
describe("Twitch join intake", () => {
  it("accepts only an exact join command, ignoring ordinary conversation", () => {
    const user = {
      chatter_user_id: "42",
      chatter_user_name: "Alice",
      color: "#00ff00",
    };
    expect(parseJoin({ ...user, message: { text: "!JOIN " } })?.id).toBe("42");
    expect(parseJoin({ ...user, message: { text: "hello !join" } })).toBeNull();
    expect(
      parseJoin({ ...user, message: { text: "!join hacked" } }),
    ).toBeNull();
    expect(parseJoin({ message: { text: "!join" } })).toBeNull();
  });
  it("deduplicates delivery and enforces an individual cooldown", () => {
    const gate = new JoinGate();
    expect(gate.accept("m1", "a", 0)).toBe(true);
    expect(gate.accept("m1", "a", 20000)).toBe(false);
    expect(gate.accept("m2", "a", 100)).toBe(false);
    expect(gate.accept("m3", "b", 100)).toBe(true);
    expect(gate.accept("m4", "a", 11000)).toBe(true);
  });
});
class Socket {
  static instances: Socket[] = [];
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  constructor(public url: string) {
    Socket.instances.push(this);
  }
  close() {
    this.closed = true;
    this.onclose?.();
  }
  async receive(message: unknown) {
    await this.onmessage?.({ data: JSON.stringify(message) });
  }
}
const identity = {
  token: "test-only",
  clientId: "client",
  userId: "123",
  login: "tester",
  expiresAt: Infinity,
};
const welcome = (id: string) => ({
  metadata: { message_type: "session_welcome" },
  payload: { session: { id, keepalive_timeout_seconds: 10 } },
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Socket.instances = [];
});
describe("EventSub lifecycle", () => {
  it("subscribes to the signed-in channel and delivers deduplicated viewers", async () => {
    vi.stubGlobal("WebSocket", Socket);
    const fetcher = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetcher);
    const chat = new TwitchChat(identity);
    const joined = vi.fn();
    chat.onJoin = joined;
    chat.connect();
    const socket = Socket.instances[0];
    await socket.receive(welcome("s1"));
    const body = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(body.condition).toEqual({
      broadcaster_user_id: "123",
      user_id: "123",
    });
    expect(body.transport.session_id).toBe("s1");
    const event = {
      metadata: {
        message_type: "notification",
        subscription_type: "channel.chat.message",
        message_id: "m1",
      },
      payload: {
        event: {
          chatter_user_id: "a",
          chatter_user_name: "Alice",
          message: { text: "!join" },
        },
      },
    };
    await socket.receive(event);
    await socket.receive(event);
    expect(joined).toHaveBeenCalledTimes(1);
    chat.disconnect();
  });
  it("migrates a session without duplicate subscriptions and closes the old socket", async () => {
    vi.stubGlobal("WebSocket", Socket);
    const fetcher = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetcher);
    const chat = new TwitchChat(identity);
    chat.connect();
    const old = Socket.instances[0];
    await old.receive(welcome("s1"));
    await old.receive({
      metadata: { message_type: "session_reconnect" },
      payload: {
        session: {
          reconnect_url: "wss://eventsub.wss.twitch.tv/ws?reconnect=abc",
        },
      },
    });
    await Socket.instances[1].receive(welcome("s2"));
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(old.closed).toBe(true);
    chat.disconnect();
  });
  it("reconnects after an unplanned disconnect and creates a fresh subscription", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", Socket);
    const fetcher = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetcher);
    const chat = new TwitchChat(identity);
    chat.connect();
    await Socket.instances[0].receive(welcome("s1"));
    Socket.instances[0].close();
    await vi.advanceTimersByTimeAsync(1000);
    expect(Socket.instances).toHaveLength(2);
    await Socket.instances[1].receive(welcome("s2"));
    expect(fetcher).toHaveBeenCalledTimes(2);
    chat.disconnect();
  });
  it("stops and reports authorization failure", async () => {
    vi.stubGlobal("WebSocket", Socket);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401 }),
    );
    const chat = new TwitchChat(identity);
    const status = vi.fn();
    chat.onStatus = status;
    chat.connect();
    await Socket.instances[0].receive(welcome("s1"));
    expect(status).toHaveBeenLastCalledWith(
      "error",
      expect.stringContaining("authorization expired"),
    );
    expect(Socket.instances[0].closed).toBe(true);
  });
  it("rejects a reconnect destination outside Twitch", async () => {
    vi.stubGlobal("WebSocket", Socket);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    const chat = new TwitchChat(identity);
    const status = vi.fn();
    chat.onStatus = status;
    chat.connect();
    await Socket.instances[0].receive({
      metadata: { message_type: "session_reconnect" },
      payload: { session: { reconnect_url: "wss://example.com/steal" } },
    });
    expect(Socket.instances).toHaveLength(1);
    expect(status).toHaveBeenLastCalledWith(
      "error",
      expect.stringContaining("unexpected"),
    );
  });
});
describe("Token validation", () => {
  it("rejects mismatched application IDs even if the token is otherwise valid", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({
          ok: true,
          json: async () => ({
            client_id: "other",
            user_id: "123",
            scopes: ["user:read:chat"],
          }),
        }),
    );
    await expect(validateToken("test-token", "expected")).rejects.toThrow(
      "did not grant",
    );
  });
  it("requires the narrow chat-reading scope", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({
          ok: true,
          json: async () => ({
            client_id: "expected",
            user_id: "123",
            scopes: [],
          }),
        }),
    );
    await expect(validateToken("test-token", "expected")).rejects.toThrow(
      "did not grant",
    );
  });
});
