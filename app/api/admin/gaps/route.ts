import { NextRequest, NextResponse } from 'next/server';

function isAuthed(request: NextRequest) {
  return request.headers.get('authorization') === `Bearer ${process.env.ADMIN_SECRET}`;
}

// Returns single-lab canonicals paired with their nearest cross-lab match.
// Uses the Supabase Management API for raw SQL since pgvector self-joins
// cannot be expressed via the PostgREST query builder.
export async function GET(request: NextRequest) {
  if (!isAuthed(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const PROJECT_REF = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace('https://', '').split('.')[0];
  const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

  if (!TOKEN) {
    return NextResponse.json({ error: 'SUPABASE_ACCESS_TOKEN not configured' }, { status: 500 });
  }

  try {
    const res = await fetch(
      `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            SELECT
              t1.id AS id1,
              t1.canonical_name_lt AS name1,
              (SELECT string_agg(DISTINCT l.name, ', ' ORDER BY l.name)
               FROM prices p JOIN labs l ON l.id = p.lab_id
               WHERE p.test_id = t1.id AND p.is_stale = false) AS labs1,
              t2.id AS id2,
              t2.canonical_name_lt AS name2,
              (SELECT string_agg(DISTINCT l.name, ', ' ORDER BY l.name)
               FROM prices p JOIN labs l ON l.id = p.lab_id
               WHERE p.test_id = t2.id AND p.is_stale = false) AS labs2,
              round((1 - (t1.embedding <=> t2.embedding))::numeric, 4) AS similarity
            FROM tests t1
            JOIN tests t2 ON t1.id < t2.id
            WHERE t1.embedding IS NOT NULL
              AND t2.embedding IS NOT NULL
              AND 1 - (t1.embedding <=> t2.embedding) > 0.88
              AND EXISTS (
                SELECT 1 FROM prices p1
                JOIN prices p2 ON p1.lab_id != p2.lab_id
                WHERE p1.test_id = t1.id AND p2.test_id = t2.id
                  AND p1.is_stale = false AND p2.is_stale = false
              )
            ORDER BY similarity DESC
            LIMIT 150
          `,
        }),
      }
    );

    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json({ error: `DB query failed: ${body}` }, { status: 500 });
    }

    const data = await res.json();
    if (data.error) {
      return NextResponse.json({ error: data.error.message ?? JSON.stringify(data.error) }, { status: 500 });
    }

    return NextResponse.json({ pairs: data });
  } catch (err) {
    console.error('/api/admin/gaps:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
