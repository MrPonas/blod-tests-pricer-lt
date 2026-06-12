import React, { useState, useMemo } from "react";
import { PRICING_TRENDS, BLOOD_TESTS } from "../data";
import { TrendingUp, HelpCircle, Activity, Heart, ArrowUpRight, DollarSign, Calendar } from "lucide-react";

interface PriceTrendsProps {
  visibleLabs?: string[];
}

export default function PriceTrends({ visibleLabs }: PriceTrendsProps) {
  // Available tests to chart
  const trendKeys = Object.keys(PRICING_TRENDS);
  const [activeTestId, setActiveTestId] = useState(trendKeys[0]); // defaults to Vitamin D

  // Get active test details
  const activeTestDetails = useMemo(() => {
    return BLOOD_TESTS.find((test) => test.id === activeTestId);
  }, [activeTestId]);

  // Selected Trend data
  const trendData = PRICING_TRENDS[activeTestId] || [];

  // Labs details for colors and indicators
  const labs = useMemo(() => {
    const allLabs = [
      { id: "anteja", name: "Antėja", color: "#059669", strokeDash: "none" }, // Accent Emerald
      { id: "synlab", name: "Synlab", color: "#2563eb", strokeDash: "none" }, // Blue
      { id: "medicinaPractica", name: "Medicina Practica", color: "#0d9488", strokeDash: "none" }, // Teal
      { id: "rezus", name: "Rezus.lt", color: "#0284c7", strokeDash: "none" } // Sky
    ];
    if (!visibleLabs) return allLabs;
    return allLabs.filter(l => visibleLabs.includes(l.id));
  }, [visibleLabs]);

  // Tooltip state for interactive chart tracking
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);

  // Math conversions for custom SVG graphing bounding box
  // Width of graph = 500, Height of graph = 220
  const width = 500;
  const height = 220;
  const paddingX = 50;
  const paddingY = 30;

  // Compute boundaries
  const { minVal, maxVal } = useMemo(() => {
    if (trendData.length === 0) return { minVal: 0, maxVal: 100 };
    let allPrices: number[] = [];
    trendData.forEach((d) => {
      labs.forEach((l) => {
        const val = d[l.id as keyof typeof d] as number;
        if (typeof val === "number") {
          allPrices.push(val);
        }
      });
    });
    const min = allPrices.length > 0 ? Math.min(...allPrices) : 0;
    const max = allPrices.length > 0 ? Math.max(...allPrices) : 100;
    // add a 15% safety margin around min and max
    const diff = max - min || 1;
    return {
      minVal: Math.max(0, min - diff * 0.15),
      maxVal: max + diff * 0.15
    };
  }, [trendData, labs]);

  // X & Y scalers
  const pointsCount = trendData.length;
  const getX = (index: number) => {
    return paddingX + (index * (width - paddingX * 2)) / (pointsCount - 1 || 1);
  };
  const getY = (val: number) => {
    const range = maxVal - minVal || 1;
    return height - paddingY - ((val - minVal) / range) * (height - paddingY * 2);
  };

  // Generate SVG paths for each lab
  const paths = useMemo(() => {
    let result: Record<string, string> = {};
    labs.forEach((l) => {
      result[l.id] = "";
    });

    if (trendData.length < 2) return result;

    labs.forEach((l) => {
      let pathStr = "";
      trendData.forEach((dataPoint, index) => {
        const x = getX(index);
        const y = getY(dataPoint[l.id as keyof typeof dataPoint] as number);
        if (index === 0) {
          pathStr += `M ${x} ${y}`;
        } else {
          pathStr += ` L ${x} ${y}`;
        }
      });
      result[l.id] = pathStr;
    });

    return result;
  }, [trendData, minVal, maxVal, labs]);

  // Format date readable
  const formatDate = (dateStr: string) => {
    const [year, month] = dateStr.split("-");
    const monthNames: Record<string, string> = {
      "01": "Sausis", "02": "Vasaris", "03": "Kovas", "04": "Balandis",
      "05": "Gegužė", "06": "Birželis", "07": "Liepa", "08": "Rugpjūtis",
      "09": "Rugsėjis", "10": "Spalis", "11": "Lapkritis", "12": "Gruodis"
    };
    return `${monthNames[month] || month} ${year} m.`;
  };

  return (
    <div className="bg-[#fdfdfc] rounded-none border-2 border-[#1a1a1a] p-6 space-y-6 shadow-[4px_4px_0px_0px_#1a1a1a]">
      
      {/* Title block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#e5e5e0]">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-[#1a1a1a] text-[#fdfdfc]">
              <TrendingUp className="w-4 h-4" />
            </span>
            <h3 className="text-xl font-serif italic font-bold text-[#1a1a1a] tracking-tight">Kainų Dinamika ir Istorija</h3>
          </div>
          <p className="text-xs text-[#8a8a82] mt-1 font-sans">
            Stebėkite, kaip tyrimų įkainiai kito pagrindinėse laboratorijose per pastaruosius metus.
          </p>
        </div>

        {/* Selected test switcher styled with sharp edges */}
        <div className="flex flex-wrap gap-1.5">
          {trendKeys.map((key) => {
            const test = BLOOD_TESTS.find((b) => b.id === key);
            if (!test) return null;
            return (
              <button
                key={key}
                onClick={() => {
                  setActiveTestId(key);
                  setHoveredPointIndex(null);
                }}
                className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-none border transition shrink-0 ${
                  activeTestId === key
                    ? "bg-[#1a1a1a] border-[#1a1a1a] text-white"
                    : "bg-[#f4f4f0] border-[#e5e5e0] text-[#63635e] hover:border-[#1a1a1a] hover:text-[#1a1a1a]"
                }`}
              >
                {test.code}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Detail text details */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-[#fcfcfb] border border-[#e5e5e0] rounded-none p-5 space-y-3">
            <h4 className="text-[10px] font-mono font-bold text-[#8a8a82] uppercase tracking-widest">Aktyvus tyrimas</h4>
            <p className="text-base font-bold text-[#1a1a1a] font-sans leading-tight">
              {activeTestDetails?.name}
            </p>
            <p className="text-xs text-[#555550] leading-relaxed font-sans pb-2">
              Istoriniai duomenys rodo konkurencingos rinkos pakitimus. Medicina Practica bei Rezus.lt aktyviai varžosi kaina, o didžiųjų laboratorijų paketai išlieka stabiliausi.
            </p>
            <div className="flex items-center gap-2 pt-3 border-t border-[#e5e5e0] text-xs font-semibold text-[#1a1a1a]">
              <Calendar className="w-4 h-4 text-[#8a8a82] shrink-0" />
              <span className="font-mono text-[11px] uppercase tracking-wider">Intervalas: Pastarieji 12 mėn.</span>
            </div>
          </div>

          {/* Interactive instruction indicator styled as warm editorial note */}
          <div className="p-4 bg-[#fffcf0] border border-[#f0e6c5] rounded-none text-[#856d2b] text-[11px] leading-relaxed flex items-start gap-2 max-w-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-[#d4a017] shrink-0 mt-1.5 animate-pulse" />
            <p>
              <span className="font-bold">Interaktyvus grafikas:</span> Užveskite pelės žymeklį (arba bakstelėkite ekrane) ant grafiko stulpelių taškų, kad palygintumėte istorinius mėnesio įkainius tiesiogiai.
            </p>
          </div>
        </div>

        {/* SVG Chart Panel */}
        <div className="lg:col-span-8 space-y-4">
          
          {/* Legend row */}
          <div className="flex flex-wrap gap-4 items-center justify-center py-2 bg-[#f4f4f0] rounded-none border border-[#e5e5e0] text-xs">
            {labs.map((lab) => (
              <div key={lab.id} className="flex items-center gap-2">
                <span className="w-3 h-0.5 rounded-sm" style={{ backgroundColor: lab.color }} />
                <span className="font-bold text-[#1a1a1a] text-[10px] uppercase tracking-wider font-mono">{lab.name}</span>
              </div>
            ))}
          </div>

          <div className="relative border border-[#e5e5e0] bg-[#fdfdfc] rounded-none p-4">
            {/* SVG container responsive */}
            <svg 
              viewBox={`0 0 ${width} ${height}`} 
              className="w-full h-auto overflow-visible select-none"
            >
              {/* Horizonal grid lines */}
              {[0, 1, 2, 3, 4].map((index) => {
                const ratio = index / 4;
                const valueY = minVal + ratio * (maxVal - minVal);
                const y = getY(valueY);

                return (
                  <g key={index} className="opacity-50">
                    <line 
                      x1={paddingX} 
                      y1={y} 
                      x2={width - paddingX} 
                      y2={y} 
                      stroke="#e5e5e0" 
                      strokeWidth="1" 
                      strokeDasharray="2 3"
                    />
                    <text 
                      x={paddingX - 8} 
                      y={y + 3} 
                      textAnchor="end" 
                      className="text-[9px] font-mono fill-[#1a1a1a] font-bold"
                    >
                      {valueY.toFixed(1)} €
                    </text>
                  </g>
                );
              })}

              {/* X Axis Columns tracker grid */}
              {trendData.map((d, index) => {
                const x = getX(index);
                return (
                  <g key={index} className="opacity-50">
                    <text 
                      x={x} 
                      y={height - paddingY + 14} 
                      textAnchor="middle" 
                      className="text-[8px] font-mono fill-[#1a1a1a] font-bold uppercase"
                    >
                      {d.date.replace("-", "/")}
                    </text>
                  </g>
                );
              })}

              {/* Render Paths */}
              {labs.map((lab) => {
                const pathStr = paths[lab.id] || "";
                return (
                  <path
                    key={lab.id}
                    d={pathStr}
                    fill="none"
                    stroke={lab.color}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="transition-all duration-300"
                  />
                );
              })}

              {/* Interactive columns for hover tracking */}
              {trendData.map((d, index) => {
                const x = getX(index);
                return (
                  <g key={index}>
                    {/* Invisible vertical bar for easy hover targeting */}
                    <rect
                      x={x - 15}
                      y={paddingY}
                      width={30}
                      height={height - paddingY * 2}
                      fill="transparent"
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredPointIndex(index)}
                      onTouchStart={() => setHoveredPointIndex(index)}
                    />

                    {/* Active vertical hover line */}
                    {hoveredPointIndex === index && (
                      <line
                        x1={x}
                        y1={paddingY}
                        x2={x}
                        y2={height - paddingY}
                        stroke="#1a1a1a"
                        strokeWidth="1.2"
                        strokeDasharray="2 2"
                        className="pointer-events-none"
                      />
                    )}

                    {/* Draw data points dots */}
                    {labs.map((lab) => {
                      const val = d[lab.id as keyof typeof d] as number;
                      const y = getY(val);
                      const isHovered = hoveredPointIndex === index;

                      return (
                        <circle
                          key={lab.id}
                          cx={x}
                          cy={y}
                          r={isHovered ? 5 : 3.5}
                          fill={lab.color}
                          stroke="#ffffff"
                          strokeWidth={isHovered ? 2 : 1.2}
                          className="pointer-events-none transition-all duration-150"
                        />
                      );
                    })}
                  </g>
                );
              })}
            </svg>

            {/* Float Tooltip styled elegantly and editorially */}
            {hoveredPointIndex !== null && trendData[hoveredPointIndex] && (
              <div 
                className="absolute bg-[#1a1a1a] text-[#fffcf0] rounded-none shadow-[2px_2px_0px_0px_#8a8a82] border border-[#1a1a1a] p-3 text-xs w-48 space-y-2 transition pointer-events-none"
                style={{
                  left: `${Math.min(
                    Math.max(10, (getX(hoveredPointIndex) / width) * 100 - 24),
                    76
                  )}%`,
                  top: "30px"
                }}
              >
                <div className="pb-1 border-b border-[#fffcf0]/10 text-[9px] uppercase tracking-widest text-[#8a8a82] font-mono font-bold">
                  {formatDate(trendData[hoveredPointIndex].date)}
                </div>
                <div className="space-y-1.5 font-mono text-[10.5px]">
                  {labs.map((lab) => {
                    const price = trendData[hoveredPointIndex!][lab.id as keyof typeof trendData[0]] as number;
                    return (
                      <div key={lab.id} className="flex justify-between items-center">
                        <span className="text-zinc-300 font-bold">{lab.name}</span>
                        <span className="font-extrabold text-[#fffcf0]">{price.toFixed(2)} €</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

    </div>
  );
}
