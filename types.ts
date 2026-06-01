/**
 * Shared types for Telegram bulk video message forwarder.
 */

export interface TelegramUser {
  id: string;
  username?: string;
  firstName: string;
  lastName?: string;
}

export interface TelegramChat {
  id: string;
  title: string;
  username?: string;
  isGroup: boolean;
  isChannel: boolean;
  canSend: boolean;
  noForwards?: boolean;
}

export interface VideoMessage {
  id: string;
  date: number; // UTC timestamp
  size?: number; // message media size in bytes
  duration?: number; // duration in seconds
  isRound: boolean; // whether it is a camera round bubble (video note)
  text?: string;
}

export interface ForwardJobStatus {
  id: string;
  status: 'idle' | 'running' | 'paused_flood' | 'stopped' | 'completed' | 'failed';
  total: number;
  current: number;
  success: number;
  failed: number;
  skipped: number;
  currentMessageId?: string;
  waitingUntil?: number;
  activeWaitSeconds: number;
  itemsState: Record<string, { status: 'pending' | 'success' | 'failed' | 'retrying'; error?: string }>;
  logs: string[];
}

export interface AuthState {
  apiId: string;
  apiHash: string;
  phone: string;
  loginToken?: string;
  phoneCodeHash?: string;
  code: string;
  password?: string;
  step: 'config' | 'phone' | 'otp' | 'completed';
  error?: string;
}
