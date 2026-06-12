import React, { useState } from "react";
import Header from "./components/Header";
import ComparisonTable from "./components/ComparisonTable";
import TestCart from "./components/TestCart";
import PriceTrends from "./components/PriceTrends";
import LocationsMap from "./components/LocationsMap";
import { BLOOD_TESTS, CATEGORIES, LABORATORIES } from "./data";
import { 
  Activity, 
  ShoppingCart, 
  MapPin, 
  TrendingUp, 
  FileText, 
  Info, 
  Sparkles, 
  X, 
  HeartHandshake,
  Check,
  ChevronRight,
  AlertCircle
} from "lucide-react";

export default function App() {
  // Navigation State
  // "comparison" | "cart" | "trends" | "locations"
  const [activeTab, setActiveTab] = useState<"comparison" | "cart" | "trends" | "locations">("comparison");

  // Shopping Cart / Basket State: Stores BloodTest IDs
  const [cartItems, setCartItems] = useState<string[]>(["indiv-vitd", "indiv-bkt"]); // defaults pre-populated for a rich first-load experience!

  // Visible laboratories state for future-proofing comparison dynamic counts
  const [visibleLabs, setVisibleLabs] = useState<string[]>(() =>
    LABORATORIES.map((lab) => lab.id)
  );

  const handleToggleLab = (labId: string) => {
    setVisibleLabs((prev) => {
      if (prev.includes(labId)) {
        if (prev.length <= 1) return prev; // Prevent deselecting all laboratories
        return prev.filter((id) => id !== labId);
      } else {
        return [...prev, labId];
      }
    });
  };

  // Toggle single item from cart
  const handleToggleCart = (id: string) => {
    setCartItems(prev => {
      if (prev.includes(id)) {
        return prev.filter(item => item !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  // Remove single item from cart explicitly
  const handleRemoveItem = (id: string) => {
    setCartItems(prev => prev.filter(item => item !== id));
  };

  // Clear cart
  const handleClearCart = () => {
    setCartItems([]);
  };

  // Compute a live savings callout tip for the landing home page promo banner
  // Let's find Vitamin D (extremely popular in Lithuania)
  const vitDTest = BLOOD_TESTS.find(t => t.id === "indiv-vitd");
  const bktTest = BLOOD_TESTS.find(t => t.id === "indiv-bkt");

  return (
    <div className="min-h-screen bg-[#fdfdfc] flex flex-col font-sans text-[#1a1a1a] selection:bg-[#ecfdf5]">
      
      {/* Top Header with live counts */}
      <Header totalTestsCount={BLOOD_TESTS.length} />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 space-y-8 w-full">
        
        {/* Dynamic Promo Recommendation / Savings Callout Bar styled in high contrast editorial fashion */}
        <div className="border-2 border-[#1a1a1a] rounded-none p-6 text-[#1a1a1a] bg-[#fffcf0] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-[4px_4px_0px_0px_#1a1a1a] relative overflow-hidden transition-all duration-200">
          <div className="flex items-start md:items-center gap-3.5 relative">
            <div className="p-2.5 bg-[#1a1a1a] text-[#fffcf0] rounded-none flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div className="space-y-1">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#1a1a1a] font-mono">
                Sumanios sveikatos patarimas • Lietuvos Rinka
              </h4>
              <p className="text-sm text-[#3a3a35] font-sans leading-relaxed">
                Šį mėnesį <span className="underline decoration-2 decoration-[#059669] font-bold text-[#1a1a1a]">Vitaminas D</span> pigiausias yra <span className="font-semibold text-[#1a1a1a]">Rezus.lt (19.50 €)</span> ir <span className="font-semibold text-[#1a1a1a]">Medicina Practica (19.90 €)</span>. Brangesnis Synlab (24.50 €). Sutaupykite net <span className="font-bold underline text-[#059669] font-serif italic text-base">5.00 €</span> kiekviename tyrime!
              </p>
            </div>
          </div>

          <button 
            onClick={() => {
              setActiveTab("comparison");
            }}
            className="text-xs font-bold px-5 py-3 bg-[#1a1a1a] text-white hover:bg-[#333] hover:-translate-y-0.5 active:translate-y-0 text-white rounded-none shadow-[2px_2px_0px_0px_#8a8a82] shrink-0 self-start md:self-auto transition-all flex items-center gap-1.5 cursor-pointer uppercase tracking-wider"
          >
            Palyginti kainas
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Navigation Tabs bar - Styled as editorial column header dividers */}
        <div className="flex xl:flex-row flex-col xl:items-center justify-between gap-4 border-b-2 border-[#1a1a1a] pb-3">
          <div className="flex flex-wrap gap-2">
            
            <button
              onClick={() => setActiveTab("comparison")}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold tracking-wider uppercase transition shrink-0 cursor-pointer rounded-none border-t border-x ${
                activeTab === "comparison"
                  ? "bg-[#1a1a1a] text-white border-[#1a1a1a]"
                  : "bg-white hover:bg-[#f4f4f0] border-[#e5e5e0] text-[#63635e] hover:text-[#1a1a1a]"
              }`}
            >
              <FileText className="w-4 h-4" />
              Tyrimų kainų palyginimas
            </button>

            <button
              onClick={() => setActiveTab("cart")}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold tracking-wider uppercase transition shrink-0 relative cursor-pointer rounded-none border-t border-x ${
                activeTab === "cart"
                  ? "bg-[#1a1a1a] text-white border-[#1a1a1a]"
                  : "bg-white hover:bg-[#f4f4f0] border-[#e5e5e0] text-[#63635e] hover:text-[#1a1a1a]"
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              Krepšelio analizė
              {cartItems.length > 0 && (
                <span className={`px-2 py-0.5 rounded-none text-[10px] font-mono font-bold ${
                  activeTab === "cart" ? "bg-[#fffcf0] text-[#1a1a1a]" : "bg-[#059669] text-white"
                }`}>
                  {cartItems.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("trends")}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold tracking-wider uppercase transition shrink-0 cursor-pointer rounded-none border-t border-x ${
                activeTab === "trends"
                  ? "bg-[#1a1a1a] text-white border-[#1a1a1a]"
                  : "bg-white hover:bg-[#f4f4f0] border-[#e5e5e0] text-[#63635e] hover:text-[#1a1a1a]"
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              Kainų tendencijos
            </button>

            <button
              onClick={() => setActiveTab("locations")}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold tracking-wider uppercase transition shrink-0 cursor-pointer rounded-none border-t border-x ${
                activeTab === "locations"
                  ? "bg-[#1a1a1a] text-white border-[#1a1a1a]"
                  : "bg-white hover:bg-[#f4f4f0] border-[#e5e5e0] text-[#63635e] hover:text-[#1a1a1a]"
              }`}
            >
              <MapPin className="w-4 h-4" />
              Klinikų adresai
            </button>

          </div>

          <div className="text-[11px] font-mono uppercase text-[#8a8a82] shrink-0 tracking-wider">
            Kainos nurodytos su PVM • Laboratorijos nepriklausomos
          </div>
        </div>

        {/* Active Tab View Rendering */}
        <div className="min-h-[450px]">
          {activeTab === "comparison" && (
            <ComparisonTable 
              bloodTests={BLOOD_TESTS} 
              categories={CATEGORIES}
              cartItems={cartItems}
              visibleLabs={visibleLabs}
              onToggleLab={handleToggleLab}
              onToggleCart={handleToggleCart}
              onNavigateToCart={() => setActiveTab("cart")}
              onSetCartItems={setCartItems}
            />
          )}

          {activeTab === "cart" && (
            <TestCart
              cartItems={cartItems}
              bloodTests={BLOOD_TESTS}
              visibleLabs={visibleLabs}
              onRemoveItem={handleRemoveItem}
              onClearCart={handleClearCart}
              onNavigateToComparison={() => setActiveTab("comparison")}
            />
          )}

          {activeTab === "trends" && (
            <PriceTrends visibleLabs={visibleLabs} />
          )}

          {activeTab === "locations" && (
            <LocationsMap />
          )}
        </div>

        {/* FAQ & Information about Labs in Lithuania */}
        <div className="bg-[#fcfcfb] border border-[#e5e5e0] rounded-none p-7 space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-[#e5e5e0]">
            <span className="p-1.5 bg-[#1a1a1a] text-white">
              <HeartHandshake className="w-4 h-4 shrink-0" />
            </span>
            <h3 className="text-lg font-serif italic text-[#1a1a1a] tracking-tight">DUK ir svarbi pagalba pacientui</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-xs leading-relaxed text-[#555550]">
            <div className="space-y-2">
              <h4 className="font-bold text-[#1a1a1a] text-sm font-sans">1. Kada geriausia atvykti kraujo tyrimui?</h4>
              <p className="font-sans">
                Kraują priduoti rekomenduojama ryte (nuo 7:00 iki 11:00 val.), nevalgius 8–12 valandų prieš procedūrą. Kavą, arbatą ir kitus gėrimus ryte patariama pakeisti švariu paprastu vandeniu, kad laboratoriniai tyrimų rodikliai išliktų kuo tikslesni.
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-bold text-[#1a1a1a] text-sm font-sans">2. Kas yra kraujo paėmimo mokestis?</h4>
              <p className="font-sans">
                Tai vienkartinis mokestis (svyruoja nuo 2.00 € iki 3.00 €), kurį laboratorijos nuskaito už vakuuminės sistemos adatą, slaugytojos darbą ir pirminį mėginio paruošimą. Mūsų portalo „Krepšelio analizėje“ šis mokestis pridedamas automatiškai prie bendros sumos!
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-bold text-[#1a1a1a] text-sm font-sans">3. Ar tyrimus sujungus į rinkinį gaunama nuolaida?</h4>
              <p className="font-sans">
                Taip, be abejonės! Pasirinkus išsamius profilaktinius rinkinius (pvz. moters ar vyro sveikatą, skydliaukės tyrimus), tyrimų įkainiai gaunasi iki 30-50% palankesni lyginant su užsakymu pavieniui. Sveikatos tikrinimo paketas yra pranašesnis pasirinkimas.
              </p>
            </div>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="bg-[#1a1a1a] text-[#8a8a82] border-t border-[#e5e5e0] py-12 mt-16 font-sans">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-xs">
            <div className="flex items-center gap-2.5">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#059669]"></span>
              </span>
              <p className="text-slate-300 font-medium font-sans">
                Sukurta Lietuvai • Nepriklausomas kraujo tyrimų kainų gidų projektas „Laboratorijų Kainos“.
              </p>
            </div>
            <p className="text-slate-400 font-mono text-[10px] tracking-wide">
              PASKUTINĖ PATIKRA: 2026 M. GEGUŽĖ • duomenų nepriklausomumas
            </p>
          </div>
          <p className="text-[11px] text-[#8a8a82]/80 border-t border-zinc-800 pt-5 leading-relaxed font-sans">
            Portalo organizuojama informacija neteikia medicininių konsultacijų ar oficialių rekomendacijų gydymui. Dėl tyrimo paskyrimo, asmeninės tyrimų programos sudarymo bei gautų rezultatų dešifravimo visada privaloma pasikonsultuoti su savo šeimos gydytoju. Pavadinimai „Antėja“, „Synlab“, „Medicina Practica“ bei „Rezus“ priklauso jų oficialiems savininkams ir naudojami informavimo tikslais.
          </p>
        </div>
      </footer>

      {/* Floating Bottom Cart Counter Action badge */}
      {cartItems.length > 0 && activeTab !== "cart" && (
        <button
          onClick={() => setActiveTab("cart")}
          className="fixed bottom-6 right-6 bg-[#059669] hover:bg-[#047857] text-[#fffcf0] font-bold text-xs p-4 px-6 rounded-none shadow-[4px_4px_0px_0px_#1a1a1a] flex items-center gap-2 border-2 border-[#1a1a1a] z-50 transition-all cursor-pointer transform hover:scale-102"
        >
          <ShoppingCart className="w-4 h-4" />
          <span className="uppercase tracking-wider">Krepšelis ({cartItems.length})</span>
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
        </button>
      )}

    </div>
  );
}
