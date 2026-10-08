'use client';
import { useEffect, useRef, useState } from 'react';
export default function Recorder({ send, close, notify }: { send: (blob: Blob) => Promise<boolean>; close: () => void; notify: (text: string) => void }) {
  const recorder = useRef<MediaRecorder | null>(null); const media = useRef<MediaStream | null>(null);
  const mounted = useRef(true); const [seconds, setSeconds] = useState(0); const [recording, setRecording] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null); const [url, setUrl] = useState(''); const [busy, setBusy] = useState(false);
  const starting = useRef(false); const aborted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; aborted.current = true; if (recorder.current?.state === 'recording') recorder.current.stop(); media.current?.getTracks().forEach(t => t.stop()); }; }, []);
  useEffect(() => { if (!blob) return; const objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); return () => URL.revokeObjectURL(objectUrl); }, [blob]);
  useEffect(() => { if (!recording) return; const timer = setInterval(() => setSeconds(s => s + 1), 1000); return () => clearInterval(timer); }, [recording]);
  useEffect(() => { if (seconds >= 120 && recorder.current?.state === 'recording') recorder.current.stop(); }, [seconds]);
  async function start() {
    if (starting.current || recording) return; starting.current = true;
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error('Gravação não disponível neste navegador. Use Safari ou Chrome atualizado.');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) { stream.getTracks().forEach(t => t.stop()); return; }
      media.current = stream;
      const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find(t => MediaRecorder.isTypeSupported(t));
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined); recorder.current = rec;
      const chunks: BlobPart[] = []; let size = 0;
      rec.ondataavailable = event => { if (event.data.size) { chunks.push(event.data); size += event.data.size; if (size > 5 * 1024 * 1024 && rec.state === 'recording') rec.stop(); } };
      rec.onstop = () => { stream.getTracks().forEach(t => t.stop()); if (mounted.current && !aborted.current) { setRecording(false); if (size > 5 * 1024 * 1024) notify('O áudio ficou muito grande. Grave uma mensagem menor.'); else setBlob(new Blob(chunks, { type: rec.mimeType })); } };
      rec.onerror = () => { stream.getTracks().forEach(t => t.stop()); setRecording(false); notify('A gravação foi interrompida. Tente novamente.'); };
      aborted.current = false; setBlob(null); setSeconds(0); setRecording(true); rec.start(1000);
    } catch (error) { notify(error instanceof Error ? error.message : 'Permita o microfone para gravar.'); }
    finally { starting.current = false; }
  }
  return <div className="lc-recorder"><div><strong>{recording ? `● Gravando · ${seconds}s` : blob ? 'Ouça antes de enviar' : 'Mensagem de voz'}</strong><small>Até 2 minutos • microfone do aparelho</small></div>{url && blob && <audio src={url} controls />}
    <div className="lc-recorder-actions"><button type="button" onClick={() => { aborted.current = true; close(); }} disabled={busy}>Cancelar</button>{recording ? <button type="button" className="lc-primary" onClick={() => recorder.current?.stop()}>Parar</button> : blob ? <button type="button" className="lc-primary" disabled={busy} onClick={async () => { setBusy(true); try { if (await send(blob)) close(); } finally { if (mounted.current) setBusy(false); } }}>{busy ? 'Enviando…' : 'Enviar áudio'}</button> : <button type="button" className="lc-primary" onClick={start}>Começar a gravar</button>}</div>
  </div>;
}
