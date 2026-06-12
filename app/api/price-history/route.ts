import { NextRequest, NextResponse } from 'next/server';
import { getPriceHistory } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const testId = parseInt(id ?? '');
  if (isNaN(testId)) return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  try {
    const history = await getPriceHistory(testId);
    return NextResponse.json(history);
  } catch {
    return NextResponse.json([]);
  }
}
