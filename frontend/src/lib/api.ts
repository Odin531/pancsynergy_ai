import type {
  HealthResponse,
  ModelInfoResponse,
  DrugPairInput,
  SynergyPredictionOutput,
  BatchDrugPairInput,
  BatchSynergyPredictionOutput,
  ValidatedCombosResponse,
} from '@/types';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://127.0.0.1:8000';

class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly detail?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path}`;
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...options?.headers },
      ...options,
    });
  } catch (err) {
    throw new ApiError(0, `Network error: cannot reach ${url}`, String(err));
  }

  if (!response.ok) {
    let detail: string | undefined;
    try {
      const body = (await response.json()) as { detail?: string };
      detail = body.detail;
    } catch {
      // ignore JSON parse failure
    }
    throw new ApiError(
      response.status,
      detail ?? `HTTP ${response.status} ${response.statusText}`,
      detail,
    );
  }

  return response.json() as Promise<T>;
}

// ─── Endpoint wrappers ────────────────────────────────────────────────────────

export const api = {
  health(): Promise<HealthResponse> {
    return request<HealthResponse>('/health');
  },

  modelInfo(): Promise<ModelInfoResponse> {
    return request<ModelInfoResponse>('/api/v1/info');
  },

  predict(pair: DrugPairInput): Promise<SynergyPredictionOutput> {
    return request<SynergyPredictionOutput>('/api/v1/predict', {
      method: 'POST',
      body: JSON.stringify(pair),
    });
  },

  predictBatch(batch: BatchDrugPairInput): Promise<BatchSynergyPredictionOutput> {
    return request<BatchSynergyPredictionOutput>('/api/v1/predict/batch', {
      method: 'POST',
      body: JSON.stringify(batch),
    });
  },

  validatedCombos(limit = 307): Promise<ValidatedCombosResponse> {
    return request<ValidatedCombosResponse>(`/api/v1/combos/validated?limit=${limit}`);
  },
};

export { ApiError };
export { BASE_URL };
