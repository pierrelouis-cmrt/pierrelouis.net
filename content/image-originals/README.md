# Audit des images statiques — 17 septembre 2026

Référence validée : écran jusqu’à **1 920 pixels CSS**, densité **×2**.
Mesures Chromium à 320, 420, 760, 767, 768, 1100, 1101, 1199, 1200, 1470 et 1920 px, complétées par les plafonds CSS (menus, filigranes, lightbox). Le carrousel a été mesuré après son recalcul JavaScript.

Les dimensions ciblent les pixels réellement affichés avec `object-fit: cover/contain`, sans recadrage ni déformation. L’arrondi aux pixels entiers peut produire un écart de 1 px. Les originaux des fichiers modifiés sont conservés ici, avec leur arborescence et leurs octets exacts. Tous les PNG préexistants restent aussi à leur emplacement d’origine.

Les WebP déjà à la cible ou inférieurs à celle-ci restent **strictement identiques**, sans recompression. Seules les réductions et conversions nécessitent un encodage WebP qualité 80 (ImageMagick, méthode 6). `audit.json` consigne les dimensions, décisions et empreintes SHA-256.

## Périmètre exclu

- Photos et projets : conversion/redimensionnement déjà assurés par leurs scripts de build, y compris leurs réutilisations dans Links et Now.
- SVG : ressources vectorielles, sans résolution raster à optimiser.
- Favicons, icônes d’installation et images uniquement utilisées dans les métadonnées sociales : usages sans taille CSS dans le site ; formats conservés.
- Images non référencées dans les pages (anciens visuels Links, anciens filigranes, capture du README) : conservées.
- Pochette musicale distante : fournie dynamiquement par Last.fm, sans fichier local à convertir.

Le filigrane du menu mobile reste en PNG : ses 1434 px sont inférieurs aux 1520 px requis à sa largeur CSS maximale de 760 px. Cela applique la consigne de ne pas toucher aux sources trop petites.

## Fichiers modifiés

| Fichier | Avant | Après |
| --- | --- | --- |
| `assets/mobile-menu/capecl.webp` | 508 × 252 | 336 × 167 |
| `assets/image_colophon_aurland.webp` | 4032 × 1613 | 3840 × 1536 |
| `assets/image_featured_1.webp` | 1581 × 1976 | 1441 × 1801 |
| `assets/lists/things-i-like.webp` | 768 × 768 | 560 × 560 |
| `assets/lists/things-i-dislike.webp` | 768 × 768 | 560 × 560 |
| `assets/lists/tv-shows.webp` | 768 × 768 | 560 × 560 |
| `assets/lists/articles-and-videos.webp` | 768 × 768 | 560 × 560 |
| `assets/lists/places-ive-been.webp` | 768 × 768 | 560 × 560 |
| `assets/lists/tech-and-gear.webp` | 768 × 768 | 560 × 560 |
| `posts/components/apps/assets/carousel/landscape1.webp` | 1333 × 1000 | 1067 × 800 |
| `posts/components/apps/assets/carousel/landscape2.webp` | 1333 × 1000 | 1067 × 800 |
| `assets/image_watermark_first.webp` | 1433 × 280 | 830 × 162 |
| `assets/image_watermark_last.webp` | 942 × 280 | 545 × 162 |

13 images traitées ; 17 images auditées laissées intactes. Poids des fichiers servis concernés : 2,573,844 → 1,601,456 octets (−37.8 %). Les sauvegardes dans `content/` ne sont pas publiées par le build.

Pour revenir en arrière, recopier les fichiers de cette arborescence à la racine du dépôt et rétablir les références `.png` des deux filigranes dans `base.css`. Les changements HTML ne concernent que les attributs de dimensions des images redimensionnées.
