## 0.13.0b0 — Première bêta publique · Slider bidirectionnel

- Ajoute à **Lotus Slide** un second mode **Deux positions fixes / interrupteur**, en conservant intégralement le mode historique de validation à sens unique.
- Le curseur reste sur l’une des deux extrémités et peut être glissé dans les deux sens ; le seuil de bascule s’applique symétriquement depuis la position courante.
- Permet de synchroniser la position du curseur avec une entité Home Assistant et de piloter directement un état **ON/OFF** via `homeassistant.turn_on` / `homeassistant.turn_off`.
- Ajoute un mode alternatif avec **deux actions Home Assistant distinctes**, une pour chaque sens, tout en utilisant une entité d’état pour resynchroniser la position.
- Permet aux deux extrémités d’utiliser des **entités d’état différentes** et d’afficher indépendamment une **icône ou une image**.
- Reprend le mécanisme éprouvé de Lotus Stack pour les visuels dynamiques : visuel fixe, deux états/conditions ou correspondances de valeurs entières, avec visuel de secours.
- Les icônes dynamiques peuvent définir une couleur propre à chaque état et les images utilisent le sélecteur de médias natif Home Assistant.
- Ajoute une option d’**orientation automatique de la flèche du bouton** : elle indique toujours le sens vers l’autre position et s’inverse automatiquement lorsque le curseur change d’extrémité, y compris en orientation verticale ou inversée.
- Conserve la compatibilité des anciennes configurations : sans `mode: two_state`, Lotus Slide garde exactement son comportement de validation à sens unique.
- Internationalise les nouveaux contrôles du Slider dans les **19 langues** prises en charge par Lotus View Studio.
- Aligne la version de l’intégration, du frontend et le cache-busting sur **0.13.0b0**.

## 0.12.2 — Icône de création de dashboard

- Remplace l’icône de création de dashboard par une **page vierge** (`mdi:file-outline`), plus lisible dans le bouton blanc de la bannière.
- Force l’icône en **gris foncé** (`#374151`) et renforce légèrement son contraste au survol (`#1f2937`).
- Conserve le bouton blanc, le comportement existant et l’internationalisation du libellé accessible.
- Aligne les versions backend, frontend, manifeste et cache-busting sur **0.12.2**.

## 0.12.2 — Bannière d’identité Lotus View Studio

- Remplace le petit en-tête technique du gestionnaire par une **bannière complète** dans le même principe visuel que Lotus EnOcean.
- Utilise une palette propre à Lotus View Studio dérivée de son icône : **bleu profond → bleu Lotus → azur**, sans reprendre le vert d’EnOcean.
- Intègre l’icône dans un médaillon clair, le nom **Lotus View Studio**, la fonction d’éditeur visuel, un descriptif court et le numéro de version.
- Intègre les actions globales **langue**, **actualisation** et **création de dashboard** directement dans la bannière avec un traitement contrasté.
- Ajoute un rendu responsive pour les écrans étroits et mobiles, avec repositionnement des actions sous l’identité du produit.
- Internationalise le nouveau descriptif court dans les **19 langues** prises en charge.
- Aligne les versions backend, frontend, manifeste et cache-busting sur **0.12.2**.

## 0.12.0 — Migration complète vers le domaine Lotus View Studio

- Migre le domaine Home Assistant de `lotus_visual` vers **`lotus_view_studio`** et déplace l’intégration principale vers `custom_components/lotus_view_studio`.
- Migre les routes frontend vers `/lotus_view_studio_static`, `/lotus_view_studio_brand` et le panneau vers `lotus-view-studio`.
- Ajoute un pont `custom_components/lotus_visual` limité à la migration : il crée automatiquement la nouvelle entrée de configuration puis retire l’ancienne entrée via les API publiques Home Assistant.
- Migre automatiquement les stockages serveur `lotus_visual.digicodes` et `lotus_visual.preferences` vers `lotus_view_studio.digicodes` et `lotus_view_studio.preferences`.
- Migre les clés locales navigateur de langue, largeur de barre, guides et presse-papiers vers le préfixe `lotus_view_studio`, avec lecture des anciennes clés pendant la transition.
- Bascule les commandes WebSocket vers l’espace de noms `lotus_view_studio/*` tout en conservant des alias `lotus_visual/*` pour les modules 0.11.x éventuellement encore présents dans le cache navigateur.
- Expose `window.LotusViewStudio` comme espace de noms frontend canonique et conserve `window.LotusVisual` comme alias de compatibilité.
- Conserve volontairement les types de cartes et métadonnées Lovelace historiques afin de ne pas casser les dashboards déjà enregistrés.
- Maintient les améliorations 0.11.0 : renommage visible en Lotus View Studio et noms facultatifs pour Lotus Slide et Lotus Digicode.
- Aligne les versions backend, frontend et cache-busting sur **0.12.0**.

## 0.11.0 — Lotus View Studio et identification des cartes

- Renomme l’application **Lotus Visual** en **Lotus View Studio** dans le panneau, le gestionnaire, l’intégration Home Assistant, les traductions et la documentation.
- Conserve volontairement tous les identifiants techniques existants (`lotus_visual`, `custom:lotus-visual-layout`, types des cartes et métadonnées YAML) afin de ne casser aucune vue déjà enregistrée.
- Met automatiquement à jour le titre d’une entrée d’intégration existante vers **Lotus View Studio** au prochain chargement.
- Ajoute un champ **Nom** facultatif à **Lotus Slide** et **Lotus Digicode**. Ce nom sert à identifier la carte dans l’éditeur, notamment dans le libellé de la carte sélectionnée, sans être affiché dans le rendu final du dashboard.
- Les anciennes configurations sans `name` restent valides et conservent les libellés génériques `Lotus Slide` et `Lotus Digicode`.
- Aligne les versions backend, frontend et cache-busting sur **0.11.0**.

## 0.10.9 — Nettoyage Firefox et internationalisation

- Supprime les bannières de chargement et les avertissements Lotus non essentiels de la console Firefox ; les diagnostics techniques sont désormais silencieux par défaut et activables explicitement.
- Corrige l’ambiguïté de traduction entre **Annuler** et **Annuler la dernière modification**, ainsi que l’action **Rétablir**, dans les 19 langues.
- Internationalise les libellés dynamiques de Lotus Stack, les textes accessibles de Lotus Slide et Digicode, l’état vide de Lotus Visual et les réglages de placement de Lotus Layers.
- Corrige plusieurs traductions allemandes restées en français et garantit un repli vers l’anglais pour toute chaîne Lotus Layers non couverte.
- Retire le fichier `strings.json` obsolète de l’intégration personnalisée ; les 19 catalogues complets restent fournis dans `translations/`, conformément au format Home Assistant actuel.
- Harmonise les versions du manifeste, du backend, des modules frontend, de la documentation et des tests sur **0.10.9**.

## 0.10.8 — Regroupement logique des barres d’outils

- Réorganise la section **Édition** des cartes : **Copier** est désormais placé avant **Dupliquer**, avec un espacement visuel entre les deux commandes afin de mieux distinguer la copie inter-vues de la duplication locale.
- Remanie la barre horizontale en **six groupes fonctionnels** : cartes (ajouter/coller), structure de la vue (onglets/sélection multiple), repères d’édition, zoom, affichage final et outil YAML avancé.
- Ajoute un séparateur graphique vertical entre chacun de ces groupes pour accélérer le repérage visuel sans ajouter de libellés permanents dans une barre déjà dense.
- Conserve les mêmes commandes, raccourcis, états actifs/désactivés et règles d’internationalisation : seule leur organisation visuelle change.
- Renforce le comportement responsive de la barre en gardant chaque groupe d’icônes solidaire pendant le défilement horizontal.

## 0.10.7 — Copier / coller une carte entre vues Lotus Visual

- Ajoute une commande **Copier la carte** dans la section Édition de la barre verticale.
- Ajoute une commande **Coller la carte copiée** dans la barre horizontale globale, juste après l’ajout de carte ; elle n’apparaît que lorsqu’un contenu Lotus est disponible.
- Utilise un presse-papiers interne basé sur `sessionStorage`, avec repli mémoire lorsque le stockage navigateur est indisponible. La copie survit donc à la navigation entre vues du même onglet Home Assistant sans utiliser le presse-papiers système.
- Le collage conserve la configuration et la géométrie de la carte, puis l’affecte explicitement à **l’onglet actif** et au **calque de travail actif** de la vue de destination. Les identifiants de calque/onglet de la vue source ne sont jamais réutilisés.
- Renforce le gestionnaire d’ajout de cartes pour respecter les métadonnées `layer` et `tab` déjà enregistrées lorsqu’une carte est injectée directement par copie/collage ou duplication.
- Distingue visuellement les opérations : `mdi:content-duplicate` pour **Dupliquer**, `mdi:content-copy` pour **Copier** et `mdi:content-paste` pour **Coller**.
- Une carte située dans un calque verrouillé peut être copiée (lecture seule), mais le collage est interdit dans un calque de destination verrouillé.
- Internationalise les nouvelles commandes et leurs états dans les **19 langues** prises en charge.

## 0.10.6 — Conservation de l’état des calques pendant les opérations sur les cartes

- Corrige la remise à zéro des **calques masqués** lorsqu’une carte était ajoutée ou supprimée : une variation du nombre de cartes ne réinitialise plus la visibilité de travail des calques.
- Isole définitivement les opérations sur les cartes des réglages de calques : enregistrer, modifier, dupliquer, déplacer ou supprimer une carte ne modifie plus le calque actif, les calques masqués ni les verrouillages de calques.
- Ajoute un **cache de session d’édition en mémoire**, propre à chaque vue, qui conserve l’état des calques lorsque Home Assistant reconstruit le composant Lovelace après une sauvegarde native.
- Le cache conserve le catalogue courant des calques (nom, ordre et verrouillage), le calque de travail actif et les calques temporairement masqués. Il sert également de protection contre une configuration Lovelace momentanément en retard après une sauvegarde.
- Les modifications natives d’une carte et les suppressions déclenchent maintenant un point de sauvegarde de cet état avant de rendre la main à Home Assistant.
- L’état temporaire reste strictement lié au mode édition : il est vidé lorsque l’utilisateur quitte l’éditeur et n’a aucun effet sur le dashboard final.
- Les sauvegardes automatiques continuent de matérialiser les catalogues de calques propres à chaque onglet afin de préserver les verrouillages persistants.

## 0.10.5 — Fond configurable des icônes de début et de fin du Slider

- Ajoute à Lotus Slide la possibilité d’afficher un **fond indépendant derrière l’icône de départ et l’icône d’arrivée** afin de préserver leur lisibilité sur une image ou une carte située derrière.
- Le fond est désactivé par défaut pour conserver strictement le rendu des configurations existantes.
- Chaque fond peut être configuré séparément : **couleur**, **opacité**, **taille responsive** et **arrondi**.
- La taille du fond est calculée par rapport à la zone réellement disponible autour de l’icône et reste donc responsive en orientation horizontale comme verticale.
- Le fond reste centré derrière l’icône et n’intercepte aucun événement tactile ou souris.
- Les nouveaux réglages sont disponibles uniquement pour les icônes de départ et d’arrivée ; le bouton mobile conserve déjà sa propre gestion de fond.
- Complète l’internationalisation de ces commandes dans les **19 langues** prises en charge.
- Lotus Slide passe en version interne **1.2.0**.

## 0.10.4 — Persistance des calques et protection de la géométrie

- Corrige une régression de la 0.10.3 où une sauvegarde de position ou d’appartenance pouvait réécrire `lotus_visual.layers` sous une forme globale et faire perdre le catalogue de calques propre à certains onglets.
- Les sauvegardes automatiques de cartes conservent maintenant explicitement les jeux de calques de **tous les onglets** et les modifications optimistes encore en attente de propagation dans `lovelace.config`.
- Les sauvegardes de gestion des calques partent désormais de la configuration enrichie avec les derniers `view_layout` connus, afin qu’une opération de renommage/verrouillage de calque ne puisse jamais écraser une affectation de carte enregistrée juste avant.
- Ajoute une récupération défensive : si une carte référence encore `layer-2`, `layer-3`, etc. mais que le catalogue de son onglet a été perdu par une ancienne version, Lotus Visual reconstruit automatiquement le calque au lieu de replacer silencieusement la carte dans le Calque 1.
- Renforce la migration de `view_layout` : les anciennes données `lotus_visual_layout` sont fusionnées avec le format `lotus` avant toute écriture. Les dimensions personnalisées `x/y/width/height` sont donc préservées même lorsqu’un format récent ne contenait encore que `tab` ou `layer`.
- Applique la même protection dans l’éditeur d’onglets et dans le pont d’édition natif Home Assistant.
- Déplace la commande **Changer de calque** dans la section **Calque**, entre **Ajouter au calque actif** et **Retirer du calque**.
- Remplace la flèche générique de changement d’onglet par l’icône dédiée `lotus:tab-move`, représentant un onglet avec une flèche sortante et indépendante de la disponibilité des icônes MDI selon la version de Home Assistant.

## 0.10.3 — Calques indépendants par onglet

- Corrige la portée des calques : lorsque les onglets Lotus sont activés, chaque onglet possède désormais sa propre liste de calques, leur ordre, leurs noms et leurs verrouillages.
- Sans onglet actif, la gestion reste globale à la vue comme auparavant.
- Introduit un stockage compatible avec les anciennes configurations : l’ancien tableau `lotus_visual.layers` sert de modèle de migration, puis les calques sont enregistrés dans un espace `global` et des espaces `tabs` indépendants.
- Isole également l’état de travail de l’éditeur par onglet : calque actif et calques temporairement masqués ne se propagent plus d’un onglet à l’autre.
- Le compteur de cartes d’un calque ne compte plus les cartes appartenant aux autres onglets, même si elles utilisent le même identifiant interne de calque.
- Lorsqu’une carte est déplacée vers un autre onglet, elle rejoint le **Calque 1** de l’onglet de destination afin de ne jamais réutiliser accidentellement un calque homonyme d’un autre onglet.
- Les nouvelles cartes sont ajoutées dans le calque de travail de l’onglet actif.
- La section Calques de la barre latérale affiche le nom de l’onglet actif pour rendre la portée immédiatement visible.
- L’éditeur d’onglets supprime les jeux de calques des onglets supprimés et réinitialise correctement l’appartenance au calque lors d’un changement d’onglet.

## 0.10.2 — Simplification des outils de carte et ordre par calques

- Réduit les outils contextuels des cartes à trois groupes lisibles : **Édition**, **Position** et **Calque**, en sélection simple comme multiple.
- Place dans **Édition** les commandes de modification, duplication, verrouillage et changement de calque ; le déplacement vers un autre onglet reste disponible dans ce même groupe lorsqu’il est pertinent.
- Regroupe dans **Position** les commandes de centrage, alignement, dimensions identiques et répartition afin d’éviter la multiplication des sections.
- Conserve dans **Calque** les commandes d’ajout de la sélection au calque de travail et de retrait vers le Calque 1.
- Supprime de l’interface les commandes **Ordre d’affichage** propres aux cartes : la profondeur est désormais gérée par l’ordre des calques.
- Réutilise les icônes `mdi:arrange-send-backward` et `mdi:arrange-bring-forward` pour reculer ou avancer le calque actif, représentation plus cohérente de la profondeur.
- Déplace l’icône de suppression dans l’en-tête de la sélection, à côté du nom et des informations de position/taille.
- Conserve l’internationalisation complète en utilisant les libellés **Édition**, **Position** et **Calque** déjà traduits dans les 19 langues prises en charge.

## 0.10.1 — Sections contextuelles et multisélection des calques

- Réorganise les outils de la barre verticale en sections explicites et stables : **Sélection**, **Calque de la sélection**, **Édition**, **Position et alignement**, **Dimensions**, **Ordre d’affichage**, **Répartition** et **Gestion de la sélection**.
- Supprime le libellé trop général **Actions de la carte** : la même structure est utilisée pour une carte ou plusieurs cartes, avec affichage uniquement des sections pertinentes.
- Étend les commandes d’appartenance aux calques à toute la sélection multiple : **ajouter au calque de travail**, **retirer vers le Calque 1** et **déplacer vers un autre calque** agissent désormais explicitement sur toutes les cartes sélectionnées.
- Adapte les infobulles, libellés, confirmations et compteurs au singulier/pluriel.
- Complète l’internationalisation des nouvelles sections et commandes de calques dans les **19 langues** prises en charge, avec variables `{count}` pour les libellés de multisélection.
- Localise également les libellés d’accessibilité de la barre horizontale, de la barre latérale et de sa poignée de redimensionnement.

## 0.10.0 — Refonte de l’éditeur Visual et calques nommés

- Sépare l’interface d’édition en **deux barres d’outils** : la barre horizontale conserve uniquement les commandes globales de l’éditeur, tandis qu’une nouvelle barre verticale regroupe la gestion des calques et les actions propres aux cartes.
- Ajoute une **barre verticale redimensionnable** par glissement de sa bordure gauche. Sa largeur est mémorisée localement et limitée à **30 % de la largeur du navigateur**.
- Transforme les anciens plans de cartes en **calques nommés de la vue** enregistrés dans `lotus_visual.layers`, avec un **Calque 1** toujours disponible comme base.
- Ajoute la création d’un calque, la suppression d’un calque vide, l’avancement/recul d’un calque et le **renommage direct** depuis la liste.
- L’ordre des calques pilote la profondeur d’affichage de toutes les cartes qu’ils contiennent, dans l’éditeur comme dans le rendu final.
- Chaque calque affiche son état de travail, sa visibilité dans l’éditeur et son verrouillage. La visibilité reste temporaire et strictement liée à l’édition ; le verrouillage est mémorisé dans la vue mais n’altère jamais le dashboard final.
- Ajoute les actions de carte **Ajouter au calque de travail**, **Retirer vers le Calque 1** et **Déplacer vers un autre calque**. Toute carte appartient toujours à un calque, ce qui évite les éléments orphelins.
- Les nouvelles cartes sont automatiquement affectées au calque de travail actif.
- Déplace les commandes d’édition de carte dans la barre verticale et masque entièrement cette zone lorsqu’aucune carte n’est sélectionnée.
- Un clic dans une zone vide de l’éditeur désélectionne désormais la carte ou la sélection multiple active.
- Conserve les corrections 0.9.15 du bloqueur modal Slider/Digicode et de l’icône de déplacement entre onglets.
- Ajoute les tests `VISUAL_LAYERS_SLIDE_MODAL_0.10.0_TEST.mjs` et `I18N_0.10.0_REGRESSION_TEST.mjs`.

## 0.9.15 — Slider modal blocker, tab icon and editor layers

- Ajoute à **Lotus Slide** l’option **Bloquer tous les autres clics pendant l’affichage du slider**. Le mécanisme réutilise le bloqueur modal de Lotus Visual déjà utilisé par le Digicode et respecte la visibilité native Home Assistant.
- Généralise le bloqueur modal aux cartes Lotus Slide et Lotus Digicode, y compris lorsqu’elles sont enveloppées dans une carte conditionnelle native Home Assistant.
- Corrige l’icône blanche de la commande **Déplacer vers un autre onglet** en remplaçant l’icône MDI non rendue par `mdi:arrow-right`.
- Ajoute un panneau **Calques** dans la barre de l’éditeur Visual, trié selon l’ordre Z réel des cartes de l’onglet actif.
- Chaque calque peut être masqué/réaffiché temporairement depuis l’éditeur, sans modifier le YAML ni le rendu final.
- Ajoute une commande pour masquer en une fois tous les calques situés au-dessus de la carte sélectionnée, ainsi qu’une commande pour réafficher tous les calques.
- Les calques masqués sont réinitialisés à la sortie du mode édition afin qu’aucun état d’édition temporaire ne puisse affecter l’utilisation du dashboard.
- Complète les traductions des nouvelles commandes pour les 19 langues prises en charge.
- Lotus Slide passe en version interne **1.1.1**.
- Ajoute les tests `VISUAL_LAYERS_SLIDE_MODAL_0.9.15_TEST.mjs` et `I18N_0.9.15_REGRESSION_TEST.mjs`.

## 0.9.14 — Native Home Assistant visibility for Lotus Stack

- Corrige la visibilité native Home Assistant (`visibility:`) des cartes Lotus Stack enregistrées sous forme `picture-elements`.
- Le renderer responsive Lotus Stack ne force plus la carte visible lorsqu'une visibilité native est configurée.
- Le `hui-card` Home Assistant d'origine reste connecté hors écran comme sonde de visibilité ; Home Assistant continue donc d'évaluer lui-même les conditions.
- Le résultat `card-visibility-changed` pilote simultanément le wrapper Lotus et le renderer Stack dédié.
- En mode édition, la carte reste visible afin de pouvoir être sélectionnée et configurée, conformément au comportement Home Assistant.
- Ajout d'un test de non-régression dédié au cas `picture-elements + lotus_visual_stack + visibility`.

## 0.9.13 — Digicode selector reliability

- Fixes a regression where the Digicode security level and Level 1 `input_number` PIN entity could not be selected after internationalisation.
- Digicode fields now connect directly to Home Assistant `ha-selector`; i18n changes only visible labels, never selector values.
- Adds a defensive `ha-form` fallback and a final HTML fallback so the security controls stay usable during frontend component loading.
- Synchronizes Digicode i18n with the current Home Assistant user locale.

## 0.9.9

- Corrige une régression Digicode introduite par l’internationalisation : les sélecteurs Home Assistant natifs ne sont plus transformés avant d’être transmis à `ha-form`.
- Le choix du niveau de sécurité (1 / 2 / 3) fonctionne de nouveau.
- En niveau 1, le sélecteur de l’entité `input_number` contenant le PIN fonctionne de nouveau.
- Les libellés restent traduits, tandis que les valeurs techniques (`frontend_entity`, `server_plain`, `server_encrypted`, `entity_id`) restent strictement inchangées.
- Ajout d’un test de non-régression dédié aux sélecteurs natifs du Digicode.

## 0.9.8

- Correction du dernier décroché visible au raccord entre un onglet actif et un onglet voisin arrondi avec remplissage.
- Le tracé SVG tient désormais compte de l’épaisseur réelle du contour (1 px ou 2 px) : son axe est décalé d’une demi-épaisseur pour coïncider exactement avec le contour interne de l’onglet actif.
- Le rayon de la courbe est compensé de la même valeur, ce qui conserve une tangence continue sans cran horizontal à fort zoom.
- Ajout de petits raccords aux extrémités opposées pour éviter tout décalage d’un pixel sur le second bord.
- Même géométrie dans le rendu final et dans l’aperçu de l’éditeur, pour haut/bas/gauche/droite et précédent/suivant.

## 0.9.7

- Correction du raccord visuel des onglets arrondis avec remplissage par le voisin.
- Le contour du voisin se prolonge maintenant jusqu’au point de tangence, suit la courbe puis rejoint le séparateur partagé.
- Suppression de la rupture de bordure supérieure/inférieure (ou latérale pour une barre verticale) visible après la correction 0.9.6.
- Même géométrie dans l’aperçu de l’éditeur et dans le rendu final.

# 0.9.6

- Correction complémentaire du contour des onglets avec remplissage par le voisin : le trait droit restant provenait du **contour de sélection de l’onglet actif** (`box-shadow`), et non du séparateur standard.
- Le contour actif est désormais dessiné côté par côté afin de supprimer uniquement le côté partagé lorsqu’un raccord arrondi est utilisé.
- Le côté partagé est remplacé par le même tracé vectoriel courbe que le raccord, avec une épaisseur et une intensité adaptées lorsque l’onglet concerné est actif.
- Le correctif s’applique au rendu final et à l’aperçu de l’éditeur, pour les barres en haut, en bas, à gauche et à droite.
- Le remplissage, les dimensions et les zones cliquables des onglets restent inchangés.

# 0.9.5

- Correction du contour des onglets lorsque **Remplir avec l’onglet précédent / suivant** est activé sur un arrondi simple.
- Le séparateur entre les deux onglets ne reste plus droit dans la zone arrondie : il suit maintenant exactement la courbe du coin puis rejoint la partie droite du raccord.
- La bordure n’est pas supprimée : seul l’ancien segment droit est remplacé par un tracé vectoriel adapté à la géométrie de l’arrondi.
- Le calcul est responsive et couvre les quatre positions de barre : **haut, bas, gauche et droite**, pour un arrondi au début comme à la fin.
- L’aperçu de l’éditeur d’onglets et le rendu final utilisent le même principe de contour.
- Le remplissage par la couleur active/inactive de l’onglet voisin introduit en 0.8.44 reste inchangé.

# 0.9.4

- Remplacement de l’icône monochrome de la barre latérale par le pictogramme validé **lotus dans une fenêtre**.
- Le lotus utilise cinq pétales simplifiés et reste volontairement séparé du contour afin de conserver une lecture nette à 24 px.
- Le pictogramme reste un `ha-icon` monochrome (`lotus:lotus`) : Home Assistant conserve donc la gestion native de la couleur selon le thème et l’état sélectionné.
- Ajout de `brand/sidebar_icon.svg` comme source vectorielle maintenable de l’icône de navigation.
- Aucun changement des icônes officielles `brand/icon.png` / `brand/dark_icon.png` utilisées dans Appareils et services et dans l’en-tête du gestionnaire.

# 0.9.3

- Uniformisation de l’identité visuelle Lotus Visual autour de l’icône officielle de l’intégration (`brand/icon.png`).
- L’en-tête du gestionnaire Lotus Visual affiche désormais exactement l’icône de l’application visible dans **Appareils et services**.
- Les vues Lotus du gestionnaire utilisent cette même icône au lieu de `mdi:flower-outline`.
- Suppression des dernières références `mdi:flower` / `mdi:flower-outline` du frontend Lotus Visual.
- La barre latérale conserve une variante monochrome `lotus:lotus`, nécessaire au rendu natif `ha-icon` de Home Assistant et dérivée de la même identité graphique.
- Ajout d’un chemin statique dédié aux ressources de marque Lotus Visual.

# 0.9.2

- Extension de la couverture linguistique européenne avec **néerlandais (`nl`), polonais (`pl`), suédois (`sv`), danois (`da`), norvégien bokmål (`nb`), finnois (`fi`) et tchèque (`cs`)**.
- Lotus Visual prend désormais en charge **19 langues d’interface**, en plus du mode automatique suivant la langue de l’utilisateur Home Assistant.
- Ajout d’un pack européen dédié `lotus-i18n-europe.js` afin de conserver une architecture de traduction modulaire et de ne pas alourdir le noyau FR/EN/DE.
- Les commandes principales, éditeurs, positions, actions, onglets, cartes et réglages Digicode disposent de traductions dédiées dans les sept nouvelles langues ; les diagnostics rares conservent l’anglais comme fallback de sécurité.
- La détection automatique reconnaît les locales Home Assistant `nl`, `pl`, `sv`, `da`, `nb`, `fi` et `cs`, ainsi que leurs variantes régionales (`nl-NL`, `pl-PL`, etc.).
- Pour le norvégien, Lotus utilise explicitement **`nb` (Norsk bokmål)** afin de correspondre à la locale Home Assistant.
- Ajout des traductions Home Assistant `nl.json`, `pl.json`, `sv.json`, `da.json`, `nb.json`, `fi.json` et `cs.json`.
- Mise à jour du stockage des préférences serveur pour accepter les sept nouvelles langues.
- Ajout du test `I18N_0.9.2_TEST.mjs` couvrant la liste des 19 langues, la détection automatique européenne, les traductions principales, les sélecteurs et les fichiers de traduction Home Assistant.
- Version d’intégration et cache frontend portés à **0.9.2**.

# 0.9.1

- Remplacement de l’icône générique `mdi:flower` du panneau latéral **Lotus Visual** par une icône Lotus monochrome dédiée (`lotus:lotus`), enregistrée directement par le frontend Lotus Visual et compatible avec la couleur du thème Home Assistant.
- Extension de l’internationalisation aux langues **italienne, espagnole, portugaise, chinoise simplifiée, japonaise, coréenne, thaïe, russe et arabe**, en plus du français, de l’anglais et de l’allemand.
- La détection automatique reconnaît désormais les locales Home Assistant `it`, `es`, `pt`, `zh`, `ja`, `ko`, `th`, `ru` et `ar`, y compris leurs variantes régionales (`pt-BR`, etc.) ; le chinois simplifié suit explicitement `zh-Hans`/`zh-CN`, tandis que `zh-Hant` reste en fallback anglais tant qu’une traduction traditionnelle dédiée n’est pas fournie.
- Le choix manuel de langue accepte les 12 langues et reste enregistré par utilisateur Home Assistant.
- Ajout d’un rendu bidirectionnel sûr pour le sélecteur de langue arabe : le contenu arabe utilise `rtl` sans imposer cette direction au reste de Home Assistant.
- Lotus Layers accepte désormais toutes les langues du moteur global ; lorsqu’une chaîne Layers n’a pas encore de traduction dédiée, le moteur global est interrogé puis l’anglais reste le fallback de sécurité.
- Ajout des fichiers de traduction Home Assistant `it`, `es`, `pt`, `zh`, `ja`, `ko`, `th`, `ru` et `ar`.
- Ajout du test `I18N_0.9.1_TEST.mjs` couvrant détection automatique, surcharge utilisateur, sélecteurs, persistance backend, RTL arabe et enregistrement de l’icône Lotus.
- Le test exécutable i18n 0.9.0 devenu obsolète est retiré du paquet ; sa fiche de vérification historique est conservée.
- Version d’intégration et cache frontend portés à **0.9.1**.

# 0.9.0

- **Internationalisation globale de Lotus Visual** : l’interface suit automatiquement la langue de l’utilisateur connecté à Home Assistant.
- Première couverture complète en **français, anglais et allemand**, avec l’anglais comme langue de secours lorsqu’une langue Home Assistant n’est pas encore disponible dans Lotus Visual.
- Ajout d’une commande `mdi:translate` dans Lotus Visual permettant de choisir **Automatique — Home Assistant**, Français, English ou Deutsch.
- La surcharge manuelle est enregistrée **par utilisateur Home Assistant** dans le backend Lotus Visual et mise en cache localement ; elle ne modifie jamais le YAML des cartes ou des vues.
- Ajout du moteur commun `lotus-i18n.js` pour centraliser les traductions des éditeurs, formulaires, sélecteurs, infobulles, confirmations, messages d’état et erreurs.
- Lotus Layers est raccordé au moteur global : son ancien mécanisme FR/EN prend désormais en charge l’allemand et respecte la surcharge utilisateur Lotus Visual.
- Internationalisation des éditeurs **Lotus View / onglets, Stack, Slide et Digicode**, ainsi que des bridges utilisés dans les dialogues natifs Home Assistant.
- Les contenus appartenant à l’utilisateur (nom de vue, nom d’onglet, entité, texte personnalisé) restent inchangés et ne sont jamais traduits automatiquement.
- Ajout de `translations/de.json` pour les chaînes de configuration de l’intégration Home Assistant.
- Version d’intégration et cache frontend portés à **0.9.0**.

# 0.8.44

- Amélioration visuelle des onglets à arrondi simple : un onglet peut désormais remplir la zone découverte par son arrondi avec la couleur de l’onglet voisin, donnant l’illusion que ce voisin passe derrière lui.
- Pour un arrondi au **début de la barre**, le remplissage reprend automatiquement la couleur courante de l’onglet précédent ; pour un arrondi à la **fin de la barre**, il reprend celle de l’onglet suivant. La couleur active du voisin est également respectée.
- L’option **Remplir avec l’onglet précédent / suivant** n’est proposée que lorsqu’un seul côté est arrondi et qu’un voisin existe réellement. Les deux coins arrondis conservent volontairement le comportement transparent actuel.
- Le remplissage est purement décoratif : largeur, hauteur, position, ordre et zones cliquables des onglets restent inchangés. L’aperçu de l’éditeur et le rendu final utilisent le même mécanisme.

# 0.8.43

- Suppression de la commande Lotus Visual « carte conditionnelle » : la visibilité d’une carte complète reste confiée à l’onglet natif **Visibilité** de Home Assistant. Les anciens wrappers `conditional` restent lisibles pour compatibilité.
- **Lotus Stack passe en 1.1.46** et ajoute une visibilité propre à chaque cellule. L’éditeur de cellule réutilise `ha-card-conditions-editor` de Home Assistant ; le YAML généré regroupe les éléments de la cellule dans un `type: conditional` natif, de sorte que Home Assistant assure lui-même validation et évaluation des conditions.
- Une cellule conditionnelle reste toujours visible et sélectionnable dans l’éditeur Stack ; seule sa représentation finale est masquée lorsque Home Assistant considère la condition fausse.
- Les séparations internes d’une Stack sont désormais sélectionnables par clic en plus du glisser-déposer. La séparation sélectionnée est mise en évidence et affiche, dans chaque cellule adjacente, une saisie numérique en pourcentage (`Gauche`/`Droite` ou `Haut`/`Bas`).
- La saisie numérique et le glisser-déposer utilisent exactement le même moteur géométrique et les mêmes limites de taille minimale ; une séparation commune à plusieurs cellules est donc déplacée de façon atomique et cohérente.
- Le renderer Lotus Layers traite les éléments conditionnels natifs comme des conteneurs de visibilité (`display: contents`) afin que leurs sous-éléments conservent le repère et le dimensionnement responsive de la Stack.

# 0.8.42

- Correction de la **marge de sécurité de la vue** : elle est désormais appliquée uniquement au rendu final téléphone/tablette et n’influence plus l’espace de travail ni le cadrage de l’éditeur Visual.
- La marge est calculée indépendamment sur chaque bord à partir des cartes interactives. Une image `top center` reste donc collée en haut lorsqu’aucune carte n’atteint le bord supérieur, tandis qu’une carte extrême en bas conserve réellement l’espace de sécurité configuré sous elle.
- Les modes sans défilement, défilement vertical et défilement horizontal utilisent les mêmes marges asymétriques ; les marges droite/basse restent accessibles jusqu’à l’extrémité du scroll.
- Ajout de deux commandes contextuelles pour une sélection simple : **centrer horizontalement sur l’image de fond** et **centrer verticalement sur l’image de fond**. Elles ne sont visibles que lorsqu’une seule carte est sélectionnée et respectent le verrouillage de la carte.

# 0.8.41

- L’éditeur Canvas n’est plus limité aux dimensions de l’image d’arrière-plan : une carte peut être placée au-dessus, en dessous, à gauche ou à droite de l’image.
- L’espace de travail est calculé sur l’union entre le cadre de l’image et les extrémités des cartes visibles ; il s’agrandit automatiquement lorsqu’une carte dépasse le cadre.
- Ajout du défilement horizontal et vertical automatique dans l’éditeur lorsque l’espace de travail dépasse la fenêtre. Le déplacement d’une carte près d’un bord peut également faire défiler l’espace de travail.
- Ajout d’un zoom d’édition de **10 % à 800 %**, par pas de 10 %, avec affichage permanent de la valeur en pourcentage.
- Ajout de trois raccourcis de cadrage : **image complète**, **ajuster à la largeur** et **ajuster à la hauteur**. Une image portrait en mode `contain` peut donc être affichée entièrement ou agrandie puis parcourue verticalement.
- Ajout du paramètre de vue **Marge de sécurité de la vue** (`0 à 160 px`). Cette bordure est réservée autour de l’ensemble image + cartes afin d’éviter qu’un élément interactif soit collé au bord de l’écran.
- Le calcul de la vue finale tient compte des cartes situées hors image et de la marge de sécurité, sans modifier leurs coordonnées en pourcentage.

# 0.8.40

- Correction de l’alignement de l’image d’arrière-plan des onglets Lotus dans la vue finale.
- Les neuf positions (`top left`, `top center`, `top right`, `center left`, `center`, `center right`, `bottom left`, `bottom center`, `bottom right`) pilotent désormais réellement la position de la scène lorsque l’image laisse de l’espace libre.
- En mode `contain`, un fond configuré en haut n’est plus recentré verticalement après la sortie de l’éditeur : `top center` place maintenant le haut de l’image au bord supérieur de la zone d’onglet.
- Le repère des cartes reste verrouillé sur l’image : l’image et les cartes sont déplacées ensemble, sans désynchronisation des positions en pourcentage.
- En mode de défilement vertical/horizontal, l’alignement est respecté sur les axes qui tiennent dans la fenêtre, tout en conservant une origine de défilement accessible lorsqu’un contenu dépasse la fenêtre.

# 0.8.39

- Correction de la visibilité des cartes Lotus Stack placées dans une carte conditionnelle native Home Assistant.
- La visibilité initiale est maintenant lue sur le véritable `hui-conditional-card`, même lorsqu'il est encapsulé par `hui-card`.
- Synchronisation renforcée au chargement et lors des changements d'état (`card-visibility-changed`, attribut `hidden`, cycle Lit).
- Le rendu Stack conditionnel est explicitement masqué/affiché sans dépendre de la feuille de style navigateur `[hidden]`.
- Aucun changement de comportement pour Lotus Slide et Lotus Digicode, qui restent rendus par le chemin natif Home Assistant.

# 0.8.38

- **Lotus Stack passe en 1.1.45.** Base fonctionnelle : 0.8.37 ; aucun changement fonctionnel de Slide, Digicode, Layers ou du Layout hors numéros de version/cache.
- Ajout du mode **Icône fixe / Deux états / Valeur entière** dans les cellules Stack utilisant une représentation par icône.
- En mode binaire, `OFF` / `false` / `0` sont équivalents et `ON` / `true` / `1` sont équivalents. Chaque état possède une icône et une couleur indépendantes.
- En mode valeur entière, le nombre de correspondances est configurable comme pour les images ; chaque valeur entière peut définir sa propre icône et sa propre couleur.
- L’icône fixe et sa couleur restent le fallback. Une correspondance peut laisser son icône vide pour conserver la même icône et ne faire varier que la couleur.
- L’entité de valeur, lorsqu’elle est définie, pilote l’icône dynamique ; sinon l’entité principale est utilisée. La source est toujours l’état brut et reste indépendante d’un attribut éventuellement affiché sous forme de texte.
- Ajout du picture-element minimal `custom:lotus-dynamic-icon-element` pour conserver le comportement lors du rendu du `picture-elements` sauvegardé, Home Assistant ne proposant pas de table arbitraire valeur → icône/couleur dans `state-icon`.

# 0.8.37

- **Lotus Digicode passe en 1.3.4.** La carte ne peut plus être enregistrée tant qu’aucun PIN valide n’est réellement désigné pour le niveau de sécurité choisi.
- **Niveau 1** : l’éditeur exige désormais un Helper Nombre `input_number`, vérifie que l’entité existe réellement dans `hass.states` et que sa valeur courante est un entier exploitable comme PIN. Une entité absente, indisponible, non entière ou d’un autre domaine bloque Enregistrer.
- **Niveaux 2 et 3** : la présence d’un `pin_id` ne suffit plus. L’éditeur interroge `lotus_visual/digicode/status` et n’autorise l’enregistrement que si un PIN est effectivement présent côté serveur avec le même niveau de sécurité.
- Un nouveau PIN saisi mais pas encore envoyé au serveur bloque également l’enregistrement de la carte, même si un ancien PIN serveur existe encore.
- Ajout d’un état explicite « Enregistrement autorisé / Enregistrement bloqué » dans la section Code et sécurité.
- Le pont de dialogue Lotus complète le bouton Enregistrer natif de Home Assistant : il est désactivé tant que la validation PIN du Digicode échoue et `_save()` possède le même garde-fou pour éviter un contournement par un événement de sauvegarde.
- Validation automatisée : 14 scénarios couvrant les trois niveaux de sécurité et le verrouillage du bouton Enregistrer passent avec succès.

# 0.8.36

- Lotus Digicode 1.3.3 : l’aperçu de l’éditeur utilise désormais le vrai code configuré dans les trois niveaux de sécurité au lieu du code de démonstration `2580`.
- Niveau 1 : l’aperçu lit directement la valeur réelle du Helper `input_number` / `number`; aucune action n’est exécutée depuis l’aperçu.
- Niveaux 2 et 3 : l’aperçu valide le PIN réellement enregistré sur le serveur avec un mode `preview` réservé aux administrateurs. Une validation d’aperçu n’exécute jamais l’action et ne modifie pas le compteur anti-bruteforce.
- Niveaux 2 et 3 : après remplacement réussi du PIN, `security.revision` est incrémenté. Cette valeur ne contient aucun secret mais déclenche `config-changed`, ce qui fait reconnaître le changement par l’éditeur Home Assistant.
- Après enregistrement d’un nouveau PIN serveur, l’aperçu recharge immédiatement son état : il n’est plus nécessaire de quitter le mode édition pour tester le nouveau PIN.
- Le champ PIN indique explicitement lorsqu’un nouveau PIN a été saisi mais pas encore envoyé au serveur.

# 0.8.35

- Lotus Digicode 1.3.2 : le mélange aléatoire des chiffres est désormais relancé à chaque transition réelle masqué → visible, y compris via une carte conditionnelle dans une vue Lotus Visual et pas seulement dans un dialogue/popup.
- Lotus Visual Layout : une carte Home Assistant masquée reste dans le DOM mais sa zone devient totalement non interactive (`pointer-events: none`). Une carte masquée ne peut donc plus bloquer les cartes superposées situées dessous.
- Lotus Digicode : nouvelle option « Bloquer tous les clics autour du digicode pendant son affichage ». Lorsqu’elle est activée, un bloqueur modal transparent couvre la vue et seul le Digicode visible reste interactif jusqu’à sa disparition.
- Le blocage modal respecte les conditions d’affichage, ne s’active jamais en mode édition et disparaît immédiatement lorsque le Digicode est masqué.

# 0.8.34

- Lotus Digicode 1.3.1 : correction de la zone de clic des touches. Toute la cellule de chaque touche est désormais le hitbox du bouton ; la géométrie (cercle, triangle, polygone, coins arrondis) devient purement visuelle et ne réduit plus la zone interactive.
- Priorité de pile renforcée entre afficheur et clavier afin qu’aucune zone invisible de l’afficheur ne puisse intercepter les clics des premières rangées.
- Le mélange aléatoire est régénéré à chaque nouvelle apparition/reconnexion du Digicode, et lors d’une nouvelle apparition d’un dialogue conservé dans le DOM.
- Le nouveau mélange est garanti différent du précédent, même dans le cas extrêmement improbable où le tirage aléatoire reproduirait exactement la même permutation.
- Les positions des touches Annuler/Supprimer restent fixes ; seuls les chiffres 0 à 9 sont remélangés.

# 0.8.33

- Lotus Digicode 1.3.0 : ajout de trois niveaux de sécurité du PIN.
- Niveau 1 : conservation du mode historique via une entité `input_number` / `number`.
- Niveau 2 : PIN enregistré en clair uniquement dans le stockage serveur Lotus Visual ; validation côté serveur.
- Niveau 3 : chiffrement applicatif RSA-OAEP navigateur → serveur et conservation serveur sous forme de hash PBKDF2-SHA256 salé.
- L’éditeur explique, pour chacun des trois niveaux, comment enregistrer le bon PIN dans Home Assistant.
- Pour les niveaux serveur, les actions de service/toggle sont exécutées côté backend après validation.
- Limitation des tentatives serveur : verrouillage temporaire après plusieurs codes erronés.
- Les PIN serveur peuvent commencer par zéro et ne sont jamais placés dans le YAML de la carte.

# Lotus Visual 0.8.32

- Repart strictement de la base stable 0.8.31.
- **Lotus Digicode passe en 1.2.0.** Aucun changement fonctionnel de Lotus Stack, Slide, Layers ou du Layout.
- Ajout d’un ordre de touches entièrement personnalisable pour les chiffres 0–9, Supprimer et Annuler.
- L’ordre peut être modifié par glisser-déposer ou par déplacement pas à pas avec les flèches dans l’éditeur.
- Ajout du mode **Placement aléatoire des chiffres 0 à 9**. Lorsqu’il est actif, Supprimer et Annuler restent exactement aux emplacements définis par l’utilisateur ; seuls les chiffres sont mélangés entre les dix emplacements numériques.
- Le mélange ne change jamais pendant une saisie en cours. Il est renouvelé après la fin d’une tentative (code correct ou incorrect) et au chargement/reconfiguration de la carte.
- Les textes, icônes et images personnalisés restent associés à leur chiffre réel et se déplacent avec lui lors du mélange.
- Compatibilité ascendante : l’ordre historique est conservé par défaut et le mélange aléatoire est désactivé sur les anciennes cartes.

# Lotus Visual 0.8.31

- Repart strictement de la base stable 0.8.30.
- **Lotus Slide passe en 1.1.0.** Aucun changement fonctionnel de Lotus Stack, Digicode, Layers ou du Layout.
- Ajout d’un biseau réglable sur le corps / rail du slider : `0` conserve le rectangle historique, une valeur supérieure crée une silhouette à 8 côtés.
- Le bouton reprend automatiquement le même nombre de côtés que le corps ; il n’est pas possible d’avoir un corps octogonal avec un bouton carré ou circulaire.
- Le biseau et l’arrondi peuvent être combinés. L’arrondi des 8 sommets est géométriquement plafonné afin de conserver un segment droit sur chaque côté et de ne jamais transformer la forme en cercle.
- Le biseau maximal représente 36 % du petit côté à chaque coin, soit au minimum 28 % de segment droit sur les côtés courts d’un bouton carré.
- Le contour du rail et du bouton suit la silhouette biseautée ; la progression reste contenue à l’intérieur du contour.
- Le rapport de référence du slider est normalisé pour que l’axe de déplacement reste toujours strictement plus long que l’axe transversal.
- Compatibilité ascendante : `track.bevel` vaut `0` par défaut, donc les sliders 0.8.30 conservent exactement leur forme historique tant que le nouveau réglage n’est pas utilisé.

# Lotus Visual 0.8.30

- Repart strictement de la base stable 0.8.29.
- **Lotus Digicode passe en 1.1.1.** Aucun changement fonctionnel de Lotus Stack, Slide, Layers ou du Layout.
- Ajout d’un arrondi réglable des sommets pour le carré, le losange, les quatre triangles, le pentagone, l’hexagone et l’octogone.
- Le cercle reste volontairement sans réglage d’arrondi.
- Les formes polygonales utilisent des courbes quadratiques aux sommets, recalculées après chaque redimensionnement du digicode.
- L’arrondi polygonal est plafonné géométriquement : au maximum, chaque coin consomme 36 % de chacun de ses côtés adjacents, ce qui conserve au moins 28 % de segment droit sur chaque côté.
- Le rectangle arrondi est plafonné à 36 % du petit côté afin de ne jamais devenir un cercle complet.
- Les configurations 0.8.29 restent inchangées visuellement par défaut : `keys.corner_radius` vaut 0 tant que l’utilisateur ne règle pas l’arrondi des formes géométriques.

# Lotus Visual 0.8.28

- Repart exactement de la base fonctionnelle 0.8.27.
- Lotus Stack 1.1.44 : correction ciblée du mode « valeur entière → image » dans Lotus Visual Layout.
- Aucun refactoring de Stack, Slide, Digicode, Layers ou de l'éditeur.
- Le runtime Stack sélectionne désormais l'image entière via `_resolvedImage()` à partir de l'état HA vivant et utilise le résolveur `media-source` déjà éprouvé par le mode binaire.

# Lotus Visual 0.8.27

- **Lotus Stack passe en 1.1.43.**
- Le rendu `Valeur entière → image` utilisé à l'intérieur de Lotus Visual Layout n'utilise plus `lotus-dynamic-image-element`.
- Le runtime utilise désormais directement le composant natif Home Assistant `hui-image`, lié à l'entité source avec `stateImage`.
- Pour chaque valeur entière, Lotus génère les formes équivalentes `1`, `1.0`, `1.00`, etc. afin de couvrir la représentation des `input_number` Home Assistant.
- Les URL `media-source://` sont résolues par le composant natif Home Assistant, sans cache d'état Lotus intermédiaire.
- Le nouvel objet `hass` est propagé directement au `hui-image` monté, sans reconstruction de toute la vue.
- Le mode binaire, les actions, la géométrie, l'éditeur et le schéma YAML restent inchangés.

## 0.8.26

- Suppression de la copie `current_value` pour les images pilotées par entier.
- `lotus-dynamic-image-element` lit en priorité l'état vivant dans `hass.states[entity].state`.

## 0.8.25

- Correction du rafraîchissement global : un changement d'état Home Assistant ne reconstruit plus tous les Lotus Stack de la vue.
- Le layout ne relance plus les sondes de géométrie de l'arrière-plan à chaque changement d'entité.

## 0.8.24

- Premier branchement du renderer d'image entière dans le runtime Lotus Visual Layout.

## 0.8.23

- Lotus Stack : le mode « Valeur entière → image » lit exclusivement l’état brut de l’entité source.
- Séparation complète entre la source utilisée pour l’image et `value_source` / `attribute`, qui restent réservés à l’affichage textuel.
- Un ancien attribut masqué lorsque « Afficher l’état / la valeur » est désactivé ne peut plus bloquer l’image sur la valeur par défaut.
- Le mode binaire et les actions de cellule ne sont pas modifiés.

## 0.8.21

- **Lotus Stack passe en 1.1.36**.
- Correction renforcée du mode « Valeur entière → image » : le rendu enregistré n’utilise plus la correspondance textuelle `state_image` de Home Assistant pour ce mode.
- Ajout d’un élément `custom:lotus-dynamic-image-element` qui lit directement l’état (ou l’attribut) de l’entité source et compare numériquement la valeur configurée.
- Les états équivalents `2`, `2.0`, `2.00` sélectionnent donc tous l’image affectée à la valeur entière `2`.
- Le changement d’état Home Assistant provoque immédiatement une nouvelle résolution de l’image, avec ou sans image par défaut.
- Le mode binaire reste sur l’élément image natif Home Assistant afin de limiter le correctif au mode entier.
- Le mode entier est désormais réellement disponible aussi pour les cellules `button`, conformément au comportement prévu en 0.8.19.
- Conservation de `entity`, `value_entity`, `image_value_count`, `image_values`, actions et options d’affichage lors du round-trip de l’éditeur.

## 0.8.19

- **Lotus Stack passe en 1.1.35**.
- Correction du changement d'image piloté par une valeur entière Home Assistant.
- `value_entity` pilote désormais aussi l'image lorsqu'elle est définie, sans déplacer les actions, le nom ni l'icône hors de l'entité principale.
- Les états numériques équivalents (`2`, `2.0`, `2.00`, etc.) correspondent au même entier configuré.
- Le mode `integer` fonctionne pour les cellules `info` et `button`.
- Conservation de `entity` / `value_entity` lors du round-trip natif, y compris lorsque l'état texte est masqué.
- Aucun autre comportement de Lotus Stack ou Lotus Visual n'est modifié.

## 0.8.18

- **Lotus Visual : ajout de la répartition à égale distance.**
- Deux nouvelles commandes apparaissent uniquement lorsque 3 cartes ou plus sont sélectionnées : répartition horizontale et répartition verticale.
- La carte extrême de départ et la carte extrême d’arrivée restent fixes ; seules les cartes intermédiaires sont déplacées.
- La distance libre entre les bords des cartes est rendue identique, y compris lorsque les cartes ont des dimensions différentes.
- En horizontal, les cartes sont ordonnées de gauche à droite ; en vertical, de haut en bas.
- Une carte intermédiaire verrouillée annule l’opération afin de ne pas produire une fausse répartition « égale ».
- Les outils restent invisibles avec 0, 1 ou 2 cartes sélectionnées et sont désactivés en grille responsive.
- Cache-busting global passé à 0.8.18.

## 0.8.17

- **Correction réelle de la barre d’outils contextuelle Lotus Visual.**
- Les styles des boutons ne peuvent plus neutraliser l’attribut `hidden` : les actions mono-sélection disparaissent réellement en sélection multiple et les actions d’alignement/égalisation disparaissent réellement hors sélection multiple.
- Le groupe d’actions contextuelles entier est masqué lorsqu’aucune carte n’est sélectionnée.
- **Lotus Stack passe en 1.1.34.**
- Correction du round-trip Home Assistant du nombre d’images en mode valeur entière : les lignes d’images encore vides restent conservées dans `lotus_visual_stack.items` et ne sont plus supprimées lors de la reconstruction depuis `state_image`.
- Le compteur `− / valeur / +` peut donc dépasser le nombre d’images déjà renseignées sans revenir à 2 ou à une autre ancienne valeur.
- La saisie manuelle du nombre reste locale pendant la frappe puis est validée sur changement de champ, perte de focus ou Entrée.
- La position de défilement de l’inspecteur reste préservée pendant ces modifications.

## 0.8.16

- Correction du sélecteur « Nombre d'images » de Lotus Stack en mode valeur entière.
- Les boutons − / + repartent toujours de la valeur visible/courante et non d'une valeur capturée avant le rerender.
- Le clic − / + est traité avant la perte de focus du champ numérique afin qu'un `change` ne puisse plus annuler le clic.
- La saisie manuelle est validée de façon fiable à la sortie du champ ou avec Entrée.
- La position verticale de l'inspecteur Stack est conservée exactement lors d'une modification du nombre d'images.
- Lotus Stack 1.1.33.

# Lotus Visual 0.8.15

### Barre d’outils Visual — commandes réellement contextuelles

- Les commandes propres à une seule carte sont désormais masquées tant qu’exactement une carte n’est pas sélectionnée.
- Les commandes d’alignement et d’égalisation restent visibles uniquement à partir de deux cartes sélectionnées.
- La suppression, commune aux sélections simple et multiple, disparaît lorsqu’aucune carte n’est sélectionnée.

### Éditeurs Stack / Slide / Digicode — conservation du focus

- Les boîtes texte ne déclenchent plus une reconstruction de l’éditeur à chaque caractère.
- La saisie reste active pendant l’écriture ou l’effacement ; la nouvelle valeur est appliquée lorsque l’utilisateur quitte le champ.
- Lotus Stack passe en 1.1.32, Lotus Slide en 1.0.5 et Lotus Digicode en 1.0.3.

### Lotus Stack — nombre d’images par valeur entière

- Le choix du nombre d’images utilise maintenant un contrôle `− / valeur / +`.
- `−` et `+` modifient le nombre d’une unité.
- La valeur centrale reste saisissable manuellement et est bornée entre 0 et 50.

# Lotus Visual 0.8.14

### Barre Visual — chargement fiable des nouvelles commandes

- Correction du cache ESM du navigateur : tous les imports internes Lotus sont maintenant versionnés avec `?v=0.8.14`.
- Le bootstrap charge lui-même `lotus-core.js` avec un cache-buster avant de charger les autres modules. Cela évite de conserver une ancienne barre d’outils après une mise à jour.
- Les commandes grille, contour, portée de grille et modes de défilement de la vue sont donc chargées avec la même version que le reste de Lotus Visual.

### Lotus Stack 1.1.31 — cellule avec nom seul

- Une cellule peut désormais afficher uniquement un nom personnalisé, sans icône, sans valeur et sans entité.
- Ajout d’un élément `custom:lotus-static-text-element` pour représenter du texte littéral dans une carte `picture-elements` native.
- Les réglages d’une cellule sont sauvegardés de façon compacte dans `lotus_visual_stack.items`, ce qui rend la réouverture de l’éditeur sans perte.
- Les anciens marqueurs 0.8.13 contenant un nom dans un placeholder invisible sont migrés automatiquement lorsqu’ils sont encore présents.
- Le texte statique reste responsive et réduit sa taille lorsqu’il ne tient plus dans la cellule.

# Lotus Visual 0.8.12

- Lotus Stack 1.1.30 : texte et icônes adaptatifs à la taille réelle de chaque cellule, y compris le rendu natif picture-elements.
- Lotus Slide 1.0.4 : libellé et icônes redimensionnés avec le rail, les zones latérales et le bouton.
- Lotus Digicode 1.0.2 : affichage, chiffres, symboles et icônes des touches réduits automatiquement lorsque la carte devient plus petite.
- Suppression des minima de taille qui pouvaient provoquer des rognages sur les petits écrans.

# Changelog

## 0.8.11 — 2026-08-16

### Lotus Visual — sélection multiple, alignements et guides d’édition

- Ajout d’un mode de sélection multiple accessible par `mdi:checkbox-multiple-marked-outline`. Ctrl/Cmd/Shift + clic permet également d’ajouter ou retirer une carte de la sélection.
- La première carte sélectionnée devient la **carte de référence** et reçoit un contour distinct de couleur avertissement ; les autres cartes sélectionnées conservent la couleur d’accent Lotus.
- Actions groupées par rapport à la carte de référence : alignement gauche, centre horizontal, droite, haut, centre vertical, bas et harmonisation des dimensions.
- Suppression simultanée de plusieurs cartes avec une seule confirmation et une seule sauvegarde Lovelace.
- Les cartes verrouillées restent protégées lors des opérations géométriques groupées et sont ignorées avec un retour d’état explicite.
- Ajout de deux guides centraux en pointillés (horizontal et vertical) sur le canvas libre, visibles uniquement en mode édition.
- Les commandes d’édition unitaire sont masquées pendant une sélection multiple afin d’éviter toute ambiguïté ; la suppression reste disponible.
- Le mode Grille responsive autorise la sélection/suppression multiple mais neutralise les alignements manuels et l’égalisation de taille.
- Lotus Stack reste en 1.1.29 ; aucun changement du schéma YAML des cartes.

## 0.8.8 — 2026-08-16

### Lotus Stack 1.1.29 — indicateur d’interaction optionnel

- La petite icône d’action (main tactile / chevron) n’est plus ajoutée automatiquement aux cellules de type bouton.
- Nouveau réglage **Afficher l’icône d’interaction**, désactivé par défaut.
- Le choix est conservé lors des conversions internes ↔ `picture-elements` grâce au marqueur `--lotus-vs-affordance`.
- Le réglage **Afficher le retour visuel d’interaction (survol / focus)** reste indépendant et continue de piloter uniquement le retour de survol/focus.
- Cache-busting global passé à 0.8.8.

## 0.8.7 — 2026-08-16

### Lotus Stack 1.1.28 — icône seule responsive et rendu final cohérent

- La taille maximale d’une icône passe de 80 % à 100 % de la cellule.
- Une cellule contenant uniquement une icône centre désormais strictement le visuel horizontalement et verticalement, sans padding résiduel.
- À 100 %, l’icône peut occuper le plus grand carré inscrit dans la cellule, en restant responsive sur les deux axes.
- Le rendu `picture-elements` sauvegardé conserve la même taille que l’aperçu grâce au bridge `lotus-icon-size-bridge.js`.
- Lotus Layers interprète désormais `--lotus-vs-icon-size` comme un pourcentage de cellule et non comme une pseudo-valeur en pixels.
- Le cache-busting global passe à 0.8.7.

## 0.8.6 — 2026-08-15

### Lotus Stack 1.1.27 — harmonisation atomique des séparateurs
- Correction de l’harmonisation des largeurs/hauteurs lorsque plusieurs séparateurs doivent bouger en même temps.
- Les séparateurs ne sont plus déplacés séquentiellement : toutes les positions cibles sont calculées sur la géométrie d’origine puis appliquées en une seule opération.
- Évite les faux blocages « une cellule voisine atteindrait sa taille minimale » causés par une géométrie intermédiaire temporairement trop petite alors que la géométrie finale est valide.
- Fonctionne dans les deux axes et conserve la propagation vers les cellules voisines non sélectionnées lorsqu’elles partagent le même séparateur continu.
- Aucun changement du schéma YAML (`lotus_visual_stack.version: 2`).

## 0.8.5 — 2026-08-15

### Couleurs d’arrière-plan
- Déplacement de la couleur de fond propre à chaque onglet dans la section **Arrière-plan de cet onglet**.
- La couleur d’un onglet reste facultative et fonctionne avec ou sans image d’arrière-plan.
- La couleur reste stockée dans `lotus_visual.tabs.items[].fill_color`, séparément de l’objet `background` natif Home Assistant.
- Renforcement du champ **Couleur de fond de la vue** dans l’éditeur natif d’arrière-plan de Lotus Visual : le choix est propagé par `background-config-changed` et un fallback runtime 2026.8 marque la vue modifiée si nécessaire.
- Le stockage global reste `lotus_visual.fill_color`; aucune clé Lotus n’est ajoutée dans `background`.

## 0.8.4

- Ajout d’une commande contextuelle `mdi:filter-remove-outline` dans la barre d’outils Lotus Visual lorsqu’une carte sélectionnée est une carte native `conditional`. Elle retire uniquement l’enveloppe conditionnelle et conserve la carte.
- Ajout du bouton **Retirer la condition** dans le pied de la fenêtre native Home Assistant d’édition d’une carte conditionnelle, à côté de **Afficher l’éditeur de code**. L’action sauvegarde immédiatement la carte interne puis ferme la fenêtre.
- Lors du retrait d’une condition, les métadonnées portées par l’enveloppe (`view_layout`, `grid_options` et autres clés externes à `type/conditions/card`) sont transférées à la carte interne afin de conserver la position et la présentation.
- Correction de l’édition des Lotus Stack et Lotus Slide lorsqu’ils sont imbriqués dans une carte conditionnelle : l’onglet **Conditions** conserve l’éditeur/aperçu natif Home Assistant ; l’onglet **Carte** donne toute la largeur au véritable éditeur Lotus et masque uniquement l’aperçu HA dupliqué.
- Le bridge suit maintenant les changements d’onglet du `hui-conditional-card-editor` et dimensionne également son `hui-card-element-editor` imbriqué.
- **Lotus Digicode passe en 1.0.1** : la carte possède désormais un ratio intrinsèque `design.width/design.height` lorsqu’aucun conteneur externe ne lui impose une hauteur. Cela évite l’écrasement vertical dans l’aperçu natif d’une carte conditionnelle.
- Aucun changement de schéma YAML des cartes Lotus. Lotus Stack reste en 1.1.26 et Lotus Slide en 1.0.3.

## 0.8.3

- Déplace la commande « Déplacer vers un autre onglet » de l’onglet actif vers la barre d’outils contextuelle Lotus Visual.
- Icône retenue : `mdi:tab-arrow-right`, placée avec Modifier / Dupliquer / Supprimer.
- L’icône n’est rendue que lorsqu’une carte est sélectionnée, que les onglets sont activés et qu’au moins deux onglets existent.
- La barre d’onglets redevient strictement une barre de navigation : elle ne contient plus de commande liée à la carte sélectionnée.
- Aucun changement de schéma YAML.

## 0.8.2

- Déplacement d’une carte entre onglets depuis la barre d’onglets elle-même : lorsqu’une carte est sélectionnée en mode édition, l’onglet actif affiche une icône `mdi:tab-arrow-right`.
- Un clic sur cette icône ouvre un sélecteur compact des onglets ; l’onglet courant est identifié et non sélectionnable, les autres sont proposés avec leur nom, icône ou image et leur mode Canvas/Grille.
- Le changement d’onglet d’une carte est sauvegardé immédiatement dans `view_layout.lotus.tab`, sans réintroduire la section « Cartes par onglet » dans l’éditeur global.
- Suppression du bouton de validation des modifications graphiques dans Lotus Visual.
- Déplacement et redimensionnement d’une carte : sauvegarde automatique au relâchement du pointeur.
- Verrouillage/déverrouillage et changement de plan : sauvegarde automatique immédiate.
- Pendant l’enregistrement automatique, les interactions de géométrie sont brièvement verrouillées afin d’éviter deux sauvegardes concurrentes.
- Aucun changement du schéma YAML ; Lotus Stack reste en 1.1.26, Lotus Slide en 1.0.3 et Lotus Digicode en 1.0.0.

## 0.8.1

- Suppression de la section **« Cartes par onglet »** de l’éditeur des onglets.
- L’affectation des cartes n’est pas supprimée : Lotus Visual la gère automatiquement. Une nouvelle carte est rattachée à l’onglet actif et une carte ancienne sans `view_layout.lotus.tab` reste associée au premier onglet.
- Aucun changement du YAML existant ni des versions Lotus Stack, Slide et Digicode.

## 0.8.0

- Les onglets Lotus peuvent maintenant choisir leur mode de présentation : **Canvas libre** ou **Grille responsive**.
- Le mode Canvas conserve le comportement historique : arrière-plan par onglet et positionnement libre des cartes en pourcentage.
- Le mode Grille range automatiquement les cartes de l’onglet en tuiles et adapte le nombre de colonnes à la largeur disponible.
- Paramètres de grille par onglet : largeur minimale d’une tuile, nombre maximal de colonnes, espacement et marge périphérique.
- Les métadonnées de positionnement libre des cartes sont conservées lorsqu’un onglet passe en grille afin de pouvoir revenir au Canvas sans perdre la composition précédente.
- En mode Grille, déplacement libre, redimensionnement, verrouillage et gestion des plans sont neutralisés car la position est automatique.
- Les cartes Lotus qui possèdent un ratio de conception (Stack, Slide, Digicode) conservent ce ratio dans la grille.
- Chaque onglet peut maintenant arrondir zéro, un ou deux coins situés côté bord de l’écran.
- Rayon d’arrondi exprimé relativement à l’épaisseur réelle de l’onglet pour rester responsive lors d’un passage haut/bas/gauche/droite.
- Le fond image d’un onglet n’est pas rendu lorsque cet onglet est en mode Grille ; sa configuration est conservée pour un éventuel retour en Canvas.
- Lotus Stack reste en 1.1.26 ; Lotus Slide reste en 1.0.3 ; Lotus Digicode reste en 1.0.0.

## 0.7.2

- **Lotus Stack passe en 1.1.26**.
- Correction complète du mode d'ajustement des images lorsqu'une cellule affiche aussi un texte ou une valeur.
- `Contenir` utilise désormais le rectangle intrinsèque de l'image avec `max-width/max-height: 100%` : aucune partie de l'image ne doit être rognée par Lotus.
- `Couvrir` et `Étirer` conservent un rectangle image occupant toute la zone visuelle afin que les trois modes aient des rendus réellement distincts.
- Ajout de `lotus-image-fit-bridge.js` pour le rendu natif `picture-elements` : le marqueur Lotus `--lotus-vs-image-fit` est transmis au `hui-image.fitMode` interne de Home Assistant.
- Les `hui-image-element` Home Assistant sans marqueur Lotus ne sont pas modifiés.

## 0.7.1

- **Lotus Stack passe en 1.1.25**.
- Correction des trois modes d’ajustement d’image dans le renderer Lotus :
  - `contain` : image entière, proportions conservées ;
  - `cover` : cellule remplie, recadrage centré possible ;
  - `fill` : cellule remplie, déformation autorisée.
- Les images ne réutilisent plus le gabarit carré des icônes : une image seule dispose réellement de toute sa cellule ; une image accompagnée de texte dispose d’une zone rectangulaire dédiée.
- Ajout d’une **entité de valeur indépendante** (`value_entity`) pour toutes les cellules affichant un état, y compris les boutons.
- Une cellule peut désormais utiliser une entité principale pour le visuel et les actions, tout en affichant l’état ou un attribut d’un second capteur.
- Le YAML natif `picture-elements` conserve cette séparation par des marqueurs Lotus minimaux sur l’élément `state-label`, sans wrapper supplémentaire.
- Compatibilité ascendante conservée : sans `value_entity`, la valeur continue de provenir de l’entité principale.

## 0.7.0

- **Gestion des onglets au niveau de Lotus Visual View.**
- Nouvelle commande `mdi:tab` dans la barre d’édition de la vue.
- Nouvel éditeur graphique 60/40 `lotus-tabs-editor.js`.
- Position de la barre : haut, bas, gauche ou droite.
- Étendue et profondeur définies en pourcentage et réinterprétées automatiquement selon l’orientation.
- Taille identique de tous les onglets, répartis équitablement dans la barre.
- Alignement début / centre / fin lorsque la barre occupe moins de 100 % de l’axe.
- Par onglet : texte, icône MDI, image, couleur normale, couleur active et couleurs de premier plan.
- Par onglet : couleur de remplissage de la scène et arrière-plan image indépendant.
- Les arrière-plans d’onglets utilisent les mêmes clés que l’arrière-plan natif Home Assistant (`image`, `opacity`, `attachment`, `size`, `alignment`, `repeat`).
- Affectation graphique des cartes aux onglets ; métadonnée compacte `view_layout.lotus.tab`.
- Les cartes historiques sans `tab` sont interprétées dans le premier onglet sans migration destructive.
- Les onglets peuvent être désactivés tout en conservant leurs réglages et les affectations des cartes.
- La barre réserve son propre espace : elle ne masque pas les cartes ni l’image de fond.
- Le repère `0–100 %` des cartes reste celui de la scène utile après réservation de la barre.
- Lotus Stack reste en 1.1.24 ; Lotus Slide reste en 1.0.3 ; Lotus Digicode reste en 1.0.0.

## 0.6.0

- **Nouvelle carte Lotus Digicode 1.0.0** (`custom:lotus-digicode-card`).
- Ajout de Lotus Digicode au menu Lotus Visual, au registre des cartes et au flux de création directe.
- Source du code via entité numérique Home Assistant (`input_number` / `number`).
- Longueur de saisie calculée automatiquement à partir de la valeur entière de l'entité.
- Validation automatique au dernier chiffre et action configurée avec le sélecteur `ui_action` natif Home Assistant.
- Éditeur graphique 60/40 avec aperçu interactif et redimensionnement par les quatre côtés.
- Matrice paramétrable sur 2, 3 ou 4 lignes ; gestion de la dernière ligne incomplète gauche/centre/droite/étirée.
- Personnalisation complète du cadre, du cadran, des touches, des contours, couleurs et arrondis.
- Chiffres remplaçables visuellement par caractères Unicode ou icônes MDI sans modifier la valeur numérique réellement saisie.
- Masquage du code par astérisque, point, carré, losange ou caractère personnalisé.
- Boutons optionnels retour arrière et effacement complet.
- Retour erreur/succès par message et/ou icône, avec délai de réinitialisation.
- Lotus Visual reconnaît le ratio de conception du Digicode pour son redimensionnement responsive.
- Lotus Stack reste en 1.1.24 ; Lotus Slide reste en 1.0.3.

## 0.5.9

- **Lotus Stack passe en 1.1.24**.
- Fusion : conservation automatique du contenu de la première cellule sélectionnée ; suppression du contenu des autres cellules fusionnées.
- Harmonisation : commandes visibles uniquement lorsqu'une chaîne de cellules sélectionnées partage un côté dans le sens concerné.
- Harmonisation : prise en charge des cellules de tailles différentes et propagation du déplacement aux cellules voisines reliées au même séparateur.
- Redimensionnement du contour : ancrage magnétique sur le carré parfait de la carte ou de chacune des cellules déformées par le bord manipulé.
- Alt désactive temporairement l'ancrage carré.

## 0.8.11
- Correction de l’affichage du quadrillage d’édition dans le Canvas libre.
- Correction du contour de repérage de l’image de fond dans l’éditeur.
- Les sélecteurs CSS utilisent désormais `data-layout-mode="canvas"`, valeur réellement produite par le moteur Lotus Visual.
- Les repères restent strictement limités au mode édition et disparaissent dans la vue finale.
