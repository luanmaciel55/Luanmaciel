'use client';
import { createClient } from '@supabase/supabase-js';
// A separate storage key keeps the chat session independent of the admin session.
export const chat = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://buxevihtjiialecfhkhy.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_2UyIhB0in7Fa3pczGkZtzw_NmpvTiBm',
  { auth: { storageKey: 'lm-chat-session', detectSessionInUrl: false } },
);
export async function chatApi(action: string, body: Record<string, unknown> = {}) {
  const { data: { session } } = await chat.auth.getSession();
  const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) }, body: JSON.stringify({ action, ...body }) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Não foi possível concluir. Tente novamente.');
  return data;
}
