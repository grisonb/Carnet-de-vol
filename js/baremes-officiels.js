// v0.69 (R169) : barèmes officiels des indemnités journalières des PN (frais réels), années 2022 à 2025. Données PUBLIQUES (bulletins
// syndicaux reprenant les montants de la DGFiP). Une ligne par pays :
//   « #année|zone euro|vol journée|source »
//   « E|liste » = groupe Euro (montant de la zone euro, zone Euro-Europe) ; « M|pays|montant » = groupe Moyen (zone Euro-Europe) ;
//   « W|pays|montant » = groupe Monde (zone Monde) ; « |du=JJ/MM;au=JJ/MM;ville=…;note=… » = précisions : montant daté (sans « au » :
//   jusqu'au 31/12), ville (choix à part « Pays – Ville »), note.
// « France métropolitaine » devient « France » (nom utilisé par l'app).
const DONNEES = `
#2022|159|79.50|Bulletin SNPNAC Déclaration 2023 – Revenus 2022
E|France métropolitaine,Guadeloupe,Guyane,Martinique,Mayotte,Saint-Barthélemy,Saint-Martin,Saint-Pierre-et-Miquelon,La Réunion,Allemagne,Autriche,Belgique,Chypre,Espagne,Estonie,Finlande,Grèce,Irlande,Italie,Lettonie,Lituanie,Luxembourg,Malte,Pays-Bas,Portugal,Slovaquie,Slovénie
M|Albanie|130.00
M|Algérie|136.10
M|Bosnie-Herzégovine|169.00
M|Bulgarie|145.00
M|Croatie|142.00
M|Danemark|223.22
M|Grande-Bretagne|211.58
M|Hongrie|175.00
M|Islande|233.44
M|Macédoine|117.00
M|Maroc|175.00
M|Monténégro|150.00
M|Norvège|144.32
M|Pologne|175.00
M|République tchèque|180.00
M|Roumanie|160.00
M|Serbie|150.00
M|Suède|188.89
M|Suisse|227.44
M|Tunisie|125.00
W|Afghanistan|257.14
W|Afrique du Sud|185.00
W|Afrique du Sud|138.00|du=02/03;au=04/12
W|Angola|300.00
W|Arabie saoudite|158.00
W|Argentine|144.70
W|Arménie|186.00
W|Australie|224.46
W|Bénin|145.00
W|Biélorussie|150.00
W|Bolivie|124.42
W|Brésil|216.00
W|Burundi|140.00
W|Burkina Faso|145.00
W|Cameroun|120.00
W|Canada|182.55
W|République centrafricaine|121.96
W|Chili|200.00
W|Chine|232.05|note=y compris Shanghai
W|Colombie|162.21
W|Comores|150.00
W|Congo (Brazzaville)|107.90
W|République démocratique du Congo|195.00
W|Corée du Sud|210.00
W|Côte d'Ivoire|208.86
W|Costa Rica|143.48
W|Cuba|200.00
W|Djibouti|187.58
W|Dominique|245.16
W|Égypte|148.00
W|Émirats arabes unis|300.00
W|Équateur|138.25
W|États-Unis|294.93|note=sauf New York
W|États-Unis|294.93|ville=New York
W|États-Unis|414.75|ville=New York;du=01/09;au=31/12
W|Gabon|213.43
W|Géorgie|179.72
W|Ghana|230.41
W|Guatemala|160.00
W|Guinée (Conakry)|170.00
W|Guinée équatoriale|137.97
W|Guyana|184.33
W|Honduras|140.09
W|Hong Kong|259.00
W|Inde|210.00
W|Indonésie|160.00
W|Iran|171.43
W|Irak|300.00
W|Israël|230.00
W|Japon|186.27|note=sauf Tokyo
W|Japon|219.14|ville=Tokyo
W|Jordanie|196.29
W|Kenya|129.95
W|Koweït|245.00
W|Liban|154.00
W|Libye|54.51
W|Libye|240.00|du=29/04
W|Madagascar|114.00
W|Malaisie|99.50
W|Mali|246.36
W|Maurice|149.07
W|Mauritanie|143.00
W|Mexique|150.00
W|Niger|118.91
W|Nigeria|273.00
W|Panama|164.06
W|Pérou|156.68
W|Polynésie française|132.00
W|Qatar|278.00
W|République dominicaine|120.56
W|Russie|230.00
W|Rwanda|255.30
W|Sénégal|139.95
W|Seychelles|300.00
W|Sierra Leone|239.63
W|Singapour|200.00
W|Sri Lanka|180.00
W|Syrie|154.00
W|Taïwan|188.55
W|Tchad|225.00
W|Thaïlande|132.32
W|Togo|125.98
W|Turquie|135.00
W|Ukraine|208.00
W|Venezuela|195.00
W|Vietnam|158.00
W|Zimbabwe|165.90
#2023|169|84.50|Bulletin SNPNC – barème PN année 2023 (vol journée non imprimé : moitié de 169)
E|Allemagne,Autriche,Belgique,Chypre,Croatie,Espagne,Estonie,Finlande,France métropolitaine,Grèce,Guadeloupe,Guyane,Irlande,Italie,La Réunion,Lettonie,Lituanie,Luxembourg,Malte,Martinique,Mayotte,Pays-Bas,Portugal,Saint-Barthélemy,Saint-Martin,Saint-Pierre-et-Miquelon,Slovaquie,Slovénie
M|Albanie|130.00
M|Algérie|140.64
M|Bosnie-Herzégovine|169.00
M|Bulgarie|145.00
M|Danemark|222.92
M|Grande-Bretagne|208.40
M|Grande-Bretagne|243.14|du=16/05
M|Hongrie|175.00
M|Islande|231.16
M|Liechtenstein|236.02
M|Macédoine|117.00
M|Maroc|175.00
M|Monténégro|150.00
M|Norvège|133.01
M|Norvège|245.14|du=16/05
M|Pologne|175.00
M|République tchèque|180.00
M|Roumanie|160.00
M|Serbie|150.00
M|Suède|179.37
M|Suisse|236.02
M|Tunisie|125.00
W|Afghanistan|261.35
W|Afrique du Sud|185.00
W|Angola|300.00
W|Anguilla|194.84
W|Antigua|288.51
W|Arabie saoudite|158.00
W|Arabie saoudite|337.00|du=16/05
W|Argentine|147.07
W|Arménie|186.00
W|Aruba|140.51
W|Australie|217.50
W|Azerbaïdjan|204.00
W|Bahamas|193.90
W|Bahreïn|200.00
W|Bangladesh|258.00
W|Barbade|332.54
W|Belize|165.80
W|Bénin|145.00
W|Bermudes|181.72
W|Biélorussie|150.00
W|Birmanie|234.18
W|Bolivie|126.46
W|Botswana|119.00
W|Brésil|216.00
W|Brunei|176.15
W|Burkina Faso|145.00
W|Burundi|140.00
W|Cambodge|140.51
W|Cameroun|120.00
W|Canada|179.78
W|Cap-Vert|123.11
W|Chili|203.27
W|Chine|222.83|note=y compris Shanghai
W|Colombie|164.86
W|Comores|150.00
W|Congo (Brazzaville)|182.94
W|Corée du Nord|254.79
W|Corée du Sud|210.00
W|Costa Rica|158.31
W|Côte d'Ivoire|208.86
W|Cuba|200.00
W|Curaçao|140.51
W|Djibouti|190.59
W|Dominique|249.17
W|Égypte|148.00
W|Émirats arabes unis|300.00
W|Équateur|140.51
W|Érythrée|182.66
W|États-Unis|299.75
W|États-Unis|299.75|ville=New York
W|États-Unis|421.53|ville=New York;du=01/09
W|Éthiopie|123.00
W|Fidji|176.36
W|Gabon|213.43
W|Gambie|126.67
W|Géorgie|182.66
W|Ghana|234.18
W|Grenade|265.09
W|Guatemala|160.00
W|Guinée (Conakry)|170.00
W|Guinée-Bissau|105.00
W|Guinée équatoriale|137.97
W|Guyana|187.34
W|Haïti|206.08
W|Honduras|142.38
W|Hong Kong|263.99
W|Îles Caïmans|132.08
W|Îles Cook|232.01
W|Îles Marshall|144.26
W|Palaos|291.32
W|Inde|210.00
W|Indonésie|160.00
W|Irak|300.00
W|Iran|174.23
W|Israël|230.00
W|Jamaïque|203.27
W|Japon|166.95
W|Japon|196.41|ville=Tokyo
W|Jordanie|199.50
W|Kazakhstan|140.00
W|Kenya|132.08
W|Kirghizistan|150.00
W|Kiribati|129.38
W|Koweït|245.00
W|Laos|140.51
W|Lesotho|120.00
W|Liban|154.00
W|Liberia|215.45
W|Libye|240.00
W|Macao|263.99
W|Madagascar|114.00
W|Malaisie|95.67
W|Malawi|200.46
W|Maldives|320.00
W|Mali|246.36
W|Maurice|149.71
W|Mauritanie|143.00
W|Mexique|150.00
W|Micronésie|147.07
W|Moldavie|176.10
W|Mongolie|102.00
W|Mozambique|177.04
W|Namibie|90.00
W|Namibie|150.00|du=16/05
W|Nauru|375.00
W|Népal|131.14
W|Nicaragua|144.26
W|Niger|118.91
W|Nigeria|273.00
W|Nigeria|230.00|du=16/05
W|Niue|118.32
W|Nouvelle-Calédonie|132.00
W|Nouvelle-Calédonie|168.00|du=22/09
W|Nouvelle-Zélande|214.60
W|Oman|265.00
W|Ouganda|130.00
W|Ouzbékistan|184.53
W|Pakistan|162.05
W|Panama|166.74
W|Papouasie-Nouvelle-Guinée|172.00
W|Paraguay|168.61
W|Pérou|159.24
W|Philippines|146.81
W|Polynésie française|132.00
W|Polynésie française|168.00|du=22/09
W|Qatar|278.00
W|République centrafricaine|121.96
W|République démocratique du Congo|195.00
W|République dominicaine|133.01
W|Soudan du Sud|286.64
W|Russie|230.00
W|Rwanda|159.24
W|Saint-Kitts-et-Nevis|268.84
W|Saint-Vincent|257.60
W|Sainte-Lucie|244.49
W|Salvador|165.80
W|Samoa|215.45
W|Sao Tomé-et-Principe|126.46
W|Sénégal|139.95
W|Seychelles|300.00
W|Sierra Leone|243.55
W|Singapour|200.00
W|Singapour|309.01|du=16/05
W|Somalie|148.00
W|Soudan|163.93
W|Sri Lanka|180.00
W|Suriname|168.61
W|Syrie|154.00
W|Taïwan|180.01
W|Tanzanie|135.00
W|Tchad|225.00
W|Thaïlande|133.45
W|Timor oriental|150.00
W|Togo|125.98
W|Tonga|168.41
W|Trinité-et-Tobago|250.11
W|Turkménistan|102.00
W|Turquie|135.00
W|Tuvalu|158.75
W|Ukraine|208.00
W|Uruguay|126.46
W|Vanuatu|210.00
W|Venezuela|195.00
W|Vietnam|158.00
W|Wallis-et-Futuna|132.00
W|Wallis-et-Futuna|168.00|du=22/09
W|Yémen|188.00
W|Zambie|180.00
W|Zimbabwe|168.61
#2024|173|86.50|Bulletin SNPNAC Déclaration 2025 – Revenus 2024
E|France métropolitaine,Guadeloupe,Guyane,Martinique,Mayotte,Saint-Barthélemy,Saint-Martin,Saint-Pierre-et-Miquelon,La Réunion,Allemagne,Autriche,Belgique,Chypre,Espagne,Estonie,Finlande,Grèce,Irlande,Italie,Lettonie,Lituanie,Luxembourg,Malte,Pays-Bas,Portugal,Slovaquie,Slovénie
M|Albanie|130.00
M|Algérie|141.33
M|Bosnie-Herzégovine|169.00
M|Bulgarie|145.00
M|Croatie|142.00
M|Danemark|222.61
M|Grande-Bretagne|256.64
M|Hongrie|175.00
M|Islande|232.88
M|Macédoine|117.00
M|Maroc|175.00
M|Monténégro|150.00
M|Norvège|235.54|du=16/05
M|Pologne|175.00
M|République tchèque|180.00
M|Roumanie|160.00
M|Serbie|150.00
M|Suède|176.92
M|Suisse|247.10
M|Tunisie|125.00
W|Afghanistan|257.20
W|Afrique du Sud|185.00
W|Afrique du Sud|138.00|du=02/02;au=14/12
W|Angola|300.00
W|Arabie saoudite|337.00
W|Argentine|144.99
W|Arménie|186.00
W|Australie|214.33
W|Bénin|145.00
W|Biélorussie|150.00
W|Bolivie|124.68
W|Brésil|216.00
W|Burundi|140.00
W|Burkina Faso|145.00
W|Cameroun|120.00
W|Canada|179.46
W|Canada|216.51|du=08/07
W|Canada|176.46|ville=Toronto
W|Canada|374.64|ville=Toronto;du=08/07
W|Canada|176.46|ville=Vancouver
W|Canada|304.74|ville=Vancouver;du=08/07
W|Chili|200.41
W|Chine|218.87|note=y compris Shanghai
W|Colombie|162.54
W|Comores|150.00
W|Congo (Brazzaville)|182.84
W|Corée du Sud|210.00
W|Côte d'Ivoire|208.86
W|Costa Rica|156.08
W|Cuba|200.00
W|Djibouti|188.38
W|Dominique|245.66
W|Égypte|148.00
W|Émirats arabes unis|300.00
W|Équateur|138.53
W|États-Unis|295.53
W|États-Unis|332.47|du=01/09
W|États-Unis|295.53|ville=New York
W|États-Unis|452.53|ville=New York;du=01/09
W|Gabon|213.43
W|Géorgie|180.09
W|Ghana|230.88
W|Guatemala|160.00
W|Guinée (Conakry)|170.00
W|Guinée équatoriale|137.97
W|Guinée-Bissau|105.00
W|Guinée-Bissau|169.00|du=08/07
W|Guyana|184.71
W|Honduras|140.38
W|Hong Kong|260.48
W|Inde|210.00
W|Indonésie|160.00
W|Irak|300.00
W|Iran|171.78
W|Israël|230.00
W|Japon|161.16
W|Japon|189.60|ville=Tokyo
W|Jordanie|196.69
W|Kenya|130.08
W|Koweït|245.00
W|Liban|154.00
W|Libye|240.00
W|Madagascar|114.00
W|Malaisie|95.42
W|Maldives|320.00
W|Mali|246.36
W|Maurice|141.49
W|Maurice|191.01|du=18/07
W|Mauritanie|143.00
W|Mexique|150.00
W|Mexique|188.97|du=08/07
W|Mozambique|174.55
W|Niger|118.91
W|Nigeria|230.00
W|Nouvelle-Calédonie|168.00
W|Ouganda|130.00
W|Pakistan|159.77
W|Panama|164.39
W|Pérou|157.00
W|Polynésie française|168.00
W|Qatar|278.00
W|République centrafricaine|121.96
W|République centrafricaine|148.35|du=08/07
W|République démocratique du Congo|195.00
W|République démocratique du Congo|240.00|du=08/07
W|Russie|230.00
W|Rwanda|157.00
W|Sénégal|139.95
W|République dominicaine|131.14
W|Seychelles|300.00
W|Singapour|309.64
W|Syrie|154.00
W|Taïwan|74.61
W|Tchad|225.00
W|Thaïlande|134.61
W|Togo|125.98
W|Turquie|135.00
W|Ukraine|208.00
W|Uruguay|124.68
W|Venezuela|195.00
W|Vietnam|158.00
W|Zimbabwe|166.24
#2025|174|87.00|Bulletin SNPNAC Déclaration 2026 – Revenus 2025
E|France métropolitaine,Guadeloupe,Guyane,Martinique,Mayotte,Saint-Barthélemy,Saint-Martin,Saint-Pierre-et-Miquelon,La Réunion,Allemagne,Autriche,Belgique,Chypre,Espagne,Estonie,Finlande,Grèce,Irlande,Italie,Lettonie,Lituanie,Luxembourg,Malte,Pays-Bas,Portugal,Slovaquie,Slovénie
M|Albanie|130.00
M|Algérie|140.33
M|Bosnie-Herzégovine|169.00
M|Bulgarie|145.00
M|Danemark|222.40
M|Danemark|289.35|du=27/11
M|Grande-Bretagne|246.00
M|Hongrie|175.00
M|Islande|236.00
M|Macédoine|117.00
M|Maroc|175.00
M|Monténégro|150.00
M|Norvège|228.30
M|Pologne|175.00
M|République tchèque|180.00
M|Roumanie|160.00
M|Serbie|150.00
M|Suède|177.60
M|Suisse|247.10
M|Tunisie|125.00
W|Afghanistan|253.20
W|Afrique du Sud|185.00
W|Afrique du Sud|138.00|du=02/03;au=14/12
W|Angola|300.00
W|Arabie saoudite|337.00
W|Argentine|142.50
W|Arménie|186.00
W|Australie|201.50
W|Australie|220.22|du=27/11
W|Bénin|145.00
W|Biélorussie|150.00
W|Bolivie|122.56
W|Brésil|216.00
W|Burundi|140.00
W|Burkina Faso|145.00
W|Cameroun|161.00
W|Canada|203.75
W|Canada|286.82|ville=Vancouver
W|Canada|352.62|ville=Toronto
W|Chili|197.00
W|Chine|214.39
W|Chypre|190.00
W|Colombie|159.78
W|Comores|150.00
W|Congo (Brazzaville)|182.84
W|Corée du Sud|210.00
W|Côte d'Ivoire|209.00
W|Croatie|142.00
W|Cuba|200.00
W|Djibouti|185.10
W|Dominique|241.50
W|Égypte|148.00
W|Émirats arabes unis|300.00
W|Équateur|136.20
W|États-Unis|326.84
W|États-Unis|326.84|ville=New York;du=01/01;au=31/08
W|États-Unis|444.85|ville=New York;du=01/09;au=31/12
W|Gabon|213.43
W|Géorgie|177.03
W|Ghana|226.95
W|Guatemala|160.00
W|Guinée (Conakry)|170.00
W|Guinée équatoriale|137.97
W|Guinée-Bissau|169.00
W|Hong Kong|257.05
W|Inde|210.00
W|Indonésie|160.00
W|Irak|300.00
W|Iran|168.80
W|Israël|230.00
W|Japon|147.54
W|Japon|173.55|ville=Tokyo
W|Jordanie|193.36
W|Kenya|128.00
W|Koweït|245.00
W|Liban|154.00
W|Libye|240.00
W|Madagascar|114.00
W|Malaisie|99.00
W|Maldives|320.00
W|Mali|246.36
W|Maurice|184.50
W|Mauritanie|143.00
W|Mexique|178.60
W|Mozambique|171.60
W|Niger|118.91
W|Nigeria|160.00
W|Nigeria|230.00|ville=Lagos, Port-Harcourt
W|Nouvelle-Calédonie|168.00
W|Ouganda|130.00
W|Pakistan|157.16
W|Panama|161.10
W|Pérou|154.30
W|Polynésie française|168.00
W|Qatar|278.00
W|Russie|230.00
W|Rwanda|147.56
W|République centrafricaine|146.35
W|Sénégal|139.95
W|République dominicaine|128.90
W|République dominicaine|300.00|du=27/11
W|Seychelles|300.00
W|Singapour|305.40
W|Syrie|154.00
W|Taïwan|169.98
W|Tchad|225.00
W|Thaïlande|137.05
W|Togo|146.00
W|Turquie|135.00
W|Ukraine|208.00
W|Uruguay|122.55
W|Venezuela|195.00
W|Vietnam|158.00
W|Zimbabwe|163.40
`;

// Lecture des données : Map année -> { annee, zoneEuro, journee (centimes), source, pays: [{ nom, montant (centimes | null), zone,
// groupe, periodes: [{ du: 'MM-JJ', au: 'MM-JJ', montant }], note }] }. Un pays repris plus loin (ex. Chypre 2025 en Monde) remplace
// l'entrée du groupe Euro ; une ligne avec « du » ajoute une période au pays (ou à la ville) de même nom.
const cents = t => Math.round(Number(t) * 100);
const jjmm = t => { const [j, m] = String(t).split('/'); return `${m.padStart(2, '0')}-${j.padStart(2, '0')}`; };
export const SEP_VILLE = ' – ';
function lire(texte) {
  const annees = new Map();
  let cur = null;
  const entree = (nom, zone, groupe) => {
    const k = nom.toUpperCase();
    let p = cur.index.get(k);
    if (!p || p.groupe !== groupe) {
      if (p) cur.pays.splice(cur.pays.indexOf(p), 1); // repris dans un autre groupe : remplace
      p = { nom, montant: null, zone, groupe, periodes: [] };
      cur.pays.push(p); cur.index.set(k, p);
    }
    return p;
  };
  for (const brut of texte.split('\n')) {
    const l = brut.trim();
    if (!l) continue;
    if (l.startsWith('#')) {
      const [a, euro, journee, source] = l.slice(1).split('|');
      cur = { annee: a, zoneEuro: cents(euro), journee: cents(journee), source, pays: [], index: new Map() };
      annees.set(a, cur);
      continue;
    }
    const [g, nom, montant, prec] = l.split('|');
    if (g === 'E') {
      for (const n of nom.split(',')) { const p = entree(n.trim() === 'France métropolitaine' ? 'France' : n.trim(), 'euro', 'E'); p.montant = cur.zoneEuro; }
      continue;
    }
    const opts = Object.fromEntries(String(prec || '').split(';').filter(Boolean).map(x => { const i = x.indexOf('='); return [x.slice(0, i).trim(), x.slice(i + 1).trim()]; }));
    const n = opts.ville ? `${nom}${SEP_VILLE}${opts.ville}` : nom;
    const p = entree(n, g === 'W' ? 'monde' : 'euro', g);
    if (opts.du) p.periodes.push({ du: jjmm(opts.du), au: opts.au ? jjmm(opts.au) : '12-31', montant: cents(montant) });
    else p.montant = cents(montant);
    if (opts.note) p.note = opts.note;
  }
  for (const a of annees.values()) delete a.index;
  return annees;
}
export const BAREMES_OFFICIELS = lire(DONNEES);
export const baremeOfficiel = annee => BAREMES_OFFICIELS.get(String(annee)) || null;
