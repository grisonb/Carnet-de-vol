# Carnet de vol — consignes pour Claude

Carnet de vol électronique (logbook pilote) au format EASA (FCL.050 / AMC1 FCL.050), pour un seul pilote.
PWA pour smartphone Android (Chrome), utilisable d'une main, entièrement hors ligne.
L'utilisateur n'est pas développeur : lui expliquer les choses simplement, en français.

## Règles absolues

- **Dépôt PUBLIC** : il ne contient QUE le code. JAMAIS de vol réel, d'immatriculation des vols du pilote,
  de nom ou trigramme de collègue, de fichier FlyLog, de maquette, de capture d'écran avec des données réelles,
  ni aucune donnée réelle, même dans les tests ou les exemples. Les tests utilisent des vols inventés
  (`tests/outils/faux-flylog.js`). Les tables génériques (types OACI, terrains OACI) sont autorisées.
- Les données privées sont dans `../donnees-privees/` (hors dépôt) : export FlyLog, maquette, remarques,
  valeurs de référence du contrôle import.
- `.gitignore` exclut `*.csv`, `*.xlsx`, `donnees/`, `donnees-privees/`, `maquette*.html`, les captures de tests.
  **Vérifier `git status` avant chaque commit** : aucun fichier de données ne doit être suivi.
- Commit et push **uniquement après « OK push » tapé par l'utilisateur**. Jamais de `--force`.
- Une version = une livraison poussée. Le numéro est écrit à UN SEUL endroit : `js/numero-version.js`.
  Le service worker le lit avec `importScripts` pour nommer son cache ; l'app le lit via `js/version.js`
  (accueil « vX.Y » en haut à gauche, écran Plus). Changer ce numéro change le cache : le téléphone récupère
  la version. **Le service worker doit rester un script CLASSIQUE (jamais `import`/`export`, jamais
  `type: 'module'`)** : sinon les téléphones déjà installés ne peuvent plus se mettre à jour (bug de la v0.2).
  Ajouter une entrée dans `JOURNAL.md`.
- Textes de l'app en français. Durées affichées « 1h18 », totaux « 5 702h48 ».
- v0.1 : AUCUN serveur ni appel réseau en dehors du chargement de l'app depuis GitHub Pages.

## Traces ADS-B (VPS)

Serveur : `https://vps-3c305ff2.vps.ovh.net/carnet-traces/` (index.json + traces/<code>/<jour>.json), mot de passe
de l'utilisateur « carnet » (jamais dans le dépôt). Installation, script et retour arrière : dossier privé
`../donnees-privees/vps-carnet-traces/`. Toute modification du VPS : montrer d'abord, attendre l'OK tapé.
Les codes ADS-B et immatriculations réels ne sont JAMAIS dans le dépôt (servis par le VPS derrière le mot de passe).
IndexedDB v2 : magasin `traces` (hors sauvegarde). v0.55 (R138) : le mot de passe (`cartesMotDePasse`) est un réglage PARTAGÉ
(synchro, sauvegarde ; une ancienne sauvegarde sans lui ne l'efface pas : `GARDES_SI_VIDES` dans etat.js).

## Copie automatique sur le NAS (v0.10)

`js/copieur.js` (logique : regroupement 5 s, une seule copie en attente, essais espacés, textes) et `js/ui/nas.js`
(envoi gzip + SHA-256 vers `<adresse>/carnet.php?action=envoyer|test|liste|lire&v=2`, en-tête `X-Carnet-Cle`, écrans Plus).
Protocole 2 (v0.12) : le serveur web du Synology remplace toute réponse 4xx/5xx par sa page (sans CORS, illisible) ;
avec `&v=2` le NAS répond aux erreurs en 200 + `{"erreur","code"}` (`erreurDansReponse`). Le PHP web du NAS n'a pas
zlib : l'app envoie `&vols=N`, le NAS vérifie la copie par son empreinte. Garder la compatibilité avec les vrais codes HTTP.
L'adresse du NAS et son mot de passe sont TAPÉS sur le téléphone (réglages `nasAdresse`, `nasMotDePasse`, `nasAuto`,
`nasEtat`, écrits avec `ecrireReglageDiscret` pour ne pas relancer une copie) : jamais dans le dépôt, exclus de la
sauvegarde (`REGLAGES_PRIVES`). Script PHP, installation (tâche DSM root) et guide : dossier privé
`../donnees-privees/nas-carnet-sauvegarde/` (jamais dans le dépôt). Ne jamais toucher au NAS soi-même.

## Vols envoyés par NPF-Q400 (v0.15)

Format commun « carnet-vol-npf » versions 1 et 2 (défini avec la session NPF-Q400 TEST : ne pas le changer seul ;
v2 = avion par `nomAvion` « M73 », escales = passages ordonnés { oaci, nom, lat, lon, atterrissages ISO UTC },
`copilote` trigramme). NAS : carnet.php version 4, actions `vol-depot`, `vols-liste`, `vol-retirer` (dossier privé
`vols-npf/`). Logique : `js/npf.js` (validation, avion par immatriculation / nom, escales jour / nuit, copilote,
brouillon, lignes « FEU n°NN », différences ; la table des terrains est passée en paramètre) ; écrans :
`js/ui/npf.js` (bandeau `#npf-bandeau`, liste, Ignorer, mise à jour) et `ouvrirSaisie(vol, { npf })` (brouillon,
zone `#npf-zone`). Un vol enregistré garde `npfId`, `npfExporteLe` et `feuxPositions` (Carte du vol : flammes).
Une escale peut n'avoir qu'un `nom` (pélicandrome sans code OACI) et sa position `lat` / `lon` ; `arriveePosition`
(v0.17) = position GPS d'une arrivée sans code : dernier atterrissage et nuit calculés à cette position tant qu'aucun
terrain connu n'est tapé (`F.arrPos`), gardée avec le vol pour la Carte du vol ; jamais de personne
créée sans accord pour un copilote NPF inconnu.
Jamais d'enregistrement automatique ; jamais de message d'erreur intrusif.

## Hébergement

GitHub Pages, branche `main`, racine : https://grisonb.github.io/Carnet-de-vol/ (dépôt grisonb/Carnet-de-vol ; jusqu'à la v0.39 :
grisonb/Carnet-de-vol-TEST et https://grisonb.github.io/Carnet-de-vol-TEST/ — le dossier local garde son nom)
Pas d'étape de compilation : les fichiers du dépôt sont servis tels quels.

## Architecture

- `index.html` : tous les écrans (Carnet, saisie, Totaux, Plus) et fenêtres (avions, fiche, personne,
  étiquette, règles, escale, écran « outil » générique).
- `css/app.css` : styles repris de la maquette validée + compléments ; `css/polices.css` + `polices/` :
  Barlow (licence OFL), embarquée pour le hors ligne.
- `manifest.webmanifest` : id `/Carnet-de-vol/`, start_url et scope relatifs `./` (v0.39) (le site grisonb.github.io héberge
  d'autres apps, NPF-Q400 et NPF-Q400-TEST : ne jamais élargir la portée ni réutiliser leur id).
- `sw.js` : service worker, portée = dossier de l'app, cache d'abord. Un cache par adresse (v0.39) : `carnet-app-vX.Y` à
  /Carnet-de-vol/, `carnet-de-vol-vX.Y` à l'ancienne /Carnet-de-vol-TEST/ ; chacun n'efface que ses anciennes versions (les
  caches sont partagés par tout le site). Liste de fichiers à tenir à jour (un test vérifie que tous les js/css/polices/icônes y sont).
- `js/` — logique sans interface (testée sous Node) :
  - `temps.js` durées et heures ; `fuseaux.js` UTC <-> heure locale du terrain (Intl) ;
  - `nuit.js` temps de nuit EASA (soleil à plus de 6° sous l'horizon, minute par minute le long de la route) ;
  - `terrains.js` table mondiale OACI `ressources/terrains.json` ({z: fuseaux, t: {code: [lat, lon, nom, pays,
    n° de fuseau]}}), générée par `outils/generer-terrains.py` depuis OurAirports (domaine public) et
    mwgg/Airports (MIT) ; + terrains ajoutés à la main par le pilote (réglage `terrainsPerso`, jamais dans le code) ;
  - `drapeaux.js` drapeaux SVG dessinés par l'app ; `types-avion.js` table des types OACI (+ `typesAffiches` pour Plus) ;
  - `modele.js` structure vol / avion / personne, colonnes EASA (SE / ME / multipilote), fonctions ;
  - `missions.js` lignes de mission, numéros de feu, pastilles par règles, « Remarque du carnet » ;
  - `flylog.js` import FlyLog (anti-doublon par quantités) ; `totaux.js` ; `controle.js` ;
  - `pdf.js` carnet EASA (jsPDF, `vendor/jspdf.umd.min.js`, MIT ; cases centrées, tailles `TAILLES` / `MINI` : ne pas
    changer colonnes, largeurs ni `LIGNES_PAR_PAGE`) ; `sauvegarde.js` sauvegarde JSON + tableur CSV
    (`sansPhotos` pour la copie NAS, `garderPhotos` à la restauration depuis le NAS) ;
  - `csv.js` ; `db.js` IndexedDB ; `etat.js` données en mémoire + enregistrement ; `version.js` ;
  - `bande.js` bande d'heures de l'accueil (choix et valeurs, à partir de `calculerTotaux`) ;
  - `traces.js` traces ADS-B : découpe aux heures bloc, cas et textes de la « Carte du vol » (affichage seulement).
- `js/ui/` — écrans : `carnet.js` (liste par paquets de 40 au défilement, loupe ; fenêtre [debut, affiches[ : la liste
  peut s'ouvrir sur un vol ancien et charger les plus récents au-dessus ; place gardée entre les écrans via
  `memoriserPlace` / `restaurerPlace`, `history.scrollRestoration = 'manual'`), `saisie.js`, `avions.js`
  (recherche, Tous mes avions, fiche lecture seule / modification), `terrain-perso.js`, `glisser.js` (glisser
  une ligne vers la gauche -> bouton « Supprimer »), `totaux.js`, `plus.js`,
  `regles.js`, `commun.js`, `carte.js` (Carte du vol : serveur de traces, Leaflet, plein écran, Plus › Cartes de vol),
  `suppression.js` (suppression d'un vol avec confirmation + Annuler, partagée),
  `retour.js` (flèche retour Android : une entrée d'historique par niveau ouvert, fenêtres suivies par leur attribut
  `hidden` ; toute nouvelle fenêtre doit être ajoutée à sa liste COUCHES avec son bouton de fermeture ; v0.18 : chaque
  entrée porte son niveau `{ carnet: n }` et un `history.go()` de l'app est reconnu à son niveau d'arrivée (`cible`),
  même en retard — ne jamais revenir à un simple délai).
- `js/recherche.js` : recherche de vols par date (jour / mois / année, formats français).
- `js/personnes.js` (v0.55) : `afficherPersonne` (trigramme, sinon nom, sinon prénom), `formesPersonne`, `indexPersonnes`,
  `nomAffiche`, `volsACorriger`, `totauxTrigrammes`. `js/trace-import.js` (v0.55) : lecture GPX / KML / KMZ / IGC / GeoJSON /
  CSV, `simplifier`, `encoderPoints` / `decoderPoints`, `traceImportee`. (`js/fiches-avions.js` supprimé en v0.55.)
- `js/compteurs.js` (v0.56) : `listeCompteurs(fiches, ordre)`, `deplacer`, `departDuType` (compteurs de départ), `compteursDuType`,
  `compteursParDefaut` (avion puis type), `compteursDuVol` (défaut + ajoutés + valeur > 0), `changerChoix`, `volsAvecCompteur`,
  `nouvelleCle`, `problemeNom`. `js/ui/compteurs.js` : Plus › Compteurs, `htmlCases` (fiches type / avion).
- Saisie : nouveau vol = arrivée du dernier vol -> `arriveeParDefaut` (modele.js : FMEP si départ FMEP, sinon `BASE` LFTW ; suit le
  départ tant que `F.arrAuto`, v0.20) ; bouton « LF » (réglage `prefixeLF`) dans `champOACI`.
- Boutons × : constante `CROIX` (`commun.js`, croix dessinée) dans un bouton `.xbtn` ou `.x` (rond rouge).
- Couleurs (v0.19) : classe `vert` (valider / continuer : bandeau NPF, #save, #ab-no) et `annuler` (tout bouton « Annuler »,
  y compris les nouveaux) ; jetons `--vert-fond`, `--rouge-fond`, texte blanc (contraste > 4,5:1).
- Mot de passe du NAS (v0.22, R51, carnet.php v5) : Plus › Copie sur le NAS › Changer le mot de passe
  (`ecranChangerMotDePasse`, js/ui/nas.js ; règles `problemeNouveauMotDePasse` dans js/copieur.js : 12 caractères,
  ASCII sans espace car il voyage dans l'en-tête X-Carnet-Cle). Après un refus ou une réponse perdue, l'app vérifie
  avec le nouveau (le navigateur peut renvoyer la demande). Mot de passe refusé -> `nasRefuse()` : AUCUN appel
  automatique (copie, vols NPF) tant qu'il n'est pas corrigé (sinon blocage « trop d'essais » de l'adresse, iPad compris).
  L'ancien mot de passe reste la clé de NPF-Q400 (test répond `cle: 'npf'`). 429 -> statut `bloque` (+ `attente`).
- Synchro (v0.23, R50 étape 3, sens unique) : `js/synchro.js` (logique pure : éléments, carte {clé: [rev, empreinte]},
  envoi des seuls changements + suppressions, réception) et `js/ui/synchro.js` (Plus › Synchro du carnet, réseau via
  requete de nas.js : synchro-etat / -recevoir / -envoyer). Rôle par appareil `synchroRole` ('reference' = téléphone qui
  envoie, 'consultation' = PC qui reçoit), `synchroEtat`, `synchroAppareil` : dans REGLAGES_PRIVES (hors sauvegarde).
  Réglages qui voyagent : REGLAGES_PARTAGES. Photos d'avion : jamais envoyées (v0.25). Consultation : `enConsultation()`
  (etat.js) refuse toute écriture du carnet (événement consultation-refus), body.consultation cache les boutons de
  modification, pas de copie NAS ni de vols NPF sur cet appareil ; jamais de copie d'un carnet vide.
- Synchro deux sens (v0.24, R50 étape 4) : rôles 'reference' (téléphone) et 'modification' (PC) envoient ET reçoivent.
  Carte {clé: [rev, empreinte | null (trace de suppression)]} = dernière version commune ; `analyserRecus` : un élément
  reçu ne remplace celui d'ici que s'il n'a pas changé ici depuis (sinon fusion pour REGLAGES_FUSIONNABLES, sinon
  CONFLIT gardé dans synchroEtat.conflits, rien n'est envoyé pour lui avant le choix). Le rev n'avance QUE par la
  réception (jamais par l'envoi). Vol ouvert dans la saisie (`cleVolOuvert`) : jamais changé, conflit. Plus de 20
  suppressions : `aConfirmer` (bandeau), envoi après confirmation. `synchroHistorique` (privé) : « Annuler la dernière
  synchro » (30 j). Opérations sur l'état de la synchro en file (`exclusif`). Vols NPF et copies NAS : téléphone seulement.
  Doublons : `doublons()` parmi les vols créés depuis `deuxSensDepuis` ; `doublonsVus` partagé.
- iPad (v0.25) : 3e appareil, rôle 'modification' comme le PC ; reconnu par `estIPad` (UA iPad, ou Mac tactile :
  iPadOS se présente comme un Mac) -> identifiant 'ipad-…', textes « Cet iPad », « Garder la version de l'iPad »
  (`duNom`, `ceNom`, `leNom` dans synchro.js). Tablette tactile (pointer:coarse, ≥ 700 px) : onglets et « Annuler » ≥ 44 px.
  Barre d'état : padding env(safe-area-inset-top). Carnet d'ici vide : pas de « Confirmer » des suppressions.
  Même origine que NPF-Q400 (grisonb.github.io) : le Carnet ne touche qu'à ses caches (préfixes 'carnet-app-v' / 'carnet-de-vol-v',
  sw.js) et à sa base IndexedDB 'carnet-de-vol' ; aucun localStorage.
- v0.26 : majuscules par défaut (attribut `autocapitalize` : characters pour codes / immatriculations / noms d'avion /
  trigrammes / étiquettes / missions, words pour noms de personnes / terrains / titulaire, sentences pour remarques /
  modèles ; vérifié champ par champ par tests/unitaires/v026.test.js). Bouton `#rafraichir` (haut gauche du Carnet) =
  synchroniser maintenant, `texteRafraichir` (synchro.js). Synchro : envoyeur regroupé sur 0,3 s ; `dernierEnvoi()` à
  visibilitychange hidden / pagehide (requete keepalive, 60 Ko au plus, depuis le carnet en mémoire) ; « N en attente
  d'envoi » (#sync-bandeau.discret) tant que quelque chose n'est pas parti.
- v0.27 : `ouvrirSaisie` remet TOUTES les cases du formulaire à zéro avant de remplir (R64 : Temps IFR / nuit du vol
  précédent repris et enregistrés). R63 : chaque escale a `approches` ; `vol.approches` reste le TOTAL (arrivée +
  escales : PDF, CSV, synchro, sauvegardes inchangés) ; le compteur principal = total − escales (`approchesEscales`).
- v0.28 : carte du Carnet : étiquette `.chip.appr` « N appr. » (total) après l'IFR (R65) ; temps de vol dans une pastille
  `.fl-bloc.t-feu|feu2|mi|ifr|sable` (`couleurTemps` dans js/ui/carnet.js : feu > Entraînement > IFR > sable, mêmes règles
  et mêmes couleurs CSS que les étiquettes) (R66). Plus de bouton flottant : `#fab` = « + » rond vert dans `.tabs`, à droite
  de « Plus » (actif depuis toutes les vues ; saisie modifiée : « Abandonner la saisie ? » puis nouveau vol, `apresAbandon`) (R67).
- v0.53 : R130 `js/inst-exam.js` (`ROLES_IE`, `nomReel` : « SELF » = vide, `instExamDuVol` : pas d'« Inst » en fonction dc,
  `completerInstExam` : clé date + hDep + dep + arr, vols du fichier avec copi ET inst / exam, champ vide seulement).
  Champs du vol `nomInstructeur` / `nomExaminateur` (existants). Saisie : `#ie-add`, `#ie-z` (`#ie-inst`, `#ie-exam`,
  `#ie-nom`, `#ie-res`, `#ie-x`), `F.ie` / `F.ieOrig`, `rendreIE` ; carte : `.chip.fn.fn-copi.fn-ie` ; recherche + examinateur.
  Plus `#pl-ie` / `#file-ie` (`completerIE`, plus.js), réglage PARTAGÉ `rattrapageInstExam` (bouton masqué partout).
- v0.54 : R133 `pastilleFeu` toujours `plein: true` (« Feu n°41, 42 », feu repris avec son numéro ; `.chip.feu2` n'est plus
  produit). R132 carte : pastille de règle « MISSION » affichée « Mission ». R134 `repartitionAtterrissages(n, nuitDebut,
  nuitFin)` (js/nuit.js) ; saisie : `repartirAtt` (arrivée = total − escales, `F.attEsc` = escales connues), `signatureAtt`
  (heures, terrains, escales, position d'arrivée) ; `F.attSig` posé à l'ouverture d'un vol enregistré (aucun rattrapage) ;
  « Att. Nuit » ± = correction gardée ; NPF : escales + 1 à l'arrivée, réparti par la règle. R135 libellés « Dash 8 / CdB »…
  R131 `FONCTIONS.cdb.puce` = 'CdB'.
- v0.55 : R136 fiche personne `#p-modal` (Nom, Prénom, Trigramme ; z-index 30, devant `#outil`) ; `enregistrerPersonneEtVols`,
  `indexDesPersonnes` / `nomAfficheVol` (etat.js) ; saisie : `montrerNom` + `F.affOrig` / `texteGarde` (texte enregistré
  gardé tant qu'on n'y touche pas). R137 « Trace du vol » / « Traces des vols ». R139 vol `traceImportee` { nom, format, n,
  nOrigine, t0, pts, importeLe } ; carte.js `etatDuVol` (importée d'abord), `majImport`, `#tr-imp`, `#file-trace`, `#tr-info`,
  `#tr-x` ; saisie `enregistrer()` reprend `traceImportee` de la dernière version ; `lots(liste, n, octets)` + `ENVOI_OCTETS`.
  R140 Plus : `#pl-save`, `#pl-sync` (`resumeLigneSynchro`), `#pl-restore` (`ecranRestaurer` : `#rs-fichier` / `#rs-nas`) ;
  `#sy-nas` (ui/synchro.js) ouvre `ecranNas` ; `verifierRappel` : classe `alerte` (`copieEnEchec`, `copieBloquee`), bouton
  `#pl-bk-go` mode `nas`. R141 / R142 : `#pl-fiches`, `#pl-import`, `#pl-ie` retirés (`#file-flylog` caché gardé pour les
  tests). R143 Totaux `.sec.repli` (`.sec-t`, `poserSections`), réglage privé `totauxOuverts`, `#t-tri`.
- v0.56 : R144 réglages PARTAGÉS `compteursFiches` { cle: { nom, totaux, masque, cree, creeLe, supprime } } et `compteursTypes`
  { code: [cles] } (`compteurs` = l'ordre, comme avant, « on » gardé : sert au départ DH8D) ; avion `compteursPropres` (null =
  comme le type) ; vol `compteursAjoutes`. `listeDesCompteurs()` (etat.js). Saisie : `#ctr-open` « Compteurs › » ouvre
  `#cpt-modal` (`#cptm-list` : `.cbox[data-ck]`, `[data-mv]`), question `#cpc-modal` (`#cpc-b [data-po]`) ; `#ctr-zone` /
  `#ctr-panel` supprimés. Fiche type `#te-cps`, fiche avion `#fi-cpsec` (`#fi-cp-sw`, `#fi-cps`). Totaux : `t.parCompteur`
  (créés), `valeurCompteur`. CSV : `colonnesTableur(liste)`. R145 ordre de Plus, `#pl-compteurs`. R146 `lireDerniereVersionNas`
  / `derniereVersionGardee` (ui/nas.js), réglage privé `nasDerniereVersion`.
- v0.57 : R147 `departDuType` ne coche plus `amerrSEP` pour les types SEP (aucun type ne l'a de départ).
- v0.58 : R147 (bis) cases du bloc du vol centrées (`#v-saisie .c-vol .aprow|.blocrow`, `text-indent:.04em` compense
  l'espacement des lettres). R148 `champOACI(sel, suivant, apres, { espace: 'LFML' })` (lu dans `input`, clavier Android).
  R149 `js/vols-groupes.js` ; réglage PARTAGÉ `volsGroupesTypes` { code: bool } ; `avion.volsGroupes` (null = comme le type) ;
  vol `volsGroupes: true` + `tempsTotal` tapé (`#vg-zone`, `#f-vg`, `#f-bloc-in`, `F.groupe`, `recalculerGroupe` : ni nuit ni
  R134) ; fiches `#te-vg`, `#fi-vg-sw`. R150 `alerteTemps` + `#tv-modal` (`confirmerTemps` dans `enregistrer`, pas pour NPF).
- v0.59 : R151 profil sous la trace : `js/profil.js` (pur : `profilDeTrace` points [t, lat, lon, alt ft, gs kt?] -> vitesse fournie
  sinon calculée sur 30 s, aberrants isolés ignorés ; `valeursA`, `echelle`, `graduationsTemps`) et `js/ui/profil.js` (SVG
  `#profil` / `#pf-val` / `#pf-svg` / `#pf-leg`, `afficherProfil`, `changerFuseauProfil` appelé par `changerMode`) ; carte.js
  `montrerProfil` (point jaune `path.pf-point` sur `#carte-mini`). `traceImportee.a` = altitude (dizaines de ft), `.v` = vitesse mesurée (kt ; GPX `<mytracks:speed>` km/h, `<speed>` m/s) ; `decouper`
  garde tout après lat / lon. VPS : altitude oui, vitesse sol non (plan proposé, rien exécuté).
- v0.60 : R152 `#cp-pf` « Profil » + `#cp-profil` (carte plein écran, classe `avec-profil` : la carte s'arrête au-dessus,
  `--cp-pf-h`) ; ui/profil.js : deux zones (`afficherProfilPlein`, `aUnProfil`, `_profilPlein`) ; carte.js `pointJaune(carte)`
  (la carte suit le point), `majProfilPlein`, réglage PRIVÉ `profilPlein`. Synchro : `cleVolOuvert()` = vol en MODIFICATION
  seulement (lecture : mis à jour, `rafraichirVolLu`) ; conflit d'un vol ouvert non modifié ici appliqué dès sa fermeture ;
  un conflit n'est effacé que par une version reçue au moins aussi récente (`a.carte[k][0] >= c.rev`).
- v0.61 : R154 `js/report.js` (`estAReporter` : vol `aReporter: true` ; absent = reporté ; `basculerReport` + `reporteLe` ;
  `seulReportDiffere` / `plusRecentReport` utilisés par `analyserRecus` : rond seul changé des deux côtés -> le plus récent).
  carnet.js : `.fl-rep[data-rep]` (SVG, zone 40 px), `#rep-ligne` / `#rep-n` / `#rep-tous`, `filtreReport` (supprimés en v0.66) ; saisie : nouveau vol
  (pas simulation) `aReporter: true` ; `enregistrerVol(v, { garderDate })` (etat.js) garde `modifieLe`.
  R155 `js/anomalies.js` (`anomaliesDuCarnet(vols, avions, terrainDe)` -> Map id -> [{ type a..h, texte }], `anomaliesDuVol`,
  `ignorer` / `estIgnore` : vol `anomaliesIgnorees` { empreinte des CHAMPS contrôlés, le }) ; `js/ui/anomalies.js` (cache par
  `etat.revision`, `TRIANGLE`) ; carnet.js `.fl-an` + `.flight.avec-an`, `#an-btn` / `#an-n`, `filtreAnomalies` (exclusif avec
  `filtreReport`) ; saisie `#an-cadre` / `#an-l` / `#an-ign` (permis en lecture). report.js `fusionnerEtats` (synchro).
- v0.62 : R156 `js/anomalies-traitees.js` (pur : `correctionALaSaisie`, `avantApres`, `ajouterCorrigees` (300 lignes au plus),
  `corrigeesAffichees`, `ignoreesAffichees`, `rattrapage` : clé `cleDoublon` avec quantités, à défaut même ligne du fichier + date) ;
  anomalies avec `cle` (« a|LFML », « c-nuit »…), `anomaliesDuCarnet(…, { avecIgnorees })`, `nePlusIgnorer` (empreinte null, heure
  gardée). Réglages PARTAGÉS `anomaliesCorrigees` (fusionnable : réunion par id) et `rattrapageCorrections` ; PRIVÉ `questionCorrections`
  ('a-poser' si le carnet a des vols FlyLog au premier lancement, 'non', 'posee'). `js/ui/anomalies-traitees.js` : `#pl-anom` /
  `#pl-anom-n`, écran `ecranAnomaliesTraitees` (`#at-c`, `#at-i`, `#at-l .lv[data-vol]`, `[data-np]`, `#at-fl`, `#at-res`), question
  `#rq-modal` (`#rq-oui`, `#rq-non`), `#file-rq` ; saisie `enregistrer` -> `noterCorrection` ; app.js `ouvrir-vol-traite` (retour à
  l'écran à la fermeture du vol).
- v0.63 : R157 `js/suivi.js` (pur : `textesDuVol` (champs suivis -> texte ; `att:CODE`, `cpt:cle`), `majSuivi`, `suiviDepuisFlyLog`,
  `lignesSuivi`) ; réglage PARTAGÉ `suivi-<id du vol>` = { o: { champ: texte d'origine }, le } (un élément par vol ; `estReglagePartage`
  dans synchro.js remplace `REGLAGES_PARTAGES.includes` partout) ; `enregistrerReglages(liste)` (etat.js, une écriture). Pas suivis :
  rond, « ignoré », trace, « Modifié le », champs techniques. anomalies-traitees.js `cartesTraitees` (une carte par vol : Corrigées /
  Modifiés), `rattrapageSuivis`, `OCTETS_CORRIGEES`. Onglet `#at-m` ; question v0.63 : PRIVÉ `questionModifications`, PARTAGÉ
  `rattrapageModifications` (la question v0.62 n'est plus posée). Suivi noté seulement par la saisie (`noterCorrection`).
- v0.64 : R158 saisie `sansCodeVM()` : terrain intermédiaire avec `nom` et sans code : `#vm-ok` accepté (code vide, nom gardé).
  R159 `recalculer` : `F.garde` (valeurs enregistrées à l'ouverture) + `sigHeures` / `sigNuit` : temps de vol, colonne, fonction, IFR
  recalculés seulement si date / heures changent, nuit si date / heures / terrains changent (retour à l'origine : valeurs enregistrées ;
  vol enregistré en vols groupés : `F.garde.groupe`, tout recalculé quand on éteint) ;
  nuit tapée : `F.nuitMain`, vol `nuitManuelle: true` (jamais remplacée) ; `signatureAtt` sans les nombres d'att. des escales (delta
  ajouté). Anomalies traitées : ligne `tempsNuit` -> `[data-remettre]` « Remettre 0hMM » (lignesSuivi : `origine`). R160
  `arrondiDixieme` (temps.js) sur la nuit calculée (et proposée, ancien vol), plafonnée au temps de vol. R161 carnet.js `.fl-tps` > `.fl-dix` (`enDixiemes`,
  couleur `var(--vol)`) + `.fl-bloc`.
- v0.65 : R158b terrain intermédiaire sans code : le nom peut être dans `nom` (NPF) OU dans `code` (import FlyLog : route
  « LFTW|NOM AVEC ESPACES|LFTW ») ; `formeCode` / `nomSansCode` (saisie.js) : tout ce qui n'est pas 4 lettres / chiffres est un nom ;
  fenêtre : champ du code vide (pas de focus, « LF » toléré), « <nom> · Terrain sans code OACI », « Valider » garde code et nom.
- v0.66 : R162 ligne « À reporter sur le carnet » (`#rep-ligne`, `#rep-n`, `#rep-tous`) et `filtreReport` supprimés ; le rond `.fl-rep` reste ;
  `#an-btn` seul filtre (`filtreAnomalies`).
- v0.67 : R163 anomalie `i` « Att. de nuit sans temps de nuit » (attNuit ≥ 1, tempsNuit 0). R164 (corrigé ; R165 « Format Tps de
  Vol » global retiré, `formatTemps` ignoré s'il arrive) : « Temps en dixièmes » PAR TYPE, réglage PARTAGÉ `dixiemesTypes` { code: bool }
  (absent : DH8D et CL2T allumés, `DIXIEMES_DEFAUT`), vols-groupes.js `dixiemesDuType` / `dixiemesAvion` ; fiche type `#te-dx`.
  Tests : `serveur()` pose `CARNET_DIXIEMES_DEFAUT = []` (anciens tests en heures avec des Dash 8 inventés) ; `serveur({ dixiemesDefaut: null })`
  = départ réel de l'app (v067.mjs).
  Affichage seulement : carnet.js `carteVol` (fl-bloc, bulles IFR / Nuit), saisie (`dxSaisie`, `D`, `poser` / `lireChamp` : data-min =
  minutes exactes tant que le champ n'a pas reçu de frappe ; `reformaterDurees` au changement d'avion). temps.js `enDixiemesPoint`
  (« 1.4 »), `dureeAffichee`, `lireDuree` lit « 1.4 » / « 1,4 ». Totaux, PDF, CSV, alerte R150, Anomalies traitées : heures et minutes.
  `.fl-dix` (R161) supprimé.
- v0.68 : R166 frais d'escale. `js/frais.js` (pur : montants en CENTIMES, `euros`, `lireMontant`, `baremeDe` (France d'office), `calculer`
  (Euro : 1 par nuit, la dernière 1,5 ; Monde : 1 par jour au pays de sa nuit ; zone = pays principal / pays de la nuit),
  `lignesFrais` (détachements, vols journée par jour, J+2 par paires de jours, sinon « incomplet »), `anneeFrais`, `anneesFrais`).
  Données : vol `frais` { type 'journee' | 'j2' | null, pays, le } (écrit avec `garderDate`, fusionné par `fusionnerEtats`, hors
  `seulReportDiffere`) ; réglages PARTAGÉS `detachement-<id>` { id, du, au, pays, nuits (exceptions), le | supprime } et `bareme-<année>`
  (`estCleFrais` dans `estReglagePartage`). `js/ui/frais.js` : zone `#fe-zone` (permise en lecture), fenêtre `#dt-modal`, Plus `#pl-frais`
  (`ecranFrais`, `ecranAnneeFrais`, `#fb-*` barème, `#fa-l` lignes, `#fa-pdf`), `modelePdf` / `dessinerPdf` (jsPDF portrait, « € » permis).
  app.js : événement `ouvrir-vol-retour` { id, retour }.
- v0.52 : R126 `.chip.fn.fn-cdb|fn-copi` (carnet.js `fnClasse`) ; contours : bord 1 px (déjà là, transparent) en `currentColor`
  ou `--bord-plein` (feu, ent, gaar, nuit) + liseré 0,5 px, sélecteurs `:root .flight .chips …` (plus précis que les règles
  de couleur). R127 `NOMS_AFFICHES` / `nomAffiche` (bande.js) : « Dash 8 Q400 » affiché « Dash 8 », clés inchangées.
  R128 clé `familleAnnee:<famille>` (familles détaillées) ; `t.parFamilleAnnee` (totaux.js, `calculerTotaux(vols, avions,
  aujourdhui)`) ; clé du cache des totaux de l'accueil + le jour. R129 `#v-carnet .hstrip span{text-transform:none}`.
  Socle sans text-box (`rognerSansTextBox`) : centré sur la hauteur des capitales (« H », comme text-box), ligne de base
  calée sur un pixel de l'écran en coordonnées de la page (le centrage ne dépend plus de la position de la case).
- v0.51 : R125 `.sc-l` en flex (hauteur de la case), chaque `span` rogné (`text-box` sinon `rognerSansTextBox` : ligne de base
  mesurée avec un repère + encre mesurée sur une police de 1000 px) et centré seul ; `ajusterSocle` (js/ui/socle.js, appelé
  par `afficherSocle` et `ajusterEntete`) : `--sc-t` / `--sc-j` / `--sc-e` arrondis au pixel, × largeur / largeur à 360 px
  (au plus 30 / 26), marges ≥ 10 px ; sans text-box : couples vérifiés 17/26, 19/28, 20/30 (l'ancien Chrome dessine de
  travers à certaines tailles : titre 18, J- 29).
- v0.50 : R124 `SOCLE_COLONNES.ops` = « Vol OPS avant le » (js/socle.js) ; « Vol OPS a partir du » et « Entrainement avant le »
  ne sont jamais lus.
- v0.49 : R123 réglages partagés : `enregistrerReglage` (etat.js) écrit `{ cle, valeur, modifieLe }` ; `elementsDuCarnet` /
  `trierRecus` font voyager `modifieLe` ; `analyserRecus` : réglage non fusionnable changé des deux côtés -> le plus récent
  (`modifieLe`, sinon `le` du NAS ; inconnu ici -> NAS), plus de conflit ; `reglageVide` + `videDOrigine` : vide jamais
  échangé ni envoyé ni « modifié ici ». `rattraperReglages` (ui/synchro.js) : si `synchroEtat.reglagesConnus` ne contient
  pas tout REGLAGES_PARTAGES -> relecture depuis 0 des réglages absents de la carte (deux sens) / de tous (consultation),
  une fois. Cause du constat : la v0.47 sautait `socleAdresse` en avançant son repère.
- v0.48 : R122 `js/socle.js` (pur : `lireReponseSocle`, `echeance`, `normaliserTitre`, `SOCLE_COLONNES`) et `js/ui/socle.js`
  (`lireSocle` une à la fois, fetch GET 20 s ; `afficherSocle` -> `#h-socle` `.sc.sc-vert|orange|rouge|gris` ; Plus
  `#pl-socle` -> écran « Socle OPS / IFR » `#so-adr` / `#so-test` / `#so-ok`). Réglage PARTAGÉ `socleAdresse`
  (REGLAGES_PARTAGES : synchro, sauvegarde, copie NAS ; jamais dans le code ni les tests : faux serveur local) ; réglage
  PRIVÉ `socleLu` { le, ops: { avantLe, dernier }, ifr }. Lecture : lancement, visibilitychange, `#rafraichir`, changement
  d'adresse (`surChangement`). Centrage : `text-box` sinon marges -4,75 / -2,25 px (mesurées au pixel). Bande : padding 4 px.
- v0.47 : R121 `verifierVolsNpf({ essai })` (js/ui/npf.js) renvoie `{ statut, n }`, une seule recherche à la fois (promesse
  `recherche` partagée), échec -> un nouvel essai `NPF_REESSAI` (1 min, pas d'essai en chaîne), `setInterval` `NPF_PERIODE`
  (2 min) seulement si `document.visibilityState === 'visible'` ; `texteNpf`. Bouton `#rafraichir` (ui/synchro.js) :
  `Promise.all([synchroniser(), verifierVolsNpf()])`, message « … · N vols NPF à importer » (échec NPF affiché seulement
  si la synchro a réussi ou n'est pas activée).
- v0.46 : R117 `#f-copi` 20 px 700, line-height 22,4 px et height 46,4 px figées (placeholder 16 px). R118 `#f-date.datein`
  700, `--date-t` (`ajusterDate`, saisie.js : canvas, 24 à 14 px, réserve de l'icône 28 px sauf Safari), line-height figée
  y compris `::-webkit-datetime-edit*`, icône `::-webkit-calendar-picker-indicator` en 16 px (sinon la case grandit).
  R120 `familleAvion` / `FAMILLES_PAR_CODE` (modele.js : DH8D -> Dash 8 Q400, CL2T -> CL-415, sinon modèle, sinon code),
  `t.parFamille|CdB|Copi` (totaux.js), clés `famille:` / `familleCdB:` / `familleCopi:` (bande.js, `FAMILLES_DETAILLEES`),
  `normaliserBande` (anciennes clés `type:` converties à l'affichage, `bandeChoisie()` dans carnet.js ; écrit au premier
  changement seulement : pas de conflit de synchro). Anciennes clés toujours lues par `valeurBande`. Bande : cases
  `min-width:min-content` (c'est la bande entière qui doit tenir) ; `ajusterLigne` : libellés -> 10 px, valeurs -> 14 px,
  libellés -> 8 px, valeurs -> 9 px, puis regrossit valeurs et libellés tant que tout tient ; dernier recours : classe
  `serre` (cases rétrécissables, « … » sur les libellés).
- v0.45 : R114 `.fl-tete>.fl-route{margin-top:2px}` (trajet descendu de 4 px). R116 `.fl-tete>.fl-bloc{position:relative;
  top:-2.5px}` (haut de la pastille = haut du contour de la date). R115 `.flight .fl-id` en flex : `.fl-nm` / `.fl-reg` 17 px
  (flex:none), `.fl-mod` 15 px (`--mod`, « … » sur lui seul), `.fl-meta` 15 px ; `ajusterTypes()` (carnet.js) réduit le type
  jusqu'à 13 px (cartes nouvelles à chaque paquet ; toutes au changement de taille / police prête).
- v0.44 : R109 date dans un contour (`--date-cadre`, bord 1 px + liseré 0,5 px, rayon 8, line-height 1, `text-box:trim-both cap
  alphabetic` ; repli `@supports not` : padding 1 / 2 px mesuré au pixel), `top:-2px` + trajet `margin-top:-2px` ; mois
  `#list .month` 18 px 800. R110 `--fond-accueil` (#d4deec) : `body:has(#v-carnet:not([hidden]))` et `--bg` de `#v-carnet`.
  R111 `.hrow` en flex : `.h-cote` (version + `#rafraichir`), `#h-carte` (`.h-lab`, `#h-total` avec `<small>h</small>`),
  `#q-open` ; `ajusterEntete()` (carnet.js) : police du total (38 px max) et des bandes `#h-strip` / `#h-quick` (variables
  `--bv` / `--bl`, repères REPERES, passes jusqu'à stabilité ; refait sur `resize`, `orientationchange`, `visualViewport`
  resize et dans `montrer('carnet')` ; PAS de ResizeObserver : Safari signalait « ResizeObserver loop »). Ligne avion de la
  saisie : son ResizeObserver n'agit que si la largeur change, à l'image suivante. R112 lecture seule
  de la saisie (saisie.js `fixerLecture`, `enLecture`, classe `#v-saisie.lecture` + `body.vol-lecture`, champs `readOnly`
  marqués `data-lecture`, `bloquerEnLecture` en capture sauf `AUTORISES_LECTURE`) ; crayon `#f-edit` ; `#cancel` « Fermer » /
  « Annuler » (vol enregistré -> retour en lecture) ; `ouvrirSaisie(vol, { modifier })` ; carte.js `volEnLecture()` fige les
  flammes ; `saisieModifiee()` faux en lecture. R113 `tests/lancer.mjs` (rapide / complet).
- v0.43 : R106 `.fl-tete>.fl-date{position:relative;top:-4px}` (décalage visuel seulement, rien d'autre ne bouge).
- v0.42 : R104 `#hs-jours` (menu `#hs-modal`) -> réglage privé `afficherJours` (REGLAGES_PRIVES, `ecrireReglageDiscret`) :
  `#h-quick` caché s'il vaut false. R105 carteVol : `.fl-top.fl-tete` en grille (date `.fl-date` ligne 1, `.fl-route` ligne 2,
  `.fl-bloc` à droite sur les deux lignes) ; `.fl-id` sans la date.
- v0.41 : R102 manifest background_color #0f1b35 ; `#lancement` (index.html, style en ligne) écran de lancement bleu nuit
  plein écran, retiré par `finLancement()` (app.js : carnet prêt, erreur, déménagement) ou de lui-même après 8 s (CSS).
  R103 `.flight.swfront` : bord 1 px `--carte-bord` + liseré 0,5 px (box-shadow) + `--carte-ombre` ; `.flight.sim` garde son rouge.
- v0.40 : R101 nom « Carnet de Vol » (manifest name / short_name, title, apple-mobile-web-app-title, `.pver`) ; id / start_url / scope inchangés.
- v0.39 : nouvelle adresse /Carnet-de-vol/ et icône du pilote (`icones/icon-192|512.png`, `apple-touch-icon.png`, `favicon-32.png`,
  `favicon.ico`). `js/demenagement.js` : à l'ANCIENNE adresse, si la nouvelle répond (`nouvelleAdresseRepond`, fichier de version
  sans cache) -> `#demenage` (app.js `demenager`, carnet non lancé) + `estDemenage()` : db.js refuse toute écriture
  (`verifierEcriture`), `requete` (ui/nas.js) répond `demenage` sans réseau. Revérifié au retour du réseau / au premier plan.
- v0.38 : R93 `js/cadrage.js` (`placement`, `deplacer`, `zoomer`, `cadrageValide` ; cadrage { cx, cy, z ≥ 1 }) et
  `js/ui/cadrage.js` (`ouvrirCadrage` -> `#rc-modal`, `placerPhoto`, `afficherPhotoCadree`) ; avion `photoCadre` (fiche :
  `#fi-rc` « Recadrer », ouverture auto au chargement d'une photo) ; retiré avec la photo (synchro `elementsDuCarnet`,
  `sansPhotos`), gardé par `garderPhotos` et `ecrireIci`. R94-R99 carnet.js : classe `vol-<couleurTemps>` sur `.flight`
  (jetons `--c-feu|gaar|ent|ifr|sable`, `--vol`) ; pastille blanche contour 4 px ; `.fl-rem` noir + barre `--vol` ;
  `.chip.hl.lrg-feu|lrg-ent` ; `.chip.att` (jour) ; `.chip.nuit.att-nuit` ; `.chip.appr` bleu IFR.
- v0.37 : R89 « 3 att », « 3 appr » sans point (carnet.js, `pastilleNombre` de saisie.js). R90 `ajusterAvion` (saisie.js) :
  `#ac-cur .t` sur une ligne, tailles × `--ac-k` (≥ 12 px), classe `coupe` (« … » sur le type) en dernier recours ;
  ResizeObserver + `document.fonts.ready`. R91 `compteursRanges` (modele.js) : entrée `{ cle: 'feux' }` dans le réglage
  « compteurs » (absente = en premier) ; `rendreCompteurs` déplace `#feu-row` (même élément, mêmes boutons) dans `#ctrs`.
- v0.36 : R88 `plusGrandFeu(vols, exclureId, avecSimulation)` : `avecSimulation` = vol de simulation (brouillonNpf,
  `prochainFeu` / mise à jour NPF de la saisie avec `F.simulation`) -> les n° se suivent entre simulations ; vrai vol :
  simulations ignorées (inchangé). NPF n'envoie aucun n° de feu.
- v0.35 : R85 `estSimulation` / `volsReels` (modele.js) : vol `simulation: true` (NPF-Q400-RUN, `brouillonNpf`) exclu de
  `calculerTotaux`, `heuresDerniersJours`, `totalHdV`, onglet Totaux, PDF (plus.js), `plusGrandFeu`, `volAvecNumero`,
  `dernier` de la saisie, `doublons` (synchro.js), anti-doublon FlyLog ; gardé partout ailleurs ; bandeaux `.sim-bandeau`
  (`#f-sim`, `#cp-sim` + `#carte-plein.avec-sim`, `.fl-sim`, `.sim-ligne` du bandeau / liste NPF) ; CSV « Simulation » ;
  KML « SIMULATION – ». R86 texte blanc gras : feu #d32f2f, contour #d32f2f (sombre #ef5350 / #ff8a80), Entraînement
  #c8650f, `.chip.mi.gaar` #d81b60 (carnet.js) ; autres `.chip.mi` inchangées. R87 `couleurTemps` : feu > GAAR (`t-gaar`, framboise)
  > Entraînement > IFR > sable.
- v0.34 : R84 `.chip.feu`, `.fl-bloc.t-feu` en #e5534b / #2a0503 (sombre texte #1f0302) ; `.chip.feu2` bord #e5534b, texte
  #b3261e (sombre #ff8a80). Variables `--feu` / `--feu-soft` (saisie, messages) inchangées.
- v0.33 : R82 style KML (js/kml.js : `ICONE_FLAMME` = icône Google Earth web n°`ICONE_ID` 2124 bleue, `ICONE_TAILLE` 0.8,
  hotSpot 64/128, libellé `LIBELLE_COULEUR` ff2dc0fb). R83 `#cp-ge` dans `.cp-bas` (sous la carte, avec le crédit ;
  `#carte-plein.avec-ge` réserve la place avant de créer la carte), icône `PARTAGE` (commun.js) ; Android (pas de partage
  des .kml dans Chrome) : téléchargement + message.
- v0.32 : R76 `F.ancien` (vol enregistré avec temps de vol, sans heures) : `heureAncienVol` calcule l'autre heure
  (temps de vol fixe), `recalculerAncien` ne touche JAMAIS nuit / IFR / att. / colonnes et propose `#nuit-calc`
  (« Appliquer »). `enregistrer()` garde la colonne avion telle quelle si sa valeur comptée ne change pas. R77 `#ac-cur` :
  ordre DOM reg / sub / type, « / » en ::before. R78 `#v-saisie .field>label, .flabel` en 17 px / 600 / --ink.
  R79 `#feu-num` (dans `#fire-next`) -> `#fn-modal` (`ouvrirNumeroFeu`, `validerNumeroFeu`, `remplacerNumero`,
  `volAvecNumero` ; sans feu : `F.feuChoisi` pour le prochain « + ») ; règle `plusGrandFeu` inchangée (carrière).
  R81 `js/kml.js` (`kmlDuVol`, `numerosDesFeux` : n° gardé, sinon ligne de la même commune `communeNpf`, sinon ordre) ;
  `envoyerGoogleEarth` (carte.js) -> `proposerFichier(…, { partager: true })` ; GUIDE.md (import dans Google Earth).
- v0.31 : R70 étiquette « Entraînement » `.chip.mi.ent` + pastille `.fl-bloc.t-mi` (#f0a050 / #3f1c02 ; sombre #d97b2b / #1f0d00).
  R71 période de la loupe (`#p-du`, `#p-au`, `periodeDe`, `lireJour`, `formaterJour` dans js/ui/carnet.js ; `dateAffichee`
  mémorisée par vol) : seuls #h-total et la bande suivent (`volsDuHaut`), #h-quick masqué, bandeau `#periode-bandeau`.
  R72 flammes (js/ui/carte.js, plein écran seulement, pas en consultation) : appui long 0,6 s = déplacement (pointer
  events), toucher = bulle « Supprimer ce feu », fenêtre `#feu-modal` ; `communeDe` = géocodage inverse IGN
  (`CARNET_GEOCODAGE`, index=parcel puis address) ; hors ligne : `communeAVenir` + réglage privé `feuxCommunesEnAttente`
  (`recalculerCommunes` au retour du réseau) ; vol marqué `feuxRetouches` : la mise à jour NPF garde ses flammes sauf
  `#npf-feux` (« Reprendre… ») ; `enregistrer()` de la saisie reprend `feuxPositions` de la dernière version enregistrée.
  R73 `poserFond` : Plan (OSM) / Photo (`CARNET_TUILES_PHOTO`, WMTS IGN ORTHOIMAGERY.ORTHOPHOTOS, « © IGN »),
  réglage privé `carteFond` ; jamais en cache (le service worker ne garde que les fichiers de l'app). R74 `.viachip` :
  `.vc-nom` (« … ») + `.vc-n` pastilles `.vc-p` (`.zero` en gris).
- v0.30 (R69) : libellés des compteurs de la saisie (`.step>span:first-child`, `.mlbl`) en `--ink`, 600, 17 px ; « (n°…) » (`.step small.hint`) 14 px gris foncé (clair/sombre) ; `.step .ctl` ne rétrécit pas.
- v0.29 (R68) : `couleurTemps` rend `feu` pour TOUT vol feu (plus de pastille `t-feu2` en contour) ; l'étiquette `.chip.feu2` reste en contour.
- Photos d'Internet (v0.21, R34) : `js/photos-web.js` (Commons : catégorie « immat (aircraft) » puis titres ; Planespotters)
  et `js/ui/photo-web.js` (fenêtre #ph-modal). Commons : photo choisie gardée avec `photoCredit` {source, auteur, licence,
  licenceUrl, page, titre}, crédit affiché sous la photo (#fi-credit). Planespotters : AFFICHÉE seulement (ses règles
  interdisent de garder l'image), adresses inchangées, lien vers sa page sans nofollow. Tests : `CARNET_COMMONS`,
  `CARNET_PLANESPOTTERS` (faux serveurs locaux). `photoCredit` suit `photo` (copie NAS, restauration).
- Référence d'interface : maquette v19 (`../donnees-privees/maquette-carnet-v19.html`, contient de vraies données :
  jamais dans le dépôt) et remarques P1-P6, R1-R15.
- `js/app.js` démarre l'app.

### Données (IndexedDB « carnet-de-vol »)

Magasins `vols`, `avions`, `personnes` (clé `id` UUID, `creeLe`, `modifieLe` : prêt pour la copie NAS v0.2),
`suppressions` (traces des suppressions pour la synchro), `reglages` (compteurs, règles de pastilles,
étiquettes, missions ajoutées, titulaire, date de dernière sauvegarde, types modifiés, référence du contrôle).

Un vol stocke les heures bloc en **UTC** (`date` = date UTC du départ, `hDep`, `hArr`) et `mode` ('loc'|'utc')
pour l'affichage. Colonnes avion `tempsSE/ME/MP` : `null` = déduit de la fiche avion ; valeur = saisie.
Monopilote SE/ME = temps total − part multipilote du vol (c'est ainsi que FlyLog compte).
Avion : `nom` (court, affiché en gras dans la saisie), `indicatif` (radio, seulement dans la fiche),
`etiquettes` (proposées dans la saisie ; défaut : DH8D -> BOMBING + TRANSPORT, train classique -> TAILWHEEL).
BOMBING et TRANSPORT s'excluent sur un vol. Suggestions de missions masquées : réglage `missionsMasquees`
(on ne modifie jamais le texte des vols). Compteurs du bloc Mission par type d'avion : `COMPTEURS_PAR_TYPE`
(`modele.js`, DH8D seulement pour l'instant). Bande d'heures : réglage `bandeHeures` (liste ordonnée de clés, rangée avec ↑ ↓ dans la fenêtre de choix). Migrations de données : `etat.js` (`migrer`, une fois, drapeau en réglage).

## Tests

**Deux commandes (v0.44, R113)** — chaque test tourne à part, un échec n'arrête pas la suite, durée de chaque test et résumé
à la fin, journaux dans `tests/navigateur/journaux/` (non commités) :
- `npm run test:rapide` : TEST RAPIDE (10 min au plus) : tests unitaires + test navigateur de la version en cours (le plus
  grand `vNNN.mjs`, ou d'autres en arguments : `node tests/lancer.mjs rapide v031`) + non-régression courte (`RAPIDE`
  dans `tests/lancer.mjs` : parcours = lancement sans erreur, vol, sauvegarde / restauration, PDF ; mise-a-jour = mise à
  jour de version sans perte ; v012 = synchro NAS de base sur un faux NAS ; accueil 390 / 360 px dans le test de la
  version). Plus le contrôle avec le vrai fichier (ci-dessous, à lancer à la main). Passe AUTOMATIQUEMENT en test complet
  si des fichiers « sensibles » ont changé depuis le dernier commit (synchro, import, sauvegarde / restauration, format
  des données, service worker : liste `SENSIBLES`).
- `npm run test:complet` (= `npm run test:navigateur`) : TEST COMPLET, toute la batterie (liste `COMPLET`), à la demande.
- Aucun test n'a été supprimé : on ne fait que les déplacer entre `RAPIDE` et `COMPLET` (accord de l'utilisateur requis
  pour supprimer).

- `npm test` : tests unitaires (Node, vols inventés).
- `node tests/navigateur/parcours.mjs` : parcours complet Chromium, émulation Pixel 7.
- `node tests/navigateur/installation.mjs` : manifeste installable, id distinct des autres apps du site,
  service worker limité au Carnet (le serveur de test sert l'app sous /Carnet-de-vol/ ; `serveur({ dossiers })` peut aussi servir l'ancienne
  adresse /Carnet-de-vol-TEST/, `fermerDossier` la fait répondre 404). `mise-a-jour.mjs` reste à l'ancienne adresse.
- `node tests/navigateur/mise-a-jour.mjs` : mise à jour d'une app installée (v0.1, v0.2, version suivante).
- `node tests/navigateur/v04.mjs` : écrans v0.4 à 390 px (migration v0.3, avion, étiquettes, monopilote,
  fiche lecture seule, terrains) + captures `tests/navigateur/captures/v04-*.png`.
- `node tests/navigateur/v05.mjs` : glisser une suggestion de mission pour la supprimer (glissés tactiles simulés
  par le protocole DevTools), Annuler, suggestions masquées, sauvegarde / restauration.
- `node tests/navigateur/v06.mjs` : bande d'heures, libellés missions, suppression d'un vol par glissé, compteurs DH8D.
- `node tests/navigateur/v07.mjs` : bande d'heures sous le TOTAL, ordre ↑ ↓, Feux / Largages CdB Dash.
- `node tests/navigateur/v08.mjs` : Carte du vol avec FAUX serveur de traces et de tuiles (jamais le vrai VPS).
- `node tests/navigateur/v09.mjs` : boutons × rouges, menu Plus par sections, flèche retour, appui long, recherche par date.
- `node tests/navigateur/v010.mjs` : types d'avion ; copie NAS avec un FAUX NAS local (regroupement, NAS injoignable,
  hors ligne, mot de passe refusé, restauration d'une version).
- `node tests/navigateur/v011.mjs` : carte de vol du Carnet (date, nom / immatriculation, modèle coupé, mission), clair / sombre.
- `node tests/navigateur/v012.mjs` : copie NAS avec un FAUX NAS qui imite le Synology (pages d'erreur sans CORS) :
  protocole 2 (`&v=2`, erreurs lisibles), NAS sans zlib (`&vols=N`), ancien script.
- `node tests/navigateur/v013.mjs` : place gardée dans la liste, « Voir dans le carnet », « ↑ Dernier vol » (600 vols inventés).
- `node tests/navigateur/v014.mjs` : copie NAS sans photos, sauvegarde avec photos, restauration qui garde les photos,
  Entrée de la recherche, PDF depuis l'app. PDF sous Node : `tests/outils/pdf-noeud.js` (enregistreur : chaque case et
  chaque texte, pour vérifier que rien ne déborde) et `tests/outils/vols-pdf.js` (vols inventés difficiles).
- `node tests/navigateur/v015.mjs` : vols NPF-Q400 avec un FAUX NAS v3 (bandeau, liste, brouillon LOC / UTC, minuit UTC,
  avion inconnu, 0 / 1 / 3 feux, Enregistrer -> retrait, Ignorer, mise à jour du même id, carte des feux hors ligne).
- `node tests/navigateur/v016.mjs` : vols NPF au format 2 (avion par nom, deux avions du même nom, escales ordonnées
  jour / nuit, pélicandrome sans code, copilote trouvé / inconnu, ce qui change, format 1 toujours lu).
- `node tests/navigateur/v016b.mjs` : terrains par défaut d'un nouveau vol (-> LFTW), sélection du code au toucher, bouton
  « LF » (2 lettres, hors LF, mémorisé), vol NPF non modifié, Plus › Importer des fiches avions (avions inventés).
- `node tests/navigateur/v017.mjs` : `arriveePosition` (arrivée sans code OACI : jour / nuit, code tapé ensuite, carte).
- `node tests/navigateur/v017b.mjs` : avions d'un même type classés par immatriculation (`classerParTypeEtImmat`, `modele.js`).
- `node tests/navigateur/v018.mjs` : touchers simulés avec history.go() lent (comme le téléphone) : liste des vols NPF.
- `node tests/navigateur/v019.mjs` : couleurs vert / rouge (contraste, même place et même taille, clair / sombre).
- `node tests/navigateur/v020.mjs` : La Réunion (R58 arrivée FMEP, nuit FMEP, saisie FMEP / FMEE avec et sans « LF »).
- `node tests/navigateur/v021.mjs` : photos d'Internet (faux Commons / Planespotters : choix, crédit, jamais gardée pour Planespotters).
- `node tests/navigateur/v022.mjs` : changer le mot de passe du NAS (faux NAS v5 : clé NPF, trop d'essais, NAS v4, réponse perdue).
- `node tests/navigateur/v023.mjs` : synchro téléphone -> PC (deux appareils, faux NAS v5, 1 200 vols, consultation, hors ligne).
- `node tests/navigateur/v025.mjs` : iPad (WebKit, paysage / portrait) 3e appareil : rejoindre, modifier, conflit, hors ligne, carnet effacé.
  WebKit sur ce PC (Ubuntu 26.04) : bibliothèques d'Ubuntu 24.04 décompressées dans ~/.cache/carnet-webkit-libs et
  reliées dans ~/.cache/ms-playwright/webkit-2104/minibrowser-wpe/sys/lib ; le test met PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1.
- `node tests/navigateur/v026.mjs` : majuscules, bouton « Rafraîchir » (3 appareils), envoi dès l'enregistrement et à la fermeture (keepalive), fenêtre photo.
- `node tests/navigateur/v027.mjs` : R64 formulaire propre (2 vols NPF à la suite, Nouveau vol après Enregistrer / Annuler / Ignorer) et R63 approches par terrain intermédiaire (PDF, CSV, sauvegarde, synchro, iPad).
- `node tests/navigateur/v028.mjs` : étiquette « N appr. », pastille du temps (couleurs = étiquettes, route longue sans chevauchement), « + » de la barre du bas (19 px, 360 px, garde d'abandon, Enregistrer non recouvert), téléphone, PC, iPad paysage et portrait.
- `node tests/navigateur/v029.mjs` : pastille du temps pleine (couleur « Feu n°… ») pour tout vol feu, « Feu » repris compris, en clair et en sombre (téléphone, PC, iPad).
- `node tests/navigateur/v030.mjs` : libellés des compteurs (taille, graisse, couleur, contraste clair/sombre), libellé long à 360 px, fenêtre Terrain intermédiaire (téléphone, PC, iPad).
- `node tests/navigateur/v031.mjs` : orange Entraînement (contraste), période de la loupe (totaux du haut, Totaux et PDF inchangés), flammes (appui long, Annuler, commune par FAUX géocodage IGN, hors ligne, suppression, synchro PC, réimport NPF), fond Photo (FAUX IGN, crédit, hors ligne, rien en cache), terrains intermédiaires à 360 px ; iPad WebKit (service worker bloqué pour que Playwright voie les demandes).
- `node tests/navigateur/v032.mjs` : ancien vol sans heures (départ / arrivée / minuit, nuit gardée + « Appliquer »), avion « nom / immat / type » (360 px), libellés (clair / sombre), numéro du feu (doublon, Annuler, vol suivant, vol ancien, synchro PC), KML Google Earth (partage simulé, téléchargement PC, aucun appel réseau), iPad.
- `node tests/navigateur/v033.mjs` : style du KML (icône, taille, couleurs, XML valide), bouton « Google Earth » tout en bas (390 / 360 px, PC, iPad paysage / portrait, rien de caché), bulle, partage simulé, Android : téléchargement + message.
- `node tests/navigateur/v034.mjs` : couleurs R86 / R87 (Feu, contour, Entraînement, GAAR et pastille des vols GAAR : texte blanc gras, contrastes clair / sombre ; IFR / sable / Appr / att. / autres pastilles / ligne de mission / bandeau SIMULATION inchangés), téléphone, PC, iPad.
- `node tests/navigateur/v035.mjs` : vols de simulation NPF-Q400-RUN (faux NAS v5 : bandeaux, jamais comptés, PDF, n° de feu, défauts, doublons, CSV, Google Earth, synchro PC / iPad, suppression + Annuler ; vrai vol inchangé).
- `node tests/navigateur/v036.mjs` : n° de feu des simulations (55 ; 56-57 ; vrai vol 55 ; 58 ; « + » vrai vol 56, simulation 59 ; jamais renumérotés), téléphone et iPad.
- `node tests/navigateur/v037.mjs` : « att » / « appr » sans point, avion sur une ligne (390 / 360 px, police réduite, « … » à 12 px seulement, boutons inchangés), « Feux » rangé parmi les compteurs (ordre gardé après réouverture, « + » / n° inchangés), iPad.
- `node tests/navigateur/v038.mjs` : recadrer la photo (fenêtre au chargement, pincer, glisser, molette, curseur, Valider / Annuler, gardé après réouverture, flèche retour) ; cartes des vols R94-R99 (couleurs, contours, même taille, ordre IFR / appr / att nuit, clair / sombre), téléphone 390 / 360 px, PC, iPad.
- `node tests/navigateur/v039.mjs` : changement d'adresse (les deux adresses servies, nouvelle en ligne ou non : écran « déménagé », aucune écriture, aucune demande au faux NAS, sauvegarde, bouton, caches séparés, icônes et nom), téléphone et iPad.
- `node tests/navigateur/v041.mjs` : écran de lancement bleu nuit (manifeste, écran interne plein écran puis retiré), contour et ombre des cartes (clair / sombre, simulation), téléphone 390 / 360 px, PC, iPad.
- `node tests/navigateur/v042.mjs` : interrupteur « Afficher 3, 7 et 30 jours » (défaut, éteint, réouverture, réglage privé, totaux inchangés) ; date en tête des cartes (390 / 360 px clair / sombre, trajet long, PC, iPad).
- `node tests/navigateur/v055.mjs` : fiche personne ABC -> ABD (tous les rôles, autres champs intacts, appareil B), règle
  d'affichage ; « Trace » ; mot de passe des traces (B, sauvegarde, restauration C, pas dans le CSV) ; import GPX / KML / KMZ /
  IGC / GeoJSON / CSV, invalides, croix -> ADS-B, 50 000 points, synchro, restauration ; Sauvegarde 3 lignes, restaurer
  fichier / version NAS, copie automatique, alerte ; outils retirés ; Totaux repliables + Trigrammes. Faux NAS v5.
- `node tests/navigateur/v054.mjs` : bulles « Mission » et feu pleines, atterrissages (3 → 3/0, 1 → 0/1, 5 → 4/1, nuit
  2 → 0/2), correction à la main gardée puis règle réappliquée, brouillon NPF fini de nuit (faux NAS), ancien vol inchangé.
- `node tests/navigateur/v053.mjs` : Inst / Exam (saisie, bulles, lecture, recherche, sauvegarde / restauration, synchro faux
  NAS, totaux), rattrapage FlyLog (faux fichiers : rien de retrouvé, puis complété / déjà rempli / absent ; bouton masqué
  après relance et sur l'appareil synchronisé), « CdB ».
- `node tests/navigateur/v052.mjs` : contours et taille des bulles (avec / sans les règles v0.52), CDB / Copi, « Dash 8 » et
  casse de la bande, choix gardés, « Dash 8 Année » (horloge simulée, 1er janvier), Chromium et WebKit.
- `node tests/navigateur/v051.mjs` : centrage de CHAQUE morceau à l'encre (couleur de la case lue dans son style, bords de la
  capture ignorés), marges ≥ 10 px, tailles ; 360 / 393 / 412 px, ×2 / ×3, Chromium (repli), WebKit (text-box) et WebKit
  forcé sur le repli. `V051_SONDE=1` : tout mesurer sans s'arrêter.
- `node tests/navigateur/v050.mjs` : case OPS = « Vol OPS avant le » (colonnes pièges), colonne absente (Tester, lecture).
- `node tests/navigateur/v049.mjs` : réglage partagé entre deux appareils déjà synchronisés (bouton, synchro automatique,
  vide d'origine, effacement, le plus récent gagne, état laissé par la v0.47 rattrapé), faux NAS + faux socle.
- `node tests/navigateur/v048.mjs` : socle OPS / IFR (faux serveur qui imite la web app Google, faux NAS, horloge simulée) :
  Tester, couleurs et J-n, gris, centrage au pixel (Chromium / WebKit, 390 / 360 px), bande plus basse, appareil B (synchro)
  et C (sauvegarde restaurée).
- `node tests/navigateur/v047.mjs` : vols NPF sans refaire l'export (faux NAS v5 + NPF, mode muet ; horloge de la page
  simulée avec `page.clock` : 2 min, 1 min, 20 s sans attendre ; arrière-plan simulé par `document.visibilityState`).
- `node tests/navigateur/v046.mjs` : cases autre pilote / date et bouton + de même taille (avec / sans les règles v0.46),
  texte non coupé (encre au pixel contre le même texte dessiné à part), icône du calendrier, lecture / modification ;
  noms de modèles dans le menu et la bande, anciens choix convertis, Chromium et WebKit 390 / 360 px.
- `node tests/navigateur/v045.mjs` : date immobile (avec / sans les règles v0.45), trajet descendu de 4 px, haut de la pastille
  = haut du contour (mesures AU PIXEL, Chromium et WebKit, 390 / 360 px, clair / sombre), ligne avion 17 / 15 px sur une ligne
  (cas longs : type 13 px puis « … »), heures 15 px.
- `node tests/navigateur/v044.mjs` : date dans son contour (MESURE de l'encre au pixel, Chromium et WebKit, 390 / 360 px,
  écrans ×2 et ×3, clair / sombre), mois ; fond de l'accueil ; carte du total et bandes (390 / 360 / 340 px, 1 à 4 cases,
  gros et très gros carnet, « plus grande taille qui tient ») ; vol en lecture seule (chaque champ, chaque bouton, fiche
  avion, flamme, LF / LOC / UTC, crayon -> Annuler / Enregistrer, nouveau vol, recherche). `V044_PARTIE=R112` : une partie.
- `node tests/navigateur/v043.mjs` : date remontée de 4 px, tout le reste à la même place (mesure avec / sans la règle), 390 / 360 px clair / sombre, PC, iPad.
- `node tests/navigateur/v024.mjs` : synchro dans les deux sens (passage en modification, conflits et 3 choix, doublon, NPF, hors ligne, >20 suppressions, annuler, mot de passe refusé).
- `node tests/navigateur/fluidite.mjs` : 4070 vols inventés, processeur ralenti ×6.
- `node outils/controle-import.mjs ../donnees-privees/flylog-decode-v1.csv ../donnees-privees/totaux-flylog-reference.json` :
  contrôle avec le VRAI fichier, en local uniquement (rien n'est écrit dans le dépôt).
- Sur ce PC (WSL, sans sudo), Chromium a besoin de bibliothèques extraites localement :
  `LD_LIBRARY_PATH=~/.cache/carnet-chromium-libs/root/usr/lib/x86_64-linux-gnu` (paquets libnss3, libnspr4, libasound2t64
  récupérés avec `apt-get download` puis `dpkg -x`). npm peut être bloqué par le réseau : les paquets
  peuvent être téléchargés avec curl depuis registry.npmjs.org.
