// v0.70 (R178) : code pays ISO (celui des drapeaux, ressources/terrains.json) -> nom du pays tel qu'il est écrit dans les barèmes des
// indemnités (js/baremes-officiels.js). Les territoires d'outre-mer ont leur propre code (RE La Réunion, YT Mayotte…). Code absent :
// pays à choisir à la main.
export const NOMS_PAYS = {
  FR: 'France', RE: 'La Réunion', YT: 'Mayotte', GP: 'Guadeloupe', MQ: 'Martinique', GF: 'Guyane', PM: 'Saint-Pierre-et-Miquelon',
  BL: 'Saint-Barthélemy', MF: 'Saint-Martin', NC: 'Nouvelle-Calédonie', PF: 'Polynésie française', WF: 'Wallis-et-Futuna',
  DE: 'Allemagne', AT: 'Autriche', BE: 'Belgique', CY: 'Chypre', HR: 'Croatie', ES: 'Espagne', EE: 'Estonie', FI: 'Finlande', GR: 'Grèce',
  IE: 'Irlande', IT: 'Italie', LV: 'Lettonie', LT: 'Lituanie', LU: 'Luxembourg', MT: 'Malte', NL: 'Pays-Bas', PT: 'Portugal', SK: 'Slovaquie',
  SI: 'Slovénie', AL: 'Albanie', DZ: 'Algérie', BA: 'Bosnie-Herzégovine', BG: 'Bulgarie', DK: 'Danemark', GB: 'Grande-Bretagne', HU: 'Hongrie',
  IS: 'Islande', LI: 'Liechtenstein', MK: 'Macédoine', MA: 'Maroc', ME: 'Monténégro', NO: 'Norvège', PL: 'Pologne', CZ: 'République tchèque',
  RO: 'Roumanie', RS: 'Serbie', SE: 'Suède', CH: 'Suisse', TN: 'Tunisie',
  AF: 'Afghanistan', ZA: 'Afrique du Sud', AO: 'Angola', AI: 'Anguilla', AG: 'Antigua', SA: 'Arabie saoudite', AR: 'Argentine', AM: 'Arménie',
  AW: 'Aruba', AU: 'Australie', AZ: 'Azerbaïdjan', BS: 'Bahamas', BH: 'Bahreïn', BD: 'Bangladesh', BB: 'Barbade', BZ: 'Belize', BJ: 'Bénin',
  BM: 'Bermudes', BY: 'Biélorussie', MM: 'Birmanie', BO: 'Bolivie', BW: 'Botswana', BR: 'Brésil', BN: 'Brunei', BF: 'Burkina Faso', BI: 'Burundi',
  KH: 'Cambodge', CM: 'Cameroun', CA: 'Canada', CV: 'Cap-Vert', CF: 'République centrafricaine', CL: 'Chili', CN: 'Chine', CO: 'Colombie',
  KM: 'Comores', CG: 'Congo (Brazzaville)', CD: 'République démocratique du Congo', KP: 'Corée du Nord', KR: 'Corée du Sud', CR: 'Costa Rica',
  CI: 'Côte d\'Ivoire', CU: 'Cuba', CW: 'Curaçao', DJ: 'Djibouti', DM: 'Dominique', DO: 'République dominicaine', EG: 'Égypte',
  AE: 'Émirats arabes unis', EC: 'Équateur', ER: 'Érythrée', US: 'États-Unis', ET: 'Éthiopie', FJ: 'Fidji', GA: 'Gabon', GM: 'Gambie',
  GE: 'Géorgie', GH: 'Ghana', GD: 'Grenade', GT: 'Guatemala', GN: 'Guinée (Conakry)', GW: 'Guinée-Bissau', GQ: 'Guinée équatoriale', GY: 'Guyana',
  HT: 'Haïti', HN: 'Honduras', HK: 'Hong Kong', KY: 'Îles Caïmans', CK: 'Îles Cook', MH: 'Îles Marshall', PW: 'Palaos', IN: 'Inde', ID: 'Indonésie',
  IQ: 'Irak', IR: 'Iran', IL: 'Israël', JM: 'Jamaïque', JP: 'Japon', JO: 'Jordanie', KZ: 'Kazakhstan', KE: 'Kenya', KG: 'Kirghizistan',
  KI: 'Kiribati', KW: 'Koweït', LA: 'Laos', LS: 'Lesotho', LB: 'Liban', LR: 'Liberia', LY: 'Libye', MO: 'Macao', MG: 'Madagascar',
  MY: 'Malaisie', MW: 'Malawi', MV: 'Maldives', ML: 'Mali', MU: 'Maurice', MR: 'Mauritanie', MX: 'Mexique', FM: 'Micronésie', MD: 'Moldavie',
  MN: 'Mongolie', MZ: 'Mozambique', NA: 'Namibie', NR: 'Nauru', NP: 'Népal', NI: 'Nicaragua', NE: 'Niger', NG: 'Nigeria', NU: 'Niue',
  NZ: 'Nouvelle-Zélande', OM: 'Oman', UG: 'Ouganda', UZ: 'Ouzbékistan', PK: 'Pakistan', PA: 'Panama', PG: 'Papouasie-Nouvelle-Guinée',
  PY: 'Paraguay', PE: 'Pérou', PH: 'Philippines', QA: 'Qatar', SS: 'Soudan du Sud', RU: 'Russie', RW: 'Rwanda', KN: 'Saint-Kitts-et-Nevis',
  VC: 'Saint-Vincent', LC: 'Sainte-Lucie', SV: 'Salvador', WS: 'Samoa', ST: 'Sao Tomé-et-Principe', SN: 'Sénégal', SC: 'Seychelles',
  SL: 'Sierra Leone', SG: 'Singapour', SO: 'Somalie', SD: 'Soudan', LK: 'Sri Lanka', SR: 'Suriname', SY: 'Syrie', TW: 'Taïwan', TZ: 'Tanzanie',
  TD: 'Tchad', TH: 'Thaïlande', TL: 'Timor oriental', TG: 'Togo', TO: 'Tonga', TT: 'Trinité-et-Tobago', TM: 'Turkménistan', TR: 'Turquie',
  TV: 'Tuvalu', UA: 'Ukraine', UY: 'Uruguay', VU: 'Vanuatu', VE: 'Venezuela', VN: 'Vietnam', YE: 'Yémen', ZM: 'Zambie', ZW: 'Zimbabwe',
  MC: 'Monaco', AD: 'Andorre', SM: 'Saint-Marin', VA: 'Vatican', XK: 'Kosovo', SZ: 'Eswatini', TJ: 'Tadjikistan', BT: 'Bhoutan',
  PR: 'Porto Rico', GL: 'Groenland', FO: 'Îles Féroé', GI: 'Gibraltar', JE: 'Jersey', GG: 'Guernesey', IM: 'Île de Man',
};
export const nomPays = iso => NOMS_PAYS[String(iso || '').toUpperCase()] || null;
