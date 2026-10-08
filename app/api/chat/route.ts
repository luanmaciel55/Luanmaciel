import { createClient } from '@supabase/supabase-js';
import { createHash, createHmac } from 'node:crypto';
import { normalizeIdentifier, normalizePhone, validEmail, validPhone } from '../../../lib/chat/shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const reply = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(req: Request) {
  const origin = req.headers.get('origin');
  if (origin) {
    try {
      const source = new URL(origin);
      if (!['http:', 'https:'].includes(source.protocol) || source.host !== req.headers.get('host')) return reply({ error: 'Origem inválida.' }, 403);
    } catch { return reply({ error: 'Origem inválida.' }, 403); }
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || !pub) return reply({ error: 'O chat está em preparação. O administrador precisa concluir a ativação.' }, 503);
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const auth = createClient(url, pub, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const raw = await req.text();
    if (raw.length > 8192) return reply({ error: 'Solicitação muito grande.' }, 413);
    const body = JSON.parse(raw);
    const action = String(body.action || '');
    // On Vercel this header is overwritten by its trusted edge, never supplied by the client.
    const ip = process.env.VERCEL ? req.headers.get('x-vercel-forwarded-for')?.split(',')[0] || 'unknown' : 'local';
    const identifier = normalizeIdentifier(String(body.identifier || body.email || '').slice(0, 254));
    async function limit(scope: string, value: string, maximum: number) {
      const hash = createHash('sha256').update(`${scope}:${value}`).digest('hex');
      const { data, error } = await admin.rpc('chat_rate_limit', { p_key: hash, p_limit: maximum });
      if (error) throw new Error('Chat indisponível. Tente mais tarde.');
      if (!data) throw new Error('Muitas tentativas. Aguarde 10 minutos e tente novamente.');
    }
    await limit('ip', ip, 120);
    if (action === 'login' || action === 'register') {
      await limit(action + ':identity', identifier, action === 'register' ? 5 : 15);
      if (action === 'register') await limit('register:ip', ip, 10);
      const password = String(body.password || '');
      if (password.length < 8 || password.length > 128) return reply({ error: 'Use uma senha de 8 a 128 caracteres.' }, 400);
      if (action === 'register') {
        const email = String(body.email || '').trim().toLowerCase();
        const phone = normalizePhone(String(body.phone || ''));
        const name = String(body.name || '').trim();
        if (!validEmail(email) || !validPhone(phone) || name.length < 2 || name.length > 60) return reply({ error: 'Preencha nome, e-mail válido e celular com DDD.' }, 400);
        // Never confirm or modify an existing account. Existing site-admin identities are preserved.
        const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
        if (error || !created.user) return reply({ error: 'Não foi possível cadastrar. Confira os dados ou entre na sua conta.' }, 400);
        const { error: profileError } = await admin.rpc('chat_create_profile', { p_user: created.user.id, p_name: name, p_email: email, p_phone: phone });
        if (profileError) {
          await admin.auth.admin.deleteUser(created.user.id);
          return reply({ error: 'Não foi possível cadastrar. Confira os dados ou entre na sua conta.' }, 400);
        }
      }
      let email = identifier;
      if (!identifier.includes('@')) {
        const { data } = await admin.from('chat_identities').select('email').eq('phone', identifier).maybeSingle();
        email = data?.email || 'nonexistent@invalid.example';
      }
      const { data, error } = await auth.auth.signInWithPassword({ email, password });
      if (error || !data.session) return reply({ error: 'E-mail, celular ou senha inválidos.' }, 401);
      const { data: profile } = await admin.from('chat_profiles').select('id').eq('id', data.user.id).maybeSingle();
      if (!profile) return reply({ error: 'Esta conta não possui cadastro no chat.' }, 403);
      return reply({ session: { access_token: data.session.access_token, refresh_token: data.session.refresh_token } });
    }
    const token = req.headers.get('authorization')?.replace(/^Bearer /i, '') || '';
    const { data: { user }, error } = await admin.auth.getUser(token);
    if (error || !user) return reply({ error: 'Entre na sua conta novamente.' }, 401);
    const { data: profile } = await admin.from('chat_profiles').select('id').eq('id', user.id).maybeSingle();
    if (!profile) return reply({ error: 'Cadastro no chat não encontrado.' }, 403);
    if (action === 'add-contact') {
      await limit('contact:user', user.id, 30);
      const { data: target } = await admin.from('chat_identities').select('user_id').eq(identifier.includes('@') ? 'email' : 'phone', identifier).maybeSingle();
      if (!target || target.user_id === user.id) return reply({ error: 'Contato não encontrado. Confira o telefone ou e-mail completo.' }, 404);
      const { data: blocked, error: blockError } = await admin.from('chat_blocks').select('owner_id').or(`and(owner_id.eq.${user.id},blocked_id.eq.${target.user_id}),and(owner_id.eq.${target.user_id},blocked_id.eq.${user.id})`).limit(1);
      if (blockError) throw new Error('Não foi possível verificar o contato.');
      if (blocked?.length) return reply({ error: 'Este contato não está disponível.' }, 403);
      const [user_a, user_b] = [user.id, target.user_id].sort();
      const { data: thread, error: threadError } = await admin.from('chat_threads').upsert({ user_a, user_b }, { onConflict: 'user_a,user_b' }).select().single();
      if (threadError) throw new Error('Não foi possível adicionar o contato.');
      const { error: contactError } = await admin.from('chat_contacts').upsert({ owner_id: user.id, contact_id: target.user_id }, { onConflict: 'owner_id,contact_id' });
      if (contactError) throw new Error('Não foi possível salvar o contato.');
      return reply({ thread });
    }
    if (action === 'ice') {
      const servers: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
      const turnUrl = process.env.CHAT_TURN_URL;
      const secret = process.env.CHAT_TURN_SECRET;
      if (turnUrl && secret) {
        const username = `${Math.floor(Date.now() / 1000) + 3600}:${user.id}`;
        servers.push({ urls: turnUrl.split(','), username, credential: createHmac('sha1', secret).update(username).digest('base64') });
      }
      return reply({ iceServers: servers, relayConfigured: Boolean(turnUrl && secret) });
    }
    return reply({ error: 'Ação inválida.' }, 400);
  } catch (error) {
    if (error instanceof SyntaxError) return reply({ error: 'Solicitação inválida.' }, 400);
    const message = error instanceof Error ? error.message : '';
    return reply({ error: message.startsWith('Muitas tentativas') ? message : 'Chat indisponível. Tente novamente em instantes.' }, message.startsWith('Muitas tentativas') ? 429 : 503);
  }
}
