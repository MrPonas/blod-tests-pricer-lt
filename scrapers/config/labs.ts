export interface LabConfig {
  slug: string;
  name: string;
  priceListUrl: string;
  additionalUrls?: string[];
  bookingUrl: string;
}

export const labs: LabConfig[] = [
  // Synlab: disabled — price page requires very heavy JS rendering, times out
  // {
  //   slug: 'synlab',
  //   name: 'Synlab',
  //   priceListUrl: 'https://www.synlab.lt/tyrimai-ir-kainos',
  //   bookingUrl: 'https://www.synlab.lt/registracija',
  // },

  {
    slug: 'anteja',
    name: 'Anteja',
    // All blood-test subcategory pages discovered via Playwright from /tyrimai/kraujo-tyrimai
    priceListUrl: 'https://anteja.lt/tyrimai/kraujo-tyrimai/bendrieji-kraujo-tyrimai',
    additionalUrls: [
      'https://anteja.lt/tyrimai/kraujo-tyrimai/skydliaukes-tyrimai',
      'https://anteja.lt/tyrimai/kraujo-tyrimai/kepenu-funkcijos-tyrimai',
      'https://anteja.lt/tyrimai/kraujo-tyrimai/prostatos-tyrimai',
      'https://anteja.lt/tyrimai/kraujo-tyrimai/hormonu-tyrimai',
      'https://anteja.lt/tyrimai/kraujo-tyrimai/lytiskai-plintancios-ligos',
      'https://anteja.lt/tyrimai/kraujo-tyrimai/vezio-zymenys',
      'https://anteja.lt/tyrimai/kraujo-tyrimai/sirdies-ir-kraujagysliu-tyrimai',
      'https://anteja.lt/tyrimai/kraujo-tyrimai/vitaminu-tyrimai',
      'https://anteja.lt/tyrimai/kraujo-tyrimai/elektrolitu-ir-mikroelementu-tyrimai',
      'https://anteja.lt/tyrimai/kraujo-tyrimai/alergologiniai-tyrimai-ir-alergenu-programos',
      'https://anteja.lt/tyrimai/kraujo-tyrimai/imunologiniai-tyrimai',
      'https://anteja.lt/tyrimai/kraujo-tyrimai/inkstu-funkcijos-tyrimai',
      'https://anteja.lt/tyrimai/kraujo-tyrimai/biocheminiai-tyrimai',
      'https://anteja.lt/tyrimai/kraujo-tyrimai/celiakijos-tyrimai',
      'https://anteja.lt/tyrimai/kraujo-tyrimai/covid-19-tyrimai',
      'https://anteja.lt/tyrimai/kraujo-tyrimai/erkiu-pernesamu-ligu-tyrimai',
      'https://anteja.lt/tyrimai/kraujo-tyrimai/genetiniai-tyrimai',
      'https://anteja.lt/tyrimai/kraujo-tyrimai/gliukozes-tyrimai',
      'https://anteja.lt/tyrimai/kraujo-tyrimai/hepatitu-zymenu-tyrimai',
      'https://anteja.lt/tyrimai/kraujo-tyrimai/infekciju-tyrimai',
      'https://anteja.lt/tyrimai/kraujo-tyrimai/jautrumo-maistui-tyrimai',
      'https://anteja.lt/tyrimai/kraujo-tyrimai/kasos-funkcijos-tyrimai',
      'https://anteja.lt/tyrimai/kraujo-tyrimai/kraujo-kresejimo-tyrimai',
      'https://anteja.lt/tyrimai/kraujo-tyrimai/kvepavimo-taku-infekcijos',
      'https://anteja.lt/tyrimai/kraujo-tyrimai/mazakraujystes-tyrimai',
      'https://anteja.lt/tyrimai/kraujo-tyrimai/nipt-tyrimai',
      'https://anteja.lt/tyrimai/kraujo-tyrimai/riebalu-apykaitos-tyrimai',
      'https://anteja.lt/tyrimai/kraujo-tyrimai/virusiniu-ligu-tyrimai',
      'https://anteja.lt/tyrimai/kraujo-tyrimai/ziv-tyrimai',
    ],
    bookingUrl: 'https://anteja.lt',
  },

  // Affidea: disabled — blocks automated scraping (HTTP 500 on all engines)
  // {
  //   slug: 'affidea',
  //   name: 'Affidea',
  //   priceListUrl: 'https://www.affidea.lt/tyrimai-ir-kainos',
  //   bookingUrl: 'https://www.affidea.lt',
  // },

  // Meliva: disabled — no public price list found on their website
  // {
  //   slug: 'meliva',
  //   name: 'Meliva',
  //   priceListUrl: 'https://meliva.lt/kainos',
  //   bookingUrl: 'https://meliva.lt',
  // },

  {
    slug: 'rezus',
    name: 'Rezus',
    priceListUrl: 'https://rezus.lt/visi-tyrimai',
    bookingUrl: 'https://rezus.lt',
  },
];
