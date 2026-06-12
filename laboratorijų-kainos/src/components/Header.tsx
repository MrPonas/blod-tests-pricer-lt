import React from "react";
import { Activity, AlertTriangle, RefreshCw, Sparkles } from "lucide-react";

interface HeaderProps {
  totalTestsCount: number;
}

export default function Header({ totalTestsCount }: HeaderProps) {
  return (
    <header className="relative bg-[#fdfdfc] text-[#1a1a1a] border-b border-[#e5e5e0] pt-10 pb-6">
      {/* Editorial Decorative Top Border */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#1a1a1a]" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 pb-6 border-b border-[#e5e5e0]">
          
          <div className="space-y-2.5">
            <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-[#8a8a82] font-semibold">
              <Sparkles className="w-3 h-3 text-[#1a1a1a]" />
              Nepriklausomas palyginimas • Medicinos Analitika
            </div>
            
            <div className="flex items-start gap-4">
              <div className="p-3 bg-[#1a1a1a] text-white rounded-none border border-[#1a1a1a] shrink-0">
                <Activity className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-4xl md:text-5xl font-serif italic font-medium tracking-tight text-[#1a1a1a] leading-none">
                  Laboratorijų Kainos
                </h1>
                <p className="text-sm text-[#63635e] font-sans mt-2 max-w-xl leading-relaxed">
                  Kraujo tyrimų, profilaktinių sveikatos rinkinių ir diagnostikos įkainių palyginimas didžiausiose šalies laboratorijose.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-[#f4f4f0] border-2 border-[#1a1a1a] rounded-none px-4 py-2 text-xs text-[#1a1a1a] flex items-center gap-3">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#059669] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#059669]"></span>
              </span>
              <div>
                <p className="font-bold text-[#1a1a1a]">Duomenys aktyvūs</p>
                <p className="text-[#8a8a82] text-[10px]">Atnaujinta: Vakar, 2026-05-25</p>
              </div>
            </div>

            <div className="bg-[#f4f4f0] border-2 border-[#1a1a1a] rounded-none px-4 py-2 text-xs text-[#1a1a1a] flex items-center gap-3">
              <RefreshCw className="w-4 h-4 text-[#1a1a1a]" />
              <div>
                <p className="font-bold text-[#1a1a1a]">{totalTestsCount} tyrimai ir paketai</p>
                <p className="text-[#8a8a82] text-[10px]">4 didžiosios laboratorijos</p>
              </div>
            </div>
          </div>
        </div>

        {/* Warning Callout styled exactly like Editorial bar */}
        <div className="mt-5 p-4 bg-[#fffcf0] border-2 border-[#f0e6c5] rounded-none text-xs text-[#856d2b] flex items-start gap-3">
          <AlertTriangle className="w-4.5 h-4.5 text-[#d4a017] shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <span className="font-bold text-[#856d2b]">Svarbi informacija pacientams:</span> Kadangi laboratorijos retkarčiais koreguoja įkainius nepranešusios, čia pateikiamos kainos yra orientacinės. Kai kurie Gliukozės bei Magnio tyrimų įkainiai Medicina Practica / Rezus pažymėti kaip <span className="underline decoration-[#d4a017]/50 text-[#1a1a1a] font-medium">atnaujinami</span> (gali skirtis ± 0.20-0.40 €). Prieš vykstant į kliniką rekomenduojama patikrinti oficialias nuorodas.
          </p>
        </div>
      </div>
    </header>
  );
}

