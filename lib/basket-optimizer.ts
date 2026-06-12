export interface BasketLab {
  id: string;
  name: string;
  samplingFee: number;
  bookingUrl: string | null;
  color?: string;
}

export interface BasketTest {
  id: string;
  name: string;
  code: string;
  prices: Record<string, number>;
  bookingUrls: Record<string, string | null>;
}

export interface LabCoverage {
  lab: BasketLab;
  testsSum: number;
  total: number;
  assignments: { test: BasketTest; price: number; bookingUrl: string | null }[];
  missingTests: BasketTest[];
  coversAll: boolean;
}

export interface SplitAssignment {
  test: BasketTest;
  lab: BasketLab;
  price: number;
  bookingUrl: string | null;
}

export interface SplitOption {
  assignments: SplitAssignment[];
  testsSum: number;
  samplingFees: number;
  total: number;
  labsUsed: BasketLab[];
}

export interface CoverageGap {
  test: BasketTest;
  availableLabs: BasketLab[];
}

export interface VisitGroup {
  lab: BasketLab;
  tests: { test: BasketTest; price: number; bookingUrl: string | null }[];
}

export interface MinVisitCombination {
  groups: VisitGroup[];
  total: number;
}

export interface BasketOptimization {
  labCoverages: LabCoverage[];
  singleLabOptions: LabCoverage[];
  splitOption: SplitOption | null;
  coverageGaps: CoverageGap[];
  minVisitCombination: MinVisitCombination | null;
}

function getCombinations<T>(arr: T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (arr.length < size) return [];
  const [first, ...rest] = arr;
  return [
    ...getCombinations(rest, size - 1).map(c => [first, ...c]),
    ...getCombinations(rest, size),
  ];
}

export function optimizeBasket(
  basketTests: BasketTest[],
  labs: BasketLab[],
): BasketOptimization {
  if (basketTests.length === 0 || labs.length === 0) {
    return { labCoverages: [], singleLabOptions: [], splitOption: null, coverageGaps: [], minVisitCombination: null };
  }

  const coverageGaps: CoverageGap[] = basketTests
    .filter(t => labs.every(l => (t.prices[l.id] ?? 0) === 0))
    .map(t => ({ test: t, availableLabs: labs.filter(l => (t.prices[l.id] ?? 0) > 0) }));

  const labCoverages: LabCoverage[] = labs.map(lab => {
    const assignments = basketTests
      .filter(t => (t.prices[lab.id] ?? 0) > 0)
      .map(t => ({ test: t, price: t.prices[lab.id], bookingUrl: t.bookingUrls[lab.id] ?? null }));
    const missingTests = basketTests.filter(t => (t.prices[lab.id] ?? 0) === 0);
    const testsSum = assignments.reduce((acc, a) => acc + a.price, 0);
    const coversAll = missingTests.length === 0;
    return { lab, assignments, missingTests, testsSum, total: coversAll ? testsSum + lab.samplingFee : Infinity, coversAll };
  });

  const singleLabOptions = labCoverages
    .filter(lc => lc.coversAll)
    .sort((a, b) => a.total - b.total);

  const coverableTests = basketTests.filter(t => labs.some(l => (t.prices[l.id] ?? 0) > 0));

  let splitOption: SplitOption | null = null;
  if (coverableTests.length > 0) {
    const assignments: SplitAssignment[] = coverableTests.map(test => {
      const cheapestLab = [...labs]
        .filter(l => (test.prices[l.id] ?? 0) > 0)
        .sort((a, b) => test.prices[a.id] - test.prices[b.id])[0];
      return { test, lab: cheapestLab, price: test.prices[cheapestLab.id], bookingUrl: test.bookingUrls[cheapestLab.id] ?? null };
    });
    const usedLabIds = new Set(assignments.map(a => a.lab.id));
    const labsUsed = labs.filter(l => usedLabIds.has(l.id));
    const testsSum = assignments.reduce((acc, a) => acc + a.price, 0);
    const samplingFees = labsUsed.reduce((acc, l) => acc + l.samplingFee, 0);
    splitOption = { assignments, testsSum, samplingFees, total: testsSum + samplingFees, labsUsed };
  }

  let minVisitCombination: MinVisitCombination | null = null;
  if (singleLabOptions.length === 0 && coverageGaps.length === 0 && coverableTests.length > 0) {
    outer: for (let size = 2; size <= labs.length; size++) {
      const combos = getCombinations(labs, size);
      const valid: MinVisitCombination[] = [];
      for (const comboLabs of combos) {
        if (!coverableTests.every(t => comboLabs.some(l => (t.prices[l.id] ?? 0) > 0))) continue;
        const groups: VisitGroup[] = comboLabs.map(l => ({ lab: l, tests: [] }));
        let total = comboLabs.reduce((acc, l) => acc + l.samplingFee, 0);
        for (const test of coverableTests) {
          const cheapest = [...comboLabs]
            .filter(l => (test.prices[l.id] ?? 0) > 0)
            .sort((a, b) => test.prices[a.id] - test.prices[b.id])[0];
          if (cheapest) {
            total += test.prices[cheapest.id];
            groups.find(g => g.lab.id === cheapest.id)!.tests.push({ test, price: test.prices[cheapest.id], bookingUrl: test.bookingUrls[cheapest.id] ?? null });
          }
        }
        valid.push({ groups: groups.filter(g => g.tests.length > 0), total });
      }
      if (valid.length > 0) {
        minVisitCombination = valid.sort((a, b) => a.total - b.total)[0];
        break outer;
      }
    }
  }

  return { labCoverages, singleLabOptions, splitOption, coverageGaps, minVisitCombination };
}
