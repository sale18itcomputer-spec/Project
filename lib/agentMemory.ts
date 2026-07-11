/**
 * Per-user assistant memory + skills (Odysseus manage_memory / manage_skills).
 * ─────────────────────────────────────────────────────────────
 * memory — durable facts/preferences the agent should remember across chats.
 *          Recalled into the system prompt each turn.
 * skills — reusable named prompts the staff can save and re-run.
 *
 * Both are scoped to the staff member's UserID. Backed by ai_memory / ai_skills
 * (see supabase/migrations/20260710_ai_memory_skills.sql).
 */
import { getServiceClient } from './agentServer';

const MEMORY_LIMIT = 30;

/** Format recent memories as a bullet list for the system prompt. */
export async function recallMemories(userId: string): Promise<string> {
  if (!userId) return '';
  const { data, error } = await getServiceClient()
    .from('ai_memory')
    .select('content')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(MEMORY_LIMIT);
  if (error || !data?.length) return '';
  return data.map((r: any) => `- ${r.content}`).join('\n');
}

export async function rememberFact(userId: string, content: string): Promise<any> {
  const c = (content || '').trim();
  if (!c) throw new Error('content is required');
  const { data, error } = await getServiceClient()
    .from('ai_memory')
    .insert({ user_id: userId, content: c })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return { saved: true, id: data.id };
}

export async function listFacts(userId: string): Promise<any> {
  const { data, error } = await getServiceClient()
    .from('ai_memory')
    .select('id, content, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(MEMORY_LIMIT);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function forgetFact(userId: string, args: { id?: string; contains?: string }): Promise<any> {
  const sb = getServiceClient();
  let q = sb.from('ai_memory').delete().eq('user_id', userId);
  if (args.id) q = q.eq('id', args.id);
  else if (args.contains) q = q.ilike('content', `%${args.contains}%`);
  else throw new Error('Provide id or contains to forget');
  const { error } = await q;
  if (error) throw new Error(error.message);
  return { forgotten: true };
}

export async function saveSkill(userId: string, name: string, prompt: string): Promise<any> {
  const n = (name || '').trim();
  const p = (prompt || '').trim();
  if (!n || !p) throw new Error('name and prompt are required');
  const now = new Date().toISOString();
  const { data, error } = await getServiceClient()
    .from('ai_skills')
    .upsert({ user_id: userId, name: n, prompt: p, updated_at: now }, { onConflict: 'user_id,name' })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return { saved: true, name: data.name };
}

export async function listSkills(userId: string): Promise<any> {
  const { data, error } = await getServiceClient()
    .from('ai_skills')
    .select('name, prompt, updated_at')
    .eq('user_id', userId)
    .order('name');
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Fetch one skill's prompt by name (case-insensitive) so the agent can run it. */
export async function getSkill(userId: string, name: string): Promise<{ name: string; prompt: string }> {
  const n = (name || '').trim();
  if (!n) throw new Error('name is required');
  const { data, error } = await getServiceClient()
    .from('ai_skills')
    .select('name, prompt')
    .eq('user_id', userId)
    .ilike('name', n)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`No skill named "${n}"`);
  return data as { name: string; prompt: string };
}
