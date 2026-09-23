import { Client, type IMessage, type StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { wsUrl } from '@/lib/config';
import { authService } from '@/lib/auth/authService';
import { STOMP } from '@/lib/api/endpoints';
import type { ConnectionState } from '@/types';

type Handler = (body: unknown) => void;

export interface ChatSocketCallbacks {
  onMessage?: Handler;
  onDelivered?: Handler;
  onSeen?: Handler;
  onTyping?: Handler;
  onPresence?: Handler;
  onStateChange?: (state: ConnectionState) => void;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Single-instance STOMP chat socket.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Two problems from the legacy implementation are solved here structurally
 * rather than by convention:
 *
 * 1. DUPLICATE CLIENTS. The original guarded with `_chatConnectPromise` because
 *    selecting a second conversation mid-connect would construct a second
 *    StompJs.Client and orphan the first. That guard is kept, and reinforced by
 *    making the client a module singleton — React StrictMode's double-invoked
 *    effects cannot produce two sockets.
 *
 * 2. LOST SUBSCRIPTIONS AFTER RECONNECT. @stomp/stompjs re-runs onConnect on
 *    every reconnect, and subscriptions do NOT survive. The active order id is
 *    therefore held in module state and re-subscribed inside onConnect, exactly
 *    as the original did — this is required, not defensive.
 */

let client: Client | null = null;
let connectPromise: Promise<void> | null = null;
let connected = false;
let activeOrderId: number | null = null;
let orderSubs: StompSubscription[] = [];
let globalSubs: StompSubscription[] = [];
let callbacks: ChatSocketCallbacks = {};
/** Ref-count so two mounted panels don't tear down each other's socket. */
let consumers = 0;

function setState(state: ConnectionState): void {
  callbacks.onStateChange?.(state);
}

function parse(frame: IMessage): unknown {
  try {
    return JSON.parse(frame.body);
  } catch {
    return null;
  }
}

function subscribeGlobal(c: Client): void {
  globalSubs.forEach((s) => {
    try {
      s.unsubscribe();
    } catch {
      /* already gone */
    }
  });
  globalSubs = [
    c.subscribe(STOMP.subscribe.userQueue, (f) => callbacks.onMessage?.(parse(f))),
    c.subscribe(STOMP.subscribe.presence, (f) => callbacks.onPresence?.(parse(f))),
  ];
}

function subscribeOrder(orderId: number): void {
  unsubscribeOrder();
  if (!client || !connected) return;
  orderSubs = [
    client.subscribe(STOMP.subscribe.orderChat(orderId), (f) => callbacks.onMessage?.(parse(f))),
    client.subscribe(STOMP.subscribe.orderDelivered(orderId), (f) =>
      callbacks.onDelivered?.(parse(f))
    ),
    client.subscribe(STOMP.subscribe.orderSeen(orderId), (f) => callbacks.onSeen?.(parse(f))),
    client.subscribe(STOMP.subscribe.orderTyping(orderId), (f) => callbacks.onTyping?.(parse(f))),
  ];
}

function unsubscribeOrder(): void {
  orderSubs.forEach((s) => {
    try {
      s.unsubscribe();
    } catch {
      /* socket already closed */
    }
  });
  orderSubs = [];
}

export const chatSocket = {
  get isConnected(): boolean {
    return connected && Boolean(client?.connected);
  },

  setCallbacks(next: ChatSocketCallbacks): void {
    callbacks = { ...callbacks, ...next };
  },

  connect(): Promise<void> {
    if (connected && client?.connected) return Promise.resolve();
    if (connectPromise) return connectPromise;

    const token = authService.getToken();
    let settled = false;
    setState('connecting');

    connectPromise = new Promise<void>((resolve, reject) => {
      try {
        const c = new Client({
          webSocketFactory: () => new SockJS(wsUrl()),
          connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
          reconnectDelay: 5000,
          heartbeatIncoming: 10000,
          heartbeatOutgoing: 10000,
          debug: () => {},

          onConnect: () => {
            connected = true;
            setState('connected');
            subscribeGlobal(c);
            // Reinstate the per-order topics — mandatory after any reconnect.
            if (activeOrderId !== null) subscribeOrder(activeOrderId);
            if (!settled) {
              settled = true;
              connectPromise = null;
              resolve();
            }
          },

          onDisconnect: () => {
            connected = false;
            setState('closed');
          },

          onWebSocketClose: () => {
            connected = false;
            orderSubs = [];
            globalSubs = [];
            setState(settled ? 'reconnecting' : 'error');
          },

          onStompError: (frame) => {
            connected = false;
            setState('error');
            const msg = frame?.headers?.message || frame?.body || 'STOMP error';
            if (!settled) {
              settled = true;
              connectPromise = null;
              reject(new Error(`Chat connection failed: ${msg}`));
            }
          },

          onWebSocketError: () => {
            setState('error');
            if (!settled) {
              settled = true;
              connectPromise = null;
              reject(new Error('Chat connection failed — check your network.'));
            }
          },
        });

        client = c;
        c.activate();
      } catch (e) {
        // A synchronous throw never reaches the callbacks above, so the guard
        // must be cleared here too or every retry would reuse a dead promise.
        connectPromise = null;
        setState('error');
        reject(e as Error);
      }
    });

    return connectPromise;
  },

  /** Switch the per-order topic subscriptions to a different order. */
  setActiveOrder(orderId: number | null): void {
    activeOrderId = orderId;
    if (orderId === null) {
      unsubscribeOrder();
      return;
    }
    if (connected) subscribeOrder(orderId);
  },

  publish(destination: string, body: unknown): boolean {
    if (!client || !connected) return false;
    client.publish({
      destination,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return true;
  },

  /** Called by every consumer on mount so teardown only happens for the last one. */
  acquire(): void {
    consumers += 1;
  },

  release(): void {
    consumers = Math.max(0, consumers - 1);
    if (consumers === 0) chatSocket.disconnect();
  },

  /**
   * Force a fresh connection after a failure. STOMP's own reconnectDelay only
   * retries transport drops; a handshake rejected outright (bad token, CORS on
   * /ws/chat) leaves the client in `error` with nothing scheduled, so the admin
   * needs a way to try again without reloading the page.
   */
  async reconnect(): Promise<void> {
    this.disconnect();
    await this.connect();
  },

  disconnect(): void {
    unsubscribeOrder();
    globalSubs.forEach((s) => {
      try {
        s.unsubscribe();
      } catch {
        /* ignore */
      }
    });
    globalSubs = [];
    activeOrderId = null;
    connected = false;
    connectPromise = null;
    const c = client;
    client = null;
    if (c) void c.deactivate();
    setState('idle');
  },
};
