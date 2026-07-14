/**
 * GET /api/ai-chat/skills — list the signed-in staff member's saved skills
 * (reusable prompts) for the chat widget's quick-run menu.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/agentServer';
import { listSkills } from '@/lib/agentMemory';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const skills = await listSkills((user as any).UserID);
    return NextResponse.json({ ok: true, skills });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to list skills' }, { status: 500 });
  }
}
