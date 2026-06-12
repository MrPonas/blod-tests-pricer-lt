import Link from 'next/link';

export default function AboutPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <nav className="text-xs text-gray-400 mb-6">
        <Link href="/" className="hover:text-gray-600">Pagrindinis</Link>
        <span className="mx-1.5">/</span>
        <span>Apie</span>
      </nav>

      <h1 className="text-2xl font-bold text-gray-900 mb-8">Apie projektą</h1>

      <div className="space-y-5 text-sm text-gray-700 leading-relaxed">
        <p>
          <strong>Laboratorijų kainos</strong> — nemokama viešoji svetainė, kurioje galite palyginti
          kraujo tyrimų kainas tarp visų pagrindinių Lietuvos privačių laboratorijų vienoje vietoje.
        </p>
        <p>
          Vietoje to, kad lankytumėte 5–6 skirtingas laboratorijų svetaines, čia iš karto matote
          visų laboratorijų kainas — surūšiuotas nuo pigiausios iki brangiausios, su tiesiogine
          nuoroda į registraciją.
        </p>

        <h2 className="text-base font-semibold text-gray-900 pt-3">Kaip tai veikia</h2>
        <p>
          Kainos surenkamos automatiškai kiekvieną dieną iš oficialių laboratorijų svetainių.
          Prie kiekvienos kainos matote, kada ji buvo atnaujinta.
        </p>

        <h2 className="text-base font-semibold text-gray-900 pt-3">Laboratorijos</h2>
        <ul className="list-disc pl-5 space-y-1 text-gray-600">
          {['Synlab', 'Anteja', 'Affidea', 'Meliva', 'Rezus'].map((lab) => (
            <li key={lab}>{lab}</li>
          ))}
        </ul>

        <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs">
          <strong>Svarbu:</strong> Kainos yra orientacinės ir gali keistis. Prieš lankydamiesi
          laboratorijoje, visada patikrinkite galutinę kainą oficialios laboratorijos svetainėje.
        </div>
      </div>
    </div>
  );
}
