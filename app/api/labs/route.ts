import { NextResponse } from 'next/server';
import { getLabs } from '@/lib/db';

export async function GET() {
  try {
    return NextResponse.json(await getLabs());
  } catch (err) {
    console.error('/api/labs:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
