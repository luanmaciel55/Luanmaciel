'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { chat, chatApi } from './client';
import type { Call } from './shared';

export function useCall(userId: string, notify: (message: string) => void) {
  const [call, setCall] = useState<Call | null>(null);
  const [phase, setPhase] = useState('');
  const [muted, setMuted] = useState(false);
  const callRef = useRef<Call | null>(null);
  const pc = useRef<RTCPeerConnection | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const sent = useRef<Set<string>>(new Set());
  const outgoingIce = useRef<RTCIceCandidateInit[]>([]);
  const busy = useRef(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generation = useRef(0);
  const setCurrent = useCallback((value: Call | null) => { callRef.current = value; setCall(value); }, []);
  const cleanup = useCallback(() => {
    generation.current++;
    if (timeout.current) clearTimeout(timeout.current);
    if (pc.current) { pc.current.onconnectionstatechange = null; pc.current.close(); }
    pc.current = null;
    stream.current?.getTracks().forEach(track => track.stop()); stream.current = null;
    if (audio.current) { audio.current.pause(); audio.current.srcObject = null; }
    sent.current.clear(); outgoingIce.current = []; busy.current = false;
    setMuted(false); setPhase(''); setCurrent(null);
  }, [setCurrent]);
  const end = useCallback(async () => {
    const current = callRef.current;
    cleanup();
    if (current) {
      const { error } = await chat.from('chat_calls').update({ status: 'ended' }).eq('id', current.id).neq('status', 'ended');
      if (error) notify('Chamada encerrada neste aparelho. A outra pessoa pode levar alguns segundos para receber o aviso.');
    }
  }, [cleanup, notify]);
  const receiveIce = useCallback(async () => {
    const current = callRef.current; const peer = pc.current;
    if (!current || !peer?.remoteDescription) return;
    const { data } = await chat.from('chat_ice').select('id,candidate').eq('call_id', current.id).neq('sender_id', userId);
    for (const row of data || []) {
      if (sent.current.has(row.id)) continue;
      sent.current.add(row.id);
      try { await peer.addIceCandidate(row.candidate); } catch { /* A closed peer is harmless. */ }
    }
  }, [userId]);
  const sendIce = useCallback(async () => {
    const current = callRef.current;
    if (!current || !outgoingIce.current.length) return;
    const batch = outgoingIce.current.splice(0);
    const { error } = await chat.from('chat_ice').insert(batch.map(candidate => ({ call_id: current.id, sender_id: userId, candidate })));
    if (error && callRef.current?.id === current.id) { notify('Falha na conexão da chamada. Tente novamente.'); void end(); }
  }, [end, notify, userId]);
  const prepare = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) throw new Error('Este navegador não permite chamadas. Abra o chat no Safari ou Chrome atualizado.');
    const currentGeneration = generation.current;
    const local = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
    if (currentGeneration !== generation.current) { local.getTracks().forEach(t => t.stop()); throw new Error('Chamada cancelada.'); }
    stream.current = local;
    const settings = await chatApi('ice');
    if (currentGeneration !== generation.current) { local.getTracks().forEach(t => t.stop()); throw new Error('Chamada cancelada.'); }
    if (!settings.relayConfigured) notify('Chamadas em teste: algumas redes podem impedir a conexão.');
    const peer = new RTCPeerConnection({ iceServers: settings.iceServers }); pc.current = peer;
    local.getTracks().forEach(track => peer.addTrack(track, local));
    // Create and unlock the audio element during the user's call/accept gesture.
    if (!audio.current) audio.current = new Audio();
    audio.current.autoplay = true;
    peer.ontrack = event => {
      if (!audio.current) return;
      audio.current.srcObject = event.streams[0] || new MediaStream([event.track]);
      void audio.current.play().catch(() => notify('Toque em “Ativar som” para ouvir a chamada.'));
    };
    peer.onicecandidate = event => { if (event.candidate) { outgoingIce.current.push(event.candidate.toJSON()); void sendIce(); } };
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'connected') { setPhase('Em chamada'); if (timeout.current) clearTimeout(timeout.current); }
      if (peer.connectionState === 'failed') { notify('A rede não conseguiu conectar a chamada.'); void end(); }
      if (peer.connectionState === 'disconnected') setPhase('Reconectando…');
    };
    return peer;
  }, [end, notify, sendIce]);
  const reconcile = useCallback(async () => {
    const current = callRef.current;
    if (current) {
      const { data } = await chat.from('chat_calls').select('*').eq('id', current.id).maybeSingle();
      if (!data || callRef.current?.id !== current.id) return;
      if (data.status === 'ended') { cleanup(); return; }
      if (data.status === 'ringing' && Date.now() - Date.parse(data.created_at) > 60000) { void end(); return; }
      setCurrent(data as Call);
      const peer = pc.current;
      if (data.answer && peer && !peer.currentRemoteDescription && peer.signalingState === 'have-local-offer') {
        try { await peer.setRemoteDescription(data.answer); setPhase('Conectando…'); } catch { /* Other reconciliation may already have applied the answer. */ }
      }
      await receiveIce();
    } else if (!busy.current) {
      const { data } = await chat.from('chat_calls').select('*').eq('status', 'ringing').neq('caller_id', userId).gte('created_at', new Date(Date.now()-60000).toISOString()).order('created_at', { ascending: false }).limit(1);
      if (data?.[0] && !callRef.current && !busy.current) { setCurrent(data[0] as Call); setPhase('Chamada recebida'); }
    }
  }, [cleanup, end, receiveIce, setCurrent, userId]);
  useEffect(() => {
    const channel = chat.channel(`calls-${userId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'chat_calls' }, () => void reconcile()).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_ice' }, () => void receiveIce()).subscribe(() => void reconcile());
    const poll = setInterval(() => void reconcile(), 5000);
    const onPageHide = () => { void end(); };
    window.addEventListener('pagehide', onPageHide);
    return () => { clearInterval(poll); window.removeEventListener('pagehide', onPageHide); void chat.removeChannel(channel); cleanup(); };
  }, [cleanup, end, receiveIce, reconcile, userId]);
  async function start(threadId: string) {
    if (busy.current || callRef.current) return;
    busy.current = true; setPhase('Acessando microfone…');
    try {
      const peer = await prepare();
      await peer.setLocalDescription(await peer.createOffer());
      const { data, error } = await chat.from('chat_calls').insert({ thread_id: threadId, caller_id: userId, offer: peer.localDescription?.toJSON() }).select().single();
      if (error) throw new Error('Não foi possível iniciar a chamada.');
      setCurrent(data as Call); setPhase('Chamando…'); await sendIce();
      timeout.current = setTimeout(() => { notify('A chamada não foi atendida ou não conectou.'); void end(); }, 50000);
    } catch (error) { notify(error instanceof Error ? error.message : 'Não foi possível acessar o microfone.'); cleanup(); }
    finally { busy.current = false; }
  }
  async function accept() {
    const current = callRef.current;
    if (!current || busy.current) return;
    busy.current = true;
    try {
      const peer = await prepare();
      if (callRef.current?.id !== current.id) { cleanup(); return; }
      await peer.setRemoteDescription(current.offer);
      await peer.setLocalDescription(await peer.createAnswer());
      const { error } = await chat.from('chat_calls').update({ answer: peer.localDescription?.toJSON(), status: 'active' }).eq('id', current.id);
      if (error) throw new Error('Esta chamada não está mais disponível.');
      setPhase('Conectando…'); await sendIce(); await receiveIce();
      timeout.current = setTimeout(() => { notify('Não foi possível conectar nesta rede.'); void end(); }, 35000);
    } catch (error) { notify(error instanceof Error ? error.message : 'Permita o acesso ao microfone para atender.'); void end(); }
    finally { busy.current = false; }
  }
  function toggleMute() { const tracks = stream.current?.getAudioTracks() || []; tracks.forEach(t => { t.enabled = muted; }); setMuted(!muted); }
  return { call, phase, muted, start, accept, end, toggleMute, play: () => audio.current?.play().catch(() => notify('Não foi possível ativar o som.')) };
}
