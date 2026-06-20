import AsyncStorage from '@react-native-async-storage/async-storage';
import { io, Socket } from 'socket.io-client';
import { WS_URL } from './config';

let _socket: Socket | null = null;
// One-shot guard so the "websocket error" warn doesn't flood logs on every
// reconnect attempt. We reset it when the socket actually connects, so the
// next loss-of-connectivity stretch logs once again.
let _warnedThisOutage = false;

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
  });

  _socket.on('disconnect', (reason) => {
    if (__DEV__) console.log('Socket.io disconnected:', reason);
  });

  _socket.on('connect_error', (err) => {
    // Log once per outage, not once per retry. Spam was the symptom that
    // sent us here in the first place.
    if (__DEV__ && !_warnedThisOutage) {
      _warnedThisOutage = true;
      console.warn('Socket.io connect_error:', err.message);
    }
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
    _socket.disconnect();
    _socket = null;
    _warnedThisOutage = false;
  }
}
