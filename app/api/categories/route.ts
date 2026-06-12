import { NextResponse } from 'next/server';
import { getCategories } from '@/lib/db';

export async function GET() {
  try {
    return NextResponse.json(await getCategories());
  } catch (err) {
    console.error('/api/categories:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
