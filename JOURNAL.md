# Journal des versions

## v0.68 — 27/11/2026

Remarque R166. carnet.php v5, NPF-Q400 et format NPF-Q400 inchangés ; NAS et VPS non touchés ; données du carnet inchangées (PDF EASA,
CSV, totaux d'heures, anomalies identiques ; aucun « Modifié le » changé).

**R166 : frais d'escale** (indemnités journalières, frais réels ; maquette validée). Fiche du vol : zone « FRAIS D'ESCALE » entre
« Règles des pastilles » et « Temps du carnet », cases VOL JOURNÉE / J+2 / DÉTACHEMENT (une seule, ou aucune ; utilisables aussi en
lecture ; enregistrées tout de suite, sans alerte R150 ni ligne « Anomalies traitées »). Vol journée : ½ indemnité zone euro (montant
« Vol journée » du barème). J+2 : « Pays de la nuit » (France par défaut) ; deux jours qui se suivent = une ligne (2 jours, 1 nuit),
sinon « J+2 incomplet » (0 €). Détachement : fenêtre Du / Au / Pays principal recopié sur chaque nuit (modifiable) ; jours sans vol
comptés ; les vols de ses dates se cochent tout seuls (« Fait partie du détachement du … au … », « Voir le détachement ») et ne comptent
qu'une fois. Calcul : Euro-Europe = 1 indemnité du pays de chaque nuit, la dernière 1,5 ; Monde = 1 par jour au pays de sa nuit ; détail
sur chaque ligne. Plus › Frais d'escale : une ligne par année (date de début) avec son total ; dans l'année : barème à saisir (vol
journée, pays avec montant et zone, France d'office ; « Montant manquant » = 0 €), liste (plus récent en haut ; appui = vol ou
détachement), total, « Exporter 20XX en PDF » (barème, résumé, puis chaque ligne en ordre chronologique avec ses vols ; temps au format
du type, heures de bloc en heures). Synchro et sauvegarde : case du vol (avec le vol, le plus récent gagne), un réglage par détachement
et par barème ; ancienne sauvegarde : rien de coché.

**Tests** : `tests/unitaires/v068.test.js`, `tests/navigateur/v068.mjs` (barème inventé, faux NAS, 360 / 393 px, PDF) ; v09 et v056
(menu Plus) mis à jour ; test complet ; contrôle local avec le vrai fichier.

## v0.67 — 27/11/2026

Remarques R163 et R164 (corrigée avant livraison ; R165 abandonnée). carnet.php v5, NPF-Q400 et format NPF-Q400 inchangés ; NAS et VPS
non touchés ; aucun vol réécrit (minutes) ; TOUS les totaux, le PDF et le CSV identiques à la v0.66.

**R163 : nouvelle anomalie « Att. de nuit sans temps de nuit »** : au moins 1 atterrissage de nuit (arrivée ou terrain intermédiaire)
et temps de nuit 0 ; comme les autres (« ! », bouton jaune, cadre, Ignorer, Anomalies traitées) ; simulateur non contrôlé.

**R164 : « Temps en dixièmes » par type d'avion.** Fiche du type : interrupteur « Temps en dixièmes » (comme « Vols groupés »), allumé
d'office pour DH8D (Dash 8 Q400) et CL2T (CL-415), éteint pour les autres ; réglage partagé (synchro, sauvegarde). Pour les vols de ces
types seulement : accueil (temps encadré, bulles IFR / Nuit) et fiche du vol (temps entre les blocs, Temps IFR, Temps nuit, Temps du
carnet, vols groupés) en dixièmes d'heure avec un POINT (1h24 -> 1.4, arrondi R160) ; saisie en dixièmes (« 0.2 » ou « 0,2 » = 12 min).
Un champ affiché « 1.4 » garde ses minutes exactes tant qu'on n'y tape rien. Les heures de bloc restent des heures. Tout le reste
(totaux, 3 / 7 / 30 jours, Totaux, alerte R150, Anomalies traitées, PDF, CSV) reste en heures et minutes. Le petit « 1,4 » de R161 est
retiré. Le réglage global « Format Tps de Vol » (R165) prévu d'abord n'existe pas : s'il arrivait par une synchro ou une sauvegarde, il
est ignoré.

**Tests** : `tests/unitaires/v067.test.js`, `tests/navigateur/v067.mjs` (types DH8D / CL2T / DR40, interrupteurs, faux NAS, ancien réglage
reçu et restauré) ; `v064.mjs` adapté (plus de petit « 1,4 ») ; les anciens tests (écrits en heures avec des Dash 8 inventés)
tournent sans type en dixièmes d'office (serveur de test) ; test complet ; contrôle local avec le vrai fichier.

## v0.66 — 27/11/2026

Remarque R162. carnet.php v5, NPF-Q400 et format NPF-Q400 inchangés ; NAS et VPS non touchés ; données inchangées (PDF, CSV, totaux,
état des ronds identiques).

**R162 : ligne « À reporter sur le carnet : N vols » supprimée**, avec son filtre ; rien ne la remplace (la liste suit directement,
au même endroit qu'avant quand la ligne était cachée). Le rond « reporté » de chaque carte reste, avec le même fonctionnement (appui :
coche / décoche sans ouvrir le vol ; état enregistré, synchronisé et sauvegardé). Le bouton jaune « N vols à vérifier » reste et
filtre toujours les vols avec « ! ».

**Tests** : `tests/navigateur/v066.mjs` ; `v061.mjs` et `v061b.mjs` mis à jour (ils lisaient la ligne et son filtre : ils comptent
maintenant les vols à reporter dans le carnet et vérifient que la ligne n'existe plus) ; test rapide et tests v0.61 à v0.65 ; contrôle
local avec le vrai fichier.

## v0.65 — 27/11/2026

Remarque R158b. carnet.php v5, NPF-Q400 et format NPF-Q400 inchangés ; NAS et VPS non touchés ; aucune donnée changée (totaux, PDF,
CSV et nuit identiques).

**R158b : altisurface venue de FlyLog, « Valider » toujours bloqué en v0.64.** Cause : à l'import FlyLog, la route
« DÉPART|NOM DU TERRAIN|…|ARRIVÉE » range le NOM du terrain intermédiaire dans son champ « code » (pas dans « nom ») ; la correction
de la v0.64 ne visait que les terrains dont le code est vide et le nom rempli (cas des pélicandromes envoyés par NPF-Q400) : la fenêtre
mettait le nom dans le champ du code, disait « Terrain inconnu : vérifie le code » et refusait tout ce qui n'avait pas 4 lettres. Le
test de la v0.64 avait construit son altisurface comme NPF-Q400 (code vide, nom rempli), pas comme un import FlyLog : il ne pouvait pas
le voir. Maintenant : tout terrain dont l'identifiant n'a pas la forme d'un code OACI (4 lettres / chiffres) est un nom, quels que
soient accents, espaces, minuscules ou longueur ; la fenêtre affiche « <nom> · Terrain sans code OACI » (information), le champ du code
reste vide (pas de clavier, « LF » toléré) et « Valider » garde atterrissages, approches, nom et code d'origine. Un code à 4 lettres
inconnu de la base : comme avant.

**Tests** : `tests/navigateur/v065.mjs` (import d'un faux FlyLog avec deux terrains sans code, nom tapé en minuscules, nom seul, code
inconnu ; téléphone 360 / 393 px, bouton LF actif et inactif, PC) — il échoue sur la v0.64 et réussit sur la v0.65 ; test rapide et
tests v0.61 à v0.64 ; reproduction et contrôle locaux avec le vrai fichier.

## v0.64 — 26/11/2026

Remarques R158 à R161. carnet.php v5, NPF-Q400 et format NPF-Q400 inchangés ; NAS et VPS non touchés ; aucun vol existant recalculé ;
totaux, PDF et CSV identiques.

**R158 : altisurface sans code OACI.** Un terrain intermédiaire saisi par son nom (sans code) : ses atterrissages et approches se
modifient comme les autres (avant : « Valider » refusait sans code à 4 lettres). Le nom reste tel quel ; le « ! » disparaît dès
qu'il a un atterrissage.

**R159 : la nuit ne change plus en silence.** Cause : valider la fenêtre d'un terrain intermédiaire (pour corriger ses atterrissages),
changer LOC / UTC ou un terrain relançait TOUS les calculs du vol ; la nuit était recalculée par l'app (0h14), à la place de celle de
FlyLog (0h12). Maintenant, à l'enregistrement d'un vol existant : la nuit n'est recalculée que si la date, une heure ou un terrain
change (nouveau vol : toujours) ; revenu à l'identique : la valeur enregistrée revient ; tapée à la main : jamais remplacée (gardée
avec le vol). Même règle pour les autres calculs du même cas : temps de vol (FlyLog peut différer des heures), colonne avion
(SE / ME / multipilote), temps de la fonction, temps IFR (vol IFR) ; et un atterrissage ajouté sur un terrain intermédiaire ne
répartit plus de nouveau jour / nuit ceux de l'arrivée. Anomalies traitées : chaque ligne « Nuit » changée a un bouton
« Remettre 0h12 » (valeur d'origine remise, rien recalculé, pas d'alerte R150 ; la ligne disparaît).

**R160 : nuit calculée arrondie au dixième** (multiple de 6 min ; reste 0 à 2 min en dessous, 3 à 5 au-dessus), seulement pour un
calcul fait à partir de cette version ; jamais plus que le temps de vol (vol de 1h15 entièrement de nuit : 1h15, pas 1h18).

**R161 : temps de vol en dixièmes sur l'accueil** (maquette validée), à gauche du temps encadré, même couleur, sans contour, plus
petit ; même arrondi ; vol groupé : le temps saisi. Affichage seulement.

**Tests** : `tests/unitaires/v064.test.js`, `tests/navigateur/v064.mjs` ; test rapide et tests v0.61 à v0.63 ; contrôle local avec le
vrai fichier (nuit identique sur tous les vols).

## v0.63 — 26/11/2026

Remarque R157. carnet.php v5, NPF-Q400 et format NPF-Q400 inchangés ; NAS et VPS non touchés ; données inchangées (aucun vol
réécrit ; PDF, CSV et totaux identiques).

**R157 : toutes les modifications des vols dans « Anomalies traitées »** (maquette validée ; le menu garde son nom et sa place).
Champs suivis : tous ceux du carnet (date, heures, terrains et atterrissages par terrain, avion, fonction, temps, colonnes, nuit, IFR,
approches, atterrissages et décollages, personnes, indicatif, mission, feux, compteurs, étiquettes, remarque, note). Pas suivis : rond
« reporté », « ignoré », trace, « Modifié le », champs techniques.
Trois onglets : « Corrigées (N) », « Modifiés (N) », « Ignorées (N) ». Une seule carte par vol, la plus récente en haut ; chaque champ
changé : « ancienne valeur barrée rouge -> nouvelle valeur verte », la valeur d'origine (FlyLog, ou avant la première modification
dans l'app) comparée à la valeur actuelle : un champ revenu à son origine disparaît, une carte « Modifiés » sans champ changé aussi.
Corrigées : la ligne grise de l'anomalie, puis tous les champs changés. Modifiés : vols changés sans anomalie corrigée, « Modifié le ».
Un vol créé dans l'app n'apparaît qu'à sa première modification. Badge du menu = vols des trois onglets.
Rangement : un petit réglage partagé « suivi-<vol> » par vol modifié (le vol n'est jamais réécrit ; bien sous 64 Ko) : synchro (le plus
récent gagne) et sauvegarde ; une ancienne sauvegarde restaurée : listes vides, rien de cassé. Chaque enregistrement dans la saisie qui
change un vol met sa carte à jour (une fiche personne corrigée, qui renomme dans plusieurs vols, ne crée pas de carte).
Rattrapage : la question est reposée UNE fois après la mise à jour : « Compléter avec toutes les modifications déjà faites ? » /
« Choisir le fichier FlyLog d'origine » / « Plus tard » (bouton « Retrouver les modifications dans FlyLog » en bas de l'écran) ; chaque
vol FlyLog comparé au vol actuel ; les cartes « Corrigées » déjà là sont complétées (sans doublon) ; à la fin « N vols modifiés
retrouvés ». Fait sur un appareil : plus de question sur les autres. Le fichier n'est ni gardé, ni envoyé.
Un export FlyLog brut (sans les colonnes décodées FEU et largages) peut être choisi : ces colonnes, absentes du fichier, ne sont
jamais comptées comme modifiées (sinon 139 fausses cartes « Modifiés » sur un vrai carnet).

**Tests** : `tests/unitaires/v063.test.js`, `tests/navigateur/v063.mjs` (faux FlyLog inventé, faux NAS, A -> B, sauvegarde, ancienne
sauvegarde, 360 / 393 px, 1 500 suivis : accueil 8 ms) ; v062.mjs, v09, v056 adaptés (nouvelle question, onglet, badge) ; test complet ;
contrôle local avec le vrai fichier.

## v0.62 — 26/11/2026

Remarque R156. carnet.php v5, NPF-Q400 et format NPF-Q400 inchangés ; NAS et VPS non touchés ; données inchangées (aucun vol
réécrit ; PDF, CSV et totaux identiques).

**R156 : Plus › « Anomalies traitées »** (maquette validée). Ligne juste après « Libellés missions », triangle jaune dessiné par
l'app, badge jaune = nombre de vols dans la liste (caché à 0). Deux onglets « Corrigées (N) » et « Ignorées (N) », plus récents en
haut ; un appui sur une ligne ouvre le vol (en le fermant, retour à l'écran).
Corrigées : quand un vol qui avait un « ! » (non ignoré) est enregistré et qu'une anomalie disparaît, l'app note le vol (date,
trajet, avion lus dans le carnet), l'anomalie en mots simples, l'ancienne valeur barrée en rouge -> la nouvelle en vert (seulement ce
qui a changé, ex. « LFML : 0 att. -> LFML : 1 att. ») et « Corrigé le JJ/MM/AAAA ». Vol supprimé : sa ligne disparaît.
Ignorées : vols ignorés (R155) avec l'anomalie, « Ignoré le » et « Ne plus ignorer » (le « ! » revient ; « Modifié le » inchangé).
Rattrapage : au premier lancement (carnet avec des vols venus de FlyLog), une seule question « Retrouver les corrections déjà faites
dans le fichier FlyLog d'origine ? » (« Choisir le fichier » / « Plus tard » ; le bouton « Retrouver les corrections dans FlyLog » reste
en bas de l'écran). Le fichier est lu sur l'appareil ; chaque vol est retrouvé comme à l'import d'origine (date, terrains,
immatriculation, heure de départ, temps, quantités comptées), à défaut par sa ligne du fichier et sa date ; anomalie présente dans
FlyLog et absente maintenant (ignorée = toujours là) = corrigée, datée du « Modifié le » du vol (sinon « date inconnue »). Le fichier
n'est ni gardé, ni envoyé ; relancer n'ajoute pas de doublon ; à la fin « N corrections retrouvées ». Fait sur un appareil : la
question ne revient sur aucun autre (réglage partagé).
Synchro et sauvegarde : la liste « Corrigées » est un réglage partagé (une ligne ajoutée sur deux appareils : les deux gardées) ;
« Ignorées » voyage avec les vols ; une ancienne sauvegarde restaurée : listes vides. Aucune ligne ne modifie un vol ni ne déclenche
l'alerte R150 ; ni PDF, ni CSV, ni totaux.

**Tests** : `tests/unitaires/v062.test.js`, `tests/navigateur/v062.mjs` (faux fichier FlyLog inventé, faux NAS, A -> B, sauvegarde,
ancienne sauvegarde, 360 / 393 px) ; test complet ; contrôle local avec le vrai fichier.

## v0.61 — 26/11/2026

Remarques R154 et R155. carnet.php v5, NPF-Q400 et format NPF-Q400 inchangés ; NAS et VPS non touchés ; données inchangées (aucun vol
réécrit ; PDF, CSV et totaux identiques).

**R154 : rond « reporté sur le carnet papier ».** En bas à droite de chaque carte de l'accueil : rond 16 px (trait 1,5 px,
dessiné en SVG), vert plein avec ✓ blanc = reporté, vide gris = à reporter ; zone d'appui 40 × 40 px ; un appui coche /
décoche sans ouvrir le vol ; les dernières lignes de la carte s'arrêtent avant (aucune bulle dessous). Un vol SANS
l'information est reporté : tous les vols existants (et ceux d'une ancienne sauvegarde) le sont, sans être réécrits ; un vol
créé (saisi, importé de NPF-Q400) arrive avec `aReporter: true` (pas les vols de simulation). Ligne « À reporter sur le carnet :
N vols » (`#rep-ligne`, nombre en rouge, cachée à 0) : appui = seulement ces vols, nouvel appui (« Tous › ») = tous. L'état
voyage avec le vol (synchro, sauvegarde) ; changé des deux côtés et rien d'autre : le plus récent gagne (`reporteLe`), sans
conflit à choisir. L'appui ne change pas « Modifié le » du vol (`enregistrerVol(v, { garderDate: true })`) : CSV identique ;
pas d'alerte R150. Logique : `js/report.js`.

**R155 : anomalies signalées par un triangle « ! ».** L'app ne corrige jamais rien. Détectées (et aucune autre ; simulateur
non contrôlé) : a. terrain intermédiaire avec 0 atterrissage ; b. arrivée de nuit (estNuit au bloc arrivée) et 0 atterrissage
de nuit ; c. nuit ou IFR plus grand que le temps de vol ; d. CdB + Copi + DC + PICUS différent du temps de vol (le temps
instructeur compte aussi en CdB, comme FlyLog ; un vol instructeur saisi dans l'app, sans CdB, est accepté), instructeur ou
examinateur plus grand que le temps de vol ; e. arrivée avant le départ ou vol de plus de 10 h ; f. chevauchement (se toucher
n'en est pas un) ; g. terrain intermédiaire = départ ou arrivée ; h. vol saisi deux fois (date, heures, immatriculation).
Accueil : triangle jaune dessiné (SVG) en bas à droite, à gauche du rond, les dernières lignes s'arrêtent avant ; bouton jaune
« ⚠ N vols à vérifier ⚠ » sous les cases OPS / IFR (30 px, caché à 0) : filtre, un seul filtre à la fois avec « À reporter ».
Fiche du vol : cadre jaune « Anomalie détectée » + liste + « Ignorer cette anomalie » (aussi en lecture). Vol corrigé : le
« ! » disparaît. « Ignorer » : `vol.anomaliesIgnorees` { empreinte des données contrôlées, le } ; données et « Modifié le »
inchangés, pas d'alerte R150 ; le « ! » revient seulement si ces données changent ensuite et qu'une anomalie est détectée.
Synchro : rond et « ignoré » changés chacun sur un appareil -> les deux gardés (`fusionnerEtats`). Ancienne sauvegarde : rien
d'ignoré. Calcul en une passe + un tri (`js/anomalies.js`, cache `js/ui/anomalies.js`) : 40 ms pour 4 000 vols (processeur ×4).

**Tests** : `tests/unitaires/v061.test.js`, `tests/navigateur/v061.mjs` (50 vols inventés, 360 / 393 px, faux NAS + vol NPF,
synchro A -> B, conflit du rond, sauvegarde, ancienne sauvegarde), `tests/navigateur/v061b.mjs` (anomalies a à h et cas
voisins, bouton, filtres, cadre, Ignorer, synchro, sauvegarde, 360 / 393 px, 4 000 vols) ; test complet ; contrôle local avec
le vrai fichier.

## v0.60 — 25/11/2026

Remarque R152 et défaut de synchro constaté. carnet.php v5, NPF-Q400 et format NPF-Q400 inchangés ; NAS et VPS non touchés ;
données inchangées (aucune heure, aucun total).

**R152 : profil dans la carte en plein écran.** Bouton « Profil » (style des boutons Plan / Photo), seulement si le vol a un
graphique. Appui : le graphique monte en bas (environ le tiers bas, 150 à 260 px, fond opaque, mêmes couleurs, échelles,
heures UTC / LOC et légende que sous la petite carte) ; la carte s'arrête au-dessus (déplacer, zoomer : rien de caché, ni
les boutons ni le crédit). Doigt / souris : valeurs et point jaune sur la carte en plein écran ; si le point sort de la
partie visible, la carte le suit. Nouvel appui : caché. Ouvert / fermé retenu sur cet appareil (réglage privé `profilPlein`).
Point ignoré (aberrant) : la courbe le saute au lieu de laisser une petite coupure (coupure seulement après 5 min sans
valeur).

**Défaut de synchro (trace réimportée sur l'iPad, pas reçue par le téléphone).** Cause trouvée avec le faux NAS : le
téléphone regardait le vol (lecture seule) pendant la synchro ; la règle « vol ouvert : ne pas le changer, conflit » s'est
appliquée, puis la règle « conflit réglé si la version d'ici est celle du NAS » l'a effacé aussitôt (rien n'avait changé
sur le téléphone) : la nouvelle version était perdue pour le téléphone, sans rien signaler. Corrigé : un vol seulement
regardé est mis à jour comme les autres et la fiche se rafraîchit ; un vol en modification reste protégé, puis la version
reçue s'applique dès qu'il est fermé s'il n'a pas été modifié ici ; un conflit n'est plus effacé par une version plus
ancienne. Une vraie modification des deux côtés reste un conflit à choisir (inchangé).
Aussi : un GPX sans altitude ou sans vitesse n'enregistre plus « 0 » à la place (valeur vide = absente).

**Tests** : `tests/navigateur/v060.mjs` (plein écran : téléphone portrait / paysage, PC, iPad WebKit paysage / portrait,
fluidité ; synchro : vol regardé, vol en modification, vraie modification des deux côtés) ; test complet ; contrôle local
avec le vrai fichier.

## v0.59 — 25/11/2026

Remarque R151. carnet.php v5, NPF-Q400 et format NPF-Q400 inchangés ; NAS et VPS non touchés (VPS lu seulement) ; données
inchangées (aucune heure, aucun total ; PDF et CSV identiques).

**Vérification.** VPS : le script de nuit garde l'altitude de chaque point (pieds, 0 au sol) mais PAS la vitesse sol ; les
fichiers bruts d'adsb.lol ne sont pas gardés. App : la découpe des traces ADS-B gardait déjà l'altitude ; les traces importées
la perdaient à l'encodage (`encoderPoints` ne gardait que position et heure).

**R151 : profil altitude / vitesse sous la trace du vol.** Section « Trace du vol », sous la carte : altitude en bleu (aire,
pieds à gauche), vitesse sol en vert (ligne, nœuds à droite), heures en bas dans le fuseau du vol (UTC, ou LOC = fuseau du
terrain de départ ; suit le bouton LOC / UTC), légende. Doigt ou souris posé / glissé : trait vertical, « 10:34  16 000 ft
236 kt » au-dessus, point jaune au même instant sur la carte. Vitesse sol : fournie par la trace si elle l'a, sinon CALCULÉE
avec les positions et les heures (distance parcourue sur ~30 s ; pas calculée si les points sont espacés de plus de 5 min).
Une seule courbe si l'autre manque ; aucune (ou pas d'heures) : pas de graphique. Au sol = 0 ft ; saut isolé d'altitude
ou de position impossible : ignoré pour le dessin. Dessin maison en SVG (`js/profil.js` pur, `js/ui/profil.js`), aucune
bibliothèque. Traces importées : altitude gardée en pieds (clé `a` de `traceImportee`, dizaines de pieds ; anciennes traces
sans altitude : réimporter le fichier) ; CSV : colonne altitude lue. Vitesse sol MESURÉE des GPX gardée en nœuds (clé `v`) :
`<mytracks:speed>` (myTracks) en km/h, `<speed>` (GPX 1.0, Garmin) en m/s ; le graphique l'utilise à la place de la vitesse
calculée. Taille : environ +2 caractères par point, toujours sous
la limite de 50 000 caractères par vol (64 Ko du NAS). Traces ADS-B : un 5e nombre (vitesse) serait gardé s'il arrivait.

**Tests** : `tests/unitaires/v059.test.js`, `tests/navigateur/v059.mjs` (faux serveur de traces, faux NAS, glissé mesuré à
393 px processeur ralenti ×4) ; v058 : numéro de version 0.58 ou suivant ; test complet ; contrôle local avec le vrai fichier.

## v0.58 — 22/11/2026

Remarques R147 (centrage ; numéro déjà pris par la v0.57 pour « Amerrissages SEP »), R148 à R150. carnet.php v5, NPF-Q400 et
format NPF-Q400 inchangés ; NAS et VPS non touchés ; données inchangées (aucun vol existant ne change).

**R147 : cases du bloc du vol centrées.** Départ (OACI), Arrivée (OACI), Bloc Départ, Bloc Arrivée : titre, contenu (LFML,
13h24) et nom du terrain centrés dans leur case, dans la saisie comme dans la fiche ouverte en lecture. Temps IFR / nuit déjà
centrés. Le petit blanc que l'espacement des lettres ajoute après le dernier caractère est compensé (`text-indent`). Grands
champs (Mission, remarques, autre pilote) toujours à gauche ; place, taille, couleur et police inchangées.

**R148 : Terrain intermédiaire, LFML par défaut.** Texte grisé « LFML » ; Espace sur le champ vide (ou sur « LF » seul du
bouton LF) tape LFML (« Marseille Provence » dessous). Lu sur le texte tapé (événement `input`) et non sur la touche : marche
avec le clavier d'Android, qui n'envoie pas la touche, comme sur PC.

**R149 : vols groupés.** Interrupteur « Vols groupés » dans la fiche d'un type (réglage PARTAGÉ `volsGroupesTypes`) et dans
la fiche d'un avion (`avion.volsGroupes` : true / false, absent = comme le type ; priorité : l'avion, puis le type ; éteint
par défaut). Saisie : case « Vols groupés » juste sous les heures bloc si l'avion (ou son type) l'a, ou si le vol est déjà
groupé. Allumée : le temps entre Bloc Départ et Bloc Arrivée devient une case tapée à la main (« 145 » → 1h45) ; les heures
bloc restent saisies et gardées ; le temps de nuit et la répartition jour / nuit des atterrissages (R134) ne sont plus
calculés. Le vol garde `volsGroupes: true` et `tempsTotal` = le temps tapé : il compte partout à la place de « fin − début »
(fonctions, totaux, bande, « Dash 8 / Année », carte du vol, PDF, CSV), heures bloc inchangées dans le PDF. Logique :
`js/vols-groupes.js` (`volsGroupesAvion`, `volsGroupesDuType`, `alerteTemps`).

**R150 : alerte si le temps de vol change** en modifiant un vol DÉJÀ enregistré : « Temps de vol modifié : 1h30 → 1h45
(+0h15). Ton total HdV passe de X à Y. », « Enregistrer quand même » / « Annuler » (retour à la saisie, rien d'enregistré ;
flèche retour = Annuler). Fenêtre `#tv-modal`. Pas d'alerte pour un nouveau vol, si le temps ne change pas, ni pour la
mise à jour d'un vol NPF-Q400 (qui montre déjà ce qui change).

**Tests** : `tests/unitaires/v058.test.js`, `tests/navigateur/v058.mjs` (centrage mesuré au pixel à 360 / 393 px, faux NAS) ;
anciens tests adaptés (v08 et v054 changent les heures d'un vol enregistré : « Enregistrer quand même » ; v057 : numéro de
version 0.57 ou suivant) ; test complet ; contrôle local avec le vrai fichier (totaux, PDF et CSV identiques à la v0.57).

## v0.57 — 22/11/2026

Remarque R147. carnet.php v5, NPF-Q400 et format NPF-Q400 inchangés ; NAS et VPS non touchés ; données inchangées.

**R147 : « Amerrissages SEP » n'est plus coché d'office** sur les types monomoteurs piston (DR400, C172, CAP 10…) : il n'est
plus dans les compteurs de départ d'aucun type (`departDuType`). Seuls les types jamais réglés changent : un type ou un
avion réglé à la main (fiche type, fiche avion, « Pour cet avion » / « Pour le type ») garde son choix. Un vol où il a une
valeur l'affiche toujours ; aucune valeur, aucun total ne change. Dash 8 et CL-415 inchangés.

**Tests** : `tests/unitaires/v057.test.js`, `tests/navigateur/v057.mjs` ; anciens tests adaptés (parcours, v06, v056) ;
test complet ; contrôle local avec le vrai fichier.

## v0.56 — 22/11/2026

Remarques R144 à R146. carnet.php v5, NPF-Q400 et format NPF-Q400 inchangés ; NAS et VPS non touchés ; données inchangées.

**R144 : compteurs gérables.** Plus › Mes réglages › « Compteurs » : liste, « + Nouveau compteur », fiche (Nom, « Compté
dans les Totaux », Enregistrer ; « Supprimer » s'il n'a jamais servi, sinon « Masquer » / « Réafficher » : un compteur
masqué n'est plus proposé, ses valeurs restent dans les vols, les totaux et le CSV). Changer un nom change l'affichage
partout (bulles, saisie, Totaux, CSV) ; les valeurs ne bougent pas. Feux : jamais supprimé, fonctionnement « FEU n°NN »
inchangé.
Compteurs par défaut : fiche d'un type (Plus › Types d'avion) et fiche d'un avion (« Comme le type XXX », oui par défaut,
sinon cases propres à l'avion ; priorité : l'avion, puis le type). Point de départ : Dash 8 (DH8D, MR et MRE) = ce que l'app
affichait (Feux + compteurs allumés dans l'ancien réglage ; d'usine : Largages CdB Dash et Largages instruction CdB Dash) ;
CL-415 (CL2T) = Feux, Écopages, Amerrissages CL, Largages copi CL ; types SEP (monopilote, monomoteur, piston) =
Amerrissages SEP ; autres types et simulateurs : aucun ; Largages para : aucun type.
Saisie, bloc Mission : « Compteurs › » (avant « Libellés missions › ») remplace « Choisir et ranger les compteurs » :
cases (cocher : « Juste pour ce vol » / « Pour cet avion » / « Pour le type » / « Annuler » ; décocher : « Pour cet avion » /
« Pour le type » / « Annuler ») et flèches ↑↓ (ordre pour tous les vols). Un compteur qui a une valeur sur un vol y reste
toujours affiché. En lecture seule, « Compteurs › » ne fait rien.
Données : réglages PARTAGÉS `compteurs` (ordre, comme avant), `compteursFiches` (nom, totaux, masqué, créé, supprimé),
`compteursTypes` (par type) ; avion `compteursPropres` ; vol `compteursAjoutes` ; valeurs dans `vol.feux` /
`vol.compteurs[cle]` comme avant. Synchro NAS (le plus récent gagne) et sauvegarde : oui. CSV : une colonne par compteur
(les 8 d'origine toujours, puis les créés, masqués compris). PDF EASA : inchangé. Totaux : compteurs « Compté dans les
Totaux », dans l'ordre choisi. Note : l'app ne relit pas le CSV ; la restauration se fait depuis la sauvegarde (qui contient
tout).

**R145 : ordre de Plus** : Mes réglages (Mes avions, Types d'avion, Personnes, Heures affichées en haut, Pastilles des
missions, Libellés missions, Compteurs, Traces des vols, Socle OPS / IFR), Exporter, Sauvegarde, Contrôle, Téléphone.
Bandeau du haut inchangé.

**R146 : « version gardée » = la plus récente du NAS**, quel que soit l'appareil : lue sur le NAS (action « liste » de
carnet.php v5, déjà existante) à l'ouverture de Plus, au plus une fois par minute, gardée sur l'appareil (réglage privé
`nasDerniereVersion`) ; NAS injoignable : dernière lecture gardée. Même date dans le bandeau du haut (« Copié sur le NAS
… ») ; ses alertes d'échec inchangées. Mot de passe refusé (ou NAS qui bloque) : aucune lecture automatique ; un refus est
noté comme pour la copie et la synchro, et « Synchro du carnet » affiche alors « Mot de passe refusé : à corriger ».

**Tests** : `tests/unitaires/v056.test.js`, `tests/navigateur/v056.mjs` ; anciens tests adaptés (parcours, v06, v037, v09,
v055) ; test complet ; contrôle local avec le vrai fichier (totaux v0.55 = v0.56, CSV identique).

## v0.55 — 22/11/2026

Remarques R136 à R143. carnet.php v5, NPF-Q400 et format NPF-Q400 inchangés ; NAS et VPS non touchés ; données inchangées.

**R136 : fiche personne modifiable.** Plus › Personnes : un appui sur un nom ouvre la fiche (Nom, Prénom, Trigramme ;
Enregistrer / Annuler) ; elle passe maintenant devant l'écran Personnes (elle s'ouvrait derrière). Une correction s'applique
à tous les vols avec cette personne (copi, autre pilote, instructeur, examinateur, élève) : seuls ces champs changent.
À l'écran (bulles, fiche vol, listes, suggestions) : trigramme, sinon nom, sinon prénom ; un vol enregistré avant avec
« Prénom Nom » affiche la règle sans être modifié. PDF : imprime toujours le nom enregistré dans le vol (code inchangé).
Les fiches personnes passaient déjà par la synchro NAS et la sauvegarde.

**R137 : « Trace » au lieu de « Carte »** pour la trajectoire : « TRACE DU VOL », Plus › « Traces des vols » (même titre
d'écran, texte court « Traces ADS-B (archives adsb.lol, récupérées chaque nuit par ton serveur). »), « Mot de passe des
traces », messages de la section.

**R138 : mot de passe des traces partagé** (réglage `cartesMotDePasse` dans REGLAGES_PARTAGES) : synchro NAS (le plus récent
gagne, un vide d'origine n'écrase rien, rattrapage automatique des appareils déjà synchronisés), sauvegarde de secours et
restauration (une ancienne sauvegarde sans lui ne l'efface pas). Pas dans le CSV.

**R139 : importer la trace d'un vol.** Fiche vol › Trace du vol › « Importer » (GPX, KML / gx:Track, KMZ, IGC, GeoJSON,
CSV latitude / longitude / heure). Fichier illisible ou sans point : message, rien ne change. Trace rangée avec le vol
(`traceImportee` : simplifiée à 1 500 points au plus, encodée ; vol ≤ 50 000 caractères), affichée à la place de la trace
ADS-B ; la croix la retire (la trace ADS-B revient). Synchro (envois découpés sous 3 Mo), sauvegarde, copie NAS : oui ;
CSV, PDF : non. Jamais d'heure modifiée. carnet.php v5 inchangé (élément ≤ 64 Ko, envoi ≤ 4 Mo : respectés).

**R140 : Plus › Sauvegarde en 3 lignes** : Sauvegarde de secours ; Synchro du carnet (« Synchronisé · version gardée il y
a X ») ; Restaurer (« Depuis un fichier » / « Depuis une version du NAS »). Réglages du NAS (adresse, mot de passe, copie
automatique) : Synchro du carnet › « NAS : adresse, mot de passe, copie automatique ». Copie automatique inchangée. Bandeau
du haut gardé ; copie refusée par le NAS (ou bloquée depuis plus d'un jour) : bandeau rouge d'alerte, bouton « Voir ».

**R141 + R142 : retirés de Plus** : « Importer des fiches avions », « Importer FlyLog », « Compléter instructeur /
examinateur depuis FlyLog ». Aucune donnée ne change. (Le chargeur caché de fichier FlyLog reste pour les tests.)

**R143 : Totaux** : sections repliables (fermées au départ, celles laissées ouvertes retenues sur cet appareil : réglage
privé `totauxOuverts`) ; nouvelle section « Trigrammes » (vols et heures ensemble, dernier vol ; personnes avec trigramme,
tous rôles ; simulateur exclu ; selon la période choisie). Aucun total existant ne change.

**Tests** : `tests/unitaires/v055.test.js`, `tests/navigateur/v055.mjs` ; anciens tests adaptés (v08, v09, v010, v016b,
v019, v022, v023, v053 et clics « Copie sur le NAS » / « Restaurer depuis le NAS ») ; test complet.

## v0.54 — 21/11/2026

Remarques R132 à R135. carnet.php v5, NPF-Q400 et format NPF-Q400 inchangés ; NAS et VPS non touchés ; données inchangées.

**R132 : « Mission »** au lieu de « MISSION » sur la bulle des cartes de vol (pastille de règle dont le texte est
« MISSION ») ; couleurs inchangées ; PDF inchangé.

**R133 : toutes les bulles feu en rouge plein.** « Feu n°7 » ; plusieurs feux : « Feu n°41, 42 » ; sans numéro : « Feu ».
Un feu repris (même numéro qu'un vol précédent) montre aussi son numéro. Plus aucune bulle feu en contour seul. Affichage
seulement : aucune donnée ni aucun total ne change ; PDF inchangé.

**R134 : atterrissages jour / nuit répartis tout seuls** à partir du total N à l'arrivée : vol fini de jour : N jour ;
commencé de jour et fini de nuit : N−1 jour + 1 nuit ; entièrement de nuit : N nuit. « De nuit » = même règle que le temps
de nuit, à l'heure d'arrivée sur le terrain d'arrivée. « Att. Jour » +/− change le total ; « Att. Nuit » +/− déplace un
atterrissage entre jour et nuit (correction à la main), gardée tant que ni les heures, ni les terrains, ni le total ne
changent. Escales : leurs atterrissages gardent leur jour / nuit (heures envoyées par NPF, ou saisis à la main). Nouveaux vols, vols
modifiés et imports NPF ; les anciens vols ne sont pas rattrapés (ouverts sans rien changer d'heure : rien ne bouge).
Totaux : simple somme, comme avant.

**R135 : « Dash 8 / CdB », « Dash 8 / Copi », « Dash 8 / Année »** dans la liste des heures et la bande ; « Dash 8 » et
« CL-415 » inchangés ; mêmes identifiants internes (les choix faits restent cochés) ; PDF inchangé (codes OACI).

**Tests** : `tests/unitaires/v054.test.js`, `tests/navigateur/v054.mjs` ; v029 et v034 : feu repris en rouge plein ;
v046, v052, v06 : « Dash 8 / … » ; unitaires missions, v046, v052, v06 adaptés.

## v0.53 — 21/11/2026

Remarques R130 et R131. carnet.php v5, NPF-Q400 et format NPF-Q400 inchangés ; NAS et VPS non touchés ; données inchangées.

**R130 : instructeur ou examinateur EN PLUS du copi.** Fiche d'un vol, « Ma fonction » : lien « + Instructeur /
Examinateur » -> ligne facultative (Inst / Exam, personne avec les suggestions du copi, croix pour la retirer). Carte du
vol : bulle « Inst XXX » / « Exam XXX » juste après le copi, couleur Copi. Fiche en lecture : la personne et son rôle.
Recherche : aussi par instructeur et examinateur. Aucune heure ni aucun total ne change ; PDF inchangé. Champs du vol
déjà existants depuis la v0.1 (`nomInstructeur`, `nomExaminateur` : import FlyLog, tableur CSV, sauvegarde, synchro ;
carnet.php range le vol tel quel). « SELF » et l'instructeur d'une double commande (déjà affiché « Instr. ») ne font pas
de bulle en plus. Plus › Import FlyLog : « Compléter instructeur / examinateur depuis FlyLog » (vols avec un copi ET un
instructeur ou examinateur ; champ rempli seulement s'il est vide ; à usage unique, mémorisé avec les réglages).

**R131 : « CdB »** au lieu de « CDB » sur la bulle de fonction (couleurs inchangées ; PDF inchangé).

**Tests** : `tests/unitaires/v053.test.js`, `tests/navigateur/v053.mjs` ; v038 et v052 : « CdB » ; test complet.

## v0.52 — 21/11/2026

Remarques R126 à R129. carnet.php v5, NPF-Q400 et format NPF-Q400 inchangés ; NAS et VPS non touchés ; données inchangées.

**R126 : toutes les bulles des cartes de vol ont un contour** de 1,5 px, sans changer leur taille (mesuré avant / après).
Fond clair : contour de la couleur du texte ; fond plein (Feu, Entraînement, GAAR, Nuit) : même teinte un peu plus foncée ;
bulles qui avaient déjà un contour inchangées. CDB : fond #c8e6c9, texte et contour #1b5e20 ; Copi : fond #ecf6ed, texte et
contour #43a047 (DC, Inst. inchangées). Thème sombre : verts adaptés, contour de « Nuit » gris (la bulle est noire).

**R127 + R129 : « Dash 8 »** au lieu de « Dash 8 Q400 » dans la liste des heures et la bande (« Dash 8 », « Dash 8 CdB »…),
mêmes identifiants internes : les choix faits restent cochés. La bande écrit le libellé exact de la liste (casse respectée,
plus de MAJUSCULES forcées). PDF toujours en codes OACI.

**R128 : case « Dash 8 Année »** : heures de vol sur Dash 8 (MR + MRE), toutes fonctions, de l'année civile en cours (du
1er janvier à aujourd'hui, date du téléphone) ; simulateurs et simulations exclus ; repart à zéro au 1er janvier.

**Cases OPS / IFR** (navigateurs sans text-box seulement) : centrage rendu indépendant de la position de la case (le
changement de la bande le décalait d'un pixel dans l'ancien Chrome des tests).

**Tests** : `tests/unitaires/v052.test.js`, `tests/navigateur/v052.mjs` ; v06 et v046 (unitaires et navigateur) : libellés
« Dash 8 » ; v051 : tolérance d'arrondi d'échelle ; test rapide avec les tests des bulles et de la bande.

## v0.51 — 17/11/2026

Remarque R125. carnet.php v5, NPF-Q400 et format NPF-Q400 inchangés ; NAS et VPS non touchés ; données inchangées.

**R125 : cases OPS / IFR** : chaque morceau (titre, J-, date) est centré verticalement dans la case, indépendamment des
autres (plus d'alignement sur la ligne de base du gros « J- ») ; mesuré à l'encre, au pixel, à 360 / 393 / 412 px, écrans
×2 et ×3, Chrome et Safari, avec text-box et avec la solution de repli. La police suit la largeur de la case : 17 / 26 / 17
à 360 px, plus grande au-delà (au plus 20 / 30 / 20), toujours 10 px de marge au moins, sur une ligne. Case de 30 px,
couleurs, gris et synchro inchangés.

**Tests** : `tests/navigateur/v051.mjs` ; v048 adapté (tailles et écart à l'échelle de la case) ; test rapide.

## v0.50 — 17/11/2026

Remarque R124. carnet.php v5, NPF-Q400 et format NPF-Q400 inchangés ; NAS et VPS non touchés ; données inchangées.

**R124 : case OPS = colonne « Vol OPS avant le »** (au lieu de « Entrainement avant le ») ; jamais confondue avec « Vol
OPS a partir du » (titre exact, sans tenir compte des majuscules, accents ni espaces). Case IFR inchangée. Dernier jour =
la veille, comme avant. Colonne absente : « Colonne « Vol OPS avant le » introuvable dans la feuille. » Rien d'autre ne
change.

**Tests** : `tests/unitaires/v050.test.js`, `tests/navigateur/v050.mjs` ; v048 et v049 : la feuille inventée a la nouvelle
colonne ; test rapide.

## v0.49 — 17/11/2026

Remarque R123. carnet.php v5, NPF-Q400 et format NPF-Q400 inchangés ; NAS et VPS non touchés ; données inchangées.

**R123 : l'adresse du socle passe d'un appareil à l'autre, même déjà synchronisés.**
- Cause (reproduite avec le faux NAS) : entre deux appareils à jour, l'adresse passait bien. Mais un appareil encore en
  v0.47 quand l'adresse est partie ne connaissait pas ce réglage : il le sautait tout en avançant son repère de synchro ;
  une fois en v0.48, il ne le redemandait jamais.
- Rattrapage : à la première synchro d'une version qui connaît de nouveaux réglages partagés, l'appareil relit une fois
  sur le NAS les réglages qu'il n'a jamais traités.
- Réglages partagés : envoyés dès qu'ils changent (même sans vol modifié), reçus à chaque synchro ; le plus récent gagne,
  réglage par réglage (l'heure de modification voyage avec le réglage ; plus de « conflit à choisir » pour un réglage) ;
  un réglage resté vide et jamais échangé n'est jamais envoyé (il n'efface rien ailleurs) ; un effacement volontaire
  est transmis. Dès que l'adresse arrive, le socle est lu et les cases apparaissent.

**Tests** : `tests/unitaires/v049.test.js`, `tests/navigateur/v049.mjs` ; v024 (unitaire) : titulaire, le plus récent
gagne au lieu d'un conflit ; test complet.

## v0.48 — 17/11/2026

Remarque R122. carnet.php v5, NPF-Q400 et format NPF-Q400 inchangés ; NAS et VPS non touchés ; données inchangées.

**R122 : socle OPS et IFR sur l'accueil**, lu dans la feuille Google du pilote (web app en lecture seule, sans clé).
- Plus › Socle OPS / IFR : « Adresse du socle (Google) » + « Tester » (« OK · OPS et IFR lus » ou l'erreur en clair).
  L'adresse est gardée avec le carnet (synchro NAS, sauvegarde) : elle revient seule sur un nouvel appareil (synchro
  rejointe ou sauvegarde restaurée). Elle n'est jamais dans le code.
- Deux cases sous la bande des heures : OPS = « Entrainement avant le », IFR = « vol IFR avant le » ; dernier jour de
  validité = la veille ; « J-10 » / « J-0 » / « J+3 » et la date courte ; vert (plus de 5 jours), orange (5 à 0), rouge
  (dépassé) ; gris avec les dernières valeurs si la dernière lecture réussie n'est pas du jour. Sans adresse : rien.
- Lecture au lancement, au retour au premier plan et au bouton d'actualisation ; 20 s au plus ; une seule à la fois.
- Bande des heures plus basse (marges et interlignes), polices inchangées.

**Tests** : `tests/unitaires/v048.test.js`, `tests/navigateur/v048.mjs` (faux serveur qui imite la web app, faux NAS,
horloge simulée) ; test complet.

## v0.47 — 17/11/2026

Remarque R121 (suite au diagnostic du 17/11). carnet.php v5, NPF-Q400 et format NPF-Q400 inchangés ; NAS et VPS non
touchés ; données inchangées.

**R121 : les vols envoyés par NPF arrivent sans refaire l'export.**
- Le bouton d'actualisation lance la synchro ET la recherche des vols NPF ; message « À jour · 2 vols NPF à importer »
  (« À jour » seul s'il n'y en a aucun) ; recherche ratée : « Vols NPF : NAS injoignable, nouvel essai dans 1 min ».
- Recherche toutes les 2 min quand l'app est ouverte ET visible (rien en arrière-plan ni écran éteint).
- Recherche ratée (NAS injoignable, plus de 20 s…) : un nouvel essai automatique 1 min plus tard, sans message.
- Jamais deux recherches en même temps. Bandeau, fenêtre d'import, « pas de doublon » et les 4 déclencheurs d'avant
  inchangés.

**Tests** : `tests/navigateur/v047.mjs` (faux NAS local, horloge simulée) ; test complet.

## v0.46 — 16/11/2026

Remarques R117, R118, R120. carnet.php v5 et format NPF-Q400 inchangés ; NAS et VPS non touchés ; données inchangées.

**R117 : autre pilote en gras** (fiche d'un vol) : nom / trigramme en gras 20 px (au lieu de 16) ; la case et le bouton +
gardent exactement leur taille et leur place (mesuré avant / après, Chrome et Safari), en lecture seule et en modification.

**R118 : date de la fiche en gras**, à la plus grande taille qui tient dans la case (22 à 24 px selon l'écran) ; la case
garde sa taille ; l'icône du calendrier garde la sienne et reste utilisable (Chrome / Android / PC ; Safari n'en a pas).

**R120 : noms de modèles dans les heures affichées** (menu « Choisir les heures affichées » et bande de l'accueil) au lieu
des codes OACI : « Dash 8 Q400 » (tous les DH8D : MR et MRE regroupés ; total, CdB, Copi), « CL-415 » (tous les CL2T),
sinon le modèle de la fiche (un bouton par nom si un même code en a plusieurs). Heures identiques (vérifié avec le vrai
fichier). Anciens choix convertis tout seuls à l'affichage, même ordre ; enregistrés en noms de modèles au premier
changement. PDF EASA, fiches avions, saisie et cartes de vols inchangés. Libellés de la bande : « … » en dernier recours.

**Tests** : `tests/unitaires/v046.test.js`, `tests/navigateur/v046.mjs` ; v06 (unitaire) adapté ; test complet.

## v0.45 — 16/11/2026

Remarques R114 à R116. carnet.php v5 et format NPF-Q400 inchangés ; NAS et VPS non touchés ; données inchangées.
Dans les trois cas, la date et son contour ne bougent pas (position mesurée avec et sans les règles de la v0.45).

**R114 : plus d'espace sous la date** : le trajet (et le reste de la carte) descend de 4 px. Les tests mesuraient déjà
environ 6 px entre le contour et le haut du trajet alors que le téléphone en montrait 1 à 2 : choix du pilote, 4 px de plus.

**R115 : ligne avion et heures plus grandes** : nom et immatriculation 17 px, type 15 px, heures 15 px (couleurs et
graisses inchangées). La ligne avion reste sur une ligne : le type rapetisse d'abord (jusqu'à 13 px), puis « … ».

**R116 : pastille du temps alignée** : le haut de sa bordure est à la hauteur du haut du contour de la date (mesuré au
pixel : 0,67 px d'écart au plus, Chrome et Safari, 390 / 360 px, clair / sombre).

**Tests** : `tests/navigateur/v045.mjs` ; v011, v042, v044 adaptés ; test rapide.

## v0.44 — 16/11/2026

Remarques R109 à R113. carnet.php v5 et format NPF-Q400 inchangés ; NAS et VPS non touchés ; données inchangées.

**R109 : date des cartes dans un contour** noir 1,5 px (rayon 8 px, 5 px en haut et en bas, 7 px à gauche et à droite) ;
taille et graisse inchangées. Chiffres centrés au pixel dans le contour (`text-box`, avec une solution de repli pour les
navigateurs qui ne l'ont pas) : mesuré sur capture, écart haut / bas de 0 à 0,33 px (Chrome et Safari). Trajet toujours
collé dessous, pastille à droite. En-têtes de mois : 18 px, noir, très gras. Thème sombre : contour clair (sinon invisible).

**R110 : fond de l'accueil bleu clair** (#d4deec) ; cartes blanches ; les autres écrans et le thème sombre ne changent pas.

**R111 : total dans une carte blanche à bande bleu-blanc-rouge**, entre le bouton de synchro (version au-dessus) et la loupe,
sur une ligne ; « TOTAL HEURES DE VOL » ; valeur 38 px (le « h » plus petit), qui baisse si le total est très grand. Bande
d'heures et ligne 3 / 7 / 30 : la plus grande taille qui tient sans retour à la ligne ni coupure (repères 32 / 27 / 22 / 18 px
pour 1 / 2 / 3 / 4 cases). Toucher la bande ouvre le même menu ; toucher le total ne fait rien, comme avant.

**R112 : un vol s'ouvre en lecture seule** (carnet, recherche, « Voir dans le carnet ») : rien n'est modifiable (champs,
+ et −, interrupteurs, étiquettes, fiche de l'avion sans crayon ni recadrage, flammes figées) ; LF / LOC / UTC restent
utilisables ; « Fermer » en haut à gauche, titre « Vol » et « du JJ/MM/AAAA · départ › arrivée ». Le crayon en haut à
droite passe en « Modifier le vol » (« Annuler » revient à la lecture sans rien changer, « Enregistrer les modifications »).
Nouveau vol et vol NPF à vérifier : directement en modification.

**R113 : tests plus courts** : `npm run test:rapide` (10 min au plus) et `npm run test:complet` (`tests/lancer.mjs`) ; le
rapide devient complet tout seul si la version touche à la synchro, l'import, la sauvegarde, le format ou le service worker.
Aucun test supprimé.

**Corrigé en cours de route** : sur Safari (iPad), le premier essai de réajustement des tailles de l'accueil provoquait un
message « ResizeObserver loop » (trouvé par les tests v025, v034, v037, v038) ; remplacé par le réajustement au changement
de taille de l'écran et au retour sur le carnet.

**Tests** : `tests/navigateur/v044.mjs` ; tests adaptés à la lecture seule (crayon avant de modifier) et à la nouvelle
place de la date ; test complet puis test rapide.

## v0.43 — 15/11/2026

Remarque R106. carnet.php v5 et format NPF-Q400 inchangés ; NAS et VPS non touchés.

**R106 : date des cartes de vols remontée de 4 px** vers le bord haut de la carte (décalage visuel seulement). Trajet, ligne
avion, heures, étiquettes, remarque, pastille du temps et hauteur de la carte gardent exactement leur place (mesuré avant /
après). Taille et graisse de la date inchangées ; haut des chiffres non coupé (10 px sous le bord de la carte).

**Tests** : `tests/navigateur/v043.mjs` (positions avec et sans la règle ; 390 / 360 px clair / sombre, PC, iPad) ; v042
adapté (écart date / trajet : 2 + 4 = 6 px à l'écran) ; toute la batterie.

## v0.42 — 15/11/2026

Remarques R104 et R105. carnet.php v5 et format NPF-Q400 inchangés ; NAS et VPS non touchés.

**R104 : interrupteur « Afficher 3, 7 et 30 jours »** dans le menu des heures de l'accueil (toucher la bande sous le TOTAL).
Éteint : la ligne 3 / 7 / 30 JOURS disparaît sans laisser de place. Allumé par défaut. Réglage de l'appareil seulement
(`afficherJours`, réglage privé : ni synchro, ni copie NAS, ni sauvegarde ; gardé à la restauration). Calculs inchangés.

**R105 : la date en premier sur les cartes de vols** (maquette « A resserrée ») : 1re ligne la date (23 px, très gras), 2e
ligne le trajet (18 px gras ; 16 / 15 px avec escales), à 2 px sous la date ; la pastille du temps reste à droite, sur la
hauteur des deux lignes (un trajet long passe à la ligne sans passer sous elle). Ligne avion sans la date. Reste inchangé.

**Tests** : `tests/navigateur/v042.mjs` (interrupteur, réouverture, réglage privé ; cartes 390 / 360 px clair / sombre,
trajet long, PC, iPad) ; v011 adapté à la nouvelle place de la date ; v025 : une attente fixe de 0,3 s avant le bandeau de
conflit (trop courte quand la machine de test est chargée) remplacée par l'attente du bandeau ; toute la batterie.

## v0.41 — 15/11/2026

Remarques R102 et R103. carnet.php v5 et format NPF-Q400 inchangés ; NAS et VPS non touchés.

**R102 : lancement tout bleu nuit** (#0f1b35, la couleur du bord de l'icône)
- L'écran gris de la capture était celui d'Android, fabriqué à partir du manifeste (icône sur `background_color` #edf1f5) ;
  l'app n'avait pas d'écran de lancement à elle : ensuite, la page s'affichait vide et pâle le temps de charger le carnet.
- Manifeste : background_color #0f1b35. Nouvel écran de lancement interne (#lancement) : bleu nuit plein écran, icône au
  centre, sans la page derrière ; retiré dès que le carnet est prêt (ou en cas d'erreur, ou de lui-même après 8 s).
- theme_color (barre du haut, #1f4e79), id, start_url et scope inchangés.

**R103 : contour des cartes de vols** : gris #aab3c2 de 1,5 px et légère ombre 0 2px 6px rgba(20,30,50,.14) (option C) ;
sombre : #4c5d72 et ombre noire 50 %. 1,5 px = bord 1 px + liseré 0,5 px (Chrome arrondit un bord de 1,5 px à 1 px).
Vol de simulation : contour rouge gardé. Ombre simple (pas de flou lourd).

**Tests** : `tests/navigateur/v041.mjs` (manifeste, écran de lancement, cartes clair / sombre ; téléphone 390 / 360 px, PC,
iPad) ; toute la batterie. `v022.mjs` : un contrôle échouait une fois sur deux (déjà en v0.40) quand la demande automatique
des vols NPF tombait pendant lui ; il ne compte plus les demandes qui partent d'elles-mêmes (6 essais sur 6 réussis).

## v0.40 — 14/11/2026

Remarque R101. carnet.php v5 et format NPF-Q400 inchangés ; NAS et VPS non touchés.

**R101 : nom de l'app « Carnet de Vol »** (V majuscule) : manifeste (name et short_name), titre de la page, nom sous l'icône
de l'iPad (apple-mobile-web-app-title), ligne de version de Plus et message « pas une sauvegarde Carnet de Vol ». id, start_url
et scope du manifeste inchangés (Android garde la même app). Les phrases ordinaires (« ton carnet de vol… ») ne changent pas.

**Tests** : installation (manifeste), mise à jour, démarrage, v039 (nom et icônes) ; toute la batterie.

## v0.39 — 14/11/2026

Nouvelle adresse et nouvelle icône. carnet.php v5 et format NPF-Q400 inchangés ; NAS et VPS non touchés (ils n'acceptent que
l'origine https://grisonb.github.io, sans chemin : rien à changer).

- Le dépôt devient grisonb/Carnet-de-vol, l'app https://grisonb.github.io/Carnet-de-vol/ (renommage fait APRÈS cette version).
- Icône du pilote : icon-192, icon-512 (manifeste, sans version « maskable »), apple-touch-icon (180), favicon-32, favicon.ico.
  Nom « Carnet de vol », nom court « Carnet » (sous l'icône, iPad compris). Plus aucun « TEST » visible.
- Manifeste : id /Carnet-de-vol/, start_url et scope relatifs (./) : l'app marche à l'ancienne et à la nouvelle adresse.
- Service worker : un cache à part pour chaque adresse (ancienne : carnet-de-vol-vX.Y ; nouvelle : carnet-app-vX.Y) ; chacune
  n'efface que ses propres anciennes versions (la nouvelle n'efface jamais le cache de l'ancienne).
- Écran « Le carnet a changé d'adresse » : à l'ancienne adresse, dès que la nouvelle répond (fichier de version lu sans cache),
  écran plein avec un bouton vers la nouvelle adresse et un bouton « Enregistrer une sauvegarde de ce carnet » ; plus AUCUNE
  écriture (db.js) ni demande au NAS (copie, synchro, vols NPF). Tant que la nouvelle adresse ne répond pas : app normale.
- Mêmes données à la nouvelle adresse sur Chrome (Android, PC) : même site. iPad : la nouvelle icône peut démarrer vide
  (synchro du NAS ou sauvegarde de secours).

**Tests** : `tests/navigateur/v039.mjs` (les deux adresses servies, nouvelle en ligne ou non, faux NAS v5, téléphone, iPad) ;
tests adaptés à la nouvelle adresse (le test de mise à jour reste à l'ancienne, là où les apps installées se mettent à jour).

## v0.38 — 13/11/2026

Remarques R93 à R99. carnet.php v5 et format NPF-Q400 inchangés ; NAS et VPS non touchés.

**R93 : recadrer la photo de l'avion** (fiche avion)
- Photo chargée à la main : la fenêtre « Recadrer la photo » s'ouvre tout de suite (glisser pour déplacer, pincer, molette
  ou curseur « Zoom » pour zoomer ; le cadre blanc a exactement la proportion du bandeau ; Annuler rouge, Valider vert).
- Le zoom minimum remplit toujours le bandeau (jamais de bande vide). Bouton « Recadrer » en bas à gauche du bandeau (à côté
  de l'appareil photo) dès qu'il y a une photo, y compris trouvée par « Chercher une photo » ; il rouvre le cadrage précédent.
- La photo d'origine est gardée entière (même réduction et même JPEG qu'avant) ; seul le cadrage { centre, zoom } est gardé
  avec l'avion (`photoCadre`), à « Enregistrer » comme la photo. Sans cadrage : affichage d'avant (centré).
- Le cadrage suit la photo : il reste sur l'appareil (les photos ne voyagent ni par la synchro ni par la copie NAS) et une
  restauration depuis le NAS le garde avec la photo du téléphone. Aucun changement du NAS.

**R94-R99 : cartes des vols de l'accueil** (couleur du vol = celle de la pastille : feu, GAAR, Entraînement, IFR, sable)
- R94 remarque / mission en noir ; la barre à gauche prend la couleur du vol.
- R95 pastille du temps : fond blanc, heure et contour 4 px de la couleur du vol, même taille extérieure ; sable : #8a6a2e.
- R96 « N lrg » : contour et texte rouges (vol feu) ou orange (entraînement ; feu d'abord), sinon jaune comme avant.
- R97 « N att » (atterrissages de jour) : fond blanc, texte et contour noirs.
- R98 atterrissages de nuit à part : « N att nuit », comme l'étiquette « Nuit 0h40 » (texte blanc sur fond noir), juste
  après elle (ou à la place de « N att » s'il n'y a pas d'heures de nuit).
- R99 « N appr » : texte et contour du bleu IFR, juste après « IFR » (déjà le cas).
- Thème sombre : même logique sur le fond de la carte, teintes plus claires (contraste ≥ 4,5).
- Autres étiquettes, saisie, PDF et CSV inchangés.

**Tests** : `tests/unitaires/v038.test.js`, `tests/navigateur/v038.mjs` (téléphone 390 / 360 px, PC, iPad ; image inventée) ;
tous les tests existants (ceux qui vérifiaient l'ancien style de la pastille et des étiquettes adaptés).

## v0.37 — 12/11/2026

Remarques R89, R90 et R91. carnet.php v5 et format NPF-Q400 inchangés ; NAS et VPS non touchés.

**R89 : « att » et « appr » sans point** sur les cartes du Carnet (« 3 att », « 3 appr ») et sur les étiquettes des terrains
intermédiaires de la saisie. Autres abréviations, PDF et CSV inchangés.

**R90 : avion sur une seule ligne** dans la saisie : « M99 / F-XZZZ / Dash 8 Q400 MRE », le type un peu plus petit. Trop long :
la police se réduit toute seule jusqu'à ce que ça tienne (jamais sous 12 px) ; « … » sur le type seulement si même à 12 px ça
ne tient pas. Un peu moins de marge dans le cadre et autour des « / » pour que ce format tienne aussi à 360 px. Boutons « i »
et « + » à la même place, même taille.

**R91 : « Feux » se range parmi les compteurs** du bloc Mission (« Choisir et ranger les compteurs » : flèches ↑ ↓, pas
d'interrupteur, toujours affiché). Ordre gardé (réglage « compteurs », qui voyage avec la synchro) ; par défaut « Feux » reste
en premier. « + », « − » et « prochain : n°… » (qui se touche) inchangés, où que soit « Feux ».

**Tests** : `tests/unitaires/v037.test.js`, `tests/navigateur/v037.mjs` (téléphone 390 et 360 px, iPad) ; v027, v028, v031 et
v034 adaptés à « att » / « appr » sans point ; tous les tests existants.

## v0.36 — 11/11/2026

Remarque R88. carnet.php v5 et format NPF-Q400 inchangés ; NAS et VPS non touchés.

**R88 : numéros de feu des vols de simulation**
- NPF-Q400-RUN n'envoie pas de numéro (seulement heure, position, commune, nom de chaque feu : `feuxNpf`, js/npf.js) :
  le Carnet le calcule à l'import (`brouillonNpf`, js/npf.js), à la mise à jour d'un vol NPF et au « + » de la saisie.
- Vol de SIMULATION : prochain n° = plus grand n° des vrais vols ET des simulations + 1 (sim 1 : n°55 ; sim 2 : n°56,
  n°57 ; sim 3 : n°58). L'alerte « n° déjà dans un autre vol » d'une simulation regarde aussi les simulations.
- VRAI vol : inchangé, les simulations sont ignorées (après des simulations jusqu'au n°57, le vrai feu suivant est n°55).
- Vols déjà enregistrés : jamais renumérotés.

**Tests** : `tests/unitaires/v036.test.js`, `tests/navigateur/v036.mjs` (faux NAS v5 ; téléphone 390 px, iPad) ; tous les
tests existants ; contrôle local : totaux et prochain n° de vrai feu identiques.

## v0.35 — 11/11/2026

Remarques R85, R86 et R87. carnet.php v5 et format NPF-Q400 inchangés (le champ facultatif « simulation » existait déjà pour
le Carnet : les champs inconnus étaient ignorés) ; NAS et VPS non touchés.

**R85 : vols de SIMULATION envoyés par NPF-Q400-RUN** (« simulation »: true ; champ absent pour un vrai vol)
- Gardé du brouillon à l'enregistrement (`vol.simulation = true`). Bandeau rouge « SIMULATION VOL » : bandeau « N vols à
  importer » (« SIMULATION VOL : 1 sur 2 »), liste des vols NPF, haut du brouillon et de l'écran du vol, Carte du vol
  plein écran, carte de la liste (cadre rouge, « hors totaux »).
- Ne compte JAMAIS : TOTAL HdV, bande d'heures, 3/7/30 jours, onglet Totaux (nombre de vols compris), heures par avion,
  PDF EASA, prochain n° de feu (et alerte de doublon de n°), départ / avion / mode proposés pour un nouveau vol,
  doublons de la synchro et de l'import FlyLog.
- Reste dans : sauvegarde, copie NAS, synchro (avec sa marque), CSV (colonne « Simulation » = oui) ; suppression normale
  (glissé + Annuler). Google Earth : chaque point commence par « SIMULATION – ».
- Vrai vol NPF (sans le champ) : strictement inchangé.

**R86 : étiquettes et pastilles en texte BLANC gras** (remplace R70 et R84)
- Feu « n°… » et pastille du temps de tout vol feu (feu repris compris) : #d32f2f / blanc (5,0). « Feu » en contour :
  bord et texte #d32f2f (5,0 sur blanc) ; sombre : #ef5350 / #ff8a80 (7,1).
- Entraînement (étiquette et pastille) : #c8650f / blanc gras 700 (3,9 : choix du pilote).
- GAAR (étiquette) : framboise #d81b60 / blanc (4,9). Avant : orange pâle commun à toutes les pastilles de règles
  (`.chip.mi`) ; les autres pastilles de règles le gardent.
- Mêmes fonds en sombre (bien distincts de la carte sombre). IFR, sable, Appr, att., ligne de mission, saisie, bandeau
  SIMULATION inchangés.

**R87 : pastille du temps de vol des vols GAAR** : framboise #d81b60 / blanc (clair et sombre), avec la même règle que
l'étiquette « GAAR ». Ordre : feu, puis GAAR, puis Entraînement, puis IFR, sinon sable (GAAR + feu -> feu ; GAAR + IFR ou
GAAR + entraînement -> framboise).

**Tests** : `tests/navigateur/v035.mjs` (faux NAS v5 : vrai vol et simulation à 2 feux ; téléphone, PC, iPad) ;
`v034.mjs` vérifie maintenant R86 et R87 (couleurs, graisse, contrastes clair / sombre, cas GAAR, reste inchangé) ; `v031.mjs` adapté
(Entraînement et GAAR de R86) ; tous les tests existants.

## v0.34 — 11/11/2026

Remarque R84. carnet.php v5 et format NPF-Q400 inchangés ; NAS et VPS non touchés.

**R84 : rouge « Feu » plus franc** (choix C de la maquette, comme R70 pour l'orange Entraînement)
- Étiquette « Feu n°… » et pastille du temps de vol de tout vol feu (feu repris compris, pastille pleine) : fond
  #e5534b, texte #2a0503 (contraste 5,06) ; thème sombre : même rouge, texte #1f0302 (5,29).
- Étiquette « Feu » en contour (feu repris) : bord #e5534b, texte #b3261e (6,54 sur fond clair) ; sombre : #ff8a80 (7,05).
- Inchangés : orange Entraînement, IFR, sable, ligne de mission sous la carte, rouge de la saisie (champ Mission, messages).

**Tests** : `tests/navigateur/v034.mjs` (téléphone 390 px clair / sombre et thème choisi dans l'app, PC, iPad clair /
sombre ; couleurs et contrastes mesurés ; IFR, sable et ligne de mission comparés à la v0.33) ; tous les tests existants.

## v0.33 — 11/11/2026

Remarques R82 et R83. carnet.php v5 et format NPF-Q400 inchangés ; NAS et VPS non touchés.

**R82 : style des feux dans le fichier Google Earth (KML)**, comme les feux du projet du pilote :
- icône : l'épingle « flamme » de la bibliothèque d'icônes de Google Earth web (n° 2124), bleue #1976D2, écrite comme
  Google Earth web l'écrit lui-même (adresse earth.google.com/earth/rpc/cc/icon, pointe de l'épingle sur le feu) ;
- taille de l'icône « Petite » (0.8) ; libellé jaune #FBC02D, taille « Moyenne » (1).
- Le Carnet ne charge jamais cette icône : c'est Google Earth qui la lit à l'import.

**R83 : petit bouton « Google Earth »** (icône « partager » dessinée par l'app) tout en bas de la Carte du vol plein
écran, sous la carte (ne cache ni la carte, ni le crédit, ni « © OpenStreetMap »), 44 px de haut ; même bouton dans
la bulle d'une flamme. Fenêtre de partage du téléphone si le navigateur l'accepte (iPad). Chrome Android refuse les
fichiers .kml (liste des types permis de Chromium : photos, vidéos, sons, PDF, textes) : téléchargement, puis message
« Fichier téléchargé : ouvre-le dans Téléchargements puis Partager pour l'envoyer par mail ». Extension .kml gardée.
GUIDE.md : envoi par mail, import dans le projet.

**Tests** : `tests/navigateur/v033.mjs` (téléphone Android 390 et 360 px, PC, iPad paysage et portrait ; style du KML,
place du bouton, partage simulé, téléchargement et message) ; v032 adapté au nouveau style ; tous les tests existants.

## v0.32 — 11/11/2026

Remarques R76 à R79 et R81. carnet.php v5 et format NPF-Q400 (carnet-vol-npf v2) inchangés ; NAS et VPS non touchés.

**R76 : heures bloc d'un ancien vol sans heures**
- Ancien vol (temps de vol saisi, sans heures) : taper le départ calcule l'arrivée (départ + temps de vol), taper
  l'arrivée calcule le départ ; le temps de vol ne change pas ; passage de minuit et heures LOC gérés.
- Le calcul de nuit ne remplace JAMAIS le temps de nuit, l'IFR, les atterrissages ni les colonnes déjà saisis : s'il
  trouve une autre nuit, message « Calcul de nuit : 1h00 (gardé : 0h00) » avec « Appliquer » (seulement si on veut).
- Vols qui ont déjà leurs heures : inchangé.
- Ouvrir puis enregistrer un vol sans rien changer ne modifie plus rien du tout (avant : la colonne avion d'un vol
  importé de FlyLog passait de « 1h00 écrit » à « déduit de la fiche avion », même valeur comptée).

**R77 : avion dans la saisie** : « M91 / F-XZZA / Dash 8 Q400 MRE » (nom / immatriculation / type) ; sans nom :
« F-XAAB / type » ; texte long à la ligne puis « … », jamais sous les boutons i et +. Page d'accueil inchangée.

**R78 : libellés de la saisie** (Départ, Arrivée, Bloc Départ / Arrivée, Copi / CdB…, Étiquette, Remarques ; Code OACI
de la fenêtre Terrain intermédiaire) : couleur du texte, gras 600, 17 px, clair et sombre. Titres de blocs inchangés.

**R79 : numéro du feu**
- Règle inchangée : prochain n° = plus grand n° de feu de tout le carnet (toutes années) + 1.
- Dans « Feux (prochain : n°59) » / « Feux (n°59) », le numéro souligné en pointillé se touche : fenêtre « Numéro du
  feu » (– / + et saisie directe, aperçu « Ce vol / Feu suivant », Annuler / Valider). La ligne « FEU n°… » du vol prend
  le nouveau numéro ; les vols suivants continuent à partir du plus grand numéro du carnet.
- Numéro déjà dans un autre vol : message jaune, sans bloquer. Marche aussi pour un vol modifié plus tard.

**R81 : « Envoyer vers Google Earth »** (Carte du vol plein écran : bulle d'une flamme, et bouton pour tous les feux du vol)
- Fichier KML : « Feu n°12 / 2026 / VILLE SUR ESSAI » (sans commune : « Feu n°12 / 2026 »), icône flamme de Google
  Earth, libellé orange ; fichier « Feu-12-2026-COMMUNE.kml » ou « Feux-JJ-MM-AAAA.kml ».
- Menu Partager si le navigateur l'accepte (iPad), sinon téléchargement (PC ; Android : Chrome ne partage pas ce type
  de fichier). Aucune connexion à Google, aucun appel réseau. Il n'existe pas d'interface publique pour écrire dans un
  projet Google Earth : import à la main, expliqué dans GUIDE.md.

**Tests**
- `tests/navigateur/v032.mjs` (téléphone 390 et 360 px, PC, iPad WebKit, faux NAS v5, partage simulé, captures) ; tous
  les tests existants (v04 : le numéro souligné n'est pas un bouton – / +) ; contrôle FlyLog local ; 55 vols réels
  ouverts puis enregistrés sans changement : identiques ; fluidité avec le vrai carnet.

## v0.31 — 11/11/2026

Remarques R70 à R74. carnet.php v5 et format NPF-Q400 (carnet-vol-npf v2) inchangés ; NAS et VPS non touchés.

**R70 : orange « Entraînement » plus franc**
- Étiquette « Entraînement » et pastille du temps de vol des vols d'entraînement : fond #f0a050, texte #3f1c02
  (contraste 7,1). Thème sombre : fond #d97b2b, texte #1f0d00 (contraste 6,1). Les autres couleurs ne changent pas
  (les autres étiquettes de règles, comme GAAR, gardent leur orange clair).

**R71 : période dans la loupe**
- Deux dates « Du » et « Au » (JJ/MM/AAAA, bornes comprises, date du vol affichée sur la carte) ; « Du » seule :
  jusqu'à aujourd'hui ; « Au » avant « Du » : message, rien n'est filtré. Se combine avec la recherche texte.
- Seuls le TOTAL HdV et la bande d'heures du Carnet suivent la période ; les cumuls 3 / 7 / 30 jours sont masqués
  pendant une période. Onglet Totaux, PDF, CSV et sauvegardes : tout le carnet.
- Bandeau « Période : du … au … » avec une croix qui revient à tout le carnet.

**R72 : déplacer ou supprimer une flamme (Carte du vol en plein écran)**
- Appui long (0,6 s) sur une flamme : elle suit le doigt ; en la lâchant, « Déplacer le feu ici ? » (Déplacer / Annuler).
- Toucher une flamme : bulle « Supprimer ce feu », avec confirmation.
- Commune recalculée par le géocodage inverse de l'IGN (Géoplateforme, gratuit, sans clé : commune de la parcelle
  cadastrale la plus proche) ; hors ligne : position gardée, commune recalculée au retour du réseau (par l'appareil
  qui a déplacé la flamme).
- Heures, compteurs (Feux, largages) et mission ne changent jamais. Le changement part au NAS et vers les autres
  appareils comme toute modification.
- Même vol NPF-Q400 envoyé de nouveau : les flammes déplacées ou supprimées sont gardées ; « Ce qui change » et le
  brouillon le disent, avec un bouton « Reprendre les positions des feux envoyées par NPF-Q400 » (seulement si on le
  demande).

**R73 : fond photo aérienne**
- Carte du vol en plein écran : bouton « Plan / Photo » (choix gardé sur l'appareil). Photo = photos aériennes IGN
  (ORTHOIMAGERY.ORTHOPHOTOS, Licence Ouverte Etalab), crédit « © IGN » ; La Réunion couverte (essai réel).
- En ligne seulement ; hors ligne : plan et « Photo aérienne disponible en ligne seulement ». Les photos ne sont
  jamais gardées dans le cache hors ligne.

**R74 : étiquettes des terrains intermédiaires**
- Chaque nombre (att., nuit, appr.) dans une pastille à droite, en gras foncé ; 0 en gris ; nom long raccourci « … »
  pour que les nombres restent visibles (360 px compris) ; thème sombre lisible.

**Tests**
- `tests/navigateur/v031.mjs` (téléphone 390 et 360 px, PC, iPad WebKit, faux NAS v5, faux services IGN, captures) ;
  tous les tests existants (v016 et v027 lisent les nombres des terrains intermédiaires dans leurs pastilles) ;
  contrôle FlyLog local ; fluidité avec le vrai carnet, avec et sans période.

## v0.30 — 10/11/2026

Remarque R69. carnet.php v5 et format NPF (carnet-vol-npf v2) inchangés ; NAS et VPS non touchés.

**R69 : libellés des compteurs plus lisibles**
- Saisie d'un vol : les libellés de tous les compteurs (Feux, Largages et autres compteurs choisis, Appr, Att. Jour,
  Att. Nuit, ainsi que Règles, Temps IFR et Temps nuit dans le même bloc, et les compteurs de la fenêtre Terrain
  intermédiaire) sont de la couleur du texte (comme les valeurs), en gras 600, en 17 px.
- Le complément « (n°54) » est en 14 px gris foncé, plus discret mais lisible.
- Un libellé long passe à la ligne ; les boutons – / + gardent leur taille et leur place.
- Thème sombre : texte clair, même lisibilité.

**Tests**
- `tests/navigateur/v030.mjs` (taille, graisse, couleur et contraste en clair et en sombre ; libellé long à 360 px ;
  téléphone 390 px, PC, iPad WebKit ; captures) ; tous les tests existants ; contrôle FlyLog local.

## v0.29 — 10/11/2026

Remarque R68. carnet.php v5 et format NPF (carnet-vol-npf v2) inchangés ; NAS et VPS non touchés.

**R68 : pastille du temps de vol des vols feu**
- Pour tout vol feu, avec l'étiquette « Feu n°… » (pleine) ou « Feu » (en contour, feu repris), la pastille du temps de
  vol est pleine, exactement de la couleur de l'étiquette « Feu n°… », en clair comme en sombre.
- L'étiquette « Feu » ne change pas (en contour). Ordre des couleurs inchangé : feu, puis entraînement, puis IFR, sinon sable.

**Tests**
- `tests/navigateur/v029.mjs` (téléphone 390 px clair et sombre, PC, iPad WebKit, captures) ; tous les tests existants ;
  contrôle FlyLog local.

## v0.28 — 10/11/2026

Remarques R65 à R67 (maquette validée). carnet.php v5 et format NPF (carnet-vol-npf v2) inchangés ; NAS et VPS non touchés.

**R65 : approches sur la carte du vol**
- Étiquette « N appr. » (total : arrivée + terrains intermédiaires), juste après l'IFR (ou à sa place sans IFR), seulement
  s'il y a au moins une approche ; couleur vert-de-gris.

**R66 : temps de vol en pastille**
- Le temps de vol est dans une pastille arrondie, en gras, un peu plus grand, en haut à droite de la carte.
- Sa couleur est celle de l'étiquette qui donne le type du vol, avec les mêmes règles : feu (plein ou contour), puis
  Entraînement, puis IFR, sinon sable. Une route longue passe à la ligne sans chevaucher la pastille.

**R67 : nouveau vol depuis la barre du bas**
- Le bouton flottant « + Nouveau vol » est remplacé par un « + » blanc dans une bulle verte, à droite de « Plus » ; il
  marche depuis Carnet, Totaux et Plus ; pendant une saisie modifiée, il demande « Abandonner la saisie ? ».
- « Carnet / Totaux / Plus » plus grands (19 px), sur une ligne même à 360 px ; « Enregistrer le vol » ne recouvre plus
  la barre ; marge du bas de l'iPhone et de l'iPad respectée.

**Tests**
- `tests/navigateur/v028.mjs` (téléphone 390 et 360 px, PC, iPad WebKit paysage et portrait, captures) ; tous les
  tests existants (ceux qui cliquaient « + Nouveau vol » passent par le « + ») ; contrôle FlyLog local ; fluidité de la
  liste avec le vrai carnet comparée à la v0.27.

## v0.27 — 10/11/2026

Remarques R63 et R64. carnet.php v5 et format NPF (carnet-vol-npf v2) inchangés ; NAS et VPS non touchés.

**R64 (bug corrigé) : valeurs reprises d'un vol au suivant**
- Cause : le formulaire de saisie sert à chaque vol ; à l'ouverture d'un nouveau vol ou d'un brouillon NPF-Q400, les
  cases « Temps IFR » (en VFR) et « Temps nuit » (heures pas encore complètes) n'étaient pas remises à zéro : elles
  gardaient la valeur tapée dans le vol précédent, et l'enregistrement la reprenait.
- Correction : à chaque ouverture, toutes les cases repartent de zéro, puis le vol (ou le brouillon) les remplit.
  Les valeurs reprises volontairement du dernier vol enregistré ne changent pas (terrains R46/R58, avion, étiquettes,
  copilote, LOC/UTC).

**R63 : approches par terrain intermédiaire**
- Chaque terrain intermédiaire a son compteur « Appr » (– / +), à côté de ses atterrissages ; il s'affiche sur le terrain
  (« · 2 appr. »). Le compteur « Appr » principal = l'arrivée seulement ; le récapitulatif donne le total.
- Le vol garde le total (arrivée + terrains intermédiaires) : PDF et CSV le comptent ; vols existants inchangés (leurs
  approches restent sur l'arrivée) ; import NPF-Q400 : 0 sur les terrains intermédiaires (celles déjà saisies sont
  gardées lors d'une mise à jour) ; sauvegarde, restauration, copie NAS et synchro : sans perte ; ancienne sauvegarde
  relue normalement.

**Tests**
- `tests/unitaires/v027.test.js`, `tests/navigateur/v027.mjs` (téléphone, PC, iPad WebKit, faux NAS v5, captures ; le
  test R64 échoue sur la v0.26 et passe en v0.27) ; tous les tests existants ; contrôle FlyLog local.

## v0.26 — 09/11/2026

Remarques R59 à R62. carnet.php v5 inchangé ; NAS et VPS non touchés.

**Ce qui change**
- R60 majuscules par défaut sur les claviers du téléphone et de l'iPad : codes terrains, immatriculations, noms et
  indicatifs d'avion, trigrammes, étiquettes, missions, copilote en MAJUSCULES ; noms et prénoms de personnes, noms de
  terrains, titulaire avec une majuscule à chaque mot ; remarques et modèles avec une majuscule au début.
- R61 bouton « Rafraîchir » en haut à gauche du Carnet (à l'opposé de la loupe, 44 px, icône dessinée) : synchronise
  maintenant ; l'icône tourne pendant la synchro, puis « À jour » ou l'erreur (ex. « Pas de réseau, 2 en attente »).
- R62 une modification part au NAS dès l'enregistrement (au lieu de 5 s plus tard), et un dernier envoi part quand
  l'app passe en arrière-plan ou se ferme (demande qui survit à la fermeture). Sinon, elle repart à la prochaine
  ouverture, comme avant, sans rien perdre. « N en attente d'envoi » reste affiché, discret, en haut du Carnet tant
  que quelque chose n'est pas parti.
- R59 fenêtre « Chercher une photo » : « Toucher pour utiliser » sous les vignettes Commons ; « À voir seulement : ne
  peut pas être gardée » sur la photo Planespotters ; sans photo Commons : message clair + « Prendre une photo » /
  « Choisir dans la galerie ».
- Le numéro de version de l'accueil se met à droite du bouton « Rafraîchir ».

**Tests**
- `tests/unitaires/v026.test.js`, `tests/navigateur/v026.mjs` (téléphone et PC Chromium, iPad WebKit, faux NAS v5, faux
  Commons / Planespotters, captures) ; v0.21 adapté (message « aucune photo » dans l'encadré) ; tous les tests
  existants ; contrôle FlyLog local.

## v0.25 — 08/11/2026

L'iPad devient un 3e appareil du carnet (en modification, comme le PC). carnet.php v5 inchangé ; photos d'avion pas
encore synchronisées.

**Point vérifié avant de coder : NPF-Q400 sur le même iPad (même origine grisonb.github.io)**
- Le Carnet n'efface que ses propres caches (nom commençant par « carnet-de-vol- », sw.js) et ne répond qu'aux
  adresses sous /Carnet-de-vol-TEST/ ; sa base IndexedDB s'appelle « carnet-de-vol » ; il n'utilise pas localStorage.
- NPF-Q400, NPF-Q400-TEST et NPF-Q400-RUN (lus sans rien modifier) n'effacent que leurs caches (préfixes npf-…) et
  leurs bases de cartes (OfflineTilesDB…, OfflineMap_…, npf-q400-run-…) : jamais ce qui est au Carnet, et l'inverse.
- Place prise par le Carnet : ≈ 2 Mo d'app + quelques Mo de données (sans photos), à côté des ≈ 1,5 Go de cartes NPF.

**Ce qui change**
- Plus › Synchro du carnet sur l'iPad : « Cet iPad : recevoir le carnet et le modifier aussi » ; ensuite comme le PC
  (deux sens, conflits « Garder la version de l'iPad / du téléphone / les deux », doublons, « Annuler la dernière
  synchro »). Vols NPF-Q400 et copies NAS : téléphone seulement.
- Mise en page iPad (paysage et portrait) : colonne centrée comme sur le PC, onglets et « Annuler » de la saisie
  agrandis au doigt sur tablette, haut des écrans dégagé de la barre d'état (app sur l'écran d'accueil), nom
  « Carnet vol » sous l'icône. Téléphone et PC inchangés.
- Carnet de l'appareil effacé (Safari peut effacer les données d'un site) : rien de vide n'est envoyé ; si l'état de
  la synchro est resté, l'écran des suppressions ne propose plus « Confirmer » mais « Les remettre » (récupère tout
  depuis le NAS).

**Tests**
- `tests/unitaires/v025.test.js` (trois appareils simulés), `tests/navigateur/v025.mjs` (téléphone et PC Chromium,
  iPad WebKit 1080 × 810 puis 810 × 1080, faux NAS v5 local, captures) ; tous les tests existants ; contrôle FlyLog local.

## v0.24 — 08/11/2026

R50, étape 4 : synchro du carnet dans les DEUX sens (téléphone ↔ PC), par le NAS (carnet.php version 5, inchangé).

**Ce qui change**
- Le téléphone et le PC peuvent tous les deux ajouter, modifier et supprimer vols, avions, personnes, terrains,
  étiquettes et missions ; les deux restent à jour (ouverture, quelques secondes après un enregistrement, retour du
  réseau, toutes les 2 minutes, « Synchroniser maintenant »). Seul ce qui a changé voyage.
- PC en consultation : Plus › Synchro du carnet › « Passer en modification » (expliqué ; le carnet n'est pas renvoyé :
  le PC reprend la dernière version de chaque élément au NAS). Un nouveau PC peut aussi directement « recevoir le carnet
  et le modifier aussi ».
- Conflits : un élément changé des deux côtés (ou supprimé d'un côté, modifié de l'autre) n'est jamais écrasé ni
  effacé ; bandeau orange « N éléments modifiés sur les deux appareils › Choisir », écran côte à côte : « Garder la
  version du PC », « Garder la version du téléphone », « Garder les deux » (vols). Un vol ouvert dans la saisie n'est
  jamais changé sous les yeux du pilote. Étiquettes, missions et terrains perso ajoutés des deux côtés : réunis sans
  rien demander.
- Doublons possibles (même vol saisi deux fois, ou même vol NPF), parmi les vols créés depuis la synchro dans les deux
  sens : bandeau « Doublon possible › Voir » (supprimer l'un, ou garder les deux).
- Vols NPF-Q400 : importés sur le téléphone seulement (le PC ne les propose pas) : un vol NPF ne peut pas être enregistré
  une 2e fois sur l'autre appareil.
- Plus de 20 suppressions d'un coup : rien ne part avant confirmation (bandeau « N suppressions à envoyer › Confirmer » ;
  « Les remettre » les reprend au NAS).
- « Annuler la dernière synchro » (Plus › Synchro du carnet) : ce que la synchro a remplacé est gardé 30 jours.
- Hors ligne / NAS éteint : rien n'est perdu ; « N en attente d'envoi (pas de réseau) » dans Plus et en haut du Carnet.
- Copies automatiques du carnet sur le NAS : du téléphone seulement. Photos d'avion : pas encore synchronisées (v0.25).
- Mot de passe refusé : aucun appel automatique (synchro comprise).

**Tests**
- `tests/unitaires/v024.test.js` (deux appareils simulés, faux NAS en mémoire), `tests/navigateur/v024.mjs` (téléphone
  390 px + PC 1280 px, faux NAS v5 local, captures) ; v0.23 adaptée (le téléphone envoie et reçoit) ; tous les tests
  existants ; contrôle FlyLog local.

## v0.23 — 08/11/2026

R50, étape 3 : synchro du carnet du téléphone vers le PC, par le NAS (carnet.php version 5). Sens unique : le PC
consulte, il ne modifie rien.

**Ce qui change**
- Plus › Synchro du carnet : « Ce téléphone envoie le carnet » (appareil de référence) ou « Cet appareil consulte le
  carnet du téléphone ».
- Téléphone : premier envoi de tout le carnet (par paquets de 500), puis, quelques secondes après chaque
  modification, seulement ce qui a changé (vols, avions, personnes, réglages du carnet ; suppressions comprises). Pas de
  réseau ou NAS éteint : envoi en attente, puis tout seul (ouverture, retour du réseau, retour dans l'app). Les photos
  d'avion restent sur le téléphone (leur crédit voyage). Mot de passe, adresse du NAS et réglages propres au téléphone
  ne voyagent jamais. Réactivation : seul ce qui diffère du NAS est renvoyé.
- PC (consultation) : son carnet est remplacé par celui du téléphone (avertissement avant), puis mis à jour à
  l'ouverture, au retour dans l'app et toutes les 2 min ; bandeau « Consultation · à jour il y a … » en haut du Carnet.
  Rien ne se modifie : pas de « + Nouveau vol », vol ouvert en consultation (sans Enregistrer ni Supprimer, cases
  inactives), entrées de Plus qui modifient cachées, toute écriture refusée avec un message. Le PC n'envoie jamais de
  copie au NAS et ne s'occupe pas des vols NPF.
- Un appareil au carnet vide n'envoie plus jamais de copie sur le NAS (nouvel appareil).
- Guide NAS : nom de la tâche « Carnet NAS mot de passe origine » (DSM refuse l'apostrophe).

**Tests**
- `tests/unitaires/v023.test.js` (faux NAS en mémoire), `tests/navigateur/v023.mjs` (deux appareils : téléphone 390 px
  et PC 1280 px, faux NAS v5 local, 1 200 vols inventés, captures) ; tous les tests existants ; contrôle FlyLog local.

## v0.22 — 08/11/2026

Une remarque : R51, mot de passe du NAS personnalisé (après l'étude R50 + R51 du 08/11). Va avec carnet.php version 5
(préparé à part, installé par le pilote avec la tâche DSM « Carnet NAS installer »).

**Ce qui change**
- Plus › Copie sur le NAS › « Changer le mot de passe › » : nouveau mot de passe tapé deux fois (12 caractères au
  moins, lettres sans accent, chiffres et signes, sans espace, car il voyage dans un en-tête HTTP), « Afficher »,
  « Changer le mot de passe » (vert) / « Annuler » (rouge). Le NAS ne garde que l'empreinte ; l'app garde le nouveau.
- L'iPad (NPF-Q400) n'a rien à changer : l'ancien mot de passe reste sa clé, pour déposer des vols seulement.
  « Tester » avec l'ancien mot de passe le dit.
- Réponse perdue en route (ou demande renvoyée par le navigateur) : l'app vérifie avec le nouveau mot de passe et le
  garde si le changement a été fait.
- Mot de passe refusé : plus aucun appel automatique au NAS (copie, vols NPF) tant qu'il n'est pas corrigé, pour ne
  pas déclencher le blocage des essais (qui bloquerait aussi l'iPad sur le même réseau).
- « Trop d'essais » (NAS v5) : « réessaie dans 14 min » ; NAS encore en version 4 : message « installe d'abord la
  mise à jour ».

**carnet.php version 5** (dossier privé) : empreinte du mot de passe dans `acces/cle-carnet.json` (sinon celui
d'origine), clé NPF séparée, 5 échecs / 15 min par adresse et 30 / h au total, synchro du carnet (pour les prochaines
versions) et photos ; tâche DSM « mot de passe d'origine » en cas d'oubli.

**Tests**
- `tests/unitaires/v022.test.js`, `tests/navigateur/v022.mjs` (faux NAS v5 local, 390 px, captures) ; tous les tests
  existants ; contrôle FlyLog local. carnet.php v5 : tests PHP locaux, contrôle PHP 7.3, installation simulée.

## v0.21 — 08/11/2026

Une remarque : R34, photos d'avions trouvées sur Internet (après l'étude du 08/11 : Commons + lien Planespotters).

**Ce qui change**
- Fiche avion (en modification) : lien « Chercher une photo › » sous la photo (pas pour un simulateur).
- Wikimedia Commons : vignettes des photos libres de l'immatriculation (catégorie « immat (aircraft) », puis titres qui
  la contiennent ; 24 au plus), auteur et licence sous chaque vignette, « À vérifier » si le titre ne cite pas le type.
  Le pilote touche une photo, la voit en grand avec son crédit, puis « Utiliser cette photo » : la version 1280 px est
  téléchargée et réduite comme une photo du téléphone (≈ 100 Ko). Elle n'est gardée qu'à « Enregistrer ».
- Crédit sous la photo de la fiche : « Photo : auteur · licence · Wikimedia Commons » (liens vers la page de la photo et
  la licence). Une photo prise au téléphone n'a pas de crédit.
- Planespotters.net : sa photo est affichée dans la même fenêtre avec le nom du photographe ; elle et le nom mènent à
  sa page. Jamais gardée (ses règles l'interdisent).
- Sauvegarde manuelle : photo + crédit. Copie NAS : toujours sans photo (et sans crédit) ; à la restauration, la photo
  du téléphone et son crédit sont remis ensemble.
- Sans réseau : message ; aucune clé, aucun serveur intermédiaire (ni NAS ni VPS).

**Tests**
- `tests/unitaires/v021.test.js`, `tests/navigateur/v021.mjs` (faux Commons et faux Planespotters locaux, 390 px,
  captures) ; tous les tests existants ; contrôle FlyLog local. Essai réel hors batterie sur une immatriculation publique.

## v0.20 — 08/11/2026

Une remarque : R58, détachement à La Réunion (base FMEP).

**Ce qui change**
- Nouveau vol : si le départ est FMEP, l'arrivée par défaut est FMEP (sinon LFTW, comme avant). Le départ reste
  l'arrivée du dernier vol.
- Pendant la saisie, l'arrivée suit le départ (FMEP -> FMEP, autre -> LFTW) tant que le pilote n'a pas touché lui-même
  à l'arrivée. Un vol déjà enregistré ou un brouillon NPF-Q400 n'est jamais concerné.
- Règle dans `js/modele.js` (`arriveeParDefaut`, `BASE`).

**Contrôles (rien à changer)**
- Terrains de La Réunion : FMEP (Saint-Pierre Pierrefonds) et FMEE (Roland Garros) étaient déjà dans la table
  (coordonnées publiques, fuseau Indian/Reunion = UTC+4) ; ce sont les deux seuls terrains OACI de l'île.
- Nuit EASA à FMEP : fin du crépuscule civil identique à la minute au calcul de la NOAA (20/11/2026 : 15h05 UTC).
- Vol NPF-Q400 format 2 FMEP -> FMEE -> FMEP : terrains et atterrissages jour / nuit lus correctement.
- Bouton « LF » : pour un terrain FM.., un retour arrière libère la case (deux si la case contient un code LF), puis on
  tape les 4 lettres.

**Tests**
- `tests/unitaires/v020.test.js`, `tests/navigateur/v020.mjs` (390 px, captures) ; tous les tests existants ; contrôle
  FlyLog local.

## v0.19 — 08/11/2026

Une remarque : R56, couleurs.

**Ce qui change**
- Fond VERT : le bandeau « N vol(s) à importer depuis NPF-Q400 », « Enregistrer le vol » (et ses variantes
  « Enregistrer les modifications » / « la mise à jour »), « Continuer la saisie » (fenêtre « Abandonner la saisie ? »).
- Fond ROUGE : tous les boutons « Annuler » (12) : saisie d'un vol, terrain intermédiaire, ajouter un terrain, ajouter
  une personne, ajouter une étiquette, ajouter un avion, ignorer un vol NPF, restaurer depuis le NAS, restaurer une
  sauvegarde, import FlyLog, importer des fiches avions, et le « Annuler » du message « Vol supprimé ».
- Texte blanc, mêmes couleurs en clair et en sombre : contraste 5,1:1 (vert #2e7d32) et 5,6:1 (rouge #c62828), au-dessus
  du seuil de 4,5:1. Place, taille, texte et action des boutons inchangés (police inchangée).

**Tests**
- `tests/navigateur/v019.mjs` (390 px, clair / sombre : couleur, contraste, même place et même taille de chaque bouton,
  captures) ; tous les tests existants ; contrôle FlyLog local.

## v0.18 — 07/11/2026

Une remarque : R55, la liste des vols NPF-Q400 se fermait au lieu d'ouvrir le brouillon (premier vrai vol au format 2
reçu le 07/11 avec la v0.17 et le NAS v4).

**Cause**
- La flèche retour Android (v0.9) : quand l'app retire elle-même une entrée d'historique (`history.go`, par exemple au
  démarrage pour effacer celles d'une session précédente, ou après la fermeture d'une fenêtre), elle n'attendait la fin
  de ce recul que 800 ms. Sur le téléphone (démarrage, appareil chargé), il arrive plus tard : l'app le prenait alors
  pour un appui sur retour et fermait la fenêtre du dessus, la liste des vols NPF. Le toucher n'y était pour rien
  (pas de toucher qui traverse, pas de double déclenchement, la liste n'est pas redessinée par la vérification du NAS).

**Ce qui change**
- Chaque entrée d'historique porte son niveau ; un recul de l'app est reconnu au niveau où il arrive, même en retard :
  il ne ferme plus rien. Un vrai retour de l'utilisateur ferme toujours la fenêtre du dessus.
- Un toucher sur un vol ne peut ouvrir qu'un brouillon (protection contre un double déclenchement).
- La liste se ferme par sa croix ou la flèche retour ; elle couvre tout l'écran (aucun toucher ne la ferme).
- Cases terrain (R47, v0.16) : la sélection automatique au toucher n'efface plus des lettres déjà tapées (cas d'une
  fenêtre d'escale qui se donne le focus pendant qu'on tape).

**Tests**
- `tests/navigateur/v018.mjs` : touchers simulés, history.go() rendu lent (1,5 s) comme sur le téléphone ; bandeau puis vol
  du premier coup 10 fois de suite (dont après rechargement avec un historique ancien) ; vérification du NAS pendant le
  toucher ; toucher hors des vols ; croix ; flèche retour. Le même test échoue sur la v0.17. Tous les tests existants.

## v0.17 — 07/11/2026

Vols NPF-Q400 (format « vol NPF » version 2) : nouveau champ facultatif `arriveePosition: { lat, lon }`, envoyé quand
l'arrivée part sans code OACI (position GPS notée au dernier « Bloc arrivée »).

**Ce qui change**
- Arrivée sans code : la case Arrivée reste vide, à compléter ; le dernier atterrissage est classé jour / nuit à cette
  position (et le temps de nuit la prend comme point d'arrivée). Dès qu'un code connu est tapé, le calcul reprend les
  coordonnées du terrain ; code inconnu de la table : la position sert encore. Sans code ni position : comme avant.
- Brouillon NPF dont un terrain manque : les heures restent affichées en UTC (le fuseau local serait inconnu).
- Carte du vol : le point d'arrivée (et un pélicandrome sans code) s'affiche à sa position, même sans trace ADS-B et
  sans réseau ; la position est gardée avec le vol si le code tapé n'est pas un terrain connu.
- NAS : carnet.php v4 révisé : `arriveePosition` vérifiée (lat -90..90, lon -180..180, nombres), refusée si mal formée
  (la première v4 l'acceptait sans la vérifier). À redéposer : carnet.php, SHA256SUMS, tache_dsm_installer.sh.
- R52 : dans « Tous mes avions » et la recherche d'avion de la saisie, les avions d'un même type OACI sont classés par
  ordre alphabétique d'immatriculation (quel que soit le modèle : « … MR » ou « … MRE ») ; l'ordre des types ne change
  pas (Tous mes avions : types par ordre alphabétique, simulateurs à la fin ; recherche : type du dernier vol d'abord).

**Tests**
- `tests/unitaires/v017.test.js` ; `tests/navigateur/v017.mjs` (arrivée avec code, sans code avec position, sans code
  ni position, minuit UTC, carte hors ligne) ; `tests/navigateur/v017b.mjs` (R52, avions inventés) ; test PHP local (127 vérifications) ; tous les tests existants ; FlyLog.

## v0.16 — 07/11/2026

Vols NPF-Q400 au format « vol NPF » version 2 (le premier vrai envoi NPF-Q400 TEST v17.91 → NAS v3 → Carnet v0.15 a
marché le 07/11). Le format version 1 reste lu comme avant.

**Ce qui change**
- Avion retrouvé par son NOM dans la flotte (« M73 » = « m73 », espaces ignorés) ; si l'immatriculation est aussi
  envoyée, elle prime. Aucun ou plusieurs avions de ce nom : la recherche d'avion s'ouvre sur le nom, je choisis (ou
  « + Ajouter un avion »). La liste des vols en attente montre le nom et l'immatriculation trouvée.
- Escales : chaque passage devient un terrain intermédiaire, DANS L'ORDRE, avec Att. Jour / Att. Nuit calculés
  atterrissage par atterrissage (règle de nuit EASA, à la position du terrain, ou à la position envoyée si le code est
  inconnu). Pélicandrome sans code OACI : son nom s'affiche (pastille en pointillés), je complète le code en touchant
  l'escale ; rien ne bloque. Le dernier atterrissage est classé comme avant ; les totaux sont les sommes.
- Copilote : retrouvé par son trigramme dans mes personnes et placé comme Copi ; trigramme inconnu : « + Ajouter ZZZ à
  mes personnes » (fiche pré-remplie) ; aucune personne n'est créée sans mon accord.
- « Ce qui change » (même vol ré-exporté) compte aussi l'avion, les escales et le copilote.
- NAS : carnet.php version 4 (dépôt des formats 1 et 2, vérifications du format 2), préparé dans le dossier privé, à
  installer par la même tâche DSM (guide « Mise à jour v4 »).
- R46 : terrains par défaut d'un NOUVEAU vol : départ = arrivée du dernier vol enregistré, arrivée = LFTW (la base) ;
  premier vol ou dernier vol arrivé à LFTW : LFTW → LFTW. Toujours modifiable ; rien ne change pour un vol NPF-Q400
  importé (ses terrains priment) ni pour un vol existant.
- R47 : toucher une case terrain (départ, arrivée, terrain intermédiaire) sélectionne le code : on tape directement.
- R48 : bouton « LF » entre la date et « LOC » (même style). Activé : les cases terrain gardent « LF » et on ne tape que
  les 2 dernières lettres (passage automatique à la case suivante). Terrain hors LF : effacer le « LF » (retour
  arrière) libère la case, ou désactiver le bouton. Réglage mémorisé (`prefixeLF`).
- R49 : Plus › « Importer des fiches avions » : petit fichier texte « immatriculation, nom, indicatif radio, modèle » ;
  aperçu de ce qui change, puis « Appliquer » ; ne remplit que Nom, Indicatif radio et Modèle des avions trouvés par
  immatriculation (type OACI inchangé), ne crée aucun avion, ne touche à aucun vol ; avion introuvable signalé, ignoré.
  Le fichier du pilote reste privé (jamais dans le dépôt).

**Tests**
- `tests/unitaires/v016.test.js` (avion par nom, deux avions du même nom, escales LFHO ×2 → LFLU → LFHO, nuit,
  pélicandrome sans code, minuit UTC, copilote, ce qui change, format 1) ; `tests/navigateur/v016.mjs` (faux NAS,
  390 px, captures) ; `tests/navigateur/v016b.mjs` (terrains par défaut, sélection au toucher, bouton LF, vol NPF,
  import des fiches avions) ; test PHP local (118 vérifications) ; tous les tests existants ; contrôle FlyLog local.

## v0.15 — 06/11/2026

Une remarque : R33, recevoir les vols exportés depuis NPF-Q400 TEST (iPad), en passant par le NAS.

**Ce qui change**
- NPF-Q400 TEST dépose un vol sur le NAS (format commun « carnet-vol-npf » version 1) ; à l'ouverture de l'app, au
  retour du réseau et au retour dans l'app, si la copie NAS est configurée, le Carnet demande discrètement les vols en
  attente (sans aucun message d'erreur). S'il y en a : bandeau « N vols à importer depuis NPF-Q400 › » en haut du Carnet.
- Liste des vols en attente (date, avion, départ → arrivée, bloc, feux). Un vol s'ouvre en BROUILLON dans la saisie :
  date et heures bloc (envoyées en UTC, affichées selon le mode du dernier vol), avion trouvé par son immatriculation
  (sinon la recherche s'ouvre sur l'immatriculation avec « + Ajouter un avion »), départ / arrivée / escales, une ligne
  « FEU n°NN COMMUNE » par feu (numéros suivants) et le compteur Feux. Rien n'entre dans le carnet sans « Enregistrer ».
- Après Enregistrer, le vol est retiré du NAS (sans réseau : retiré discrètement à la vérification suivante, jamais
  reproposé). « Ignorer ce vol » (avec confirmation) le retire sans l'enregistrer.
- Un vol déjà enregistré (même id NPF) puis ré-exporté : « Ce qui change » puis « Mettre à jour ce vol » (pas de second vol).
- Positions des feux gardées avec le vol (`feuxPositions`) : flamme rouge + commune sur la Carte du vol, même sans
  trace ADS-B et sans réseau. Elles ne modifient jamais les heures. Rien ne change pour un vol saisi à la main.
- NAS : carnet.php version 3 (vol-depot, vols-liste, vol-retirer ; 200 vols au plus, 90 jours), préparé dans le dossier
  privé, à installer par la même tâche DSM (guide « Mise à jour v3 »). Avec l'ancien carnet.php, rien ne s'affiche.

**Tests**
- `tests/unitaires/v015.test.js` (format, avion par immatriculation, minuit UTC, 0 / 1 / 3 feux, mise à jour) ;
  `tests/navigateur/v015.mjs` (faux NAS : bandeau, liste, brouillon, Enregistrer, Ignorer, mise à jour, retrait différé,
  carte des feux hors ligne) ; test PHP local (dossier privé) ; tous les tests existants ; contrôle FlyLog local.

## v0.14 — 06/11/2026

Quatre remarques : R35 (copie NAS sans photos), R36 et R37 (PDF EASA), R39 (clavier de la recherche).

**Ce qui change**
- R35 : la copie automatique sur le NAS (et « Copier maintenant ») ne contient plus les photos d'avion, seulement les
  données. La sauvegarde de secours manuelle garde les photos. Restaurer depuis le NAS garde les photos du téléphone
  (même avion : même identifiant, sinon même immatriculation) ; la confirmation le dit. Le NAS ne change pas.
- R36 : PDF, chaque case est centrée horizontalement et verticalement (titres, sous-titres, saisies, totaux). Remarques :
  centrées si elles tiennent sur une ligne, sinon 2 lignes alignées à gauche (plus lisible pour un texte long).
- R37 : PDF, polices plus grandes sans changer la mise en page (mêmes colonnes, 18 lignes par page) : titres 5,4 → 5,6 pt
  (limite : « APPR. », 7 mm), sous-titres 5,4 → 7 pt (limite : « PILOTE », 10 mm), saisies 6,4 → 8 pt (limites : codes
  OACI larges, date, heures « 10:00 »), remarques 5,6 → 6,6 pt. Un texte trop large pour sa case (modèle, nom long,
  remarque longue) est écrit plus petit, jusqu'à l'ancienne taille, avant d'être coupé par « ... » : rien de ce qui tenait
  avant n'est coupé.
- PDF : la colonne « Modèle » affiche le code type OACI de l'avion (DH8D, DR40, CL2T…) au lieu du nom complet ; un
  avion sans type OACI garde son modèle. L'écran de l'app, le CSV et les fiches avion ne changent pas.
- R39 : recherche du Carnet, la touche loupe / Entrée du clavier ferme le clavier ; le texte et les résultats restent.

**Tests**
- Nouveaux tests unitaires `tests/unitaires/v014.test.js` (copie sans photo, photos gardées, PDF : pages, lignes, aucun
  texte hors de sa case, centrage) avec `tests/outils/pdf-noeud.js` (enregistreur des cases et textes du PDF) et
  `tests/outils/vols-pdf.js` (vols inventés difficiles) ; nouveau test `tests/navigateur/v014.mjs` ; tous les tests
  existants ; contrôle local avec le vrai fichier FlyLog (non commité).

## v0.13 — 06/11/2026

Retrouver un vol et consulter les vols voisins.

**Ce qui change**
- La liste du Carnet garde sa place quand on ouvre un vol puis qu'on revient (Annuler, Enregistrer, flèche retour
  Android, autre onglet). Avant, on revenait toujours en haut, sur le dernier vol.
- Recherche (date, terrain, immatriculation, mission…) : chaque vol trouvé a « Voir dans le carnet › ». La recherche se
  ferme et la liste complète s'ouvre sur ce vol (surligné un instant), avec les vols des jours voisins au-dessus et en
  dessous. En remontant, les vols plus récents se chargent au-dessus sans faire sauter l'écran.
- « ↑ Dernier vol » (en bas à gauche, quand on est loin du haut) ramène en un geste au dernier vol ; toucher l'onglet
  Carnet quand on y est déjà fait la même chose. Un nouveau vol enregistré ramène aussi en haut.

**Tests**
- Nouveau test `tests/navigateur/v013.mjs` (600 vols inventés) ; tous les tests existants, dont la fluidité ;
  contrôle local avec le vrai fichier FlyLog (non commité).

## v0.12 — 06/11/2026

Correction : « Copier maintenant » affichait « NAS injoignable » alors que « Tester » répondait OK.

**Cause**
- Le PHP du site web du NAS n'a pas l'extension zlib : le script du NAS plantait au moment de décompresser la copie.
- Le serveur web du Synology remplace toute réponse d'erreur par sa propre page, sans les en-têtes qui permettent à
  l'app de la lire : l'app ne voyait qu'un échec réseau (« NAS injoignable »), quelle que soit l'erreur.

**Ce qui change**
- L'app demande au NAS le « protocole 2 » (`&v=2`) : les erreurs lui reviennent sous une forme lisible (code 200 et
  `{"erreur", "code"}`), elle affiche donc le vrai motif (mot de passe refusé, erreur sur le NAS, copie trop grosse…).
  Les vrais codes HTTP restent compris (ancien script du NAS, faux NAS des tests).
- L'app annonce le nombre de vols de la copie (`&vols=N`) : le NAS sans zlib range la copie sans la décompresser,
  vérifiée par son empreinte SHA-256.
- Restaurer depuis le NAS : une version disparue affiche « Cette copie n'est plus sur le NAS. ».
- Le script du NAS (dossier privé, hors dépôt) est à mettre à jour par la même tâche DSM (guide).

**Tests**
- Nouveau test `tests/navigateur/v012.mjs` : faux NAS qui imite le serveur web du Synology (pages d'erreur sans CORS),
  PHP sans zlib, mot de passe refusé, erreur 500, version disparue, ancien script ; tous les tests existants.

## v0.11 — 06/11/2026

Une remarque : R32, carte de vol plus lisible dans la liste du Carnet (maquette v25, décrite dans le prompt).

**Ce qui change**
- Ligne sous le trajet : la date en gras, foncée, plus grande (police du trajet) ; le nom de l'avion en gras couleur
  du bloc Avion, puis l'immatriculation en gras foncé (sans nom : l'immatriculation prend la place du nom) ; le modèle
  en petit gris à la fin, coupé par « … ». Plus de tirets entre les éléments.
- La ligne des heures (LOC / UTC) reste en petit gris.
- La mission : en gras, 16 px, couleur du bloc Mission (orange foncé), petit trait vertical orange à gauche.
- Lisible en mode sombre ; rien ne dépasse à 390 px.

**Tests**
- 87 tests unitaires (3 nouveaux) ; nouveau test `tests/navigateur/v011.mjs` (avec nom, sans nom, sans mission,
  mission longue, clair / sombre) ; tous les tests existants (dont la fluidité) ; contrôle local avec le vrai
  fichier FlyLog (non commité).

## v0.10 — 06/11/2026

Deux remarques : R30 (types d'avion) et R31 (copie automatique sur le NAS).

**Ce qui change**
- R30 : Plus › Types d'avion ne montre que les types de mes avions (donc de mes vols), ceux ajoutés ou modifiés à la
  main, et une ligne SIM s'il y a des simulateurs. Les 4 types « exemples » de la table de la v0.1 (A320, AT72, C150,
  DA42) sont retirés ; les vols et les types réglés à la main ne changent pas.
- R31 : copie automatique du carnet sur le NAS. Quelques secondes après la dernière modification (modifications
  rapprochées regroupées), la sauvegarde de secours complète, compressée (gzip) et avec son empreinte SHA-256, part en
  arrière-plan. Pas de réseau, NAS éteint ou erreur : elle attend et repart toute seule (ouverture de l'app, retour du
  réseau, essais espacés jusqu'à 30 min) ; une seule copie en attente (toujours la dernière version). Aucune fenêtre
  ni message d'erreur : l'état se lit dans Plus.
- Plus › Sauvegarde : « Copie sur le NAS » (adresse et mot de passe tapés sur le téléphone, Tester, Copie automatique,
  Copier maintenant) et « Restaurer depuis le NAS » (versions gardées, confirmation, puis restauration comme un
  fichier). L'encart du haut passe au vert « Copié sur le NAS il y a … » quand la copie marche.
- L'adresse du NAS, son mot de passe et l'état de la copie restent sur le téléphone : ni dans le code, ni dans le CSV,
  ni dans la sauvegarde de secours ; conservés lors d'une restauration (`REGLAGES_PRIVES`).
- Côté NAS (dossier privé, installé à la main par une tâche DSM) : petit script PHP, copies rangées hors du dossier web.

**Tests**
- 84 tests unitaires (10 nouveaux : types, regroupement, file d'attente, essais espacés, mot de passe refusé, textes,
  compression, mots de passe absents de la copie et du CSV) ; nouveau test `tests/navigateur/v010.mjs` avec un FAUX
  NAS local (toute adresse non locale bloquée) ; tous les tests existants réussis ; contrôle local avec le vrai
  fichier FlyLog (41 types, taille d'une copie ; non commité).

## v0.9 — 05/11/2026

Cinq remarques faites sur le téléphone (R25 à R29), maquette v24.

**Ce qui change**
- R25 : tous les boutons × (fermer une fiche, une liste, la carte en plein écran, enlever une ligne de mission ou
  une règle, menu + de Mes avions ouvert) : rond plein rouge, croix blanche en gras dessinée par l'app (SVG),
  même taille qu'avant (≥ 40 px), lisible en mode sombre.
- R26 : menu Plus par sections (Sauvegarde, Exporter, Mes réglages, Import FlyLog, Téléphone), chaque entrée avec une
  icône dans un carré de la couleur du bloc, titre en gras, sous-titre dessous, chevron ›. En haut, un encart
  « sauvegarde » (jaune s'il n'y en a jamais eu ou plus de 7 jours, avec un bouton « Sauvegarder » ; sinon
  « Sauvegardé le JJ/MM » avec une coche verte) qui remplace l'ancien bandeau. Nouvelles entrées « Heures affichées
  en haut », « Libellés missions » et « Stockage » ; « Cartes de vol » indique l'avancement du rattrapage.
  Version en bas ; plus de mot « OUTILS ».
- R27 : flèche / geste retour d'Android : ferme la fenêtre ouverte, la carte plein écran, la fiche du vol, revient au
  Carnet depuis Totaux ou Plus ; sur l'accueil, l'app se ferme. Fiche d'un vol modifiée et non enregistrée :
  « Abandonner la saisie ? ». Une entrée d'historique par niveau ouvert (js/ui/retour.js) ; fermer par × retire la
  sienne (pas de double appui).
- R28 : plus de sélection de texte, de loupe, de menu « copier » ni de surlignage bleu à l'appui long, sauf dans les
  champs de saisie (copier-coller possible).
- R29 : recherche par date dans la loupe du Carnet (06/05/25, 6/5/2025, 06.05.2025, 06-05-25, 06 05 2025, 060525,
  06052025, 2025-05-06 ; 05/2025 = le mois ; 06/05 = ce jour toutes années ; 2025 = l'année). Sinon, recherche texte
  comme avant (js/recherche.js).

**Tests**
- 74 tests unitaires (6 nouveaux : formats de date, encart sauvegarde) ; nouveau test `tests/navigateur/v09.mjs`
  (flèche retour dans chaque cas, × puis retour, entrées de Plus, recherche par date, captures clair / sombre) ;
  tous les tests existants réussis ; contrôle local avec le vrai fichier FlyLog (non commité).

## v0.8 — 05/11/2026

« Carte du vol » (remarques R22 / R23) : trace ADS-B des archives adsb.lol, récupérées chaque nuit par le VPS
(/carnet-traces/, protégé par mot de passe). Affichage SEULEMENT : la trace ne modifie, ne propose et ne compare
jamais les heures ni les terrains.

**Ce qui change**
- Écran du vol : bloc bleu « Carte du vol » (trace en trait bleu, terrains de départ / escales / arrivée nommés).
  Fond OpenStreetMap avec du réseau (« © OpenStreetMap »), fond neutre sans réseau ; toujours « Données © adsb.lol,
  ODbL ». Toucher la carte : plein écran avec zoom au doigt, × pour fermer.
- Textes selon le cas : disponible demain matin, pas de code ADS-B, pas de trace (avion non capté), La Réunion non
  couverte, pas d'archive avant mars 2023, mot de passe à saisir, simulateur, rattrapage en cours.
- Récupération : à l'ouverture d'un vol, et en arrière-plan au démarrage pour les 30 derniers jours ; une demande à
  la fois, discrète. Seule la partie entre les heures bloc (marge 10 min, vol par-dessus minuit compris) est gardée,
  allégée à 800 points au plus, rangée sur le téléphone (nouveau magasin IndexedDB « traces », base v2) : ensuite
  affichée sans réseau. Recalculée si la date, les heures ou l'avion du vol changent.
- Plus › Cartes de vol : mot de passe (gardé sur le téléphone seulement : ni CSV, ni sauvegarde de secours ; conservé
  lors d'une restauration), bouton « Tester », état du serveur.
- Fiche avion : champ « Code ADS-B », rempli automatiquement depuis la liste du serveur (protégée), modifiable.
- Traces hors sauvegarde de secours (elles se retéléchargent ; la sauvegarde reste légère).
- Bibliothèque de carte Leaflet 1.9.4 (BSD-2) incluse : 162 Ko (≈ 46 Ko compressés), chargée à la première carte.

**Tests**
- 68 tests unitaires (dont 9 nouveaux) ; nouveau test `tests/navigateur/v08.mjs` avec faux serveur de traces et de
  tuiles (le vrai VPS n'est jamais appelé) ; tous les tests existants réussis.
- Contrôle local final (non commité) avec le vrai mot de passe et de vrais vols : traces affichées sur la carte.

## v0.7 — 05/11/2026

Remarque R24 (bande d'heures de l'accueil), maquette v23.

**Ce qui change**
- La bande d'heures est juste sous le TOTAL HdV, au-dessus des cases 3 / 7 / 30 jours.
- Fenêtre « Heures affichées en haut » : section « Ordre d'affichage » en haut (une ligne par valeur cochée,
  flèches ↑ ↓, libellé, valeur) ; ↑ désactivée en première ligne, ↓ en dernière. L'ordre est enregistré
  (réglage `bandeHeures`, compris dans la sauvegarde) ; une valeur nouvellement cochée s'ajoute à la fin.
- Deux nouveaux choix « Général » : Feux et Largages CdB Dash (nombres, mêmes calculs que l'écran Totaux).
- Le choix déjà fait sur le téléphone est conservé (même réglage qu'en v0.6).

**Tests**
- 59 tests unitaires (dont 4 nouveaux) ; nouveau test `tests/navigateur/v07.mjs` (390 px) avec captures ;
  tous les tests existants réussis ; vrai fichier FlyLog (local) : Feux 47, Largages CdB Dash 225, totaux identiques.

## v0.6 — 05/11/2026

Remarques R17 à R21, d'après la maquette v21.

**Ce qui change**
- Accueil : bande d'heures sous 3 / 7 / 30 jours (valeur « 2 695h20 », libellé dessous, défilement horizontal).
  Par défaut CdB, Copi, DC, Instructeur, IFR, Nuit. La toucher ouvre « Heures affichées en haut » : Temps bloc,
  Simulateur, CdB, Copi, DC, Instructeur, IFR, Nuit, Vols, Atterrissages, et un bouton par type d'avion (du plus
  d'heures au moins ; DH8D : total, CdB, Copi). Ordre = ordre coché ; choix enregistré (réglage `bandeHeures`,
  compris dans la sauvegarde). Mêmes calculs que l'écran Totaux.
- Bloc Mission : « Libellés missions › » (au-dessus de « Règles des pastilles › ») : tous les libellés, recherche,
  glissé à gauche pour supprimer avec « Annuler » (même liste « suggestions masquées » qu'en v0.5).
- Carnet : glisser une carte de vol vers la gauche -> « Supprimer » -> confirmation « Supprimer ce vol ? » (date,
  trajet, durée) -> « Vol supprimé — Annuler » 4 s ; « Annuler » remet le vol à l'identique. Même fonction que
  le bouton « Supprimer ce vol » de l'écran du vol. Tous les totaux sont recalculés.
- Compteurs du bloc Mission (Feux, largages, « Choisir et ranger ») seulement pour un DH8D (règles par type
  d'avion dans `modele.js`, `COMPTEURS_PAR_TYPE`) ; un ancien vol avec des compteurs non nuls les garde visibles.
- Prochain n° de feu : cherché aussi dans les remarques des vols (en plus des lignes de mission).
- Le message « Annuler » passe toujours devant les fenêtres.

**Tests**
- 55 tests unitaires (dont 6 nouveaux) ; nouveau test `tests/navigateur/v06.mjs` (390 px, glissés tactiles) avec
  captures ; tous les tests existants réussis ; contrôle avec le vrai fichier FlyLog (local) : totaux identiques,
  bande identique aux valeurs de référence, prochain feu n°52.

## v0.5 — 05/11/2026

Remarque R16 : supprimer une suggestion de mission par glissé à gauche.

**Ce qui change**
- Bloc Mission de la saisie : glisser une suggestion vers la gauche la décale et fait apparaître un bouton rouge
  « Supprimer » à droite (moins loin ou vers la droite : elle revient ; une seule ouverte à la fois). Un toucher
  simple choisit toujours la suggestion ; un glissé ne la choisit jamais ; le défilement vertical reste normal.
- « Supprimer » : la suggestion disparaît et le message « « … » supprimée des suggestions — Annuler » reste
  4 secondes. Seule la suggestion est retirée : le texte des vols enregistrés ne change jamais.
- Liste des suggestions masquées enregistrée dans les données du pilote (réglage `missionsMasquees`, comprise
  dans la sauvegarde de secours et sa restauration) : elles ne reviennent ni après redémarrage ni après recalcul.
  Retapée avec « + », une mission redevient une suggestion.
- Plus › Pastilles des missions : liste « Suggestions masquées » avec un bouton « Remettre ».

**Tests**
- 49 tests unitaires (dont 4 nouveaux sur les suggestions masquées).
- Nouveau test `tests/navigateur/v05.mjs` (Chromium, 390 px, glissés tactiles simulés) avec captures.
- Tous les tests existants réussis ; contrôle avec le vrai fichier FlyLog (local) : totaux identiques.

## v0.4 — 05/11/2026

D'après la nouvelle maquette validée (v19) et les remarques P1 à P6 et R1 à R15.

**Ce qui change**
- Accueil plus compact : version en haut à gauche, loupe à droite du TOTAL HdV (la barre de recherche
  s'ouvre en la touchant ; la refermer efface la recherche). Pastilles en couleur : fonction violet,
  missions orange, IFR bleu, nuit foncé, feu rouge, largages jaune.
- Saisie : plus de titre « Vol », date étroite en haut à gauche et LOC / UTC à droite ; une couleur par bloc
  (Vol bleu, Avion vert-bleu, Ma fonction violet, Mission orange, Temps du carnet vert, Remarques gris),
  teintes prévues en mode sombre ; libellé IFR jamais coupé ; signes « + » et « − » dessinés et centrés.
- Bloc Avion : une ligne « NOM modèle IMMAT » (sans nom : « IMMAT modèle »), qui ouvre / ferme la recherche
  (« Tous mes avions › ») ; boutons « i » (fiche en lecture seule, crayon pour modifier) et « + ».
  Champ Indicatif supprimé (l'indicatif radio est dans la fiche). Étiquettes en pastilles : seulement celles
  de l'avion choisi, « + » pour en créer une (ajoutée à l'avion) ; BOMBING et TRANSPORT exclusives ;
  TAILWHEEL cochée d'office pour un train classique.
- Fiche avion : champs « Nom » et « Indicatif radio » séparés ; bloc « Étiquettes » (hors carnet officiel) ;
  BOMBING + TRANSPORT par défaut pour les DH8D seulement ; train classique coche TAILWHEEL, tricycle la décoche.
- Tous mes avions : « + » en haut à droite ; crayon sur chaque carte (fiche en modification).
- Ma fonction : avion monopilote = pas de « Copi. », pas de champ de personne en CdB.
- Terrains : table mondiale des codes OACI à 4 lettres allégée (19 316 terrains, 0,97 Mo, 0,35 Mo
  compressé) ; « Ajouter ce terrain » pour un code inconnu (enregistré dans les données du pilote).
- Migration automatique des données v0.3 (une fois) : chaque avion garde ses étiquettes, Nom et Indicatif
  radio ; les DH8D reçoivent BOMBING + TRANSPORT, les trains classiques TAILWHEEL. Aucun vol modifié.

**Tests**
- 45 tests unitaires (dont 12 nouveaux : ligne avion, étiquettes, monopilote, terrains, migration).
- Nouveau test `tests/navigateur/v04.mjs` (Chromium, 390 px) avec captures ; parcours complet, installation,
  mise à jour (v0.1, v0.2 -> v0.4) et fluidité (4070 vols) : réussis.
- Contrôle avec le vrai fichier FlyLog (local) : tous les totaux toujours identiques.

## v0.3 — 05/11/2026

Correction : un téléphone qui avait la v0.1 restait bloqué en v0.1 (il fallait vider le cache de Chrome).

**Cause** : la v0.2 avait transformé le service worker en « module ». Le téléphone, enregistré en v0.1 avec un
service worker classique, relisait le nouveau fichier comme un script classique : erreur, mise à jour
abandonnée en silence, et l'ancienne app continuait d'être servie depuis son cache.

**Ce qui change**
- Service worker redevenu un script classique ; le numéro de version est dans `js/numero-version.js`
  (seul endroit), lu par le service worker (`importScripts`) et par l'app (`js/version.js`).
- Une nouvelle version prend la main dès qu'elle est téléchargée ; l'app se recharge alors toute seule,
  sauf pendant une saisie (dans ce cas elle s'affiche au lancement suivant).
- Téléphone resté en v0.2 : le service worker se met en mode « réparation » (réseau sans cache) et la
  bonne version s'installe au lancement suivant.

**Tests**
- 33 tests unitaires (dont : service worker lisible en script classique, version à un seul endroit).
- Nouveau test `tests/navigateur/mise-a-jour.mjs` (Chromium, Pixel 7) : v0.1 -> v0.3 et v0.2 -> v0.3 au
  2e lancement ; v0.3 -> version suivante dès le 1er lancement ; un seul cache restant.

## v0.2 — 05/11/2026

Correction de l'installation sur Android quand d'autres apps du même site (grisonb.github.io) sont installées,
et version toujours visible.

**Ce qui change**
- Manifeste : identité (`id`) explicite `/Carnet-de-vol-TEST/`, `start_url` et `scope` limités à
  `/Carnet-de-vol-TEST/`, nom court unique « Carnet vol ».
- Service worker : enregistré avec la portée `/Carnet-de-vol-TEST/` ; il ne répond qu'aux adresses du Carnet,
  ne lit que SON cache (avant : recherche dans tous les caches du site) et ne supprime que les caches
  « carnet-de-vol-… ». Nouveau cache `carnet-de-vol-v0.2`.
- Numéro de version écrit à un seul endroit (`js/version.js`) : le service worker l'importe pour nommer son
  cache, l'accueil et l'écran Plus l'affichent.
- Petite mention grise « v0.2 » en haut à droite de l'accueil, au-dessus de TOTAL HdV.

**Diagnostic (lecture seule des autres apps, rien n'y est modifié)**
- Carnet v0.1 : pas d'id → id = https://grisonb.github.io/Carnet-de-vol-TEST/ (inchangé en v0.2).
- NPF-Q400-TEST et NPF-Q400 : id « ./index.html?prod=1 », qui se calcule depuis la racine du site :
  https://grisonb.github.io/index.html?prod=1 pour LES DEUX (elles se confondent entre elles) ;
  portées /NPF-Q400-TEST/ et /NPF-Q400/. Aucune ne recouvre le Carnet.

**Tests**
- 32 tests unitaires (dont : version à un seul endroit, service worker limité au Carnet, manifeste).
- Nouveau test `tests/navigateur/installation.mjs` (Chromium, Pixel 7) : manifeste valide et installable,
  id calculé du Carnet différent de ceux de NPF-Q400-TEST et NPF-Q400, portée du service worker,
  caches et pages des autres apps intacts.
- Parcours complet Pixel 7 : réussi, avec « v0.2 » visible en haut à droite de l'accueil sans recouvrir
  TOTAL HdV, et dans l'écran Plus.

## v0.1 — 04/11/2026

Première version : PWA Android hors ligne, d'après la maquette validée v13 et les remarques numérotées.

**Ce qui est fait**
- Écran Carnet : TOTAL HdV, 3 / 7 / 30 jours (aujourd'hui inclus), recherche, vols groupés par mois,
  affichage progressif (fluide avec 4000+ vols), cartes avec drapeaux dessinés, heures LOC ou UTC, (J+1),
  pastilles (fonction, autre pilote, feu plein / contour, règles, largages, atterrissages, IFR, nuit).
- Saisie / modification / suppression d'un vol : terrains OACI avec nom et drapeau, escales avec
  atterrissages, LOC / UTC, heures « 0942 », temps de vol par-dessus minuit, VFR / IFR, approches, temps IFR,
  atterrissages, temps de nuit EASA calculé, dernier atterrissage classé jour / nuit ; avion (recherche,
  « Tous mes avions », ajout, fiche avec photo réduite à 1280 px) ; indicatif ; étiquettes ; fonction
  CdB / Copi. / DC / Inst. et autre pilote ; missions avec suggestions, feux numérotés, compteurs métier
  réglables ; « Remarque du carnet » ; récapitulatif « Temps du carnet » ; remarques et visas.
- Pastilles par règles (Plus › Pastilles des missions).
- Import FlyLog avec résumé et refus des doublons ; écran Contrôle import.
- Totaux : rubriques EASA, catégories, mission, étiquettes, types, avions ; période tout / année / 12 mois / dates.
- Exports : PDF carnet EASA (A4 paysage, totaux de page, reports, cumuls, signature), tableur CSV complet,
  sauvegarde de secours réimportable à l'identique ; rappel si pas de sauvegarde depuis 7 jours.
- IndexedDB, stockage persistant demandé et affiché, service worker (hors ligne), manifeste et icônes.

**Tests**
- 31 tests unitaires sur vols inventés : temps total (dont minuit), heures locales, nuit (jour, nuit, à cheval),
  dernier atterrissage jour / nuit, feux +1 / −1 et numérotation, pastilles, import (doublons, 00:00),
  totaux, sauvegarde puis réimport identique, tableur, PDF (totaux de page et reports), version du cache.
- Parcours complet Chromium en émulation Pixel 7 (vols inventés) : réussi.
- Fluidité 4070 vols inventés, processeur ×6 : ouverture 0,9 s, recherche 0,35 s, Totaux 0,25 s.
- Import du vrai fichier FlyLog sur le PC (local, rien dans le dépôt) : tous les totaux de référence identiques.
