import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '@/lib/api';
import type { HealthResponse, ModelInfoResponse, ApiStatus } from '@/types';

export interface BackendState {
  health: HealthResponse | null;
  modelInfo: ModelInfoResponse | null;
  apiStatus: ApiStatus;
  error: string | null;
  refresh: () => void;
  lastChecked: Date | null;
}

export function useBackend(): BackendState {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [modelInfo, setModelInfo] = useState<ModelInfoResponse | null>(null);
  const [apiStatus, setApiStatus] = useState<ApiStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    setApiStatus('loading');
    setError(null);
    try {
      const h = await api.health();
      setHealth(h);
      if (h.model_loaded) {
        try {
          const info = await api.modelInfo();
          setModelInfo(info);
        } catch (infoErr) {
          // Model info failed but health succeeded
          console.warn('Model info fetch failed:', infoErr);
        }
      }
      setApiStatus('online');
    } catch (err) {
      setApiStatus('offline');
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Backend unreachable');
      }
    }
    setLastChecked(new Date());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { health, modelInfo, apiStatus, error, refresh, lastChecked };
}
