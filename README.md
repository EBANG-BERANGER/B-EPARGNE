# Béranger Épargne

Registre financier personnel : suivi des entrées et sorties d'argent, rapport mensuel généré automatiquement, et suggestions d'épargne calculées à partir de vos propres données.

C'est une application web statique (HTML/CSS/JS, aucune dépendance, aucun serveur). Toutes les données restent dans le navigateur de l'utilisateur (`localStorage`) — rien n'est envoyé nulle part. C'est aussi une PWA (Progressive Web App) : installable, avec un service worker pour fonctionner hors ligne.

## Développement local

Aucune installation requise. Ouvrez `index.html` directement dans un navigateur, ou servez le dossier avec n'importe quel serveur statique, par exemple :

```bash
npx serve .
```

## Déploiement sur GitHub Pages

1. Poussez ce dépôt sur GitHub (branche `main`).
2. Dans les réglages du dépôt → **Pages**, source = branche `main`, dossier `/ (root)`.
3. Le site est publié à `https://<utilisateur>.github.io/<nom-du-depot>/`.

Le fichier `manifest.webmanifest` utilise des chemins relatifs, donc ça fonctionne aussi bien à la racine d'un domaine que sous un sous-dossier GitHub Pages.

## Empaqueter pour le Play Store (Android)

L'application est une PWA, donc elle peut être empaquetée en application Android via une **Trusted Web Activity (TWA)** sans réécrire le code. Le plus simple est [PWABuilder](https://www.pwabuilder.com/) :

1. Déployez d'abord le site (étape précédente) pour avoir une URL publique en HTTPS.
2. Sur pwabuilder.com, collez l'URL du site déployé → l'outil lit `manifest.webmanifest` et vérifie le service worker.
3. Choisissez le paquet **Android** → il génère un projet TWA et un fichier `.aab` (Android App Bundle) signé ou à signer.
4. Notez le nom de paquet suggéré (ex. `com.berangerepargne.app`) et conservez précieusement la clé de signature générée : elle est nécessaire pour toute mise à jour future de l'application.
5. PWABuilder vous donnera aussi un fichier `assetlinks.json` à publier sur le site (dans `.well-known/assetlinks.json`) pour que l'app Android s'ouvre sans barre d'adresse Chrome — à ajouter au dépôt une fois généré.

### Ce qu'il reste à faire manuellement (compte Google, pas automatisable)

- Créer un compte **Google Play Console** (frais unique d'environ 25 $ US) — ce compte et ce paiement doivent être faits directement par vous.
- Compléter la fiche de l'application : captures d'écran, description, catégorie (Finances), classification de contenu.
- Renseigner le formulaire **Sécurité des données** : comme l'application ne collecte ni ne transmet aucune donnée, la réponse est « aucune donnée collectée ».
- Fournir un lien vers une politique de confidentialité publique — `privacy.html` dans ce dépôt est prêt à être publié tel quel (complétez la date et le courriel de contact avant publication).
- Téléverser le `.aab` généré par PWABuilder et soumettre pour révision.

## Sauvegarde des données

Comme les données vivent uniquement sur l'appareil, utilisez le bouton **Exporter** régulièrement (ex. une fois par mois) pour garder une copie JSON de votre registre. **Importer** permet de la recharger, par exemple après avoir changé d'appareil.
