const LT_DIACRITICS: Record<string, string> = {
  'ą':'a','č':'c','ę':'e','ė':'e','į':'i','š':'s','ų':'u','ū':'u','ž':'z',
  'Ą':'a','Č':'c','Ę':'e','Ė':'e','Į':'i','Š':'s','Ų':'u','Ū':'u','Ž':'z',
};

const KNOWN_EXPANSIONS: Record<string, string> = {
  'vit\\.': 'vitaminas',
  '\\bvit\\b': 'vitaminas',
  '\\btsh\\b': 'tireotropinas',
  '\\btth\\b': 'tireotropinas',
  '\\bkla\\b': 'kraujo bendra analize',
  '\\bbka\\b': 'kraujo bendra analize',
  '\\boam\\b': 'slapimo bendra analize',
  '\\bcrp\\b': 'c reaktyvusis baltymas',
  '25-oh': '25 hidroksivitaminas',
  '25-hidroksi': '25 hidroksivitaminas',
};

const NOISE_TOKENS = new Set([
  'tyrimas', 'nustatymas', 'kiekybinis', 'kokybinis',
  'be pvm', 'su pvm', 'kaina',
]);

export function normalizeTestName(raw: string): string {
  let s = raw.toLowerCase().trim();

  s = s.replace(/[ąčęėįšųūž]/gi, c => LT_DIACRITICS[c] ?? c);

  for (const [pattern, expansion] of Object.entries(KNOWN_EXPANSIONS)) {
    s = s.replace(new RegExp(pattern, 'gi'), expansion);
  }

  s = s.replace(/\((be nuorodos|ambulatorinis|skubus|papildomas|pirminis)\)/gi, '');

  s = s.replace(/[.,\-\/\\()\[\]]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();

  s = s.split(' ').filter(t => !NOISE_TOKENS.has(t)).join(' ');

  return s;
}
