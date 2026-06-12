import { NextRequest, NextResponse } from 'next/server';
import { getScrapeRuns, getPendingReview } from '@/lib/db';

function isAuthed(request: NextRequest) {
  return request.headers.get('authorization') === `Bearer ${process.env.ADMIN_SECRET}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthed(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const [runs, pending] = await Promise.all([
      getScrapeRuns(),
      getPendingReview(),
    ]);

    return NextResponse.json({ runs, pending });
  } catch (err) {
    console.error('/api/admin/scrape-status:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
