// Supabase Edge Function: reads board game titles from a shelf photo.
// The app sends a base64 photo; this function asks Claude to read the box titles and returns them.
// Your Anthropic API key stays on the server and is never shipped inside the app.
//
// Deploy:   supabase functions deploy scan-shelf
// Secrets:  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...   (optional: ANTHROPIC_MODEL, DAILY_SCAN_LIMIT)

import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const PROMPT =
  'This photo shows board game boxes on a shelf or table. List the title of every board game whose name ' +
  'you can read on a box spine or cover. Use the official title (fix capitalization, drop edition text). ' +
  'Skip anything you cannot read with confidence. Reply with only a JSON array of strings, for example ' +
  '["Catan","Wingspan"]. Reply [] if no titles are readable.';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  const model = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-sonnet-5-5';
  const dailyLimit = Number(Deno.env.get('DAILY_SCAN_LIMIT') ?? '5');
  if (!apiKey) return json({ error: 'Photo scanning is not set up yet.' }, 503);

  // Who is asking? Only signed-in users can scan.
  const admin = createClient(supabaseUrl, serviceKey);
  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
  const { data: userData } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (!user) return json({ error: 'Sign in to scan your shelf.' }, 401);

  // Daily limit keeps your API bill predictable.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from('scan_log').select('id', { count: 'exact', head: true })
    .eq('user_id', user.id).gte('created_at', since);
  if ((count ?? 0) >= dailyLimit) {
    return json({ error: `You've used your ${dailyLimit} scans for today. Try again tomorrow.` }, 429);
  }

  let image: string, mediaType: string;
  try {
    const body = await req.json();
    image = String(body.image ?? '');
    mediaType = String(body.mediaType ?? 'image/jpeg');
  } catch {
    return json({ error: 'The photo did not arrive. Try again.' }, 400);
  }
  if (!image || image.length > 7_000_000) return json({ error: 'That photo is missing or too large.' }, 400);
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mediaType)) {
    return json({ error: 'Use a JPEG, PNG or WebP photo.' }, 400);
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
          { type: 'text', text: PROMPT },
        ],
      }],
    }),
  });

  if (!res.ok) {
    console.error('Anthropic error', res.status, await res.text());
    return json({ error: 'The photo could not be read right now. Try again in a minute.' }, 502);
  }

  const data = await res.json();
  const text: string = (data.content ?? []).filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('');
  let titles: string[] = [];
  try {
    const start = text.indexOf('['), end = text.lastIndexOf(']');
    const parsed = JSON.parse(text.slice(start, end + 1));
    if (Array.isArray(parsed)) titles = parsed.map(String).filter((t) => t.trim()).slice(0, 80);
  } catch {
    titles = [];
  }

  await admin.from('scan_log').insert({ user_id: user.id, titles_found: titles.length });
  return json({ titles, scansLeft: Math.max(0, dailyLimit - (count ?? 0) - 1) });
});
