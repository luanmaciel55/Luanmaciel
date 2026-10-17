'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

type B = {
  id: number;
  label: string;
  url: string;
  background_color: string;
  text_color: string;
  border_color: string;
  animation: string;
};

export default function Aqui() {
  const [title, setTitle] = useState('Luan Maciel de Lemos');
  const [sub, setSub] = useState('');
  const [buttons, setButtons] = useState<B[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');

      const { data: settings, error: settingsError } = await supabase
        .from('hotsite_settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();

      if (cancelled) return;

      if (settingsError) {
        console.error('[HotSite] Falha ao carregar configurações:', settingsError);
      } else if (settings) {
        setTitle(settings.title || 'Luan Maciel de Lemos');
        setSub(settings.subtitle || '');
      }

      const { data, error: buttonsError } = await supabase
        .from('hotsite_buttons')
        .select('*')
        .eq('active', true)
        .order('sort_order', { ascending: true });

      if (cancelled) return;

      if (buttonsError) {
        console.error('[HotSite] Falha ao carregar botões:', buttonsError);
        setError('Não foi possível carregar os botões. O banco de dados recusou a consulta ou está indisponível. Tente novamente mais tarde.');
        setButtons([]);
      } else {
        setButtons(data || []);
        if (!data?.length) {
          setError('Nenhum botão ativo foi encontrado. Os botões podem estar desativados ou não estar sendo retornados pelo banco de dados.');
        }
      }

      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <section className="hotsite">
      <h1>{title}</h1>
      {sub && <p>{sub}</p>}

      {loading && <p role="status">Carregando botões...</p>}

      {!loading && error && (
        <p role="status" style={{ margin: '24px 0', padding: '14px', border: '1px solid #c89b3c', borderRadius: '10px', overflowWrap: 'anywhere' }}>
          {error}
        </p>
      )}

      {buttons.map((b) => (
        <a
          key={b.id}
          className={'hotbtn anim-' + (b.animation || 'none')}
          style={{
            backgroundColor: b.background_color || '#0d1b2a',
            color: b.text_color || '#ffffff',
            borderColor: b.border_color || '#c89b3c',
          }}
          href={b.url && /^https?:\/\//i.test(b.url) ? b.url : (b.url ? 'https://' + b.url : '#')}
        >
          {b.label}
        </a>
      ))}
    </section>
  );
}
