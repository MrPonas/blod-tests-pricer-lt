export interface LabPrices {
  anteja: number;
  synlab: number;
  medicinaPractica: number;
  rezus: number;
}

export interface BloodTest {
  id: string;
  name: string; // e.g. "Bendras kraujo tyrimas (BKT)"
  latinName?: string; // e.g. "Hemogram"
  code: string; // e.g. "BKT" or "VITD"
  category: string; // "Sveikatos rinkiniai", "Bendrieji", "Hormonai", "Vitaminai", "Širdis" etc.
  description: string;
  prices: LabPrices;
  isStale?: boolean; // If price matches a warning
  updateDate: string; // "2026-05-01" etc.
  bookingUrls: {
    anteja: string;
    synlab: string;
    medicinaPractica: string;
    rezus: string;
  };
}

export interface PricingTrend {
  date: string; // "2025-11", "2026-01", etc.
  anteja: number;
  synlab: number;
  medicinaPractica: number;
  rezus: number;
}

export interface LabInfo {
  id: keyof LabPrices;
  name: string;
  fullName: string;
  accentColor: string; // Tailwind class like "bg-teal-600" / "text-teal-600"
  textColor: string;
  borderColor: string;
  samplingFee: number; // Mėginio paėmimo mokestis in EUR
  hasServiceFee: boolean; // Ar yra nario mokestis ar pan.
  turnaroundTime: string; // e.g. "1-2 d.d."
  description: string;
  rating: number; // e.g. 4.7
  bookingPlaceholderUrl: string;
}

export interface LabLocation {
  id: string;
  labId: keyof LabPrices;
  city: "Vilnius" | "Kaunas" | "Klaipėda" | "Šiauliai" | "Panevėžys" | "Alytus" | "Marijampolė";
  address: string;
  workingHours: string;
  phone: string;
  mapEmbedUrl?: string;
}
