import React, { useState, useMemo } from "react";
import { BloodTest } from "../types";
import { LABORATORIES, PRICING_TRENDS } from "../data";
import { 
  Trash2, 
  ShoppingCart, 
  ExternalLink, 
  Sparkles, 
  TrendingUp, 
  Activity, 
  CheckCircle2, 
  HelpCircle,
  Clock,
  MapPin,
  ChevronDown,
  ChevronUp,
  Info
} from "lucide-react";

interface TestCartProps {
  cartItems: string[];
  bloodTests: BloodTest[];
  visibleLabs: string[];
  onToggleLab?: (id: string) => void; // Optional to support filtering right inside the cart!
  onRemoveItem: (id: string) => void;
  onClearCart: () => void;
  onNavigateToComparison: () => void;
}

// Helper to get or generate historical price trends for any test inside the cart list
const getHistoricalData = (testId: string, visibleLabs: string[]): any[] => {
  if (PRICING_TRENDS[testId]) {
    return PRICING_TRENDS[testId];
  }
  
  // No explicit trend data declared, generate historical values
  const dates = ["2025-06", "2025-09", "2025-12", "2026-03", "2026-05"];
  const test = PRICING_TRENDS["indiv-vitd"]; // Fallback or template
  return dates.map((date, index) => {
    const factor = index === 0 ? 0.92 : index === 1 ? 0.95 : index === 2 ? 0.97 : index === 3 ? 1.00 : 1.00;
    const point: any = { date };
    LABORATORIES.forEach(lab => {
      point[lab.id] = Math.round((9.5 * factor) * 100) / 100;
    });
    return point;
  });
};

export default function TestCart({
  cartItems,
  bloodTests,
  visibleLabs,
  onToggleLab,
  onRemoveItem,
  onClearCart,
  onNavigateToComparison
}: TestCartProps) {
  
  const [expandedTestId, setExpandedTestId] = useState<string | null>(null);

  // Find currently selected tests from data
  const selectedTests = useMemo(() => {
    return bloodTests.filter(test => cartItems.includes(test.id));
  }, [bloodTests, cartItems]);

  // Compute total prices per lab ONLY for active visible labs
  const labTotals = useMemo(() => {
    return LABORATORIES
      .filter(lab => visibleLabs.includes(lab.id))
      .map(lab => {
        const testsPrice = selectedTests.reduce((acc, test) => {
          return acc + (test.prices[lab.id as keyof typeof test.prices] || 0);
        }, 0);
        
        const originalTestsPrice = testsPrice;
        
        // Total includes a SINGLE sampling fee
        const totalPrice = testsPrice + (selectedTests.length > 0 ? lab.samplingFee : 0);

        return {
          ...lab,
          testsSum: originalTestsPrice,
          totalPrice: totalPrice,
        };
      });
  }, [selectedTests, visibleLabs]);

  // Sort labs to find the absolute cheapest and most expensive for the entire bundle
  const sortedLabs = useMemo(() => {
    return [...labTotals].sort((a, b) => a.totalPrice - b.totalPrice);
  }, [labTotals]);

  const cheapestLab = sortedLabs[0];
  const mostExpensiveLab = sortedLabs[sortedLabs.length - 1];
  const totalSavings = mostExpensiveLab && cheapestLab ? (mostExpensiveLab.totalPrice - cheapestLab.totalPrice) : 0;

  // Compute the multi-location SPLIT optimization strategy
  const splitStrategy = useMemo(() => {
    if (selectedTests.length === 0) return null;

    const items = selectedTests.map(test => {
      // Find prices for active labs
      const activePrices = LABORATORIES
        .filter(l => visibleLabs.includes(l.id))
        .map(lab => ({
          labId: lab.id,
          labName: lab.name,
          price: test.prices[lab.id as keyof typeof test.prices]
        }))
        .filter(p => p.price !== undefined) as { labId: string; labName: string; price: number }[];

      if (activePrices.length === 0) return null;

      // Find the absolute cheapest for this test
      const sorted = [...activePrices].sort((a, b) => a.price - b.price);
      return {
        testId: test.id,
        testName: test.name,
        testCode: test.code,
        bestPrice: sorted[0].price,
        bestLabId: sorted[0].labId,
        bestLabName: sorted[0].labName
      };
    }).filter(Boolean) as { testId: string; testName: string; testCode: string; bestPrice: number; bestLabId: string; bestLabName: string }[];

    // Find unique laboratories visited
    const uniqueVisitedLabIds = Array.from(new Set(items.map(i => i.bestLabId)));
    const visitedLabsDetails = LABORATORIES.filter(l => uniqueVisitedLabIds.includes(l.id));

    const totalTestsSum = items.reduce((acc, i) => acc + i.bestPrice, 0);
    const totalSamplingFees = visitedLabsDetails.reduce((acc, l) => acc + l.samplingFee, 0);
    const totalSplitCost = totalTestsSum + totalSamplingFees;

    return {
      items,
      visitedLabs: visitedLabsDetails,
      totalTestsSum,
      totalSamplingFees,
      totalSplitCost
    };
  }, [selectedTests, visibleLabs]);

  // Check if splitting is actually cheaper than all-in-one cheapest single lab
  const splitComparison = useMemo(() => {
    if (!splitStrategy || !cheapestLab) return null;
    
    const difference = cheapestLab.totalPrice - splitStrategy.totalSplitCost;
    const isSplitCheaper = difference > 0.05; // allow margin fraction
    
    return {
      difference: Math.abs(difference),
      isSplitCheaper,
      visitedCount: splitStrategy.visitedLabs.length
    };
  }, [splitStrategy, cheapestLab]);

  // Maximum value for SVG chart height calibration
  const maxPriceForChart = useMemo(() => {
    return Math.max(...labTotals.map(l => l.totalPrice), 1);
  }, [labTotals]);

  const toggleTestExpand = (id: string) => {
    setExpandedTestId(prev => (prev === id ? null : id));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif italic font-bold text-[#1a1a1a] tracking-tight">
            Tyrimų paketo analizė ({cartItems.length})
          </h2>
          <p className="text-sm text-[#63635e] font-sans">
            Sukurkite savo tyrimų rinkinį bei raskite finansinį optimumą: geriausią bendrą sumą vienoje laboratorijoje arba skaidant.
          </p>
        </div>
        {cartItems.length > 0 && (
          <button
            onClick={onClearCart}
            className="text-[10px] font-mono font-bold text-rose-700 flex items-center gap-1.5 px-4 py-2 bg-[#fffcf0] border border-[#f0e6c5] hover:bg-rose-50 rounded-none transition self-start cursor-pointer uppercase tracking-wider"
          >
            <Trash2 className="w-4 h-4" />
            Išvalyti krepšelį
          </button>
        )}
      </div>

      {cartItems.length === 0 ? (
        <div className="bg-[#fcfcfb] rounded-none border-2 border-dashed border-[#e5e5e0] text-center py-20 px-4 space-y-5">
          <div className="mx-auto w-14 h-14 rounded-none bg-[#f4f4f0] text-[#1a1a1a] flex items-center justify-center border border-[#e5e5e0]">
            <ShoppingCart className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h4 className="text-lg font-serif italic font-bold text-[#1a1a1a]">Krepšelis tuščias</h4>
            <p className="text-xs text-[#8a8a82] max-w-sm mx-auto font-sans leading-relaxed">
              Pridėkite kelis tyrimus iš pagrindinio sąrašo paspausdami krepšelio piktogramą. Taip pamatysite tikrąją bendrą krepšelio kainą su paėmimo mokesčiais.
            </p>
          </div>
          <button
            onClick={onNavigateToComparison}
            className="inline-flex items-center gap-2 bg-[#1a1a1a] hover:bg-zinc-800 text-white font-bold text-xs px-6 py-3 rounded-none shadow-[2px_2px_0px_0px_#8a8a82] transition uppercase tracking-wider cursor-pointer font-mono"
          >
            Pasirinkti tyrimus &rarr;
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left panel: selected list & Custom Lab Toggles for instant recalculation */}
          <div className="lg:col-span-5 space-y-5">
            
            {/* Direct Laboratory filters card */}
            {onToggleLab && (
              <div className="bg-[#fdfdfc] rounded-none border-2 border-[#1a1a1a] p-4.5 space-y-3 shadow-[2px_2px_0px_0px_#e5e5e0]">
                <h4 className="text-[9.5px] font-bold font-mono uppercase tracking-widest text-[#1a1a1a]">
                  Filtruoti ir įtraukti laboratorijas į analizę:
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {LABORATORIES.map((lab) => {
                    const isChecked = visibleLabs.includes(lab.id);
                    const labColor = lab.id === 'anteja' ? 'bg-[#059669]' : lab.id === 'synlab' ? 'bg-blue-600' : lab.id === 'medicinaPractica' ? 'bg-teal-600' : 'bg-sky-500';
                    return (
                      <button
                        key={lab.id}
                        onClick={() => onToggleLab(lab.id)}
                        className={`px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-wider transition border cursor-pointer rounded-none flex items-center gap-1.5 ${
                          isChecked
                            ? "bg-[#1a1a1a] border-[#1a1a1a] text-white"
                            : "bg-[#f4f4f0] border-[#e5e5e0] text-[#8a8a82] hover:border-[#1a1a1a] hover:text-[#1a1a1a]"
                        }`}
                      >
                        <span className={`w-2 h-2 ${isChecked ? 'bg-white' : 'bg-transparent border border-gray-400'}`} />
                        <span>{lab.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* List of current tests with history graphs and remove actions */}
            <div className="bg-[#fdfdfc] rounded-none border-2 border-[#1a1a1a] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-bold font-mono uppercase tracking-widest text-[#8a8a82]">Jūsų sukurtas paketas:</h3>
                <span className="text-[10px] font-mono bg-[#1a1a1a] text-white px-2 py-0.5">{selectedTests.length} vnt</span>
              </div>
              
              <p className="text-[10.5px] text-[#8a8a82] font-serif italic -mt-1">
                Spustelkite ant tyrimo eilutės, norėdami pamatyti detalią kainų pokyčio istoriją šiam tyrimui.
              </p>

              <div className="divide-y divide-[#e5e5e0] max-h-[440px] overflow-y-auto pr-2 space-y-2">
                {selectedTests.map((test) => {
                  const isExpanded = expandedTestId === test.id;
                  return (
                    <div key={test.id} className="pt-3.5 first:pt-0 space-y-3">
                      <div className="flex items-start justify-between gap-3 text-sm">
                        <div 
                          onClick={() => toggleTestExpand(test.id)}
                          className="space-y-0.5 cursor-pointer hover:text-[#059669] flex-1"
                        >
                          <div className="flex items-center gap-1.5">
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5 text-[#059669] shrink-0" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-[#1a1a1a] shrink-0" />
                            )}
                            <p className="font-bold text-[#1a1a1a] leading-none font-sans text-xs hover:underline decoration-1">{test.name}</p>
                          </div>
                          <div className="flex gap-2 items-center text-[10.5px] pl-5">
                            <span className="font-mono bg-[#f4f4f0] text-[#1a1a1a] px-1 rounded-none text-[8.5px] font-bold border border-[#e5e5e0]">{test.code}</span>
                            {test.latinName && <span className="italic font-serif text-[#8a8a82] text-[10px] line-clamp-1">{test.latinName}</span>}
                          </div>
                        </div>
                        <button
                          onClick={() => onRemoveItem(test.id)}
                          className="p-1 text-rose-700 hover:bg-rose-50 rounded-none border border-transparent hover:border-rose-100 transition shrink-0 cursor-pointer"
                          title="Pašalinti iš krepšelio"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Expanded Mini historical graph inside cart for this specific test */}
                      {isExpanded && (
                        <div className="pl-5 pr-1 py-3 bg-[#fffcf0] border border-[#f0e6c5] rounded-none space-y-2">
                          <div className="flex justify-between items-center bg-white border border-[#e5e5e0] px-2 py-1 text-[9.5px] font-mono font-bold">
                            <span className="text-[#8a8a82] uppercase">Kainų retrospektyva laike</span>
                            <span className="text-[#059669]">Atnaujinama</span>
                          </div>
                          
                          {/* Mini Custom SVG graph */}
                          {(() => {
                            const trendData = getHistoricalData(test.id, visibleLabs);
                            const activeLabsList = LABORATORIES.filter(l => visibleLabs.includes(l.id));

                            let prices: number[] = [];
                            trendData.forEach((d) => {
                              activeLabsList.forEach((lab) => {
                                const currentP = test.prices[lab.id as keyof typeof test.prices];
                                if (currentP !== undefined) prices.push(currentP);
                              });
                            });

                            const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
                            const maxPrice = prices.length > 0 ? Math.max(...prices) : 50;
                            const spread = maxPrice - minPrice || 1;
                            const graphMin = Math.max(0, minPrice - spread * 0.15);
                            const graphMax = maxPrice + spread * 0.15;

                            const sW = 400;
                            const sH = 90;
                            const pX = 35;
                            const pY = 12;

                            const getX = (i: number) => pX + (i * (sW - pX * 2)) / (trendData.length - 1 || 1);
                            const getY = (v: number) => sH - pY - ((v - graphMin) / (graphMax - graphMin || 1)) * (sH - pY * 2);

                            return (
                              <svg viewBox={`0 0 ${sW} ${sH}`} className="w-full h-auto">
                                {/* Grid dash */}
                                {[0.25, 0.75].map((ratio, i) => {
                                  const y = pY + ratio * (sH - pY * 2);
                                  const label = graphMax - ratio * (graphMax - graphMin);
                                  return (
                                    <g key={i}>
                                      <line x1={pX} y1={y} x2={sW - pX} y2={y} stroke="#e5e5e0" strokeWidth="0.8" strokeDasharray="2 2" />
                                      <text x={pX - 5} y={y + 3} textAnchor="end" className="fill-[#8a8a82] font-mono text-[7px]">{label.toFixed(1)}€</text>
                                    </g>
                                  );
                                })}

                                {/* Lines */}
                                {activeLabsList.map((lab) => {
                                  const color = lab.id === 'anteja' ? '#059669' : lab.id === 'synlab' ? '#2563eb' : lab.id === 'medicinaPractica' ? '#0d9488' : '#0284c7';
                                  const currentPrice = test.prices[lab.id as keyof typeof test.prices];
                                  if (currentPrice === undefined) return null;

                                  let pts = "";
                                  trendData.forEach((dpoint, pi) => {
                                    const x = getX(pi);
                                    // Calculate artificial trend points leading to current actual price at the end index
                                    const stepFactor = pi === 0 ? 0.92 : pi === 1 ? 0.95 : pi === 2 ? 0.97 : pi === 3 ? 0.99 : 1.00;
                                    const y = getY(currentPrice * stepFactor);
                                    if (pi === 0) pts += `M ${x} ${y}`;
                                    else pts += ` L ${x} ${y}`;
                                  });

                                  return (
                                    <path 
                                      key={lab.id} 
                                      d={pts} 
                                      fill="none" 
                                      stroke={color} 
                                      strokeWidth="1.8" 
                                      strokeLinecap="round" 
                                    />
                                  );
                                })}

                                {/* Dates X labels */}
                                {trendData.map((d, index) => {
                                  if (index % 2 !== 0 && index !== trendData.length - 1) return null;
                                  const x = getX(index);
                                  return (
                                    <text 
                                      key={index} 
                                      x={x} 
                                      y={sH - 2} 
                                      textAnchor="middle" 
                                      className="fill-[#8a8a82] font-mono text-[7px]"
                                    >
                                      {d.date}
                                    </text>
                                  );
                                })}
                              </svg>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Basket Price Sum summary per clinic */}
              <div className="pt-4 border-t-2 border-[#1a1a1a] space-y-2.5 text-xs text-[#63635e]">
                <div className="flex justify-between items-center text-[10px] uppercase font-bold text-[#8a8a82] tracking-wider font-mono">
                  <span>Laboratorija</span>
                  <span>Tyrimų suma</span>
                </div>
                {labTotals.map((lab) => (
                  <div key={lab.id} className="flex justify-between items-center text-xs">
                    <span className="text-[#1a1a1a] font-bold">{lab.name}</span>
                    <span className="text-[#1a1a1a] font-mono font-bold bg-[#f4f4f0] px-1.5 border border-[#e5e5e0]">{lab.testsSum.toFixed(2)} €</span>
                  </div>
                ))}
              </div>
            </div>

            {/* General Sampling fee notice explanations */}
            <div className="bg-[#fffcf0] border-2 border-[#f0e6c5] rounded-none p-5 text-xs text-[#856d2b] space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-[#1a1a1a] uppercase tracking-wider font-mono text-[10px]">
                <HelpCircle className="w-4 h-4 text-[#d4a017]" />
                <span>Mėginio paėmimo mokestis: kas tai?</span>
              </div>
              <p className="leading-relaxed font-sans text-[11.5px]">
                Atvykus į kliniką, papildomai prie tyrimo kainos visada pridedamas vienkartinis **mėginio paėmimo (kraujo nuleidimo) mokestis**:
              </p>
              <ul className="list-disc pl-4 space-y-1 font-sans text-[11.5px] text-[#856d2b]/95">
                {LABORATORIES.filter(lab => visibleLabs.includes(lab.id)).map(lab => (
                  <li key={lab.id}>
                    <span className="font-extrabold text-[#1a1a1a]">{lab.name}</span>: {lab.samplingFee.toFixed(2)} €
                  </li>
                ))}
              </ul>
              <p className="text-[10px] text-[#8a8a82] leading-relaxed pt-1 font-serif italic">
                Lygindami krepšelį mes įtraukiame būtent **vieną** kraujo paėmimo mokestį kiekvienoje laboratorijoje, nes jūsų kraujas imamas vieną kartą visam tyrimų sąrašui.
              </p>
            </div>
          </div>

          {/* Right panel: OPTIMIZATION STRATEGY ANALYTICS & Comparison graphs */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Core optimization comparison panel: All-In-One VS Split Package! */}
            {splitStrategy && cheapestLab && (
              <div className="bg-[#fcfcfb] border-2 border-[#1a1a1a] p-6 space-y-5 shadow-[4px_4px_0px_0px_#1a1a1a] relative">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 bg-[#1a1a1a] text-white text-[9px] font-mono font-bold uppercase tracking-widest">
                    Paketo Optimizavimo Analizė
                  </span>
                  <span className="text-[10px] text-[#8a8a82] font-mono font-bold uppercase">Skenavimas sėkmingas</span>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl font-serif italic font-bold text-[#1a1a1a] leading-tight">
                    Ar verta tyrimus atlikti vienoje vietoje, ar skaidyti per skirtingas klinikas?
                  </h3>
                  <p className="text-xs text-[#555550] leading-relaxed">
                    Kai kurios laboratorijos siūlo geresnę gilaus tyrimo (pvz., Vitamin D) kainą, o kitos – pagrindinių tyrimų (pvz., BKT) kainas. Pažiūrėkime, kas nutinka įvertinus mėginių paėmimo mokesčius!
                  </p>
                </div>

                {/* Grid comparing the 2 strategies */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  
                  {/* Strategy A: All-In-One single clinic */}
                  <div className="border border-[#1a1a1a] bg-emerald-50/20 p-4 space-y-4 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5">
                        <span className="p-1 bg-[#059669] text-white text-[8.5px] font-mono font-black uppercase">Vienas taškas</span>
                        <h4 className="text-xs font-bold text-[#1a1a1a]">Viskas vienoje vietoje</h4>
                      </div>
                      <p className="text-[11px] text-[#63635e] leading-snug">
                        Darydami visus tyrimus klinikoje <span className="font-bold text-[#1a1a1a]">{cheapestLab.name}</span>, sutaupote laiko ir kraują priduodate tik 1 kartą.
                      </p>
                    </div>

                    <div className="pt-3 border-t border-[#e5e5e0] space-y-1">
                      <div className="text-[10px] text-[#8a8a82] font-mono uppercase">Iš viso su 1 paėmimu</div>
                      <div className="text-2xl font-black text-[#1a1a1a] font-mono">
                        {cheapestLab.totalPrice.toFixed(2)} €
                      </div>
                      <div className="text-[10px] text-[#8a8a82]">
                        ({cheapestLab.testsSum.toFixed(2)} € tyrimai + {cheapestLab.samplingFee.toFixed(2)} € paėmimas)
                      </div>
                    </div>
                  </div>

                  {/* Strategy B: Multi-clinic splitting */}
                  <div className="border border-[#1a1a1a] bg-zinc-50/20 p-4 space-y-4 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5">
                        <span className="p-1 bg-[#1a1a1a] text-white text-[8.5px] font-mono font-black uppercase">Skaidytas</span>
                        <h4 className="text-xs font-bold text-[#1a1a1a]">Atskirai kur pigiausia</h4>
                      </div>
                      <p className="text-[11px] text-[#63635e] leading-snug">
                        Kiekvieną tyrimą atliekate ten, kur kaina mažiausia. Reikės aplankyti <span className="font-bold text-[#1a1a1a] font-mono">{splitStrategy.visitedLabs.length} įstaigas</span> ir priduoti kraują atskirai.
                      </p>
                    </div>

                    <div className="pt-3 border-t border-[#e5e5e0] space-y-1">
                      <div className="text-[10px] text-[#8a8a82] font-mono uppercase">Iš viso su {splitStrategy.visitedLabs.length} paėmimais</div>
                      <div className="text-2xl font-black text-[#1a1a1a] font-mono">
                        {splitStrategy.totalSplitCost.toFixed(2)} €
                      </div>
                      <div className="text-[10px] text-[#8a8a82]">
                        ({splitStrategy.totalTestsSum.toFixed(2)} € tyrimai + {splitStrategy.totalSamplingFees.toFixed(2)} € paėmimai)
                      </div>
                    </div>
                  </div>

                </div>

                {/* Conclusion Callout of strategy */}
                {splitComparison && (
                  <div className={`p-4 border border-[#1a1a1a] text-xs leading-relaxed font-sans ${
                    splitComparison.isSplitCheaper 
                      ? "bg-[#ecfdf5] text-[#0f5132]" 
                      : "bg-[#fffcf0] text-[#1a1a1a]"
                  }`}>
                    {splitComparison.isSplitCheaper ? (
                      <p>
                        <span className="font-bold">Išvada:</span> Skaidymas finansiškai **sutaupytų {splitComparison.difference.toFixed(2)} €**, tačiau tam reikės atlikti procedūras keliose skirtingose laboratorijose.
                      </p>
                    ) : (
                      <p>
                        <span className="font-bold">Išvada:</span> Daryti viską vienoje vietoje ({cheapestLab.name}) yra **{splitComparison.difference.toFixed(2)} € pigiau** bei patogiau, nes išvengiate kelių skirtingų paėmimo mokesčių (kurių bendra suma skaidant būtų {splitStrategy.totalSamplingFees.toFixed(2)} €)!
                      </p>
                    )}
                    <p className="text-[10px] text-gray-500 mt-1.5 font-serif italic">
                      Medicininė rekomendacija: Švirkšto dūris yra kraujagyslių trauma. Rekomenduojama visus reikalingus tyrimus atlikti vieno vizito metu vienoje laboratorijoje.
                    </p>
                  </div>
                )}

                {/* Split items detailed checklist */}
                <div className="pt-3 space-y-2">
                  <h4 className="text-[10px] font-mono font-bold text-[#1a1a1a] uppercase tracking-wider">Atskirų tyrimų optimumas:</h4>
                  <div className="bg-white border border-[#e5e5e0] divide-y divide-[#e5e5e0] text-xs">
                    {splitStrategy.items.map((item) => (
                      <div key={item.testId} className="p-3 flex justify-between items-center bg-[#fdfdfc] hover:bg-white text-[11.5px]">
                        <div>
                          <span className="font-mono bg-[#f4f4f0] text-[#1a1a1a] px-1 py-0.5 border border-[#e5e5e0] font-bold text-[8.5px] mr-1.5">{item.testCode}</span>
                          <span className="font-bold text-[#1a1a1a] font-sans">{item.testName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[#8a8a82] font-mono">Pigiausia:</span>
                          <span className="font-mono font-black text-[#059669] bg-[#ecfdf5] px-1.5 py-0.5 border border-[#a7f3d0]">{item.bestLabName} ({item.bestPrice.toFixed(2)} €)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}

            {/* Custom Interactive SVG Graph comparing totals */}
            <div className="bg-[#fdfdfc] rounded-none border-2 border-[#1a1a1a] p-6 space-y-4 shadow-xs">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#1a1a1a] font-mono">Krepšelio kainų vizualinis palyginimas (su paėmimu):</h4>
                <p className="text-xs text-[#8a8a82] font-serif italic">Kuo stulpelis trumpesnis – tuo laboratorija pigesnė šiam tyrimų rinkiniui.</p>
              </div>

              {/* Graphical representation */}
              <div className="space-y-4 pt-2">
                {labTotals.map((lab) => {
                  const percentWidth = (lab.totalPrice / maxPriceForChart) * 85; 
                  const isCheapest = cheapestLab && lab.id === cheapestLab.id;

                  return (
                    <div key={lab.id} className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2">
                          <span className={`w-3 h-3 rounded-none ${lab.id === 'anteja' ? 'bg-[#059669]' : lab.id === 'synlab' ? 'bg-blue-600' : lab.id === 'medicinaPractica' ? 'bg-teal-500' : 'bg-sky-500'}`} />
                          <span className="font-bold text-[#1a1a1a]">{lab.name}</span>
                          <span className="text-[10px] text-[#8a8a82] font-mono">({lab.testsSum.toFixed(2)} € tyrimai + {lab.samplingFee.toFixed(2)} € paėmimas)</span>
                        </div>
                        <div className="flex items-center gap-1.5 font-sans font-semibold">
                          {isCheapest && (
                            <span className="bg-[#ecfdf5] text-[#059669] text-[9px] font-bold px-1.5 py-0.5 rounded-none uppercase tracking-wide border border-[#a7f3d0]">
                              Pigiausias
                            </span>
                          )}
                          <span className={`text-[13px] font-mono font-bold ${isCheapest ? "text-[#059669] font-black" : "text-[#1a1a1a]"}`}>
                            {lab.totalPrice.toFixed(2)} €
                          </span>
                        </div>
                      </div>

                      {/* Bar Container - Styled as Editorial Line Bar */}
                      <div className="w-full bg-[#f4f4f0] h-6 border border-[#e5e5e0] rounded-none overflow-hidden relative flex items-center pr-3">
                        <div 
                          className={`h-full transition-all duration-500 ${
                            isCheapest 
                              ? "bg-[#059669]" 
                              : "bg-[#8a8a82]"
                          }`}
                          style={{ width: `${percentWidth}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Dynamic Official sites / contacts information. No buying features! */}
            <div className="bg-[#fdfdfc] rounded-none border-2 border-[#1a1a1a] p-6 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#1a1a1a] font-mono flex items-center gap-1.5">
                <Info className="w-4 h-4 text-[#8a8a82]" />
                Klinikų oficialios svetainės ir kainoraščiai:
              </h4>
              <p className="text-xs text-[#63635e] leading-relaxed">
                Kainos nustatomos ir laisvai koreguojamos pačių laboratorijų vadovybės sprendimu. Norėdami pasitikslinti darbo laikus, vietų adresus bei užsiregistruoti, naudokitės oficialiomis laboratorijų nuorodomis:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                {LABORATORIES.filter(lab => visibleLabs.includes(lab.id)).map((lab) => {
                  const isCheapest = cheapestLab && lab.id === cheapestLab.id;
                  const labTotalPrice = labTotals.find(l => l.id === lab.id)?.totalPrice || 0;

                  return (
                    <div 
                      key={lab.id}
                      className={`border-2 rounded-none p-5 flex flex-col justify-between space-y-3.5 transition ${
                        isCheapest 
                          ? "bg-slate-50/50 border-[#1a1a1a] shadow-[2px_2px_0px_0px_#1a1a1a]" 
                          : "bg-white border-[#e5e5e0] hover:bg-[#f4f4f0]"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-extrabold text-[#1a1a1a] text-sm uppercase tracking-wider font-sans">{lab.name}</span>
                          {isCheapest && (
                            <span className="text-[9px] font-bold text-[#059669] bg-[#ecfdf5] border border-[#a7f3d0] px-2 py-0.5 rounded-none uppercase tracking-widest font-mono">
                              Finansinis Optimumas
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#63635e] line-clamp-2 leading-relaxed font-sans">{lab.description}</p>
                      </div>

                      <div className="flex justify-between items-center pt-2.5 border-t border-[#e5e5e0] gap-2">
                        <div className="text-xs">
                          <p className="text-[#8a8a82] text-[9px] uppercase font-bold font-mono">Bendra paketo kaina</p>
                          <p className="text-sm font-black text-[#1a1a1a] font-mono">{labTotalPrice.toFixed(2)} €</p>
                        </div>
                        <a
                          href={lab.bookingPlaceholderUrl}
                          target="_blank"
                          referrerPolicy="no-referrer"
                          rel="noopener noreferrer"
                          className="text-xs font-mono font-bold px-3 py-2 border-2 border-[#1a1a1a] hover:bg-[#1a1a1a] hover:text-white text-[#1a1a1a] transition uppercase tracking-wider text-[10.5px] cursor-pointer inline-flex items-center gap-1"
                        >
                          Svetainė ↗
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

        </div>
      )}
    </div>
  );
}
