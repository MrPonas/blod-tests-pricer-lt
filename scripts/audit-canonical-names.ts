import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data: tests } = await db.from('tests').select('id, canonical_name_lt');

  const pipePattern = /^[A-ZŽŠŪ\-]+\s*\|\s*/;   // "A-AMYL | " or "AMYL | "
  const codeDigitPattern = /^[A-ZŽŠŪ]{2,4}\d+\s+/; // "AB12 "
  const pureLetterCode = /^[A-ZŽŠŪ\-]{2,8}\s+(?=[A-ZŽŠŲ])/; // "AMYL Alfa..." - code then capital start

  let withPipe = 0, withDigitCode = 0, withPureLetter = 0, clean = 0;
  const examples: Record<string, string[]> = { pipe: [], digit: [], letter: [] };

  for (const t of tests ?? []) {
    const name = t.canonical_name_lt;
    if (pipePattern.test(name)) {
      withPipe++;
      if (examples.pipe.length < 10) examples.pipe.push(name);
    } else if (codeDigitPattern.test(name)) {
      withDigitCode++;
      if (examples.digit.length < 10) examples.digit.push(name);
    } else if (pureLetterCode.test(name)) {
      withPureLetter++;
      if (examples.letter.length < 10) examples.letter.push(name);
    } else {
      clean++;
    }
  }

  console.log(`Total: ${tests?.length}`);
  console.log(`With pipe format (A-AMYL | ...): ${withPipe}`);
  console.log(`With digit code (AB12 ...): ${withDigitCode}`);
  console.log(`With pure letter code (AMYL ...): ${withPureLetter}`);
  console.log(`Clean names: ${clean}`);
  console.log('\nPipe examples:', examples.pipe);
  console.log('Digit examples:', examples.digit);
  console.log('Letter examples:', examples.letter);
}
main();
