import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { io, Socket } from 'socket.io-client';
import { WS_URL } from './config';

let _socket: Socket | null = null;
// One-shot guard so the "websocket error" warn doesn't flood logs on every
// reconnect attempt. We reset it when the socket actually connects, so the
// next loss-of-connectivity stretch logs once again.
let _warnedThisOutage = false;

// Presence heartbeat. The server reaps any socket whose lastSeen is older than
// 60s and force-disconnects it (handlers.js:119-137); lastSeen is only ever
// refreshed by `presence:ping`. Mobile never sent one, so every phone socket
// was killed ~60s after connecting — and because socket.io-client does NOT
// auto-reconnect from a server-initiated disconnect, it then stayed dead until
// app restart. Outbound calls emitted into a dead transport (silently, since
// the buffer never flushes) while inbound still rang over APNs, which is why
// the bug looked one-directional. Web has always pinged from App.jsx:95.
const PRESENCE_PING_MS = 25 * 1000;
let _pingTimer: ReturnType<typeof setInterval> | null = null;

function stopPresencePing() {
  if (_pingTimer) {
    clearInterval(_pingTimer);
    _pingTimer = null;
  }
}

function startPresencePing(socket: Socket) {
  stopPresencePing();
  socket.emit('presence:ping');
  _pingTimer = setInterval(() => socket.emit('presence:ping'), PRESENCE_PING_MS);
}

export async function getSocket(): Promise<Socket> {
  if (_socket) return _socket;

  _socket = io(WS_URL, {
    // Fresh token on every (re)connect — avoids the "first connect happened
    // before login → cached tokenless socket forever" race.
    auth: async (cb: (data: { token: string | null }) => void) => {
      const token = await AsyncStorage.getItem('spidr_token');
      cb({ token });
    },
    // Polling-first matches socket.io's default and is dramatically more
    // reliable than ws-first on React Native: Expo Go, cellular, corporate
    // proxies, and certain TLS chains all kill the raw WS upgrade but pass
    // long-poll HTTP through fine. socket.io will silently upgrade to ws
    // once a polling connection is established.
    transports: ['polling', 'websocket'],
    upgrade: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1500,
    reconnectionDelayMax: 8000,
    timeout: 20000,
    autoConnect: true,
  });

  _socket.on('connect', () => {
    _warnedThisOutage = false;
    if (__DEV__) console.log('Socket.io connected:', _socket?.id);
    if (_socket) startPresencePing(_socket);
  });

  _socket.on('disconnect', (reason) => {
    if (__DEV__) console.log('Socket.io disconnected:', reason);
    stopPresencePing();
    // socket.io-client deliberately does not auto-reconnect when the server
    // hangs up — `reconnection: true` covers transport failures only. Without
    // this, one reap (or any server-side kick) leaves the app socket-less for
    // the rest of its lifetime.
    if (reason === 'io server disconnect') {
      setTimeout(() => { try { _socket?.connect(); } catch { /* non-fatal */ } }, 1000);
    }
  });

  _socket.on('connect_error', (err) => {
    // Log once per outage, not once per retry. Spam was the symptom that
    // sent us here in the first place.
    if (__DEV__ && !_warnedThisOutage) {
      _warnedThisOutage = true;
      console.warn('Socket.io connect_error:', err.message);
    }
  });

  // The OS freezes JS timers while the app is backgrounded, so the ping stops
  // and the socket may well be reaped before we come back — inbound calls ride
  // APNs in that window. On resume, reconnect (or re-ping) immediately so an
  // outbound call can't fire into a socket the server already discarded.
  AppState.addEventListener('change', (state) => {
    if (state !== 'active' || !_socket) return;
    if (_socket.connected) startPresencePing(_socket);
    else try { _socket.connect(); } catch { /* non-fatal */ }
  });

  return _socket;
}

// Force the singleton to reconnect with a fresh token (call after login /
// after logout-and-relogin without app restart).
export async function reconnectSocket() {
  if (!_socket) return getSocket();
  _socket.disconnect();
  _socket.connect();
  return _socket;
}

export function disconnectSocket() {
  if (_socket) {
    stopPresencePing();
    _socket.disconnect();
    _socket = null;
    _warnedThisOutage = false;
  }
}
