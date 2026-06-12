import { NextRequest, NextResponse } from 'next/server';
import { searchTests, getTestsByCategory } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('search');
  const category = searchParams.get('category');

  try {
    if (query) return NextResponse.json(await searchTests(query));
    if (category) return NextResponse.json(await getTestsByCategory(category));
    return NextResponse.json({ error: 'Provide search or category param' }, { status: 400 });
  } catch (err) {
    console.error('/api/tests:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
