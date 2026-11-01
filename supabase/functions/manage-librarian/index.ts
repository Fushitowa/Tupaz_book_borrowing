import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: cors })
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)
  const url = Deno.env.get('SUPABASE_URL')!
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const authHeader = req.headers.get('Authorization') || ''
  const caller = createClient(url, anon, { global: { headers: { Authorization: authHeader } } })
  const { data: { user }, error: authError } = await caller.auth.getUser()
  if (authError || !user) return json({ error: 'Sign in required.' }, 401)
  const { data: profile } = await caller.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return json({ error: 'Administrator access required.' }, 403)
  let body: { name?: string; email?: string; password?: string }
  try { body = await req.json() } catch { return json({ error: 'Invalid request body.' }, 400) }
  const name = body.name?.trim() || ''
  const email = body.email?.trim().toLowerCase() || ''
  const password = body.password || ''
  if (name.length < 2 || name.length > 100 || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8 || password.length > 128) {
    return json({ error: 'Enter a valid name, email, and password of at least 8 characters.' }, 400)
  }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name } })
  if (error || !data.user) return json({ error: error?.message || 'Could not create user.' }, 400)
  const { error: profileError } = await admin.from('profiles').insert({ id: data.user.id, email, full_name: name, role: 'librarian' })
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id)
    return json({ error: profileError.message }, 500)
  }
  return json({ id: data.user.id, email }, 201)
})
