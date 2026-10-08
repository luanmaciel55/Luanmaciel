'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { chat, chatApi } from '../../lib/chat/client';
import { EMOJIS, STICKERS, type Message, type Profile, type Thread } from '../../lib/chat/shared';
import { useCall } from '../../lib/chat/use-call';
import AudioMessage from '../../components/chat/AudioMessage';
import Recorder from '../../components/chat/Recorder';
import './chat.css';

function Icon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    chat: <><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-2 2v-10A8.5 8.5 0 0 1 10.5 3H13a8 8 0 0 1 8 8.5Z"/><path d="M7 10h10M7 14h6"/></>,
    back: <path d="m14 5-7 7 7 7"/>, add: <><path d="M12 5v14M5 12h14"/></>,
    phone: <path d="m7 3-4 2c-1 8 8 17 16 16l2-4-5-3-2 2c-3-1-5-3-6-6l2-2-3-5Z"/>,
    mic: <><rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></>,
    send: <><path d="m3 3 19 9-19 9 4-9-4-9ZM7 12h15"/></>,
    smile: <><circle cx="12" cy="12" r="9"/><path d="M8 14c2 3 6 3 8 0M8 8v1M16 8v1"/></>,
    settings: <><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/></>,
    people: <><circle cx="10" cy="8" r="4"/><path d="M2 21v-2a7 7 0 0 1 14 0v2M17 4a4 4 0 0 1 0 8M19 15c3 1 3 4 3 6"/></>,
    search: <><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/></>, close: <path d="m6 6 12 12M6 18 18 6"/>, more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
  };
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.chat}</svg>;
}
function Avatar({ name, large = false }: { name: string; large?: boolean }) { return <span className={`lc-avatar ${large ? 'large' : ''}`}>{name.trim().split(/\s+/).slice(0,2).map(n => n[0]).join('').toUpperCase()}</span>; }

export default function ChatPage() {
  const [user, setUser] = useState<User | null>(null); const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(''); const [theme, setTheme] = useState('light');
  const notify = useCallback((message: string) => setToast(message), []);
  useEffect(() => {
    const saved = localStorage.getItem('lm-chat-theme'); if (['light','dark','rose','ocean'].includes(saved || '')) setTheme(saved!);
    let active = true;
    chat.auth.getSession().then(({ data }) => { if (active) { setUser(data.session?.user || null); setLoading(false); } });
    const { data } = chat.auth.onAuthStateChange((_event, session) => { setUser(session?.user || null); setLoading(false); });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 9000); return () => clearTimeout(timer); }, [toast]);
  function changeTheme(value: string) { setTheme(value); localStorage.setItem('lm-chat-theme', value); }
  return <div className="lmchat" data-theme={theme}>
    {loading ? <div className="lc-loading">Abrindo seu chat…</div> : user ? <Messenger key={user.id} user={user} notify={notify} theme={theme} changeTheme={changeTheme}/> : <Auth notify={notify}/>}
    {toast && <div role="status" className="lc-toast"><span>{toast}</span><button aria-label="Fechar aviso" onClick={() => setToast('')}><Icon name="close"/></button></div>}
  </div>;
}
function Auth({ notify }: { notify: (message: string) => void }) {
  const [register, setRegister] = useState(false); const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return; setBusy(true);
    const fields = Object.fromEntries(new FormData(event.currentTarget).entries());
    try { const data = await chatApi(register ? 'register' : 'login', fields); const { error } = await chat.auth.setSession(data.session); if (error) throw error; }
    catch (error) { notify(error instanceof Error ? error.message : 'Não foi possível entrar.'); }
    finally { setBusy(false); }
  }
  return <div className="lc-auth"><div className="lc-auth-story"><span className="lc-brand"><span className="lc-logo"><Icon name="chat"/></span> LM <b>conversas</b></span><div className="lc-story-content"><span className="lc-eyebrow">PERTO, MESMO DE LONGE.</span><h1>Boas conversas.<br/><em>Mais conexão.</em></h1><p>Um espaço para trocar ideias, ouvir uma voz amiga e compartilhar os pequenos momentos.</p><div className="lc-sample"><div className="lc-sample-bubble">Oi! Que bom ter você por aqui. <span>😊</span></div><div className="lc-sample-bubble mine">Vamos conversar? <span>💜</span></div><img src="/chat-stickers/7.svg" width="140" height="140" alt="Figurinha Tamo junto!"/></div></div><small>Chat do site Luan Maciel</small></div>
    <div className="lc-auth-panel"><div className="lc-mobile-brand"><span className="lc-logo"><Icon name="chat"/></span> LM conversas</div><span className="lc-eyebrow">SEU CANTINHO DE CONVERSA</span><h2>{register ? 'Vamos nos conhecer?' : 'Bom ter você aqui.'}</h2><p>{register ? 'Crie sua conta e comece uma conversa.' : 'Entre para continuar de onde parou.'}</p>
      <div className="lc-auth-tabs"><button className={!register ? 'active' : ''} onClick={() => setRegister(false)} disabled={busy}>Entrar</button><button className={register ? 'active' : ''} onClick={() => setRegister(true)} disabled={busy}>Criar conta</button></div>
      <form onSubmit={submit} key={String(register)}>
        {register && <><label>Seu nome<input name="name" autoComplete="name" placeholder="Como quer ser chamado?" minLength={2} maxLength={60} required/></label><label>E-mail<input name="email" type="email" autoComplete="email" placeholder="voce@exemplo.com" maxLength={254} required/></label><label>Celular com DDD<input name="phone" type="tel" autoComplete="tel" placeholder="(21) 99999-9999" maxLength={22} required/></label></>}
        {!register && <label>E-mail ou celular<input name="identifier" autoComplete="username" placeholder="Seu e-mail ou celular com DDD" maxLength={254} required/></label>}
        <label>Senha<input name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} placeholder="Pelo menos 8 caracteres" minLength={8} maxLength={128} required/></label>
        {register && <p className="lc-fineprint">Sem confirmação por e-mail ou SMS. Use seus próprios dados: os contatos são informados pelos usuários e não têm identidade verificada. Guarde sua senha em um lugar seguro.</p>}
        <button className="lc-primary lc-full" disabled={busy}>{busy ? 'Só um instante…' : register ? 'Criar minha conta' : 'Entrar no chat'} <span>→</span></button>
      </form><p className="lc-auth-note">Conversas, mensagens de voz e um toque de carinho.<br/>Acesse diretamente pelo link do chat.</p><details className="lc-privacy"><summary>Privacidade e uso</summary><p>Conversas e áudios ficam armazenados no serviço do site, com acesso restrito aos participantes pelas regras do sistema. Não há criptografia de ponta a ponta nas mensagens. Chamadas exigem o chat aberto e permissão para o microfone. Não compartilhe senhas ou dados sensíveis. Para suporte ou exclusão da conta, contate Luan Maciel pelo canal de contato do site.</p></details>
    </div></div>;
}
function Messenger({ user, notify, theme, changeTheme }: { user: User; notify: (message: string) => void; theme: string; changeTheme: (theme: string) => void }) {
  const [me, setMe] = useState<Profile | null>(null); const [threads, setThreads] = useState<Thread[]>([]); const [selected, setSelected] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]); const [previews, setPreviews] = useState<Record<string, Message>>({});
  const [contacts, setContacts] = useState<string[]>([]); const [blocks, setBlocks] = useState<string[]>([]);
  const [tab, setTab] = useState('chats'); const [query, setQuery] = useState(''); const [draft, setDraft] = useState('');
  const [modal, setModal] = useState(''); const [picker, setPicker] = useState(''); const [recording, setRecording] = useState(false);
  const [sending, setSending] = useState(false); const [loadingMessages, setLoadingMessages] = useState(false); const [hasOlder, setHasOlder] = useState(false);
  const [online, setOnline] = useState(true); const [live, setLive] = useState(false); const [menu, setMenu] = useState(false); const [loaded, setLoaded] = useState(false);
  const bottom = useRef<HTMLDivElement | null>(null); const activeThread = useRef<string | null>(null); const requestNumber = useRef(0); const textInput = useRef<HTMLTextAreaElement | null>(null);
  const call = useCall(user.id, notify);
  const loadThreads = useCallback(async () => {
    const [profileRes, threadRes, contactRes, blockRes, messageRes] = await Promise.all([
      chat.from('chat_profiles').select('id,name').eq('id',user.id).maybeSingle(), chat.from('chat_threads').select('*').order('created_at',{ascending:false}),
      chat.from('chat_contacts').select('contact_id'), chat.from('chat_blocks').select('blocked_id'), chat.from('chat_messages').select('*').order('created_at',{ascending:false}).limit(200),
    ]);
    if (threadRes.error || profileRes.error) { notify('Não foi possível carregar o chat. A ativação pode estar pendente.'); setLoaded(true); return; }
    setMe(profileRes.data); setContacts((contactRes.data || []).map(r=>r.contact_id)); setBlocks((blockRes.data || []).map(r=>r.blocked_id));
    const rows = (threadRes.data || []) as Thread[];
    const ids = rows.map(r=>r.user_a===user.id?r.user_b:r.user_a);
    const { data: profiles } = ids.length ? await chat.from('chat_profiles').select('id,name').in('id',ids) : { data: [] };
    const map: Record<string,Message> = {}; for (const m of messageRes.data || []) if (!map[m.thread_id]) map[m.thread_id]=m as Message;
    setPreviews(map); setThreads(rows.map(r=>({...r,peer:profiles?.find(p=>p.id===(r.user_a===user.id?r.user_b:r.user_a))}))); setLoaded(true);
  },[notify,user.id]);
  const refreshMessages = useCallback(async (threadId: string) => {
    const number = ++requestNumber.current;
    const { data, error } = await chat.from('chat_messages').select('*').eq('thread_id',threadId).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(60);
    if (activeThread.current!==threadId || requestNumber.current!==number) return;
    if(error) notify('Não foi possível carregar as mensagens.'); else { setMessages(previous => { const merged = new Map(previous.map(m => [m.id, m])); for (const m of data || []) merged.set(m.id, m as Message); return Array.from(merged.values()).sort((a,b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)); }); if ((data?.length || 0) < 60) setHasOlder(false); else setHasOlder(true); }
    setLoadingMessages(false);
  },[notify]);
  useEffect(()=>{
    void loadThreads();
    const channel=chat.channel(`chat-list-${user.id}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'chat_threads'},()=>void loadThreads()).on('postgres_changes',{event:'INSERT',schema:'public',table:'chat_messages'},payload=>{
      const m=payload.new as Message; setPreviews(p=>({...p,[m.thread_id]:m}));
      if(activeThread.current===m.thread_id) setMessages(p=>p.some(x=>x.id===m.id)?p:[...p,m].sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id)));
      else void loadThreads();
    }).subscribe(status=>{setLive(status==='SUBSCRIBED');if(status==='SUBSCRIBED'){void loadThreads();if(activeThread.current)void refreshMessages(activeThread.current);}});
    const reconnect=()=>{setOnline(navigator.onLine);if(navigator.onLine){void loadThreads();if(activeThread.current)void refreshMessages(activeThread.current);}};
    const visibility=()=>{if(document.visibilityState==='visible')reconnect();};
    setOnline(navigator.onLine);window.addEventListener('online',reconnect);window.addEventListener('offline',reconnect);document.addEventListener('visibilitychange',visibility);
    const retry=setInterval(()=>{if(document.visibilityState==='visible'&&navigator.onLine){void loadThreads();if(activeThread.current)void refreshMessages(activeThread.current);}},30000);
    return()=>{void chat.removeChannel(channel);clearInterval(retry);window.removeEventListener('online',reconnect);window.removeEventListener('offline',reconnect);document.removeEventListener('visibilitychange',visibility);};
  },[loadThreads,refreshMessages,user.id]);
  useEffect(()=>{bottom.current?.scrollIntoView({behavior:'smooth',block:'end'});},[messages.length,selected?.id,picker]);
  useEffect(() => {
    if (!modal) return;
    const prior = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('.lc-modal');
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not([disabled]), input, textarea, [tabindex="0"]') || []);
    focusable()[0]?.focus();
    function key(event: KeyboardEvent) {
      if (event.key === 'Escape') setModal('');
      if (event.key === 'Tab') {
        const nodes = focusable(); const first = nodes[0]; const last = nodes[nodes.length-1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); prior?.focus(); };
  }, [modal]);
  function openThread(thread: Thread) { activeThread.current=thread.id;setSelected(thread);setMessages([]);setHasOlder(false);setDraft('');setPicker('');setRecording(false);setMenu(false);setLoadingMessages(true);void refreshMessages(thread.id); }
  function back() { activeThread.current=null;setSelected(null);setRecording(false);setPicker(''); }
  const isBlocked=Boolean(selected?.peer&&blocks.includes(selected.peer.id));
  async function send(kind: 'text'|'audio'|'sticker', content: string | number, threadId = selected?.id) {
    if(!threadId||sending||!online) return false;
    setSending(true);
    try{
      const {data,error}=await chat.from('chat_messages').insert({thread_id:threadId,sender_id:user.id,kind,...(kind==='text'?{body:content}:kind==='audio'?{audio_path:content}:{sticker_id:content})}).select().single();
      if(error) throw new Error('Mensagem não enviada. Confira a conexão; o contato também pode estar bloqueado.');
      if(activeThread.current===threadId){setMessages(p=>p.some(x=>x.id===data.id)?p:[...p,data as Message]);if(kind==='text')setDraft('');}
      setPreviews(p=>({...p,[threadId]:data as Message}));return true;
    }catch(error){notify(error instanceof Error?error.message:'Falha ao enviar.');return false;}finally{setSending(false);textInput.current?.focus();}
  }
  async function sendAudio(blob: Blob) {
    const threadId=selected?.id;if(!threadId)return false;
    const type=blob.type.split(';')[0];const ext=type==='audio/mp4'?'m4a':type==='audio/ogg'?'ogg':'webm';
    const path=`${threadId}/${user.id}/${crypto.randomUUID()}.${ext}`;
    const {error}=await chat.storage.from('chat-audio').upload(path,blob,{contentType:type,upsert:false});
    if(error){notify('Não foi possível enviar o áudio. Verifique a conexão e tente novamente.');return false;}
    const ok=await send('audio',path,threadId);if(!ok)await chat.storage.from('chat-audio').remove([path]);return ok;
  }
  async function toggleBlock() {
    const peer=selected?.peer;if(!peer)return;
    const result=isBlocked?await chat.from('chat_blocks').delete().eq('owner_id',user.id).eq('blocked_id',peer.id):await chat.from('chat_blocks').insert({owner_id:user.id,blocked_id:peer.id});
    if(result.error){notify('Não foi possível alterar o bloqueio.');return;}setBlocks(p=>isBlocked?p.filter(id=>id!==peer.id):[...p,peer.id]);setMenu(false);if(!isBlocked&&call.call?.thread_id===selected?.id)void call.end();
  }
  async function older() {
    if(!selected||!messages[0])return; const id=selected.id;const first=messages[0];
    const {data,error}=await chat.from('chat_messages').select('*').eq('thread_id',id).or(`created_at.lt.${first.created_at},and(created_at.eq.${first.created_at},id.lt.${first.id})`).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(60);
    if(error){notify('Não foi possível carregar mensagens anteriores.');return;}
    if(activeThread.current===id){setMessages(p=>[...(data||[]).reverse(),...p] as Message[]);setHasOlder(data?.length===60);}
  }
  const visible=threads.filter(t=>(tab!=='contacts'||contacts.includes(t.peer?.id||''))&&(t.peer?.name||'Contato').toLowerCase().includes(query.toLowerCase())).sort((a,b)=>(previews[b.id]?.created_at||b.created_at).localeCompare(previews[a.id]?.created_at||a.created_at));
  const preview=(m?:Message)=>!m?'Comece uma conversa':m.kind==='audio'?'♫ Mensagem de voz':m.kind==='sticker'?'Figurinha · '+STICKERS[(m.sticker_id||1)-1]:m.body;
  return <div className={`lc-shell ${selected?'has-conversation':''}`}>
    <aside className="lc-sidebar"><div className="lc-sidebar-top"><span className="lc-brand"><span className="lc-logo"><Icon name="chat"/></span> LM <b>conversas</b></span><button className="lc-icon" aria-label="Configurações e temas" onClick={()=>setModal('settings')}><Icon name="settings"/></button></div>
      <div className="lc-list-title"><div><span className="lc-eyebrow">SEU ESPAÇO</span><h1>{tab==='contacts'?'Contatos':'Conversas'}<span>.</span></h1></div><button className="lc-add" aria-label="Adicionar contato" onClick={()=>setModal('contact')}><Icon name="add"/></button></div>
      <label className="lc-search"><Icon name="search"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar pelo nome" aria-label="Buscar conversas"/></label>
      <div className="lc-tabs"><button className={tab==='chats'?'active':''} onClick={()=>setTab('chats')}><Icon name="chat"/>Conversas</button><button className={tab==='contacts'?'active':''} onClick={()=>setTab('contacts')}><Icon name="people"/>Contatos</button></div>
      <div className="lc-contact-list">{!loaded?<p className="lc-list-empty">Carregando suas conversas…</p>:visible.length?visible.map(t=><button className={`lc-contact ${selected?.id===t.id?'active':''}`} key={t.id} onClick={()=>openThread(t)}><Avatar name={t.peer?.name||'Contato'}/><span className="lc-contact-text"><strong>{t.peer?.name||'Contato'}</strong><span>{blocks.includes(t.peer?.id||'')?'Contato bloqueado':preview(previews[t.id])}</span></span><time>{previews[t.id]?new Date(previews[t.id].created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):''}</time></button>):<div className="lc-list-empty"><span className="lc-empty-icon"><Icon name="people"/></span><strong>{query?'Nenhum resultado':'Toda conversa começa com um oi.'}</strong><p>{query?'Tente outro nome.':'Adicione alguém pelo celular ou e-mail para começar.'}</p>{!query&&<button onClick={()=>setModal('contact')}>Adicionar contato →</button>}</div>}</div>
      <div className="lc-me"><Avatar name={me?.name||'Você'}/><span><strong>{me?.name||'Minha conta'}</strong><small><i className={online&&live?'connected':''}/>{!online?'Sem conexão':live?'Conectado':'Conectando…'}</small></span><button className="lc-icon" onClick={()=>setModal('settings')} aria-label="Abrir configurações"><Icon name="more"/></button></div>
    </aside>
    <section className="lc-conversation">{selected?<><div className="lc-conversation-top"><button className="lc-icon lc-back" aria-label="Voltar às conversas" onClick={back}><Icon name="back"/></button><Avatar name={selected.peer?.name||'Contato'}/><div className="lc-peer"><h2>{selected.peer?.name||'Contato'}</h2><span>{isBlocked?'Contato bloqueado':'Conversa individual'}</span></div><button className="lc-icon" aria-label="Ligar por voz" disabled={isBlocked||!!call.call||recording||!online} onClick={()=>void call.start(selected.id)}><Icon name="phone"/></button><button className="lc-icon" aria-label="Opções da conversa" aria-expanded={menu} onClick={()=>setMenu(!menu)}><Icon name="more"/></button>{menu&&<div className="lc-conversation-menu"><button onClick={()=>void toggleBlock()}>{isBlocked?'Desbloquear':'Bloquear contato'}</button><button onClick={()=>{setMenu(false);setModal('report');}}>Denunciar conversa</button></div>}</div>
      {!online&&<div className="lc-connection">Você está sem internet. As mensagens não serão enviadas.</div>}
      <div className="lc-messages" aria-label="Mensagens"><div className="lc-conversation-note">Vocês estão no LM conversas. Compartilhe bons momentos.</div>{hasOlder&&<button className="lc-older" onClick={()=>void older()}>Carregar anteriores</button>}{loadingMessages?<p className="lc-center">Carregando mensagens…</p>:!messages.length?<div className="lc-first-message"><img src="/chat-stickers/1.svg" width="150" height="150" alt="Oi, tudo bem?"/><p>Uma boa conversa começa aqui.</p></div>:messages.map((m,i)=><div key={m.id}>{(i===0||new Date(m.created_at).toDateString()!==new Date(messages[i-1].created_at).toDateString())&&<div className="lc-date">{new Date(m.created_at).toLocaleDateString('pt-BR',{day:'numeric',month:'long'})}</div>}<div className={`lc-message-row ${m.sender_id===user.id?'mine':''}`}><div className={`lc-message ${m.kind==='sticker'?'is-sticker':''}`}>{m.kind==='text'?<p>{m.body}</p>:m.kind==='audio'&&m.audio_path?<AudioMessage path={m.audio_path}/>:m.kind==='sticker'?<img src={`/chat-stickers/${m.sticker_id}.svg`} alt={STICKERS[(m.sticker_id||1)-1]} width="160" height="160"/>:null}<time>{new Date(m.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}{m.sender_id===user.id&&<span aria-label="Enviada" title="Enviada"> ✓</span>}</time></div></div></div>)}<div ref={bottom}/></div>
      {picker&&<div className="lc-picker"><div className="lc-picker-tabs"><button className={picker==='emojis'?'active':''} onClick={()=>setPicker('emojis')}>Emojis</button><button className={picker==='stickers'?'active':''} onClick={()=>setPicker('stickers')}>20 figurinhas</button><button aria-label="Fechar figurinhas" onClick={()=>setPicker('')}><Icon name="close"/></button></div><div className={picker==='emojis'?'lc-emoji-grid':'lc-sticker-grid'}>{picker==='emojis'?EMOJIS.map(emoji=><button key={emoji} onClick={()=>setDraft(d=>d+emoji)} aria-label={emoji}>{emoji}</button>):STICKERS.map((label,i)=><button key={label} disabled={sending||isBlocked||!online} onClick={()=>void send('sticker',i+1)} aria-label={`Enviar figurinha ${label}`}><img src={`/chat-stickers/${i+1}.svg`} alt={label} width="96" height="96"/></button>)}</div></div>}
      {isBlocked?<div className="lc-blocked">Você bloqueou este contato. <button onClick={()=>void toggleBlock()}>Desbloquear</button></div>:recording?<Recorder key={selected.id} send={sendAudio} close={()=>setRecording(false)} notify={notify}/>:<form className="lc-composer" onSubmit={e=>{e.preventDefault();if(draft.trim())void send('text',draft.trim());}}><button type="button" className="lc-icon" aria-label="Emojis e figurinhas" aria-expanded={!!picker} onClick={()=>setPicker(p=>p?'':'emojis')}><Icon name="smile"/></button><textarea ref={textInput} rows={1} value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Escreva sua mensagem…" aria-label="Mensagem" maxLength={4000} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing&&window.innerWidth>760){e.preventDefault();if(draft.trim())void send('text',draft.trim());}}}/>{draft.trim()?<button className="lc-send" disabled={sending||!online} aria-label="Enviar mensagem"><Icon name="send"/></button>:<button type="button" className="lc-send" disabled={!!call.call||!online} aria-label="Gravar mensagem de áudio" onClick={()=>{setPicker('');setRecording(true);}}><Icon name="mic"/></button>}</form>}
    </>:<div className="lc-welcome"><div className="lc-welcome-art"><img src="/chat-stickers/15.svg" width="240" height="240" alt="Um abraço!"/><span className="lc-art-dot one"/><span className="lc-art-dot two"/></div><span className="lc-eyebrow">GENTE PERTO. CONVERSAS DE VERDADE.</span><h2>Um oi pode mudar o dia.</h2><p>Escolha uma conversa ou adicione um contato.<br/>O resto é deixar o papo acontecer.</p><button className="lc-primary" onClick={()=>setModal('contact')}><Icon name="add"/>Nova conversa</button><small>Mensagens • Voz • Figurinhas</small></div>}</section>
    {modal&&<div className="lc-modal-backdrop" onClick={e=>{if(e.target===e.currentTarget)setModal('');}}><div role="dialog" aria-modal="true" aria-labelledby="chat-dialog-title" className="lc-modal"><button className="lc-modal-close lc-icon" aria-label="Fechar" onClick={()=>setModal('')}><Icon name="close"/></button>
      {modal==='contact'?<><span className="lc-eyebrow">UMA NOVA CONEXÃO</span><h2 id="chat-dialog-title">Adicionar contato</h2><p>A pessoa precisa ter uma conta no chat.</p><ActionForm label="E-mail ou celular com DDD" placeholder="(21) 99999-9999 ou e-mail completo" button="Adicionar e conversar" action={async value=>{const {thread}=await chatApi('add-contact',{identifier:value});await loadThreads();const {data:peer}=await chat.from('chat_profiles').select('id,name').eq('id',thread.user_a===user.id?thread.user_b:thread.user_a).single();openThread({...thread,peer});setModal('');}} notify={notify}/><small className="lc-fineprint">Confira com a pessoa se o contato é dela. Não verificamos a titularidade do telefone ou e-mail.</small></>:modal==='settings'?<><span className="lc-eyebrow">DO SEU JEITO</span><h2 id="chat-dialog-title">Seu chat, suas cores.</h2><p>Escolha o clima da conversa.</p><div className="lc-themes">{[['light','Claro'],['dark','Escuro'],['rose','Rosa'],['ocean','Oceano']].map(([id,name])=><button key={id} className={theme===id?'active':''} onClick={()=>changeTheme(id)}><i data-swatch={id}/>{name}{theme===id?' ✓':''}</button>)}</div><p className="lc-fineprint">As chamadas funcionam com os dois participantes no chat e com o microfone liberado. O site não recebe chamadas com a página fechada.</p><button className="lc-logout" onClick={async()=>{await call.end();const {error}=await chat.auth.signOut({scope:'local'});if(error)notify('Não foi possível sair. Tente novamente.');}}>Sair da conta</button></>:<><h2 id="chat-dialog-title">Denunciar conversa</h2><p>Descreva o problema para o administrador analisar.</p><ActionForm label="O que aconteceu?" placeholder="Descreva o problema (mínimo 5 caracteres)" button="Enviar denúncia" action={async value=>{if(value.trim().length<5)throw new Error('Descreva o problema com pelo menos 5 caracteres.');const {error}=await chat.from('chat_reports').insert({reporter_id:user.id,thread_id:selected?.id,reason:value.trim()});if(error)throw new Error('Não foi possível enviar a denúncia.');notify('Denúncia registrada para análise.');setModal('');}} notify={notify}/></>}
    </div></div>}
    {(call.call||call.phase)&&<div className="lc-call" role="dialog" aria-modal="true" aria-label="Chamada de voz"><div className="lc-call-card"><span className="lc-eyebrow">CHAMADA DE VOZ</span><Avatar large name={threads.find(t=>t.id===call.call?.thread_id)?.peer?.name||selected?.peer?.name||'Contato'}/><h2>{threads.find(t=>t.id===call.call?.thread_id)?.peer?.name||selected?.peer?.name||'Contato'}</h2><p>{call.phase}</p><div className="lc-call-actions">{call.phase==='Chamada recebida'?<button className="lc-answer" onClick={()=>void call.accept()}><Icon name="phone"/>Atender</button>:<><button onClick={call.toggleMute}>{call.muted?'Ativar microfone':'Silenciar'}</button><button onClick={()=>void call.play()}>Ativar som</button></>}<button className="lc-hangup" onClick={()=>void call.end()}>{call.phase==='Chamada recebida'?'Recusar':'Encerrar'}</button></div></div></div>}
  </div>;
}
function ActionForm({label,placeholder,button,action,notify}:{label:string;placeholder:string;button:string;action:(value:string)=>Promise<void>;notify:(message:string)=>void}) {
  const [value,setValue]=useState('');const [busy,setBusy]=useState(false);
  return <form onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);try{await action(value);}catch(error){notify(error instanceof Error?error.message:'Não foi possível concluir.');}finally{setBusy(false);}}}><label>{label}<input autoFocus value={value} onChange={e=>setValue(e.target.value)} placeholder={placeholder} required maxLength={1000}/></label><button className="lc-primary lc-full" disabled={busy}>{busy?'Só um instante…':button}</button></form>;
}
