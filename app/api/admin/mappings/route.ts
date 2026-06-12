import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import { normalizeTestName } from '@/scrapers/lib/normalize';

function isAuthed(req: NextRequest) {
  return req.headers.get('authorization') === `Bearer ${process.env.ADMIN_SECRET}`;
}

// ── GET /api/admin/mappings ───────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('mapping_review_queue')
    .select(`
      id, raw_name, price_eur, ai_reasoning, ai_confidence, ai_suggestion_id,
      labs ( id, name ),
      tests ( id, canonical_name_lt )
    `)
    .eq('status', 'pending')
    .order('ai_confidence', { ascending: false })
    .limit(500);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { count } = await supabaseAdmin
    .from('mapping_review_queue')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');

  return NextResponse.json({ items: data ?? [], total: count ?? 0 });
}

// ── POST /api/admin/mappings ──────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as {
    action: 'approve' | 'create' | 'skip' | 'bulk_approve';
    id?: number;
    canonical_name?: string;
  };

  try {
    if (body.action === 'skip') {
      await supabaseAdmin
        .from('mapping_review_queue')
        .update({ status: 'skipped', reviewed_at: new Date().toISOString() })
        .eq('id', body.id!);
      return NextResponse.json({ ok: true });
    }

    if (body.action === 'approve') {
      await approveItem(body.id!);
      return NextResponse.json({ ok: true });
    }

    if (body.action === 'create') {
      await createNewFromItem(body.id!, body.canonical_name!);
      return NextResponse.json({ ok: true });
    }

    if (body.action === 'bulk_approve') {
      const { data: eligible } = await supabaseAdmin
        .from('mapping_review_queue')
        .select('id')
        .eq('status', 'pending')
        .gte('ai_confidence', 0.90)
        .not('ai_suggestion_id', 'is', null);

      const ids = (eligible ?? []).map(r => r.id);
      await Promise.all(ids.map(id => approveItem(id)));
      return NextResponse.json({ ok: true, count: ids.length });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('/api/admin/mappings POST:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function approveItem(id: number) {
  const { data: item, error } = await supabaseAdmin
    .from('mapping_review_queue')
    .select('id, lab_id, raw_name, price_eur, ai_suggestion_id, ai_reasoning')
    .eq('id', id)
    .single();

  if (error || !item) throw new Error(`Queue item ${id} not found`);
  if (!item.ai_suggestion_id) throw new Error(`Item ${id} has no canonical suggestion`);

  const norm = normalizeTestName(item.raw_name);

  await Promise.all([
    supabaseAdmin.from('test_name_mappings').upsert({
      lab_id: item.lab_id,
      raw_name: item.raw_name,
      raw_name_normalized: norm,
      canonical_test_id: item.ai_suggestion_id,
      match_method: 'human_approved',
      match_confidence: 1.0,
      ai_reasoning: item.ai_reasoning,
      verified_by_human: true,
    }, { onConflict: 'lab_id,raw_name_normalized' }),

    supabaseAdmin.from('prices').upsert({
      test_id: item.ai_suggestion_id,
      lab_id: item.lab_id,
      price_eur: item.price_eur,
      lab_test_name: item.raw_name,
      lab_test_url: null,
      scraped_at: new Date().toISOString(),
      is_stale: false,
    }, { onConflict: 'test_id,lab_id' }),
  ]);

  await supabaseAdmin
    .from('mapping_review_queue')
    .update({ status: 'approved', reviewed_at: new Date().toISOString() })
    .eq('id', id);
}

async function createNewFromItem(id: number, canonicalName: string) {
  const { data: item, error } = await supabaseAdmin
    .from('mapping_review_queue')
    .select('id, lab_id, raw_name, price_eur')
    .eq('id', id)
    .single();

  if (error || !item) throw new Error(`Queue item ${id} not found`);

  const { embedText } = await import('@/scrapers/lib/embed');
  const embedding = await embedText(canonicalName);

  const { data: newTest, error: insertErr } = await supabaseAdmin
    .from('tests')
    .insert({
      canonical_name_lt: canonicalName,
      aliases: [item.raw_name],
      embedding,
    })
    .select()
    .single();

  if (insertErr) throw new Error(`Failed to create test: ${insertErr.message}`);

  const norm = normalizeTestName(item.raw_name);

  await Promise.all([
    supabaseAdmin.from('test_name_mappings').upsert({
      lab_id: item.lab_id,
      raw_name: item.raw_name,
      raw_name_normalized: norm,
      canonical_test_id: newTest.id,
      match_method: 'human_created',
      match_confidence: 1.0,
      verified_by_human: true,
    }, { onConflict: 'lab_id,raw_name_normalized' }),

    supabaseAdmin.from('prices').upsert({
      test_id: newTest.id,
      lab_id: item.lab_id,
      price_eur: item.price_eur,
      lab_test_name: item.raw_name,
      lab_test_url: null,
      scraped_at: new Date().toISOString(),
      is_stale: false,
    }, { onConflict: 'test_id,lab_id' }),
  ]);

  await supabaseAdmin
    .from('mapping_review_queue')
    .update({ status: 'new_test', reviewed_at: new Date().toISOString() })
    .eq('id', id);
}
