# O'Cadre — refonte du site ocadre.com

Refonte complète, en HTML / CSS / JavaScript statiques (aucune dépendance, aucun build), du site
des restaurants pizzerias **O'Cadre** (Forbach, Freyming-Merlebach / Betting, Saint-Avold).

## Pages

| Fichier                 | Contenu                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| `index.html`            | Accueil : hero, commande par secteur, catégories de la carte, la différence O'Cadre, restaurants & horaires, avis, commande en ligne, événements |
| `commander.html`        | Commande en ligne sans inscription : secteur par code postal, livraison / à emporter, carte avec prix et options, panier, créneau, coordonnées, confirmation (SMS / appel / envoi serveur) |
| `carte.html`            | La carte par catégorie (pizzas & flamms, pâtes, raviolis, spécialités, salades, desserts) et choix du secteur pour commander |
| `avis.html`             | Note moyenne, avis clients et formulaire d'avis                                            |
| `contact.html`          | Demande de devis événements, coordonnées, horaires, plans d'accès                          |
| `mentions-legales.html` | Mentions légales, hébergeur, droits d'auteur, confidentialité & cookies                    |

## Structure

```
assets/
  css/style.css   # design system (noir / rouge / crème, Raleway + Playfair Display), responsive
  js/main.js      # menu mobile, apparition au défilement, statut ouvert/fermé, formulaires, bandeau cookies
  js/order.js     # moteur de commande (carte, options, panier, créneaux, confirmation)
  data/menu.json  # carte, prix, options, secteurs, horaires, frais de livraison, réglages de commande
  img/            # photos du site existant, optimisées
```

## Commande en ligne

Tout est piloté par `assets/data/menu.json` :

- `secteurs` : restaurants, codes postaux et communes desservis, horaires, frais et minimum de livraison, lien de l'espace client historique.
- `categories` / `items` : la carte et les prix. **Les tarifs fournis sont indicatifs** : tant que `tarifs_valides` vaut `false`, un bandeau le signale sur la page de commande. Mettre les vrais prix puis passer la valeur à `true`.
- `options` : choix proposés (pâte, pâtes, sauce, fromage) ; chaque catégorie liste les options qui s'appliquent à ses plats.
- `commande.endpoint` : URL d'un script serveur qui recevra la commande en JSON (`POST`). Vide, la commande est confirmée par SMS pré-rempli ou appel au restaurant, avec un récapitulatif copiable.
- `commande.delai_preparation_min`, `pas_creneau_min`, `jours_a_l_avance` : génération des créneaux.

Le panier et le secteur choisi sont conservés dans le navigateur (`localStorage`).

## Mise en ligne

Copier les fichiers HTML et le dossier `assets/` à la racine de l'hébergement. Les liens
« Commander » pointent vers les espaces de commande existants
(`/pizzeria-forbach-ocadre/`, `/pizzeria-merlebach-ocadre/`, `/pizzeria-saint-avold-ocadre/`).

## À brancher côté serveur

Les deux formulaires (`avis.html`, `contact.html`) portent `action="#"`. Renseigner l'URL du
script serveur dans l'attribut `action` : `main.js` enverra alors les champs en `POST`
(`FormData`) et affichera la confirmation ou l'erreur.

## Aperçu local

```
python3 -m http.server 8000
```

puis ouvrir <http://localhost:8000/>.
