# Fianaram-pianakaviana

Compagnon React statique pour une étude biblique familiale en malagasy, alimenté exclusivement par des sources officielles [jw.org](https://www.jw.org/mg/).

## Ce que contient l’application

- programme familial hebdomadaire et préparation à la prédication ;
- navigation fluide entre `Fianarana`, `Fanompoana` et `Tahiry` ;
- mise en évidence automatique de **la journée en cours** uniquement lorsque la semaine affichée contient la date actuelle ;
- archive glissante de **deux mois maximum** ;
- prompt imprimable associé à chaque étude familiale ;
- liens directs vers les articles et les passages de la Bible en malagasy sur jw.org ;
- cartes de rôles anonymisées, afin que le code puisse être publié sans noms des enfants ou des parents.

## Source de données unique

`src/data/studies.json` est le registre unique des études. Chaque entrée doit contenir :

- une période ISO (`startDate`, `endDate`) ;
- au moins une URL `https://www.jw.org/mg/...` ;
- les liens directs jw.org pour chaque passage biblique ;
- un `printPrompt` pour chaque étude familiale.

L’application filtre elle-même les entrées clôturées depuis plus de deux mois.

## Synchronisation Slack

Le canal privé Slack `#bible-malagasy` est le canal de diffusion. Les deux tâches récurrentes mettent d’abord à jour le registre JSON, valident l’application, puis publient le résumé correspondant dans Slack :

- dimanche 18:00 UTC+3 : programme familial ;
- vendredi 19:00 UTC+3 : préparation à la prédication.

Ainsi, le site et Slack utilisent toujours le même contenu. WhatsApp n’est pas encore connecté : il devra reprendre ce même registre, sans dupliquer ni générer un contenu distinct.

## Développement local

```bash
npm install
npm run dev
```

## Validation

```bash
npm test
npm run build
```

## Publication GitHub Pages

Le workflow `.github/workflows/deploy-pages.yml` est prêt, mais le dépôt est volontairement privé et GitHub Pages est actuellement désactivé. Une publication publique exige d’abord une décision explicite sur la visibilité du dépôt ou la création d’un dépôt public séparé, car GitHub Pages rend les fichiers publiés accessibles publiquement.
