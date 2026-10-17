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

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

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

      // Load buttons first so a slow settings query cannot block the page.
      try {
        const { data, error: buttonsError } = await withTimeout(
          supabase.from('hotsite_buttons').select('*').eq('active', true).order('sort_order', { ascending: true }),
          6000,
        );

        if (cancelled) return;

        if (buttonsError) {
          console.error('[HotSite] Falha ao carregar botões:', buttonsError);
          setError('Não foi possível carregar os botões do banco de dados. Confira a conexão e as permissões do Supabase.');
          setButtons([]);
        } else {
          setButtons(data || []);
          if (!data?.length) {
            setError('O banco não retornou botões ativos. Confira os botões no editor do HotSite.');
          }
        }
      } catch (err) {
        if (cancelled) return;
        console.error('[HotSite] Consulta de botões falhou ou excedeu 6 segundos:', err);
        setError('A consulta dos botões demorou demais ou falhou. Verifique a conexão com o Supabase e tente novamente.');
      } finally {
        if (!cancelled) setLoading(false);
      }

      // Settings are optional and must never hold up the buttons.
      try {
        const { data: settings, error: settingsError } = await withTimeout(
          supabase.from('hotsite_settings').select('*').eq('id', 1).maybeSingle(),
          4000,
        );
        if (cancelled) return;
        if (settingsError) {
          console.error('[HotSite] Falha ao carregar configurações:', settingsError);
        } else if (settings) {
          setTitle(settings.title || 'Luan Maciel de Lemos');
          setSub(settings.subtitle || '');
        }
      } catch (err) {
        console.error('[HotSite] Configurações demoraram demais ou falharam:', err);
      }
    }

    void load();
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
