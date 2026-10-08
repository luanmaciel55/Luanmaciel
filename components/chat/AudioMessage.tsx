'use client';
import { useEffect, useState } from 'react';
import { chat } from '../../lib/chat/client';
export default function AudioMessage({ path }: { path: string }) {
  const [url, setUrl] = useState(''); const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    chat.storage.from('chat-audio').createSignedUrl(path, 3600).then(({ data, error }) => { if (active) { setUrl(data?.signedUrl || ''); if (error) setError('Áudio indisponível. Reabra a conversa para tentar novamente.'); } });
    return () => { active = false; };
  }, [path]);
  return url ? <audio controls preload="none" src={url} aria-label="Mensagem de áudio" onError={() => setError('Áudio indisponível neste navegador.')} /> : <span>{error || 'Carregando áudio…'}</span>;
}
