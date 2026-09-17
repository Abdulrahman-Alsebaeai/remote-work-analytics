import { cookies } from 'next/headers';
const apiUrl = process.env.API_URL ?? 'http://localhost:4000/api/v1';
export async function authenticatedFetch(path: string, init?: RequestInit) {
  const jar = await cookies(); let access = jar.get('access_token')?.value;
  let response = await fetch(`${apiUrl}${path}`, { ...init, headers: { ...init?.headers, authorization: `Bearer ${access}` }, cache: 'no-store' });
  if (response.status !== 401) return response;
  const refresh = jar.get('refresh_token')?.value; if (!refresh) return response;
  const refreshed = await fetch(`${apiUrl}/auth/refresh`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refreshToken: refresh }), cache: 'no-store' });
  if (!refreshed.ok) return response;
  const tokens = await refreshed.json(); access = tokens.accessToken;
  jar.set('access_token', access!, cookieOptions(15 * 60)); jar.set('refresh_token', tokens.refreshToken, cookieOptions(30 * 86400));
  return fetch(`${apiUrl}${path}`, { ...init, headers: { ...init?.headers, authorization: `Bearer ${access}` }, cache: 'no-store' });
}
export const cookieOptions = (maxAge: number) => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge, expires: new Date(Date.now() + maxAge * 1000), priority: 'high' as const });
export { apiUrl };
