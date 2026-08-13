# Fianaram-pianakaviana

Compagnon React statique pour une étude biblique familiale en malagasy, alimenté exclusivement par des sources officielles [jw.org](https://www.jw.org/mg/).

## Ce que contient l’application

- programme familial hebdomadaire et préparation à la prédication ;
- tableau de bord hebdomadaire, puis espaces distincts `Fianarana`, `Fanompoana`, `Tilikambo Fiambenana`, `Fanomanana` et `Tahiry` ;
- préparation personnelle manuelle ou guidée, enregistrée localement dans le navigateur sans envoyer les réponses à un service externe ;
- mise en évidence automatique de **la journée en cours** uniquement lorsque la semaine affichée contient la date actuelle ;
- archive glissante de **deux mois maximum** ;
- prompt imprimable associé à chaque étude familiale ;
- liens directs vers les articles et les passages de la Bible en malagasy sur jw.org ;
- cartes de rôles anonymisées, afin que le code puisse être publié sans noms des enfants ou des parents.

## Source de données unique

Les catalogues publiés sont :

- `src/data/studies.json` pour l’étude familiale et le ministère ;
- `src/data/watchtower-studies.json` pour La Tour de Garde.

Chaque entrée doit contenir :

- une période ISO (`startDate`, `endDate`) ;
- au moins une URL `https://www.jw.org/mg/...` ou un lien `finder` officiel avec `wtlocale=MG` ;
- les liens directs jw.org pour chaque passage biblique ;
- un `printPrompt` pour chaque étude familiale ;
- facultativement, des `guidedSuggestions` sourcées pour la préparation guidée et les numéros de paragraphes Watchtower associés aux questions.

L’application filtre elle-même les entrées clôturées depuis plus de deux mois.

## Contenu Watchtower familial privé

Le texte intégral, les intertitres, les images et leurs légendes ne sont pas ajoutés au catalogue public. Le champ `paragraphs` y est explicitement interdit. Seuls les numéros associés et le `sourceDigest` SHA-256 de la page officielle sont versionnés. Le contenu est généré dans un pack local ignoré par Git, puis importé explicitement dans l’espace `Tilikambo Fiambenana`. Le navigateur vérifie le pack contre ce digest et le catalogue avant de remplacer atomiquement son cache IndexedDB.

Pour produire le pack de toutes les études publiées :

```bash
npm run build:watchtower-private-pack
```

Pour une seule étude :

```bash
npm run build:watchtower-private-pack -- --study watchtower-2026404 \
  --output .private/2026404.watchtower-private.json
```

Le pack privé :

- reste sous `.private/` et ne doit jamais être commité ou déployé ;
- accepte uniquement des pages malagasy `jw.org` et des médias provenant des CDN officiels JW ;
- doit correspondre exactement à l’identifiant, l’URL, le digest, le titre et aux associations question-paragraphe du catalogue public ;
- conserve l’ordre des paragraphes, intertitres, figures et de la synthèse finale ;
- associe chaque question publique au dernier paragraphe concerné ;
- contient les dimensions et variantes responsives des images pour éviter les sauts de mise en page ;
- inclut les références bibliques détectées dans les paragraphes avec leur extrait officiel afin de permettre une lecture directe ;
- est limité à 5 Mo lors de l’import dans le navigateur.

Dans le lecteur continu, les paragraphes restent visibles, les versets s’ouvrent dans un panneau de lecture et les images peuvent être agrandies dans une fenêtre accessible. La section `Famintinana` termine l’article avec les questions officielles de synthèse. La réflexion personnelle reste facultative et chaque réponse préparée peut être affichée ou masquée indépendamment.

## Génération locale et synchronisation Slack

Le canal privé Slack `#bible-malagasy` est le canal de diffusion. Une seule tâche Hermes locale s’exécute le dimanche à 18:00 UTC+3 et prépare la semaine actuelle ainsi que la suivante pour les trois catégories. Aucune clé ni génération IA n’est intégrée au site public.

La tâche produit d’abord deux catalogues candidats dans un dossier temporaire, puis applique la transaction validée :

```bash
node scripts/catalogue-pipeline.mjs \
  --studies chemin/vers/studies.json \
  --watchtower chemin/vers/watchtower-studies.json
```

Le pipeline :

- refuse les doublons, périodes invalides, sources non officielles, digests invalides, paragraphes Watchtower publics et placeholders ;
- trie les catalogues de façon déterministe ;
- ne modifie aucun fichier si la validation échoue ;
- restaure les fichiers précédents si une écriture transactionnelle échoue ;
- ne réécrit rien lorsque les candidats sont identiques.

Après validation, tests et build, les catalogues sont prêts à être publiés et un résumé d’exécution est livré dans Slack. Une relance de la tâche reste idempotente. Toute publication GitHub distante passe par Composio.

## Développement local

```bash
npm install
npm run dev
```

## Validation

```bash
npm run validate:catalogues
npm test
npm run build
git diff --check
```

## Publication GitHub Pages

Le workflow `.github/workflows/deploy-pages.yml` valide les deux catalogues, exécute les tests et construit l’application avant le déploiement GitHub Pages. Une publication n’est donc possible que si tous les contrôles réussissent.
