# YOURLS

[YOURLS](https://yourls.org/) (Your Own URL Shortener) est un raccourcisseur de
liens auto-hébergé, libre (MIT), écrit en PHP. Cette intégration l'amène dans
Gladys : votre YOURLS devient un appareil avec son nombre de liens, ses clics,
les clics de son lien le plus cliqué et les clics des liens que vous choisissez
de suivre. Les scènes peuvent réagir quand un lien suivi passe un nombre rond
de clics, raccourcir une adresse et transmettre le lien court, ou lire les clics
de n'importe quel lien ; un widget du tableau de bord liste les liens les plus
cliqués.

Testé contre un vrai YOURLS 1.10.6 auto-hébergé (image Docker officielle,
MariaDB) ; vos retours sont les bienvenus dans
[les issues](https://github.com/guim31/gladys-yourls/issues).

## Ce qu'il faut

- Gladys Assistant 5.1.0 ou plus récent.
- Un YOURLS (version 1.5 ou plus récente) joignable depuis la machine de Gladys,
  sur votre réseau ou sur Internet.
- Son **jeton de signature**, ou un nom d'utilisateur et un mot de passe de son
  admin.

À chaque rafraîchissement, l'intégration envoie une requête (les totaux et les
dix liens les plus cliqués), plus une par lien suivi : 11 requêtes au plus.
YOURLS ne fixe aucun quota à son API.

## Pour commencer

### 1. Trouver le jeton de signature

Dans l'admin de YOURLS, ouvrez la page **Outils** (Tools) : la partie « Secure
passwordless API call » affiche votre jeton de signature (une suite de lettres
et de chiffres). Il permet à l'intégration d'utiliser l'API sans votre mot de
passe. À défaut, l'intégration peut utiliser un nom d'utilisateur et un mot de
passe de l'admin.

### 2. Configurer l'intégration

Dans Gladys, ouvrez **Intégrations → YOURLS → Configuration** :

- **Adresse de YOURLS** : l'adresse de votre YOURLS, celle qu'utilisent vos
  liens courts, par exemple `https://sho.rt` ou `http://192.168.1.10:8080/s`.
  Une adresse copiée depuis l'admin (`/admin/`) ou l'API (`/yourls-api.php`)
  est comprise ; sans `http://`, `https://` est utilisé.
- **Jeton de signature** : le jeton de l'étape 1 ; ou laissez-le vide et
  remplissez **Nom d'utilisateur (sans jeton)** et **Mot de passe (sans jeton)**.
- **Liens à suivre** : les mots-clés des liens courts à suivre, séparés par des
  virgules, par exemple `news, menu` (10 au plus ; une adresse courte complète
  fonctionne aussi). Chacun devient une fonctionnalité et peut déclencher
  « Palier de clics ».
- **Intervalle de rafraîchissement** : 1, 5 (par défaut) ou 15 minutes.
- **Langue des noms** : la langue des noms des fonctionnalités, fixés à l'ajout
  de l'appareil, et des erreurs des actions de scène.

**Tester la connexion** lit YOURLS et répond avec sa version, le nombre de liens
et de clics, et les mots-clés introuvables.

### 3. Ajouter l'appareil

Ouvrez l'onglet **Découverte** de l'intégration et ajoutez l'appareil YOURLS.
Après un changement des liens à suivre, l'onglet propose de mettre l'appareil à
jour.

## L'appareil

| Fonctionnalité               | Ce qu'elle montre                                             |
| ---------------------------- | ------------------------------------------------------------- |
| Joignable                    | 1 quand YOURLS répond, 0 après deux lectures ratées d'affilée |
| Liens courts                 | les liens courts de la base                                   |
| Clics                        | les clics de tous les liens                                   |
| Clics du lien le plus cliqué | les clics du lien le plus cliqué                              |
| Lien le plus cliqué          | le mot-clé du lien le plus cliqué, `-` sans aucun lien        |
| `Clics : news`               | les clics d'un lien suivi (ici `news`), une par lien suivi    |

Les chiffres sont ceux de YOURLS : tous les clics, robots compris (YOURLS ne les
distingue pas).

## Tableau de bord

Le widget **Liens YOURLS** affiche les clics et les liens au total, puis les
liens les plus cliqués avec leurs clics. Le bouton **Actualiser** relit YOURLS.
Ses réglages :

- **Liens affichés** (5 ou 10) ;
- **Afficher les totaux** ;
- **Afficher le bouton Actualiser**.

## Scènes

### Déclencheurs

- **Palier de clics** : un lien suivi passe un nombre rond de clics : 10, 25,
  50, 100, 250, 500, 1 000, 2 500… jusqu'à 1 000 000. Filtres : le mot-clé
  (vide : tout lien suivi) et le palier (vide : tous). Variables : mot-clé,
  adresse courte, adresse cible, titre, clics, palier. Chaque palier se
  déclenche une fois, même quand plusieurs sont passés entre deux lectures, ou
  pendant un arrêt de Gladys.

### Actions

- **Raccourcir une adresse** : crée un lien court dans YOURLS. Champs : l'adresse
  (elle doit commencer par `http://` ou `https://` ; les variables de scène
  sont les bienvenues), un mot-clé et un titre (facultatifs). Résultats :
  mot-clé, adresse courte, adresse cible, titre, clics, et « nouveau lien »
  (non quand YOURLS connaissait déjà l'adresse : il donne son lien existant,
  comme YOURLS le fait par défaut).
- **Lire un lien court** : lit un lien d'après son mot-clé (ou son adresse
  courte), suivi ou non. Résultats : mot-clé, adresse courte, adresse cible,
  titre, clics.

### Idées de scènes

- Un message quand le lien de votre annonce atteint 100 clics : déclencheur
  **Palier de clics** avec le mot-clé et le palier 100.
- Chaque matin, **Raccourcir une adresse** sur la page du menu du jour, puis
  envoyer l'adresse courte par Telegram.
- Chaque dimanche soir, **Lire un lien court** sur votre lettre d'information et
  envoyer ses clics.

## Dépannage

- **« YOURLS ne répond pas »** : vérifiez l'adresse et que Gladys peut joindre
  YOURLS (réseau, pare-feu, port).
- **« jeton de signature ou mot de passe refusé »** : recopiez le jeton depuis la
  page Outils (il change avec la clé de cookie de YOURLS), ou vérifiez le nom
  d'utilisateur et le mot de passe.
- **« aucune API YOURLS à cette adresse »** : l'adresse pointe ailleurs :
  utilisez l'adresse des liens courts, avec le sous-dossier de YOURLS s'il y en
  a un.
- **« l'adresse redirige »** : saisissez directement l'adresse en `https://`.
- **« certificat refusé »** : le certificat HTTPS est auto-signé ou expiré :
  utilisez l'adresse `http://` sur votre réseau local, ou un certificat reconnu.
- Un mot-clé suivi introuvable n'a pas de valeur ; **Tester la connexion** le
  nomme.
- Les logs ne montrent jamais le jeton, le mot de passe ni les visiteurs.

## Limites

- Les liens à suivre se tapent dans la configuration (10 au plus), ils ne se
  choisissent pas dans une liste : YOURLS peut contenir des milliers de liens.
- YOURLS compte tous les clics, robots et aperçus de liens compris.
- Avec un YOURLS qui garde un seul lien par adresse (le réglage par défaut),
  raccourcir une adresse connue donne son lien existant, même avec un autre
  mot-clé.
- L'appareil montre l'instance ; l'historique d'un lien commence quand vous le
  suivez.
