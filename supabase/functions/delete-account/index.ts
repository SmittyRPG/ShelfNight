// Supabase Edge Function: permanently deletes the signed-in user's account and data.
// Apple requires apps with sign-up to offer in-app account deletion.
//
// Deploy: supabase functions deploy delete-account

import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
  const { data } = await admin.auth.getUser(token);
  if (!data?.user) {
    return new Response(JSON.stringify({ error: 'Sign in first.' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
  // Profiles, shelves, threads, posts, reports and blocks are removed by "on delete cascade".
  const { error } = await admin.auth.admin.deleteUser(data.user.id);
  if (error) {
    return new Response(JSON.stringify({ error: 'Could not delete the account. Contact support.' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
  return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, 'Content-Type': 'application/json' } });
});
