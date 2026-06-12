/**
 * Assigns category_id to canonical tests using keyword matching.
 * Deterministic — no Claude needed.
 * Safe to re-run: only processes tests with category_id IS NULL.
 * Usage: npx tsx scripts/assign-categories.ts [--dry-run]
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const DRY_RUN = process.argv.includes('--dry-run');
// Also reassign tests currently in 'Kita' (cat 8) if a specific category matches
const ALSO_KITA = process.argv.includes('--also-kita');

// Categories in DB (id → slug for readability)
// 1: bendra-kraujo-analize
// 2: hormonai
// 3: vitaminai
// 4: biochemija
// 5: infekcijos
// 6: alergologijos
// 7: onkologiniai
// 8: kita

interface Rule {
  catId: number;
  label: string;
  patterns: RegExp[];
}

// Rules applied in order — first match wins. Most specific first.
// IDs 9-15 are the new fine-grained categories added 2026-06-12.
const RULES: Rule[] = [
  // ── NEW: Genetiniai (15) ─────────────────────────────────────────────────
  {
    catId: 15,
    label: 'Genetiniai',
    patterns: [
      /genetin[eėiai]/i,
      /chromosom/i,
      /\bBRCA\b/i,
      /\bHLA[\s-][A-Z]/i,
      /tėvystės\s+nustatym/i,
      /giminystės\s+nustatym/i,
      /prenatalin[eė]/i,
      /genomo\s+tyrimas/i,
      /DNR\s+tyrimas\b(?!.*PGR|.*PCR)/i,
    ],
  },
  // ── NEW: PGR tyrimai (14) ────────────────────────────────────────────────
  {
    catId: 14,
    label: 'PGR tyrimai',
    patterns: [
      /\bPGR\s+metodu\b/i,
      /\bPCR\s+metodu\b/i,
      /DNR\s+nustatym/i,
      /RNR\s+nustatym/i,
      /molekulin[eė]\s+diagnostik/i,
      /genotip[ao]\s+nustatym/i,
      /rezistentiškum.*(?:PGR|PCR)/i,
    ],
  },
  // ── NEW: Autoimuniniai (13) ───────────────────────────────────────────────
  {
    catId: 13,
    label: 'Autoimuniniai',
    patterns: [
      /autoimun/i,
      /\bANA\b/i,
      /\bANCA\b/i,
      /anti[\s-]?ds[\s-]?DNA/i,
      /antinuklear/i,
      /reumatoidinis\s+faktori/i,
      /\banti[\s-]?CCP\b/i,
      /\banti[\s-]?Sm\b/i,
      /\banti[\s-]?Jo[\s-]?1\b/i,
      /\banti[\s-]?Scl[\s-]?70\b/i,
      /\bSS[\s-]?[AB]\s+antikūn/i,
      /ciklinis\s+citrul/i,
      /\bRF\b.*reumatoid/i,
      /reumatoidinio\s+artrit/i,
    ],
  },
  // ── NEW: Mikrobiologija (11) ─────────────────────────────────────────────
  {
    catId: 11,
    label: 'Mikrobiologija',
    patterns: [
      /mikrobiologin[eė]\s+tyrimas?/i,
      /bakterij.*kultūr/i,
      /kultūr.*jautrum/i,
      /pasėlis\s+(?:ir|su)\s+jautrum/i,
      /jautrum[ao]\s+antibiotikams/i,
      /\btepinėlis\b/i,
      /tepinėlio\s+mikroskopi/i,
      /nuograndų\s+tyrimas?/i,
      /\bgrybelių\s+(?:kultūr|jautrum)/i,
    ],
  },
  // ── NEW: Mikroelementai (12) ─────────────────────────────────────────────
  {
    catId: 12,
    label: 'Mikroelementai',
    patterns: [
      /sunkiųjų\s+metal/i,
      /toksiniai?\s+metal/i,
      /\balavas\b/i,
      /\baliuminis\b/i,
      /\bauksas\b/i,
      /\bberilis\b/i,
      /\bbismutas\b/i,
      /\bgyvsidabris\b/i,
      /\barsenas\b/i,
      /\bniobis\b/i,
      /\bvolframas\b/i,
      /\btitanas\b/i,
      /\bsidabras\b/i,
      /\bstibis\b/i,
    ],
  },
  // ── NEW: Šlapimo tyrimai (10) ────────────────────────────────────────────
  {
    catId: 10,
    label: 'Šlapimo tyrimai',
    patterns: [
      /šlapimo\s+tyrimas?/i,
      /šlapimo\s+analiz/i,
      /bendr[ao\s]+šlapim/i,
      /\bBŠT\b/i,
      /mikroalbuminurij/i,
      /proteinurij/i,
      /hematuurij/i,
      /šlapimo\s+sediment/i,
      /šlapimo\s+osmoliarin/i,
      /šlapimo\s+pasėl/i,
      /24\s*val.*šlapim/i,
    ],
  },
  // ── NEW: Koaguliacija (9) ─────────────────────────────────────────────────
  {
    catId: 9,
    label: 'Koaguliacija',
    patterns: [
      /koaguliaci/i,
      /krešėjimo\s+faktori/i,
      /tromboplastin/i,
      /\bvon\s+Willebrand/i,
      /lupus\s+antikoaguliant/i,
      /antifosfolipid/i,
      /\bantikardiolipin/i,
      /heparino\s+atsparam/i,
    ],
  },
  // ── END NEW ──────────────────────────────────────────────────────────────
  {
    catId: 3,
    label: 'Vitaminai',
    patterns: [
      /vitaminas?\b/i,
      /vitamino\b/i,
      /vitaminų\b/i,
      /\bvitb\d/i,
      /\bvitd\b/i,
      /biotinas/i,
      /folio\s+rūgš/i,
      /foliatų/i,
      /retinol/i,
      /tokoferol/i,
      /filochinonas/i,
      /filokinonas/i,
      /tiaminas/i,
      /riboflavin/i,
      /piridoksin/i,
      /askorbo\s+rūgš/i,
      /panoten/i,
      /panteno/i,
    ],
  },
  {
    catId: 6,
    label: 'Alergologijos',
    patterns: [
      /alergen/i,
      /alergol/i,
      /jautrumo\s+maistui/i,
      /maisto\s+netoleranc/i,
      /\bsiGE\b/i,
      /\bALEX\b/i,
      /specifinis\s+IgE/i,
      /IgE\s+prieš/i,
      /prieš.*alergen/i,
    ],
  },
  {
    catId: 7,
    label: 'Onkologiniai žymenys',
    patterns: [
      /vėžio\s+žymuo/i,
      /vėžio\s+žymen/i,
      /vėžio\s+rizikos/i,
      /onkolog/i,
      /\bPSA\b/i,
      /prostatos\s+specifinis/i,
      /\bAFP\b/i,
      /alfa.?fetoproteinas/i,
      /\bCEA\b/i,
      /karcinoembrioninis/i,
      /\bCA[\s-]?125\b/i,
      /\bCA[\s-]?19[\s-]?9\b/i,
      /\bCA[\s-]?72[\s-]?4\b/i,
      /\bCA[\s-]?15[\s-]?3\b/i,
      /\bHE[\s-]?4\b/i,
      /\bCYFRA\b/i,
      /\bNSE\b/i,
      /chromograninas/i,
      /\bS100\b/i,
      /beta.?HCG.*vėžio/i,
      /\bAnteCancer/i,
      /\bAnteMEL\b/i,
      /\bAnteBC\b/i,
      /CINtec/i,
      /gimdos\s+kaklelio.*tepinėl/i,
      /kaulų\s+rezorbcijos/i,
      /Beta[\s-]+Cross\s+Laps/i,
    ],
  },
  {
    catId: 2,
    label: 'Hormonai',
    patterns: [
      /hormon[ao]/i,
      /\bTSH\b/i,
      /\bFT3\b|\bLT3\b/i,
      /\bFT4\b|\bLT4\b/i,
      /tireotropin/i,
      /skydliaukę\s+stimuliuoj/i,
      /tiroksinas/i,
      /trijodtironin/i,
      /skydliaukės\s+/i,
      /\bFSH\b/i,
      /folikulus\s+stimuliuoj/i,
      /\bLH\b/i,
      /liuteinizuojantis/i,
      /prolaktinas/i,
      /estradiol/i,
      /progesteronas/i,
      /testosteronas/i,
      /kortizolis/i,
      /\bDHEA/i,
      /aldosteronas/i,
      /parathormonas/i,
      /\bPTH\b/i,
      /augimo\s+hormonas/i,
      /\bIGF[\s-]?1\b/i,
      /insulinas/i,
      /C.peptidas/i,
      /androstenedionas/i,
      /melatoninas/i,
      /oksitocinas/i,
      /vazopresinas/i,
      /calcitoninas/i,
      /kalcitoninas/i,
      /reninas/i,
      /adrenalinas/i,
      /noradrenalinas/i,
      /\bACTH\b/i,
      /endokrin/i,
      /menopauz/i,
      /menopauzė/i,
      /premenopauz/i,
      /nėščiųjų.*program/i,
      /planuojančioms\s+nėšt/i,
      /vaisingumo/i,
      /vaisingumo\s+ištyrimo/i,
      /aldosterono/i,
      /androstendionas/i,
      /\bbeta[\s-]+HCG\b/i,
      /chorioninis\s+gonadotropinas/i,
    ],
  },
  {
    catId: 5,
    label: 'Infekcijos ir serologijos',
    patterns: [
      /\bPGR\b/i,
      /\bPCR\b/i,
      /\bDNR\b/i,
      /\bRNR\b/i,
      /\bRNA\b/i,
      /\bDNA\b/i,
      /antikūnai/i,
      /antikūnų/i,
      /antibrand[uū]olin/i,
      /hepatitas/i,
      /hepatito/i,
      /\bHBs/i,
      /\bHBc/i,
      /\bHBe/i,
      /\bHCV\b/i,
      /\bHAV\b/i,
      /\bŽIV\b/i,
      /\bHIV\b/i,
      /sifilis/i,
      /Treponema/i,
      /chlamidija/i,
      /Chlamydia/i,
      /Mycoplasma/i,
      /mikoplazma/i,
      /Ureaplasma/i,
      /ureaplazma/i,
      /gonorėja/i,
      /Neisseria/i,
      /Trichomonas/i,
      /trichimonozė/i,
      /herpes/i,
      /Herpes/i,
      /\bCMV\b/i,
      /cytomegalo/i,
      /citomegalovirus/i,
      /\bEBV\b/i,
      /Epstein/i,
      /boreliozė/i,
      /Borrelia/i,
      /erkių\s+pernesam/i,
      /Lyme/i,
      /TBE\b/i,
      /encefalitas.*erkių/i,
      /erkių.*encefalitas/i,
      /Anaplasma/i,
      /\bCOVID/i,
      /SARS-CoV/i,
      /koronavirusas/i,
      /rubella/i,
      /raudonukė/i,
      /toksoplazma/i,
      /Toxoplasma/i,
      /Listeria/i,
      /Salmonella/i,
      /rotavirus/i,
      /adenovirus/i,
      /noravirus/i,
      /norovirus/i,
      /kvėpavimo\s+tak/i,
      /kvepavimo\s+tak/i,
      /Influenza/i,
      /gripo\s+vir/i,
      /\bRSV\b/i,
      /infekcija/i,
      /infekci[jų]/i,
      /serologij/i,
      /lytiškai\s+plintanč/i,
      /lytiška.*liga/i,
      /mikroorganizm/i,
      /bakterinė\s+vaginoz/i,
      /Gardnerella/i,
      /Candida/i,
      /kandidozė/i,
      /mielės/i,
      /ASLO/i,
      /antistreptolizin/i,
      /streptokoko/i,
      /Streptococcus/i,
      /Staphylococcus/i,
      /Helicobacter/i,
      /celiakinė/i,
      /celiakija/i,
      /Yersinia/i,
      /ŽPV/i,
      /HPV/i,
      /papilomavirus/i,
      /Varicella/i,
      /Zoster/i,
      /imunoglobulin/i,
      /\bIgA\b/i,
      /\bIgM\b/i,
      /\bIgG\b/i,
      /\bCD\d+/i,
      /T\s+limfocitų/i,
      /limfocitų\s+fenotip/i,
      /NK\s+ląstelės/i,
      /\bHL[AŽ][\s-]?[AB]/i,
      /hepatitų.*program/i,
      /virusinių.*program/i,
      /reumatoidinio/i,
      /reumatoidin/i,
    ],
  },
  {
    catId: 4,
    label: 'Biochemija',
    patterns: [
      /biochem/i,
      /bilirubinas/i,
      /cholesterol/i,
      /cholesterolio/i,
      /\bLDL\b/i,
      /\bHDL\b/i,
      /\bDTL\b/i,
      /\bMTL\b/i,
      /triglicerid/i,
      /lipoprotein/i,
      /riebų\s+apykait/i,
      /riebalų\s+apykait/i,
      /apo[AB]/i,
      /gliukozė/i,
      /gliukoze/i,
      /gliukozes/i,
      /gliukozės/i,
      /HbA1c/i,
      /glikohemoglobin/i,
      /fruktozamin/i,
      /kreatininas/i,
      /kreatinino/i,
      /\bGFR\b/i,
      /inkstų\s+funkc/i,
      /šlapimo\s+rūgš/i,
      /karbamidas/i,
      /šlapalas/i,
      /\bALT\b/i,
      /\bAST\b/i,
      /\bGGT\b/i,
      /alkalinė\s+fosfat/i,
      /\bALF\b/i,
      /amilazė/i,
      /lipazė/i,
      /kepenu\s+funkc/i,
      /kepenų\s+funkc/i,
      /kasos\s+funkc/i,
      /albuminas/i,
      /bendras\s+baltymas/i,
      /baltymo\s+nustatym/i,
      /kalcis/i,
      /natris/i,
      /kalis/i,
      /magnis/i,
      /magn[io]/i,
      /fosforas/i,
      /chloridas/i,
      /elektrolitai/i,
      /elektrolito/i,
      /mikroelement/i,
      /geležis/i,
      /\bFe\b/i,
      /feritinas/i,
      /transferinas/i,
      /\bTIBC\b/i,
      /\bUIBC\b/i,
      /\bCRB\b/i,
      /C\s+reaktyvus\s+baltymas/i,
      /\bCRP\b/i,
      /širdies.*kraujagyslių/i,
      /kardiovaskulin/i,
      /troponinas/i,
      /\bCK[\s-]?MB\b/i,
      /mioglobinas/i,
      /proBNP/i,
      /\bBNP\b/i,
      /homocisteinas/i,
      /\bLp\(a\)/i,
      /kreatinkinazė/i,
      /prostatospecifinis/i,
      /prostatos.specifinis/i,
      /laktatdehidrogenazė/i,
      /\bLDH\b/i,
      /šlapimas/i,
      /šlapimo\s+bendras/i,
      /šlapimo\s+nustatym/i,
      /šlapimo\s+paros/i,
      /paros\s+šlapime/i,
      /žarnyno/i,
      /virškinimo/i,
      /kepenų.*program/i,
      /inkstų.*program/i,
      /kasos.*program/i,
      /osteoporozės/i,
      /osteoporoz/i,
      /\bApo\s+[AB]/i,
      /\bLp\(a\)/i,
      /cinkas|Cinkas/i,
      /\bZn\b/i,
      /varis|Varis/i,
      /\bCu\b/i,
      /selenas|Selenas/i,
      /\bSe\b.*koncentraci/i,
      /manganas/i,
      /molibdenas/i,
      /kobaltas/i,
      /jodas|jodo/i,
      /fluoras/i,
      /silicis/i,
      /alavas/i,
      /\bLitis\b/i,
      /aliuminis/i,
      /gyvsidabris/i,
      /švinas/i,
      /kadmis/i,
      /arsenas/i,
      /nikelis/i,
      /chromas/i,
      /boras/i,
      /adiponektinas/i,
      /leptinas/i,
      /C1\s+esterazė/i,
      /komplemento/i,
      /šarminė\s+fosfat/i,
      /\bALP\b/i,
      /cholinesterazė/i,
      /\bCHE\b/i,
      /cistatinas/i,
      /\bBŠT\b/i,
      /bendras\s+šlapimo/i,
      /šlapimo\s+tyrimas/i,
      /ceruloplazminas/i,
      /fosforo\s+nustatym/i,
      /\bCl\b.*chlor/i,
      /chloridų\s+koncentraci/i,
      /virškinamojo\s+trakto.*program/i,
      /\bAuksas\b/i,
      /\bBerilis\b/i,
      /\bBismutas\b/i,
      /\bNiobis\b/i,
      /\bVolframas\b/i,
      /\bTitanas\b/i,
      /Beta[\s-]+Karotenas/i,
    ],
  },
  {
    catId: 1,
    label: 'Bendra kraujo analizė',
    patterns: [
      /eritrocit/i,
      /leukocit/i,
      /trombocit/i,
      /hemoglobin/i,
      /hematokrit/i,
      /kraujo\s+formulė/i,
      /kraujo\s+formul/i,
      /bendrin[eė]\s+kraujo/i,
      /bendroji\s+kraujo/i,
      /bendra\s+kraujo/i,
      /\bOAK\b/i,
      /retikulocit/i,
      /nusėdimo\s+greitis/i,
      /eritrocitų\s+nusėd/i,
      /\bENG\b/i,
      /\bESR\b/i,
      /protrombinas/i,
      /fibrinogenas/i,
      /\bINR\b/i,
      /\bAPTT\b/i,
      /\bPTT\b/i,
      /trombino\s+laikas/i,
      /kraujo\s+krešėj/i,
      /kraujo\s+kresėj/i,
      /krešėjimo\s+laik/i,
      /antitrombinas/i,
      /mažakraujystė/i,
      /mazakraujyste/i,
      /\bAPC[\s-]?R\b/i,
      /baltymas\s+[SC]\b/i,
      /\bD[\s-]?dimeras/i,
      /von\s+Willebrand/i,
      /kraujo\s+grupė/i,
      /\bABO\b/i,
      /\bRh[\s(]/i,
      /Rh\s+faktori/i,
      /mažakraujystės.*program/i,
      /\bBKV\b/i,
      /bendras\s+kraujo\s+tyrimas/i,
    ],
  },
];

function assignCategory(name: string): number {
  const lower = name.toLowerCase();
  for (const rule of RULES) {
    for (const pat of rule.patterns) {
      if (pat.test(lower)) return rule.catId;
    }
  }
  return 8; // Kita
}

async function main() {
  let query = db.from('tests').select('id,canonical_name_lt,category_id').order('id');
  if (ALSO_KITA) {
    query = query.or('category_id.is.null,category_id.eq.8') as typeof query;
  } else {
    query = query.is('category_id', null) as typeof query;
  }
  const { data: tests, error } = await query;
  if (error) throw error;
  if (!tests?.length) { console.log('No tests without category.'); return; }
  if (ALSO_KITA) console.log('Mode: reassigning NULL + Kita (id=8) tests');

  console.log(`Assigning categories for ${tests.length} tests...${DRY_RUN ? ' [DRY RUN]' : ''}`);

  const counts: Record<number, number> = {};
  const updates: { id: number; category_id: number }[] = [];

  for (const test of tests) {
    const catId = assignCategory(test.canonical_name_lt);
    // When reassigning Kita, skip tests that would remain in Kita (no improvement)
    if (ALSO_KITA && test.category_id === 8 && catId === 8) continue;
    counts[catId] = (counts[catId] ?? 0) + 1;
    updates.push({ id: test.id, category_id: catId });
  }

  // Summary
  const catNames: Record<number, string> = {
    1: 'Bendra kraujo analizė',
    2: 'Hormonai',
    3: 'Vitaminai',
    4: 'Biochemija',
    5: 'Infekcijos',
    6: 'Alergologijos',
    7: 'Onkologiniai žymenys',
    8: 'Kita',
    9: 'Koaguliacija',
    10: 'Šlapimo tyrimai',
    11: 'Mikrobiologija',
    12: 'Mikroelementai',
    13: 'Autoimuniniai',
    14: 'PGR tyrimai',
    15: 'Genetiniai',
  };
  for (const [id, cnt] of Object.entries(counts).sort((a, b) => Number(b[1]) - Number(a[1]))) {
    console.log(`  ${catNames[Number(id)]} (${id}): ${cnt}`);
  }

  if (DRY_RUN) { console.log('\nDry run — no changes written.'); return; }

  // Batch update in groups of 100
  const BATCH = 100;
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = updates.slice(i, i + BATCH);
    for (const u of batch) {
      const { error: ue } = await db
        .from('tests')
        .update({ category_id: u.category_id })
        .eq('id', u.id);
      if (ue) console.error(`Failed id ${u.id}:`, ue.message);
    }
    process.stdout.write(`\rUpdated ${Math.min(i + BATCH, updates.length)}/${updates.length}...`);
  }
  console.log('\nDone.');
}

main().catch(console.error);
