# O'Cadre — refonte du site ocadre.com

Refonte complète, en HTML / CSS / JavaScript statiques (aucune dépendance, aucun build), du site
des restaurants pizzerias **O'Cadre** (Forbach, Freyming-Merlebach / Betting, Saint-Avold).

## Pages

| Fichier                 | Contenu                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| `index.html`            | Accueil : hero, commande par secteur, catégories de la carte, la différence O'Cadre, restaurants & horaires, avis, commande en ligne, événements |
| `carte.html`            | La carte par catégorie (pizzas & flamms, pâtes, raviolis, spécialités, salades, desserts) et choix du secteur pour commander |
| `avis.html`             | Note moyenne, avis clients et formulaire d'avis                                            |
| `contact.html`          | Demande de devis événements, coordonnées, horaires, plans d'accès                          |
| `mentions-legales.html` | Mentions légales, hébergeur, droits d'auteur, confidentialité & cookies                    |

## Structure

```
assets/
  css/style.css   # design system (noir / rouge / crème, Raleway + Playfair Display), responsive
  js/main.js      # menu mobile, apparition au défilement, statut ouvert/fermé, formulaires, bandeau cookies
  img/            # photos du site existant, optimisées
```

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
