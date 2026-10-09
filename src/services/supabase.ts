import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import { authStorage } from '@/services/auth-storage';

class UnavailableWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  readyState = UnavailableWebSocket.CLOSED;

  constructor(
    _url?: string,
    _protocols?: string | string[],
  ) {}

  close() {}
  send() {}
  addEventListener() {}
  removeEventListener() {}
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    'Missing Supabase config. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local, then restart Expo.',
  );
}

if (supabaseUrl.includes('YOUR_PROJECT_REF')) {
  throw new Error(
    'Replace EXPO_PUBLIC_SUPABASE_URL in .env.local with your project URL from Supabase (Project Settings → Data API), then restart Expo.',
  );
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  ...(typeof WebSocket === 'undefined'
    ? { realtime: { transport: UnavailableWebSocket as unknown as typeof WebSocket } }
    : {}),
});

AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
