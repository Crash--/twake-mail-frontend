# Reprendre le projet dans une nouvelle session (état au 2026-10-05, fin de journée)

Point d'entrée pour la prochaine session (agent ou humain). Le détail historique est dans
[`HANDOFF.md`](HANDOFF.md) ; les règles du code dans [`../AGENTS.md`](../AGENTS.md).

## 1. Le projet en bref

Réécriture en React de la version **web** de Twake Mail (tmail-flutter ; le mobile reste en Flutter).
App **standalone** sur le modèle de Twake Calendar / Contacts, JMAP via notre client `jmap-client-ts` v2.
Les phases 0 à 5 sont faites (lecture, composer complet, réglages et extensions Linagora, calendrier,
Drive, IA derrière capability), plus le déploiement (image non-root, CSP, Helm). Il reste des issues
ouvertes et **un chantier design** (voir §5).

## 2. Où sont les choses

| Quoi | Où |
|---|---|
| App (public) | `github.com/Crash--/twake-mail-frontend`, clone `~/Sites/Linagora/twake-mail-frontend` |
| Client JMAP (public) | `github.com/Crash--/jmap-client-ts`, branche **`v2`**, clone `~/Sites/Linagora/jmap-client-ts` ; entrée `jmap-client-ts/linagora` pour les extensions |
| Référence Flutter | `~/.paseo/worktrees/1d578va0/spiffy-pony` (worktree de tmail-flutter à jour de `master` ; `sharp-mouse` n'existe plus) |
| Design (hors dépôt) | `~/Sites/Linagora/twake-mail-design-cache/` : `design-reference.md` (point d'entrée), `sidebar-spec.md`, `component-check.md` (twake-mui vs Figma), `audit-sidebar.md`, captures Figma (`twake-mui-page/`, `other-pages/`), rendus Storybook, captures avant/après, scripts `tools/`. **Ne rien en copier dans le dépôt public.** |
| Démo (Tailscale seulement) | **https://mail-react.twake.valmoriq.fr**, branchée sur le Workplace `twake.valmoriq.fr` (tmail-backend 1.0.19.1, SSO LemonLDAP), compte `user1` (≈ 3 400 mails de démo) |
| Déploiement démo | `~/Sites/Linagora/twake-mail-react-devbox/` : `deploy.sh` (clone + build image + up), `docker-compose.yaml`, `config/.env.js`, `config/appList.js`, `seed/` |
| Workplace local | `~/Sites/Linagora/twake-workplace-docker` (**modifs locales de Quentin : ne jamais commit/reset/stash**) |
| Candidats issues tmail-backend | [`backend-issues/`](backend-issues/README.md) (texte prêt) ; repros dans `~/Sites/Linagora/tmail-backend-issues/` |
| Modèles de déploiement Linagora (privés) | `~/Sites/Linagora/twake-workplace-apps`, `~/Sites/Linagora/twake-registration` (lecture seule, **ne rien recopier de sensible** dans le dépôt public) |
| Clones de référence | `/tmp/twake-calendar-frontend`, `/tmp/twake-contacts-frontend`, `/tmp/twake-ui`, `/tmp/messages-src` (peuvent disparaître : re-cloner) |

## 3. Règles et décisions (validées par Quentin)

- UI : **`@linagora/twake-mui` uniquement, jamais cozy-ui**, pas d'import `@mui/*` ni `sx`/`style` hors `@/ds/`.
  UI manquante → **`@/ds/`** (`common/src/ds/`), **sans logique métier**. Candidats à remonter dans twake-ui.
- **Accessibilité RGAA 4.1 obligatoire** (jsx-a11y, axe dans chaque spec e2e, navigation clavier). **Responsive** (desktop, tablette, mobile).
- Données : TanStack Query. Synchronisation incrémentale par `/changes` (pas de refetch global).
- Langues : en, fr, ru, vi (import des ARB Flutter via `scripts/import-flutter-arb.mjs`) ; les 9 langues = issue #62.
- React 19 (depuis #63) : `@linagora/twake-mui` 10, `@linagora/twake-icons` 2.13 et `twake-i18n` 0.6 l'acceptent (twake-ui#130 et cozy-libs#3165 publiées). Pas d'`overrides`. Types dépréciés (`FormEvent`, `MutableRefObject`) remplacés par `SubmitEvent` et `RefObject`.
- Workflow : **une branche + une PR par lot sur `Crash--/twake-mail-frontend`, merge en rebase quand la CI est verte**, puis redéploiement démo (`deploy.sh`). Conventional Commits, trailer `Co-Authored-By: Claude …`.
- Issues : Quentin en crée souvent en cours de route → les créer sur **notre** dépôt (anglais, checklist, labels existants).
  **Rien d'externe** (tmail-backend, twake-ui, Drive…) sans son feu vert.
- **Les 20 candidats tmail-backend restent en attente** (déjà ouvertes : #2682, #2684, #2685, #2686). Ne rien ouvrir.
- **#40 (détection de pièce jointe) : ne pas implémenter** (low priority).
- Registre d'images : **Docker Hub** retenu, mais **en attente** du username de Quentin (variable `IMAGE_REPOSITORY`) et de ses secrets `REGISTRY_USERNAME` / `REGISTRY_PASSWORD`. `ghcr.io/crash--` est un nom OCI invalide.
- Lien public créé par l'intent Drive : Quentin considère que c'est géré par les options passées à l'intent (voir le rapport de la PR #97 pour le détail des options).

## 4. État au moment de la passation

- `main` = `8768916`, CI verte, aucune PR ouverte (hormis celle de ce doc), aucun worktree ; déployé sur la démo.
- Fait le 2026-10-05 (PR #100 à #118) : #98 Favoris, #93 composer qui clignote, #95 défilement vers le message, #108 glitch
  défilement / View Transition, #113 double scrollbar (zones live de `ToastRegion`), contraste reporté au thème dédié (#105),
  design : sidebar (#104), barre du haut 50 px + recherche dans le corps + barre de liste (#106), lignes de liste et états (#107),
  barre d'action des dossiers + filtre de liste comme Flutter + bouton d'aide (#118, `Refs #112`), clés `.env.js` = `env.file`
  de tmail-flutter (#114, anciens noms en alias ; table dans `docs/deployment.md`), recherche de dossiers (#116), parité
  team-mailboxes (#117, tableau dans `docs/team-mailboxes.md`).
- Démo : `config/.env.js` passé aux noms Flutter (`SERVER_URL`, `WEB_OIDC_CLIENT_ID`, `OIDC_SCOPES`, `SENTRY_ENABLED`),
  sauvegarde `config/.env.js.bak-flutter-keys-*`. Redirection SSO vérifiée ; **connexion réelle non vérifiée** (identifiants).
- Issues ouvertes : `gh issue list -R Crash--/twake-mail-frontend`. Nouvelles du jour : #102 (flèches dans l'arbre des dossiers),
  #110 (libellés d'une ligne de conversation), #111 (bandeau d'achat d'espace / paywall, logique Flutter décrite), #112 (reste de
  la parité de la barre d'action, voir son dernier commentaire). #47 : la recherche dans l'arbre (MBX-04) est faite par #116.

## 5. Chantier design : où on en est

- **Lire Figma** : le fichier Teammail 1.1 est en vue publique. Playwright headless (user-agent Chrome standard, sinon 403
  CloudFront) l'ouvre sans compte et sans quota : scripts `twake-mail-design-cache/tools/` (README du cache). Le MCP Figma de
  Quentin a un siège View/Starter (~20 ou 6 appels/mois, 6 consommés) : ne l'utiliser que dans la session principale, jamais
  dans un sous-agent. Le panneau des propriétés (composant source, variantes) exige un compte ; la bibliothèque DS est externe.
- **Référence** : page « new components Twake MUI » (l'app refaite en Twake MUI, `twake-mui-page/`), page « new sidebar »,
  conversation « new compact » (`other-pages/threads-frame.png`). La page « COMPOSE SCREENS 1.1 » date de 2024 : à ignorer.
- **Règles** : palette officielle telle quelle, **pas de correction de contraste** (thème dédié plus tard ; axe le signale en
  annotation). twake-mui d'abord (voir `component-check.md` : `SearchBar elevation={0}`, `Snackbar`+`Alert` pour le hors ligne,
  `NavDesktopDropdown` pour les en-têtes repliables…), `@/ds/` sinon, pas de surcharge du thème global.
- **Reste à faire** : lecture d'un email et conversation compacte (`n28866`, `threads-frame`), composer (`n29032/35/38/41`),
  recherche ouverte et recherche avancée (`n28838`, `n28859`), mobile (`n29045`, menus `n29085…`), mode sombre, pied de sidebar
  (stockage « disponible », version), en-têtes de section repliables (« Folders › »), finitions de la recherche de dossiers
  (ombre du champ, badge « masqué » qui tronque), bannière hors ligne à brancher (`ds/OfflineBanner` existe), skeletons.
- **Questions en attente de Quentin** : largeur de sidebar #92 (236 px + infobulle ou 264 px) ; icône « ↶ » des lignes (réponse
  rapide ou statut `$answered`) ; libellés d'une ligne de conversation (#110 : email représentatif ou union) ; engrenage du menu de
  compte en mode embarqué (proposition : le retirer) ; boutons texte 16 px (thème) vs 14 px (maquette) ; résultats masqués de la
  recherche de dossiers ouvrables ou grisés comme Flutter ; identités du composer (`mayDelete`) et actions interdites masquées ou
  grisées (team-mailboxes) ; WebFinger pour découvrir le SSO depuis `SERVER_URL` ; `COZY_INTEGRATION` vs `WORKPLACE_EMBEDDING` ;
  consentement Sentry ; défilement d'ouverture désormais jamais fluide (#109). Candidats d'issues externes listés dans les
  rapports (rien d'ouvert) : `Mailbox/clear` sur team-mailbox, namespaces `Delegated`, `serverFail` de la memory image.

## 6. Devbox : ce qui a été modifié (et comment revenir en arrière)

- `twake-mail-react-devbox/docker-compose.yaml` : image non-root (port **8080**, uid 101, `read_only`, tmpfs `/tmp`,
  `cap_drop: ALL`, `no-new-privileges`), CSP : `CSP_CONNECT_SRC="https://auth.twake.valmoriq.fr https://*.twake.valmoriq.fr"`,
  `CSP_FRAME_SRC="https://*.twake.valmoriq.fr"`, `CSP_FRAME_ANCESTORS="'self' https://*.twake.valmoriq.fr"`. Sauvegardes `*.bak-*`.
- `config/.env.js` : `TDRIVE_ENABLED = true`, `TDRIVE_INTENT_URL = 'https://{localpart}.twake.valmoriq.fr'`, `WORKPLACE_EMBEDDING = true`, `CALENDAR_SPA_URL`.
- Workplace, `cozy_stack/config/cozy.yaml` (+ `.template`) : `app_token_exchange.twake-mail-react.software_id: registry://mail` (sauvegardes `.bak-twakemail-react-*`).
- Flag cozy de **user1 seulement** : `mail.embedded-app-url = https://mail-react.twake.valmoriq.fr`. Retour :
  `docker exec cozyt cozy-stack features flags --domain user1.twake.valmoriq.fr '{"mail.embedded-app-url": "https://mail.twake.valmoriq.fr"}'`
- LemonLDAP : client OIDC `twake-mail-react` ajouté **en live** seulement (`register-oidc-client.sh` le recrée) ; l'ajouter aux
  templates `twake_auth/config/lmConf-1.json.*.template` et passer LemonLDAP en `notice` restent **à faire par Quentin**.
- `visio-livekit` limité à l'IP Tailscale (`meet_app/docker-compose.override.yml`).
- Identifiants de démo : dans le README du Workplace (« Login & next steps ») ; **ne jamais les recopier**. Le contrôle de
  permissions refuse parfois leur lecture aux agents : ne pas contourner, demander à Quentin de tester.

## 7. Pièges connus

- Après chaque push sur `jmap-client-ts` v2 : mettre à jour le lockfile de l'app puis `npm approve-scripts jmap-client-ts`.
- E2E sur l'image **memory** : bugs #2684 (Email/set bloqué/corrompu au-delà de ~256 messages), Lucene (recherche, expunge) →
  **redémarrer la stack** (`e2e/scripts/stop.sh` puis `start.sh`) entre les campagnes ; un projet compose et des ports par agent.
  Ports déjà utilisés par d'autres environnements : 80, 8080, 8090, 5984, 6060 ; publier seulement sur 127.0.0.1.
- La CI e2e tourne **contre l'image Docker** avec une **garde CSP** : toute violation fait échouer le test.
- Prettier : toujours depuis la racine du dépôt (lancé dans `e2e/`, il reformate des specs).
- Node 24 : `source ~/.nvm/nvm.sh && nvm use 24`.
- E2E en parallèle : chaque agent a son `E2E_PROJECT` et ses ports (`E2E_JMAP_PORT`, `E2E_WEBADMIN_PORT`, `E2E_APP_PORT`) **et** exporte
  `E2E_BASE_URL`, `E2E_JMAP_URL`, `E2E_WEBADMIN_URL` pour Playwright ; toujours passer son `E2E_PROJECT` à `stop.sh`.
- Avant de merger : vérifier la CI du **commit de tête** (`gh run list --commit <sha>`), pas seulement `statusCheckRollup`.
- Sous-agents : interdire `mcp__figma__*` et la copie des captures/SVG du cache dans le dépôt ; lignes ajoutées en **fin** de
  `docs/twake-mui-gaps.md`, `e2e/pages/README.md`, `e2e/e2e.md` pour limiter les conflits.
- Skills Twake : plugin `twake-guidelines` (scope utilisateur), sources dans `~/.claude/plugins/marketplaces/twake-guidelines/skills/`.

## 8. Message à coller pour démarrer la prochaine session

> On reprend la réécriture React de Twake Mail. Lis `docs/NEXT_SESSION.md` puis `AGENTS.md` du dépôt
> `~/Sites/Linagora/twake-mail-frontend`. Vérifie que les outils Figma sont disponibles, puis attaque le chantier design
> (§5) en commençant par lire le design system du fichier Teammail 1.1 (lien dans le doc). Même façon de travailler
> qu'avant : agents en parallèle dans des worktrees, une PR par lot mergée quand la CI est verte, redéploiement de la démo,
> issues sur notre dépôt pour ce que je signale, rien d'externe sans mon accord.

(Pour le design, commencer par `~/Sites/Linagora/twake-mail-design-cache/design-reference.md` et les questions du §5.)
