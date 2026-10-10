// Fresh Start: Disabled legacy sync that pushed localStorage to Supabase
// Old behavior allowed old browser cache to push old accounts back to DB
// Now DB is source of truth, localStorage is only cache v4 that is cleared on version mismatch
// This file is kept for backward compat but does nothing

export function initSupabaseSync() {
  // Disabled - DB is source of truth, no pushing from localStorage
  // Old accounts in localStorage v3 are cleared by store.ts versioning
  console.log('[KR8 Fresh Start] Legacy supabaseSync disabled - DB is source of truth');
}

export async function hydrateAccountsFromSupabase() {
  // Disabled - use dbStore.ts and AuthContext instead
}

export async function syncAccountToSupabase() {
  // Disabled - no pushing local to Supabase
}

export async function syncLiveStreamToSupabase() {
  // Disabled - use live.functions.ts server functions
}

export async function syncLiveChatMessageToSupabase() {
  // Disabled
}
