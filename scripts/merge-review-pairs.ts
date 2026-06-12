import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const PROJECT_REF = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace('https://', '').split('.')[0];
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN!;

async function sql<T = Record<string, unknown>>(q: string): Promise<T[]> {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: q }),
  });
  if (!res.ok) throw new Error(`SQL failed (${res.status}): ${await res.text()}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message ?? JSON.stringify(data.error));
  return data as T[];
}

async function merge(keep: number, del: number) {
  await sql(`UPDATE test_name_mappings SET canonical_test_id = ${keep} WHERE canonical_test_id = ${del}`);
  await sql(`UPDATE mapping_review_queue SET ai_suggestion_id = ${keep} WHERE ai_suggestion_id = ${del}`);
  await sql(`UPDATE pending_review SET resolved_test_id = ${keep} WHERE resolved_test_id = ${del}`);
  await sql(`DELETE FROM prices WHERE test_id = ${keep} AND lab_id IN (SELECT lab_id FROM prices WHERE test_id = ${del})`);
  await sql(`UPDATE prices SET test_id = ${keep} WHERE test_id = ${del}`);
  await sql(`UPDATE prices SET is_stale = false WHERE test_id = ${keep}`);
  await sql(`DELETE FROM tests WHERE id = ${del}`);
}

const MERGES: Array<{ keep: number; del: number; note: string }> = [
  // ── 0.95–0.98 tier: formatting / typo / word-order only ──────────────────────
  { keep: 1418, del: 1770, note: 'EUROIMMUN Mišrūs/mišrūs alergenai — case' },
  { keep: 1451, del: 1981, note: 'Jautrumo maistui tyrimų programos/programa' },
  { keep:  976, del: 1795, note: 'Skydliaukės ligų tyrimų programos/programa' },
  { keep: 1048, del: 1826, note: 'Vėžio žymenų tyrimų programos/programa vyrams' },
  { keep: 1415, del: 1769, note: 'EUROIMMUN IgE vabzdžių nuodų — word order' },
  { keep:  403, del: 1948, note: 'Laktozės PGR / PGR metodu' },
  { keep:  967, del:  968, note: 'sFlt-1/ PIGF vs sFlt-1/PIGF — spacing' },
  { keep:  232, del: 2223, note: 'C reaktyvus/reaktyvusis — grammar' },
  { keep:  528, del: 2095, note: 'išsirenkama/pasirenkamas iš katalogo' },
  { keep: 1352, del: 1823, note: 'ALEX³ tyrimas — wording' },
  { keep:  571, del: 2071, note: 'Rh Antikūnų/antikūnų — case' },
  { keep:  436, del: 1775, note: 'Medžiagų apykaitos tyrimų programos/programa' },
  { keep: 1837, del:  974, note: 'Širdies kraujagyslių tyrimų programos/programa — keep 1837 (2px)' },
  { keep: 1462, del: 1933, note: 'Borellia/Borrelia IgG — typo' },
  { keep: 2008, del: 1044, note: 'Varicella Zoster Viruso/viruso IgG — case, keep 2008 (2px)' },
  { keep:  358, del: 1847, note: 'Imuniteto įvertinimo programos/programa' },
  { keep:  336, del: 2030, note: 'HSV šlapime (PGR)/(PGR) — parentheses' },
  { keep:  423, del: 1825, note: 'LPI 4 CT/MG/NG/TV šlapime — same pathogens, format differs' },
  { keep: 2125, del: 1063, note: 'Vitaminas C Askorbo/askorbo — case, keep 2125 (2px)' },
  { keep: 2046, del:  488, note: 'Neisseria gonorrheae/gonorrhoeae — typo, keep 2046 (2px)' },
  { keep:  220, del: 2331, note: 'PAP - atliekamas ant / - ant stiklelio' },
  { keep:  132, del: 2078, note: 'Anti-IA2 — word order' },
  { keep: 1087, del: 2034, note: 'ŽPV aukštos rizikos — list position' },
  { keep: 1440, del: 1965, note: 'HBe antikūnai (aHBe)/(anti-HBe)' },
  { keep: 1363, del: 1915, note: 'Anti-EMA-IgA — word order' },
  { keep: 1486, del: 1937, note: 'Tėvystės 3 vaikai — punctuation' },
  { keep: 1040, del: 1818, note: 'Ureaplasma DNR nustatymas — wording' },
  { keep: 1033, del: 2090, note: 'Antifosfolipidinio sindromo — wording' },
  { keep: 1860, del: 1452, note: 'Beta-CrossLaps / beta - Cross Laps — keep 1860 (2px)' },
  { keep:  191, del: 2055, note: 'Candida spp. (PGR) nustatymas šlapime — word order' },
  { keep: 1405, del: 1867, note: 'C1 esterazės inhibitoriaus — wording' },
  { keep: 1411, del: 1926, note: 'IgG Antikūnai IgG — redundant prefix' },
  { keep:  966, del: 1809, note: 'sFlt-1 — parentheses' },
  { keep: 1361, del: 1913, note: 'Anti-DGP-IgA — word order' },

  // ── 0.92–0.95 tier: same patterns ────────────────────────────────────────────
  { keep:  285, del:  284, note: 'Folikulus/Folikulą stimuliuojantis — grammar, keep 285 (2px)' },
  { keep: 2151, del:  384, note: 'Bordetella/Bordatella — fix typo, keep 2151 (correct spelling)' },
  { keep: 1366, del: 1878, note: 'Anti-GBM — word order' },
  { keep:  466, del: 2193, note: 'Mycoplasma pneumoniae IgM — case' },
  { keep: 1032, del: 2009, note: 'Tymų Viruso/viruso IgM — case' },
  { keep: 2040, del:  487, note: 'Neisseria gonorrhoeae/gonorrheae — typo, keep 2040 (2px)' },
  { keep:  269, del: 2076, note: 'Erkinio Encefalito/encefalito IgM — case' },
  { keep: 1419, del: 1782, note: 'f79 sIgE prieš gliuteną — word order' },
  { keep: 1342, del: 1987, note: '2-ų/2 respiracinių bakterijų — wording' },
  { keep:  131, del: 2077, note: 'Anti-GAD — word order + typo dekarbokslilazę/dekarboksilazę' },
  { keep: 1448, del: 1855, note: 'Imunoglobulino IgA subklasės — wording' },
  { keep: 1071, del: 1781, note: 'Vitaminų tyrimų programos/programa' },
  { keep: 1367, del: 1956, note: 'Anti-HAV — word order' },
  { keep:  243, del: 2373, note: 'c.Albicans/Candida albicans — formatting' },
  { keep:  157, del: 1793, note: 'aTPO — word order, keep 157 (2px)' },
  { keep:  138, del: 2139, note: 'prieš Candida grybelį/Candida — wording' },
  { keep:  531, del: 2096, note: 'Pavienis retas komponentas — išsirenkama/pasirenkamas' },
  { keep:  511, del: 2287, note: 'GenoAcne — wording' },
  { keep: 1010, del: 2441, note: 'ToxoG Toxoplasma gondii IgG — prefix, keep 1010 (2px)' },
  { keep: 1753, del:  462, note: 'Mycoplasma hominis DNR nustatymas — wording, keep 1753 (2px)' },
  { keep: 1916, del: 1368, note: 'Anti-tTG-IgA — word order, keep 1916 (2px)' },
  { keep: 2039, del:  458, note: 'Mycoplasma genitalium DNR nustatymas — wording, keep 2039 (2px)' },
  { keep:  330, del: 2263, note: 'HAV bendrų/bendras antikūnų — grammar' },
  { keep: 2140, del: 1447, note: 'Yersinia spp. IgG — wording, keep 2140 (2px)' },
  { keep: 1478, del: 1479, note: 'SARS-CoV-2 greitasis testas vs …(Programa)' },
  { keep: 1374, del: 1989, note: 'B. pertussis/Bordetella pertussis IgG' },
  { keep: 1746, del: 1080, note: 'ŽIV kombinuotas — wording, keep 1746 (2px)' },
  { keep:  233, del: 1790, note: 'C-reaktyvinis/C reaktyvusis (plataus spektro)' },
  { keep:  548, del: 2022, note: 'Plaukų mikroskopinis tyrimas — wording' },
  { keep:   69, del: 2175, note: '10 LPL paletė — word order' },
  { keep:  332, del: 2261, note: 'Hepatito B DNR Tyrimas/tyrimas — case' },
  { keep: 1410, del: 1977, note: 'Difterijos IgG antikūnų nustatymas/antikūnai' },
  { keep: 1417, del: 1882, note: 'EUROIMMUN Maisto/maisto alergenai — case' },
  { keep: 1007, del: 1836, note: 'Tiesioginis MTL Cholesterolis/cholesterolis — case' },
  { keep:  343, del: 2094, note: 'Histamino kiekio/kiekis plazmoje — grammar' },
  { keep:  443, del: 2285, note: 'GenoTaste — wording' },
  { keep:  166, del: 2313, note: 'GenoTelo — wording' },
  { keep:  271, del: 2314, note: 'Farmakogenetinis — wording' },
  { keep:  305, del: 2425, note: 'Gimdos kaklelio vėžio paketas — wording' },
  { keep: 1484, del: 1938, note: 'Tėvystės DNR (tėvas, mama, vaikas) — wording' },
  { keep:  194, del: 1824, note: 'Candida sukėlėjų paletė šlapime — wording' },
  { keep:  176, del: 1834, note: 'Ca 15-3 — case/wording' },
  { keep: 1480, del: 1942, note: 'Senelių DNR (mama, 1 senelis, 1 vaikas) — wording' },
  { keep: 1968, del: 1076, note: 'Yersinia spp. IgA — wording, keep 1968 (2px)' },
  { keep: 1471, del: 1945, note: 'Prenatalinis DNR testas — wording' },
  { keep: 2199, del:  127, note: 'Antikūnai prieš TSH receptorius — wording, keep 2199 (2px)' },
  { keep: 1791, del:  252, note: 'CRB didelio jautrumo — drop djCRB prefix, keep 1791 (clean name)' },
];

async function main() {
  console.log(`Running ${MERGES.length} merges...\n`);

  let ok = 0;
  let fail = 0;
  const absorbed = new Set<number>();

  for (const { keep, del, note } of MERGES) {
    if (absorbed.has(keep) || absorbed.has(del)) {
      console.log(`  [skip] keep=${keep} ← del=${del} — one already absorbed`);
      continue;
    }
    try {
      await merge(keep, del);
      absorbed.add(del);
      console.log(`  ✓  keep=${keep} ← del=${del}  "${note}"`);
      ok++;
    } catch (err) {
      console.error(`  ✗  keep=${keep} ← del=${del}  "${note}": ${err}`);
      fail++;
    }
  }

  console.log(`\n✓ Merged: ${ok}  ✗ Failed: ${fail}\n`);

  // ── 1. Verify: similarity query above 0.92 ───────────────────────────────────
  console.log('=== Post-merge similarity check (>0.92) ===');
  const remaining = await sql<{ id1: number; name1: string; id2: number; name2: string; similarity: number }>(`
    SELECT
      t1.id as id1, t1.canonical_name_lt as name1,
      t2.id as id2, t2.canonical_name_lt as name2,
      round((1 - (t1.embedding <=> t2.embedding))::numeric, 4) as similarity
    FROM tests t1 JOIN tests t2 ON t1.id < t2.id
    WHERE 1 - (t1.embedding <=> t2.embedding) > 0.92
    ORDER BY similarity DESC
  `);

  const t1 = remaining.filter(p => p.similarity >= 0.98).length;
  const t2 = remaining.filter(p => p.similarity >= 0.95 && p.similarity < 0.98).length;
  const t3 = remaining.filter(p => p.similarity >= 0.92 && p.similarity < 0.95).length;

  console.log(`  0.98–1.00: ${t1}  0.95–0.98: ${t2}  0.92–0.95: ${t3}  Total: ${remaining.length}`);
  if (remaining.length > 0) {
    for (const r of remaining.slice(0, 20)) {
      console.log(`  [${r.similarity}] id=${r.id1} ↔ id=${r.id2}`);
      console.log(`    "${r.name1}"`);
      console.log(`    "${r.name2}"`);
    }
    if (remaining.length > 20) console.log(`  ... and ${remaining.length - 20} more`);
  }

  // ── 2. Verify is_stale = 0 ───────────────────────────────────────────────────
  console.log('\n=== Stale price check ===');
  const [{ stale_count }] = await sql<{ stale_count: number }>(
    `SELECT COUNT(*)::int as stale_count FROM prices WHERE is_stale = true`
  );
  console.log(`  is_stale = true: ${stale_count} ${stale_count === 0 ? '✓' : '⚠'}`);

  // ── 3. Spot-check: Vitaminas D / 25-OH ───────────────────────────────────────
  console.log('\n=== Vitaminas D / 25-OH spot-check ===');
  const vitD = await sql<{ id: number; name: string; lab: string; price: string; stale: boolean }>(`
    SELECT t.id, t.canonical_name_lt as name, l.name as lab,
           p.price_eur as price, p.is_stale as stale
    FROM tests t
    JOIN prices p ON p.test_id = t.id
    JOIN labs l ON l.id = p.lab_id
    WHERE t.canonical_name_lt ILIKE '%vitaminas d%'
       OR t.canonical_name_lt ILIKE '%25-OH%'
       OR t.canonical_name_lt ILIKE '%25-hidroksi%'
       OR t.canonical_name_lt ILIKE '%kolekalcifero%'
    ORDER BY t.id, l.name
  `);

  if (vitD.length === 0) {
    console.log('  (no results)');
  } else {
    let lastId = 0;
    for (const r of vitD) {
      if (r.id !== lastId) {
        console.log(`\n  [id=${r.id}] "${r.name}"`);
        lastId = r.id;
      }
      console.log(`    ${r.lab}: €${r.price}  stale=${r.stale}`);
    }
  }
}

main().catch(console.error);
