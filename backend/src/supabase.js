import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';

export const adminSupabase = createClient(
  config.supabaseUrl,
  config.supabaseServiceRoleKey,
  {
    auth: { persistSession: false, autoRefreshToken: false },
  },
);

export function createUserSupabase(accessToken) {
  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
