/**
 * SafeZone – authService.ts
 * Autenticación MySQL/JWT. Guarda el token en AsyncStorage y lo envía en cada petición.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

declare const process: { env: Record<string, string | undefined> };

// ⚠ IP local de tu PC (ipconfig | findstr IPv4) o variable EXPO_PUBLIC_API_URL.
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://192.168.1.56:3001';

const KEY_TOKEN = 'sz_token';
const KEY_USER  = 'sz_user';

export interface SessionUser {
  id: number;
  email: string;
  nombre: string | null;
  rol: 'ciudadano' | 'admin';
}

// ─── Sesión ───────────────────────────────────────────────────────────────────
export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(KEY_TOKEN);
}

export async function getSession(): Promise<SessionUser | null> {
  const raw = await AsyncStorage.getItem(KEY_USER);
  return raw ? (JSON.parse(raw) as SessionUser) : null;
}

async function saveSession(token: string, user: SessionUser) {
  await AsyncStorage.multiSet([[KEY_TOKEN, token], [KEY_USER, JSON.stringify(user)]]);
}

async function clearSession() {
  await AsyncStorage.multiRemove([KEY_TOKEN, KEY_USER]);
}

// ─── Fetch autenticado (úsalo para reportes y para el panel admin) ────────────
export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = await getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message ?? `Error ${res.status}`);
  return data;
}

// ─── Acciones ─────────────────────────────────────────────────────────────────
export async function login(email: string, password: string, adminCode?: string): Promise<SessionUser> {
  const data = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, ...(adminCode ? { adminCode } : {}) }),
  });
  await saveSession(data.token, data.user);
  return data.user;
}

export async function register(email: string, password: string, nombre: string, matricula?: string): Promise<SessionUser> {
  const data = await apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, nombre, matricula }),
  });
  await saveSession(data.token, data.user);
  return data.user;
}

export async function logout() {
  try { await apiFetch('/auth/logout', { method: 'POST' }); } catch {}
  await clearSession();
}