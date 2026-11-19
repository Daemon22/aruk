export type CoreState = 'success' | 'failure' | 'unauthorized' | 'unavailable' | 'pending' | 'invalid';

export interface CoreError {
  state: Exclude<CoreState, 'success' | 'pending'>;
  message: string;
  status?: number;
}

export interface SessionStatus {
  authenticated: boolean;
  user: {
    id: string;
    email: string;
    name: string;
  } | null;
}

export interface SystemHealth {
  status: 'healthy' | 'unhealthy';
  database: 'ready' | 'unavailable';
  service: 'aruk';
  uptime?: number;
}

export interface SystemStats {
  stats: {
    totalAccounts: number;
    activeAccounts: number;
    healthyAccounts: number;
    warningAccounts: number;
    offlineAccounts: number;
    todayRequests: number;
    currentBestProvider: string | null;
  };
}
