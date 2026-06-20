import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string>;

export const BASE_URL = extra.apiUrl || 'http://localhost:4000';
export const AUTH_URL = extra.authUrl || 'http://localhost:8080';
export const WS_URL = extra.wsUrl || BASE_URL;
export const SPOTIFY_CLIENT_ID = extra.spotifyClientId || '';
