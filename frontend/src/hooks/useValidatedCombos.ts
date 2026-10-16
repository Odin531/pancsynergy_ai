import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '@/lib/api';
import type { ValidatedCombo } from '@/types';

export interface ValidatedCombosState {
  combos: ValidatedCombo[];
  loading: boolean;
  error: string | null;
  total: number | null;
  refresh: () => void;
}

export function useValidatedCombos(limit = 307): ValidatedCombosState {
  const [combos, setCombos] = useState<ValidatedCombo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.validatedCombos(limit);
      setCombos(res.combinations);
      setTotal(res.total_validated);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to load validated combinations');
      }
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { combos, loading, error, total, refresh };
}
