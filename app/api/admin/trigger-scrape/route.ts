import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';

function isAuthed(request: NextRequest) {
  return request.headers.get('authorization') === `Bearer ${process.env.ADMIN_SECRET}`;
}

export async function POST(request: NextRequest) {
  if (!isAuthed(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({
      message: 'Use GitHub Actions → workflow_dispatch to trigger scrape in production.',
    });
  }

  // Fire and forget — works in local dev
  const proc = spawn('npx', ['tsx', 'scrapers/run-all.ts'], {
    detached: true,
    stdio: 'inherit',
    env: process.env,
  });
  proc.unref();

  return NextResponse.json({ message: 'Scrape started in background. Check terminal for output.' });
}
