import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { errorMessage } from '../lib/utils';
import type { Person } from './types';

export function usePeople(query: string, role: string, page: number, revision: number, activeOnly = false) {
  const [people, setPeople] = useState<Person[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(''); setPeople([]);
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ pagina: String(page), busca: query.trim(), cadastros: '1' });
      if (role) params.set('perfil', role);
      if (activeOnly) params.set('ativo', 'true');
      void api<{ usuarios: Person[]; total: number }>(`/usuarios?${params}`, { signal: controller.signal }).then((response) => { if (!controller.signal.aborted) { setPeople(response.usuarios); setTotal(response.total); } })
        .catch((cause: unknown) => { if (!controller.signal.aborted) setError(errorMessage(cause)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 200);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, role, page, revision, activeOnly]);
  return { people, total, loading, error };
}
