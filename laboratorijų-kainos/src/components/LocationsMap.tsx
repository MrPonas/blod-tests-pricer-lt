import React, { useState, useMemo } from "react";
import { LAB_LOCATIONS, LABORATORIES } from "../data";
import { MapPin, Clock, Phone, Search, Building2, Compass, ExternalLink } from "lucide-react";

export default function LocationsMap() {
  const [activeCity, setActiveCity] = useState<string>("Vilnius");
  const [filterLab, setFilterLab] = useState<string>("all");
  
  // Available cities in dataset
  const cities = ["Vilnius", "Kaunas", "Klaipėda", "Šiauliai", "Panevėžys"];

  // Filter locations
  const filteredLocations = useMemo(() => {
    return LAB_LOCATIONS.filter((loc) => {
      const cityMatch = loc.city === activeCity;
      const labMatch = filterLab === "all" || loc.labId === filterLab;
      return cityMatch && labMatch;
    });
  }, [activeCity, filterLab]);

  // Find lab assistance
  const getLabIconInfo = (labId: string) => {
    const lab = LABORATORIES.find((l) => l.id === labId);
    return {
      name: lab?.name || labId,
      color: lab?.id === "anteja" ? "bg-[#059669]" : lab?.id === "synlab" ? "bg-blue-600" : lab?.id === "medicinaPractica" ? "bg-teal-600" : "bg-sky-500",
      textColor: lab?.textColor || "text-[#1a1a1a]"
    };
  };

  return (
    <div className="bg-[#fdfdfc] rounded-none border-2 border-[#1a1a1a] p-6 space-y-6 shadow-[4px_4px_0px_0px_#1a1a1a]">
      
      {/* Text heading */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#e5e5e0]">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-[#1a1a1a] text-[#fdfdfc]">
              <MapPin className="w-4 h-4" />
            </span>
            <h3 className="text-xl font-serif italic font-bold text-[#1a1a1a] tracking-tight">Klinikos ir Kraujo Paėmimo Skyriai</h3>
          </div>
          <p className="text-xs text-[#8a8a82] mt-1 font-sans">
            Raskite artimiausią kraujo paėmimo punktą jūsų mieste. Atkreipkite dėmesį, kad tyrimai geriausia atlikti ryte.
          </p>
        </div>

        {/* Lab filter switcher styled with clean mono black look */}
        <div className="flex items-center gap-1 bg-[#f4f4f0] p-1 border border-[#e5e5e0] rounded-none w-fit shrink-0">
          <button
            onClick={() => setFilterLab("all")}
            className={`px-3 py-1.5 text-[10px] uppercase font-mono font-bold rounded-none transition ${
              filterLab === "all" ? "bg-[#1a1a1a] text-white" : "text-[#63635e] hover:text-[#1a1a1a]"
            }`}
          >
            Visos
          </button>
          {LABORATORIES.map((lab) => (
            <button
              key={lab.id}
              onClick={() => setFilterLab(lab.id)}
              className={`px-3 py-1.5 text-[10px] uppercase font-mono font-bold rounded-none transition ${
                filterLab === lab.id ? "bg-[#1a1a1a] text-white" : "text-[#63635e] hover:text-[#1a1a1a]"
              }`}
            >
              {lab.name}
            </button>
          ))}
        </div>
      </div>

      {/* Cities pill-selector - styled as clean tabs */}
      <div className="flex flex-wrap gap-2 border-b border-[#e5e5e0] pb-4">
        {cities.map((city) => (
          <button
            key={city}
            onClick={() => setActiveCity(city)}
            className={`px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider rounded-none transition border ${
              activeCity === city
                ? "bg-[#1a1a1a] text-white border-[#1a1a1a]"
                : "bg-[#fffcf0] text-[#63635e] border-[#e5e5e0] hover:border-[#1a1a1a] hover:text-[#1a1a1a]"
            }`}
          >
            {city}
          </button>
        ))}
      </div>

      {/* Grid of location cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredLocations.length === 0 ? (
          <div className="col-span-full py-12 text-center text-[#8a8a82] text-xs font-serif italic border border-dashed border-[#e5e5e0]">
            Nėra pasirinkto tinklo klinikos taškų mieste {activeCity}.
          </div>
        ) : (
          filteredLocations.map((loc) => {
            const labHelper = getLabIconInfo(loc.labId);
            const mapSearchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${labHelper.name} ${loc.address}`)}`;

            return (
              <div 
                key={loc.id} 
                className="border-2 border-[#1a1a1a] rounded-none p-5 bg-[#fcfcfb] hover:bg-[#fffcf0] transition flex flex-col justify-between space-y-4 shadow-[2px_2px_0px_0px_#e5e5e0]"
              >
                <div className="space-y-4">
                  {/* Badge */}
                  <div className="flex justify-between items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-none ${labHelper.color}`} />
                      <span className="font-mono font-black text-[#1a1a1a] text-xs uppercase tracking-wider">{labHelper.name}</span>
                    </div>
                    <span className="text-[10px] bg-[#f4f4f0] border border-[#e5e5e0] px-2 py-0.5 rounded-none text-[#1a1a1a] font-mono font-bold uppercase">{loc.city}</span>
                  </div>

                  {/* Details */}
                  <div className="space-y-2.5 text-xs font-sans text-[#555550]">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-[#8a8a82] shrink-0 mt-0.5" />
                      <p className="font-bold text-[#1a1a1a] font-mono">{loc.address}</p>
                    </div>

                    <div className="flex items-start gap-2">
                      <Clock className="w-4 h-4 text-[#8a8a82] shrink-0 mt-0.5" />
                      <p>{loc.workingHours}</p>
                    </div>

                    <div className="flex items-start gap-2">
                      <Phone className="w-4 h-4 text-[#8a8a82] shrink-0 mt-0.5" />
                      <p className="font-mono">{loc.phone}</p>
                    </div>
                  </div>
                </div>

                {/* Direct Google maps redirect link */}
                <div className="pt-3 border-t border-[#e5e5e0] flex items-center justify-between text-xs font-mono">
                  <span className="text-[#8a8a82] text-[9.5px] uppercase">Rekomenduojame registruotis</span>
                  <a
                    href={mapSearchUrl}
                    target="_blank"
                    referrerPolicy="no-referrer"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-extrabold text-[#059669] hover:underline uppercase text-[10.5px]"
                  >
                    Maršrutas&nbsp;&rarr;
                  </a>
                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
