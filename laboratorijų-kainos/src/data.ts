import { BloodTest, LabInfo, LabLocation, PricingTrend } from "./types";

export const LABORATORIES: LabInfo[] = [
  {
    id: "anteja",
    name: "Antėja",
    fullName: "Antėja Kraujo Tyrimai (Diagnostikos centras)",
    accentColor: "bg-emerald-600",
    textColor: "text-emerald-700",
    borderColor: "border-emerald-200",
    samplingFee: 2.50,
    hasServiceFee: false,
    turnaroundTime: "1-2 d.d.",
    description: "Viena didžiausių laboratorijų Lietuvoje, turinti platų filialų tinklą ir greitą aptarnavimą.",
    rating: 4.8,
    bookingPlaceholderUrl: "https://anteja.lt/tyrimu-krepselis"
  },
  {
    id: "synlab",
    name: "Synlab",
    fullName: "Synlab Lietuva (Tarptautinis laboratorijų tinklas)",
    accentColor: "bg-blue-600",
    textColor: "text-blue-700",
    borderColor: "border-blue-200",
    samplingFee: 3.00,
    hasServiceFee: false,
    turnaroundTime: "1 d.d. (sudėtingesniems 3-5 d.d.)",
    description: "Tarptautinė Vokietijos kapitalo laboratorija, garsėjanti itin aukšta kokybe ir rečiausiais tyrimais.",
    rating: 4.7,
    bookingPlaceholderUrl: "https://www.synlab.lt/e-parduotuve/"
  },
  {
    id: "medicinaPractica",
    name: "Medicina Practica",
    fullName: "Medicina Practica laboratorija",
    accentColor: "bg-teal-600",
    textColor: "text-teal-700",
    borderColor: "border-teal-200",
    samplingFee: 2.20,
    hasServiceFee: false,
    turnaroundTime: "1-2 d.d.",
    description: "Šilto, dėmesingo aptarnavimo tinklas, dažnai siūlantis itin patrauklias sezonines nuolaidas rinkiniams.",
    rating: 4.6,
    bookingPlaceholderUrl: "https://medicinapractica.lt/registracija/"
  },
  {
    id: "rezus",
    name: "Rezus.lt",
    fullName: "Rezus.lt tyrimų laboratorija",
    accentColor: "bg-sky-600",
    textColor: "text-sky-700",
    borderColor: "border-sky-200",
    samplingFee: 2.00,
    hasServiceFee: false,
    turnaroundTime: "1-2 d.d.",
    description: "Greitai augantis laboratorijų tinklas, siūlantis labai konkurencingas kainas ir draugišką aplinką.",
    rating: 4.5,
    bookingPlaceholderUrl: "https://rezus.lt/registracija"
  }
];

export const CATEGORIES = [
  { id: "all", name: "Visi tyrimai ir rinkiniai" },
  { id: "rinkiniai", name: "Sveikatos rinkiniai (Profilaktiniai)" },
  { id: "bendrieji", name: "Bendrieji & Biocheminiai" },
  { id: "skydliauke", name: "Skydliaukės tyrimai" },
  { id: "vitaminai", name: "Vitaminai & Mineralai" },
  { id: "sirdis", name: "Širdis & Kraujotaka" },
  { id: "kepenys-inkstai", name: "Kepenys & Inkstai" },
];

export const BLOOD_TESTS: BloodTest[] = [
  // 1. RINKINIAI
  {
    id: "rink-moteris-mini",
    name: "Moters Profilaktinis Mini rinkinys",
    latinName: "Mulieris Elementum",
    code: "RINK-M-MINI",
    category: "rinkiniai",
    description: "Būtiniausių kraujo tyrimų paketas moters sveikatos būklei įvertinti (12 tyrimų: BKT, TTH, gliukozė, cholesterolis, kalis, feritinas ir kt.).",
    prices: {
      anteja: 35.00,
      synlab: 38.50,
      medicinaPractica: 33.90,
      rezus: 32.00
    },
    updateDate: "2026-05-15",
    bookingUrls: {
      anteja: "https://anteja.lt/tyrimu-krepselis?p=moters-mini-rinkinys",
      synlab: "https://www.synlab.lt/e-parduotuve?p=moters-mini-rinkinys",
      medicinaPractica: "https://medicinapractica.lt/registracija?r=moters-mini",
      rezus: "https://rezus.lt/registracija?r=moters-mini"
    }
  },
  {
    id: "rink-moteris-max",
    name: "Moters Sveikatos Rinkinys (Išsamus)",
    latinName: "Mulieris Plenum",
    code: "RINK-M-MAX",
    category: "rinkiniai",
    description: "Itin išsamus 28 kraujo tyrimų paketas moterims. Apima kepenų, inkstų veiklą, skydliaukę, uždegimus, anemiją, vitaminą D, elektrolitus ir lytinius hormonus.",
    prices: {
      anteja: 98.00,
      synlab: 104.00,
      medicinaPractica: 95.00,
      rezus: 91.50
    },
    updateDate: "2026-05-18",
    bookingUrls: {
      anteja: "https://anteja.lt/tyrimu-krepselis?p=moters-max-rinkinys",
      synlab: "https://www.synlab.lt/e-parduotuve?p=moters-max-rinkinys",
      medicinaPractica: "https://medicinapractica.lt/registracija?r=moters-max",
      rezus: "https://rezus.lt/registracija?r=moters-max"
    }
  },
  {
    id: "rink-vyras-mini",
    name: "Vyro Profilaktinis Mini rinkinys",
    latinName: "Viris Elementum",
    code: "RINK-V-MINI",
    category: "rinkiniai",
    description: "Svarbiausių 11 kraujo tyrimų paketas vyro sveikatos profilaktikai, kepenų būklei, cholesterolio lygiui bei PSA (prostatos) markerio įvertinimui.",
    prices: {
      anteja: 36.50,
      synlab: 39.00,
      medicinaPractica: 34.00,
      rezus: 33.00
    },
    updateDate: "2026-05-15",
    bookingUrls: {
      anteja: "https://anteja.lt/tyrimu-krepselis?p=vyro-mini-rinkinys",
      synlab: "https://www.synlab.lt/e-parduotuve?p=vyro-mini-rinkinys",
      medicinaPractica: "https://medicinapractica.lt/registracija?r=vyro-mini",
      rezus: "https://rezus.lt/registracija?r=vyro-mini"
    }
  },
  {
    id: "rink-vyras-max",
    name: "Vyro Sveikatos Rinkinys (Išsamus)",
    latinName: "Viris Plenum",
    code: "RINK-V-MAX",
    category: "rinkiniai",
    description: "Pilnas vyro organizmo ištyrimas (26 tyrimai). Gliukozės, skydliaukės, širdies ir kraujagyslių rizikos vertinimas, kepenų, inkstų fermentai, testosteronas, PSA, vitaminas D.",
    prices: {
      anteja: 102.00,
      synlab: 109.00,
      medicinaPractica: 99.00,
      rezus: 94.00
    },
    updateDate: "2026-05-18",
    bookingUrls: {
      anteja: "https://anteja.lt/tyrimu-krepselis?p=vyro-max-rinkinys",
      synlab: "https://www.synlab.lt/e-parduotuve?p=vyro-max-rinkinys",
      medicinaPractica: "https://medicinapractica.lt/registracija?r=vyro-max",
      rezus: "https://rezus.lt/registracija?r=vyro-max"
    }
  },
  {
    id: "rink-skydliauke-max",
    name: "Išsamus Skydliaukės Ištyrimas (Kombinuotas)",
    latinName: "Glandula Thyreoidea Profilis",
    code: "RINK-SKYDL",
    category: "skydliauke",
    description: "Pilnas pagrindinių skydliaukės žymenų kompleksas: TTH (TSH), laisvas tiroksinas (FT4), laisvas trijodtironinas (FT3) bei antikūnai prieš skydliaukės peroksidazę (ATPO). Enkapsuliuoja skydliaukės autoimunines ligas.",
    prices: {
      anteja: 32.00,
      synlab: 34.50,
      medicinaPractica: 29.90,
      rezus: 31.00
    },
    updateDate: "2026-05-20",
    bookingUrls: {
      anteja: "https://anteja.lt/tyrimu-krepselis?p=skydliaukes-rinkinys",
      synlab: "https://www.synlab.lt/e-parduotuve?p=skydliaukes-rinkinys",
      medicinaPractica: "https://medicinapractica.lt/registracija?r=skydliauke",
      rezus: "https://rezus.lt/registracija?r=skydliauke"
    }
  },

  // 2. BENDRIEJI IR BIOCHEMINIAI
  {
    id: "indiv-bkt",
    name: "Bendras kraujo tyrimas (BKT) penkių dalių diferencijavimas",
    latinName: "Hemogram (5-part diff)",
    code: "BKT",
    category: "bendrieji",
    description: "Pagrindinis tyrimas, parodantis bendrą organizmo būklę, parodo anemiją (mažakraujystę), infekcijos ar uždegimo požymius, kraujo krešėjimo ląsteles.",
    prices: {
      anteja: 6.90,
      synlab: 7.50,
      medicinaPractica: 6.20,
      rezus: 6.00
    },
    updateDate: "2026-05-24",
    bookingUrls: {
      anteja: "https://anteja.lt/bkt-tyrimas",
      synlab: "https://www.synlab.lt/bkt",
      medicinaPractica: "https://medicinapractica.lt/bkt-tyrimai",
      rezus: "https://rezus.lt/bkt"
    }
  },
  {
    id: "indiv-crb",
    name: "C-reaktyvus baltymas (CRB)",
    latinName: "CRP (C-Reactive Protein)",
    code: "CRB",
    category: "bendrieji",
    description: "Ypatingai tikslus ir greitas organizmo infekcijos arba uždegimo markeris. Padeda diferencijuoti virusтельную (virusinę) infekciją nuo bakterinės.",
    prices: {
      anteja: 7.20,
      synlab: 8.50,
      medicinaPractica: 6.80,
      rezus: 6.50
    },
    updateDate: "2026-05-23",
    bookingUrls: {
      anteja: "https://anteja.lt/crb-tyrimas",
      synlab: "https://www.synlab.lt/crb",
      medicinaPractica: "https://medicinapractica.lt/crb",
      rezus: "https://rezus.lt/crb"
    }
  },
  {
    id: "indiv-gliukoze",
    name: "Gliukozės koncentracija serume / plazmoje",
    latinName: "Glucose (GLU)",
    code: "GLU",
    category: "bendrieji",
    description: "Pirminis tyrimas cukriniam diabetui arba hipoglikemijai diagnozuoti bei cukraus kiekiui kraujyje stebėti.",
    prices: {
      anteja: 2.80,
      synlab: 3.20,
      medicinaPractica: 2.40,
      rezus: 2.20
    },
    updateDate: "2026-04-15", // Older data warning candidate
    isStale: true,
    bookingUrls: {
      anteja: "https://anteja.lt/gliukoze-tyrimas",
      synlab: "https://www.synlab.lt/gliukoze",
      medicinaPractica: "https://medicinapractica.lt/gliukoze",
      rezus: "https://rezus.lt/gliukoze"
    }
  },
  {
    id: "indiv-hba1c",
    name: "Glikozilintas hemoglobinas (HbA1c)",
    latinName: "Hemoglobin A1c",
    code: "HBA1C",
    category: "bendrieji",
    description: "Parodo vidutinį gliukozės kiekį kraujyje per pastaruosius 2-3 mėnesius. Itin svarbus diabeto kontrolei.",
    prices: {
      anteja: 12.50,
      synlab: 14.00,
      medicinaPractica: 11.90,
      rezus: 11.00
    },
    updateDate: "2026-05-22",
    bookingUrls: {
      anteja: "https://anteja.lt/hba1c",
      synlab: "https://www.synlab.lt/hba1c",
      medicinaPractica: "https://medicinapractica.lt/hba1c",
      rezus: "https://rezus.lt/hba1c"
    }
  },

  // 3. SKYDLIAUKE
  {
    id: "indiv-tth",
    name: "Tirotropinas (TTH / TSH)",
    latinName: "TSH (Thyrotropin)",
    code: "TTH",
    category: "skydliauke",
    description: "Pagrindinis skydliaukės veiklos reguliavimo hormonas, gaminamas pagumburyje. Skiriamas skydliaukės hiperfunkcijai (suaktyvėjimui) ar hipofunkcijai (nusilpimui) nustatyti.",
    prices: {
      anteja: 8.50,
      synlab: 9.30,
      medicinaPractica: 7.90,
      rezus: 8.00
    },
    updateDate: "2026-05-21",
    bookingUrls: {
      anteja: "https://anteja.lt/tth",
      synlab: "https://www.synlab.lt/tth",
      medicinaPractica: "https://medicinapractica.lt/tth",
      rezus: "https://rezus.lt/tth"
    }
  },
  {
    id: "indiv-ft4",
    name: "Laisvas tiroksinas (FT4 / LT4)",
    latinName: "Free Thyroxine",
    code: "FT4",
    category: "skydliauke",
    description: "Skydliaukės hormonas. Pagrindinis skydliaukės funkcijos sutrikimų gylį nustatantis tyrimas, atliekamas kartu su TTH tyrimu.",
    prices: {
      anteja: 9.20,
      synlab: 9.90,
      medicinaPractica: 8.80,
      rezus: 8.50
    },
    updateDate: "2026-05-21",
    bookingUrls: {
      anteja: "https://anteja.lt/ft4",
      synlab: "https://www.synlab.lt/ft4",
      medicinaPractica: "https://medicinapractica.lt/ft4",
      rezus: "https://rezus.lt/ft4"
    }
  },
  {
    id: "indiv-atpo",
    name: "Antikūnai prieš skydliaukės peroksidazę (ATPO)",
    latinName: "Anti-TPO",
    code: "ATPO",
    category: "skydliauke",
    description: "Autoimuninio skydliaukės uždegimo (pvz., Hašimoto tiroidito) pagrindinis diagnostinis žymuo kraujyje.",
    prices: {
      anteja: 14.50,
      synlab: 15.80,
      medicinaPractica: 13.90,
      rezus: 14.00
    },
    updateDate: "2026-05-20",
    bookingUrls: {
      anteja: "https://anteja.lt/atpo",
      synlab: "https://www.synlab.lt/atpo",
      medicinaPractica: "https://medicinapractica.lt/atpo",
      rezus: "https://rezus.lt/atpo"
    }
  },

  // 4. VITAMINAI IR MINERALAI
  {
    id: "indiv-vitd",
    name: "Vitaminas D (25-hidroksivitaminas D)",
    latinName: "25-OH Vitamin D",
    code: "VITD",
    category: "vitaminai",
    description: "Svarbus kaulų būklei, dantims, imunitetui ir nuotaikos reguliavimui. Daugumai lietuvių nustatomas didelis šio vitamino deficitas, todėl tyrimas yra itin populiarus.",
    prices: {
      anteja: 21.00,
      synlab: 24.50,
      medicinaPractica: 19.90,
      rezus: 19.50
    },
    updateDate: "2026-05-24",
    bookingUrls: {
      anteja: "https://anteja.lt/vitaminas-d",
      synlab: "https://www.synlab.lt/vitaminas-d",
      medicinaPractica: "https://medicinapractica.lt/vitaminas-d",
      rezus: "https://rezus.lt/vitaminas-d"
    }
  },
  {
    id: "indiv-vitb12",
    name: "Aktyvus Vitaminas B12 (Holotranskobalaminas)",
    latinName: "Active Vitamin B12",
    code: "VITB12",
    category: "vitaminai",
    description: "Svarbus kraujodarai ir nervų sistemos veiklai palaikyti. Rekomenduojamas vegetarams, veganams ar esant nepaaiškinamam dideliam nuovargiui.",
    prices: {
      anteja: 18.00,
      synlab: 19.50,
      medicinaPractica: 17.50,
      rezus: 17.00
    },
    updateDate: "2026-05-15",
    bookingUrls: {
      anteja: "https://anteja.lt/aktyvus-vitaminas-b12",
      synlab: "https://www.synlab.lt/b12",
      medicinaPractica: "https://medicinapractica.lt/b12",
      rezus: "https://rezus.lt/b12"
    }
  },
  {
    id: "indiv-feritinas",
    name: "Feritinas (Geležies atsargų tyrimas)",
    latinName: "Ferritin",
    code: "FER",
    category: "vitaminai",
    description: "Atspindi tikrąsias geležies atsargas organizme (depo). Padeda nustatyti anemijos pradžią dar prieš nukrentant hemoglobinui.",
    prices: {
      anteja: 11.20,
      synlab: 12.80,
      medicinaPractica: 10.50,
      rezus: 10.00
    },
    updateDate: "2026-05-22",
    bookingUrls: {
      anteja: "https://anteja.lt/feritinas",
      synlab: "https://www.synlab.lt/feritinas",
      medicinaPractica: "https://medicinapractica.lt/feritinas",
      rezus: "https://rezus.lt/feritinas"
    }
  },
  {
    id: "indiv-magnis",
    name: "Magnis (Mg) serume",
    latinName: "Magnesium",
    code: "MG",
    category: "vitaminai",
    description: "Reguliuoja raumenų bei nervinių impulsų perdavimą. Trūkumas sukelia spazmus, raumenų drebėjimą ar širdies ritmo sutrikimus.",
    prices: {
      anteja: 3.20,
      synlab: 3.90,
      medicinaPractica: 2.80,
      rezus: 2.50
    },
    updateDate: "2026-04-10",
    isStale: true,
    bookingUrls: {
      anteja: "https://anteja.lt/magnis",
      synlab: "https://www.synlab.lt/magnis",
      medicinaPractica: "https://medicinapractica.lt/magnis",
      rezus: "https://rezus.lt/magnis"
    }
  },

  // 5. ŠIRDIS IR KRAUJOTAKA
  {
    id: "indiv-chol-bendras",
    name: "Bendrasis cholesterolis",
    latinName: "Total Cholesterol",
    code: "CHOL",
    category: "sirdis",
    description: "Širdies ir kraujagyslių ligų (aterosklerozės, infarkto) rizikos nustatymo rodiklis kraujyje.",
    prices: {
      anteja: 2.90,
      synlab: 3.40,
      medicinaPractica: 2.50,
      rezus: 2.30
    },
    updateDate: "2026-05-19",
    bookingUrls: {
      anteja: "https://anteja.lt/bendrasis-cholesterolis",
      synlab: "https://www.synlab.lt/cholesterolis",
      medicinaPractica: "https://medicinapractica.lt/cholesterolis",
      rezus: "https://rezus.lt/cholesterolis"
    }
  },
  {
    id: "indiv-lipidograma",
    name: "Lipidų profilis / Lipidograma (4 tyrimai)",
    latinName: "Lipid Panel",
    code: "LIPID",
    category: "sirdis",
    description: "Išsamus riebalų tyrimas, kurį sudaro 4 rodikliai: bendrasis, DTL (gerasis), MTL (blogasis) cholesteroliai bei trigliceridai.",
    prices: {
      anteja: 11.50,
      synlab: 12.80,
      medicinaPractica: 10.00,
      rezus: 9.50
    },
    updateDate: "2026-05-19",
    bookingUrls: {
      anteja: "https://anteja.lt/lipidograma-rinkinys",
      synlab: "https://www.synlab.lt/lipidograma",
      medicinaPractica: "https://medicinapractica.lt/lipidograma-tyrimai",
      rezus: "https://rezus.lt/lipidograma"
    }
  },

  // 6. KEPENYS IR INKSTAI
  {
    id: "indiv-alat",
    name: "Alanininė aminotransferazė (ALAT / ALT)",
    latinName: "ALT (GPT)",
    code: "ALAT",
    category: "kepenys-inkstai",
    description: "Svarbus kepenų pažeidimo fermentas. Pagreitėjęs nuotėkis į kraują indikuoja kepenų ląstelių irimą.",
    prices: {
      anteja: 3.80,
      synlab: 4.20,
      medicinaPractica: 3.30,
      rezus: 3.00
    },
    updateDate: "2026-05-10",
    bookingUrls: {
      anteja: "https://anteja.lt/alat-tyrimas",
      synlab: "https://www.synlab.lt/alat",
      medicinaPractica: "https://medicinapractica.lt/alat",
      rezus: "https://rezus.lt/alat"
    }
  },
  {
    id: "indiv-asat",
    name: "Aspartatinė aminotransferazė (ASAT / AST)",
    latinName: "AST (GOT)",
    code: "ASAT",
    category: "kepenys-inkstai",
    description: "Kepenų ir širdies raumens fermentas, kurio gausu ląstelėse. Atliekamas kartu su ALAT.",
    prices: {
      anteja: 3.80,
      synlab: 4.20,
      medicinaPractica: 3.30,
      rezus: 3.00
    },
    updateDate: "2026-05-10",
    bookingUrls: {
      anteja: "https://anteja.lt/asat-tyrimas",
      synlab: "https://www.synlab.lt/asat",
      medicinaPractica: "https://medicinapractica.lt/asat",
      rezus: "https://rezus.lt/asat"
    }
  },
  {
    id: "indiv-kreatininas",
    name: "Kreatininas kraujyje (+ GFKI skaičiavimas)",
    latinName: "Creatinine & eGFR",
    code: "CREA",
    category: "kepenys-inkstai",
    description: "Inkstų veiklos pagrindinis rodiklis filtracijos pajėgumams (GFKI) įvertinti.",
    prices: {
      anteja: 4.20,
      synlab: 4.80,
      medicinaPractica: 3.90,
      rezus: 3.50
    },
    updateDate: "2026-05-08",
    bookingUrls: {
      anteja: "https://anteja.lt/kreatininas",
      synlab: "https://www.synlab.lt/kreatininas",
      medicinaPractica: "https://medicinapractica.lt/kreatininas",
      rezus: "https://rezus.lt/kreatininas"
    }
  }
];

export const PRICING_TRENDS: Record<string, PricingTrend[]> = {
  "indiv-vitd": [
    { date: "2025-06", anteja: 19.50, synlab: 23.00, medicinaPractica: 18.90, rezus: 18.00 },
    { date: "2025-09", anteja: 19.90, synlab: 23.50, medicinaPractica: 18.90, rezus: 18.50 },
    { date: "2025-12", anteja: 21.00, synlab: 24.50, medicinaPractica: 19.90, rezus: 19.00 },
    { date: "2026-03", anteja: 21.00, synlab: 24.50, medicinaPractica: 19.90, rezus: 19.50 },
    { date: "2026-05", anteja: 21.00, synlab: 24.50, medicinaPractica: 19.90, rezus: 19.50 },
  ],
  "indiv-bkt": [
    { date: "2025-06", anteja: 6.50, synlab: 6.90, medicinaPractica: 5.90, rezus: 5.50 },
    { date: "2025-09", anteja: 6.50, synlab: 7.20, medicinaPractica: 6.00, rezus: 5.70 },
    { date: "2025-12", anteja: 6.90, synlab: 7.50, medicinaPractica: 6.20, rezus: 5.90 },
    { date: "2026-03", anteja: 6.90, synlab: 7.50, medicinaPractica: 6.20, rezus: 6.00 },
    { date: "2026-05", anteja: 6.90, synlab: 7.50, medicinaPractica: 6.20, rezus: 6.00 },
  ],
  "indiv-crb": [
    { date: "2025-06", anteja: 6.80, synlab: 8.00, medicinaPractica: 6.40, rezus: 6.20 },
    { date: "2025-09", anteja: 7.00, synlab: 8.20, medicinaPractica: 6.60, rezus: 6.40 },
    { date: "2025-12", anteja: 7.20, synlab: 8.50, medicinaPractica: 6.80, rezus: 6.50 },
    { date: "2026-03", anteja: 7.20, synlab: 8.50, medicinaPractica: 6.80, rezus: 6.50 },
    { date: "2026-05", anteja: 7.20, synlab: 8.50, medicinaPractica: 6.80, rezus: 6.50 },
  ],
  "rink-moteris-mini": [
    { date: "2025-06", anteja: 33.00, synlab: 36.00, medicinaPractica: 32.00, rezus: 29.90 },
    { date: "2025-09", anteja: 34.00, synlab: 37.00, medicinaPractica: 33.00, rezus: 31.00 },
    { date: "2025-12", anteja: 35.00, synlab: 38.50, medicinaPractica: 33.90, rezus: 32.00 },
    { date: "2026-03", anteja: 35.00, synlab: 38.50, medicinaPractica: 33.90, rezus: 32.00 },
    { date: "2026-05", anteja: 35.00, synlab: 38.50, medicinaPractica: 33.90, rezus: 32.00 },
  ]
};

export const LAB_LOCATIONS: LabLocation[] = [
  // VILNIUS
  {
    id: "loc-ant-v1",
    labId: "anteja",
    city: "Vilnius",
    address: "Laisvės pr. 79D, Vilnius",
    workingHours: "I-V 7:00-19:00, VI 8:00-14:00",
    phone: "+370 700 55511"
  },
  {
    id: "loc-ant-v2",
    labId: "anteja",
    city: "Vilnius",
    address: "Savanorių pr. 139A, Vilnius",
    workingHours: "I-V 7:30-16:00",
    phone: "+370 700 55511"
  },
  {
    id: "loc-syn-v1",
    labId: "synlab",
    city: "Vilnius",
    address: "Kalvarijų g. 137A, Vilnius",
    workingHours: "I-V 7:30-15:30",
    phone: "+370 5 248 7755"
  },
  {
    id: "loc-med-v1",
    labId: "medicinaPractica",
    city: "Vilnius",
    address: "Vytenio g. 59, Vilnius",
    workingHours: "I-V 7:00-15:00",
    phone: "+370 5 250 1711"
  },
  {
    id: "loc-rez-v1",
    labId: "rezus",
    city: "Vilnius",
    address: "Antakalnio g. 42, Vilnius",
    workingHours: "I-V 7:30-15:00, VI 8:00-12:00",
    phone: "+370 604 12111"
  },

  // KAUNAS
  {
    id: "loc-ant-k1",
    labId: "anteja",
    city: "Kaunas",
    address: "Savanorių pr. 169, Kaunas",
    workingHours: "I-V 7:00-19:00, VI 8:00-15:00, VII 9:00-13:00",
    phone: "+370 700 55511"
  },
  {
    id: "loc-syn-k1",
    labId: "synlab",
    city: "Kaunas",
    address: "Vytauto pr. 32, Kaunas",
    workingHours: "I-V 7:30-15:00",
    phone: "+370 37 323 125"
  },
  {
    id: "loc-med-k1",
    labId: "medicinaPractica",
    city: "Kaunas",
    address: "Kęstučio g. 36 / S. Daukanto g. 4, Kaunas",
    workingHours: "I-V 7:00-16:00, VI 9:00-13:00",
    phone: "+370 37 200 453"
  },
  {
    id: "loc-rez-k1",
    labId: "rezus",
    city: "Kaunas",
    address: "Savanorių pr. 66, Kaunas",
    workingHours: "I-V 7:30-15:00",
    phone: "+370 659 12345"
  },

  // KLAIPEDA
  {
    id: "loc-ant-kl1",
    labId: "anteja",
    city: "Klaipėda",
    address: "Liepų g. 48B, Klaipėda",
    workingHours: "I-V 7:30-17:00, VI 8:00-13:00",
    phone: "+370 700 55511"
  },
  {
    id: "loc-syn-kl1",
    labId: "synlab",
    city: "Klaipėda",
    address: "Taikos pr. 141, Klaipėda",
    workingHours: "I-V 7:30-15:00",
    phone: "+370 46 411 915"
  },
  {
    id: "loc-med-kl1",
    labId: "medicinaPractica",
    city: "Klaipėda",
    address: "Šilutės pl. 38, Klaipėda",
    workingHours: "I-V 7:00-15:00",
    phone: "+370 46 230 462"
  },
  {
    id: "loc-rez-kl1",
    labId: "rezus",
    city: "Klaipėda",
    address: "Manto g. 22, Klaipėda",
    workingHours: "I-V 7:30-15:00",
    phone: "+370 659 98765"
  },

  // ŠIAULIAI
  {
    id: "loc-ant-s1",
    labId: "anteja",
    city: "Šiauliai",
    address: "Tilžės g. 11B, Šiauliai",
    workingHours: "I-V 7:30-16:00",
    phone: "+370 700 55511"
  },
  {
    id: "loc-rez-s1",
    labId: "rezus",
    city: "Šiauliai",
    address: "Sodų g. 3A, Šiauliai",
    workingHours: "I-V 7:00-17:00, VI 8:00-13:00",
    phone: "+370 41 552 901"
  },

  // PANEVEZYS
  {
    id: "loc-ant-p1",
    labId: "anteja",
    city: "Panevėžys",
    address: "Smėlynės g. 25, Panevėžys",
    workingHours: "I-V 7:30-16:00",
    phone: "+370 700 55511"
  },
  {
    id: "loc-rez-p1",
    labId: "rezus",
    city: "Panevėžys",
    address: "Savanorių a. 12, Panevėžys",
    workingHours: "I-V 7:30-15:30",
    phone: "+370 620 44344"
  }
];
