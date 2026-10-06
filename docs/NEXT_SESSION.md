# Reprendre le projet dans une nouvelle session (état au 2026-10-06, après la nuit design)

Point d'entrée pour la prochaine session (agent ou humain). Le détail historique est dans
[`HANDOFF.md`](HANDOFF.md) ; les règles du code dans [`../AGENTS.md`](../AGENTS.md).

## 1. Le projet en bref

Réécriture en React de la version **web** de Twake Mail (tmail-flutter ; le mobile reste en Flutter).
App **standalone** sur le modèle de Twake Calendar / Contacts, JMAP via notre client `jmap-client-ts` v2.
Les phases 0 à 5 sont faites (lecture, composer complet, réglages et extensions Linagora, calendrier,
Drive, IA derrière capability), plus le déploiement (image non-root, CSP, Helm, image drop-in du chart
`linagora/tmail-frontend`). Le chantier design (§5) a couvert sidebar, liste, recherche, lecture et tout le composer ;
il reste des finitions et les **décisions en attente de Quentin** (§5).

## 2. Où sont les choses

| Quoi | Où |
|---|---|
| App (public) | `github.com/Crash--/twake-mail-frontend`, clone `~/Sites/Linagora/twake-mail-frontend` |
| Client JMAP (public) | `github.com/Crash--/jmap-client-ts`, branche **`v2`**, clone `~/Sites/Linagora/jmap-client-ts` ; entrée `jmap-client-ts/linagora` pour les extensions |
| Référence Flutter | `~/.paseo/worktrees/1d578va0/spiffy-pony` (worktree de tmail-flutter à jour de `master` ; `sharp-mouse` n'existe plus) |
| Design (hors dépôt) | `~/Sites/Linagora/twake-mail-design-cache/` (git local, jamais poussé) : `design-reference.md` (point d'entrée), specs `sidebar-spec.md`, `list-spec.md`, `reading-spec.md`, `composer-spec.md`, `editor-spec.md`, `e4-audit.md`, `component-check.md`, **`questions-quentin.md`** (décisions en attente), captures Figma (`twake-mui-page/`, `other-pages/`, `editor/`), captures avant/après par lot, scripts `tools/` (dont `automerge.sh`). **Ne rien en copier dans le dépôt public.** |
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
- Registre d'images : **Harbor Linagora**, projet privé `twake-workplace` : `harbor.linagora.com/twake-workplace/twake-mail-frontend`.
  Publié **à la main** le 2026-10-06 (`:main-9a33376` et `:main`, amd64, test de fumée passé) avec le `docker login` de la
  devbox. **Cette image date d'avant #158** : à republier depuis `main` (avec l'accord de Quentin) avant de passer la MR
  en prête. Pour que la CI publie seule (#157) : variable `IMAGE_REPOSITORY` + secrets `REGISTRY_USERNAME` / `REGISTRY_PASSWORD`
  (compte robot Harbor de préférence) à poser par Quentin. `ghcr.io/crash--` est un nom OCI invalide.
- Déploiement Workplace dev : une **MR en brouillon** sur le dépôt de déploiement interne remplace l'image tmail-web
  par celle-ci (même chart, mêmes values). Détails, accès et points à vérifier : `twake-mail-design-cache/deploy-workplace.md`
  (hors dépôt). Pousser vers le GitLab Linagora demande l'accord explicite de Quentin.
- Lien public créé par l'intent Drive : Quentin considère que c'est géré par les options passées à l'intent (voir le rapport de la PR #97 pour le détail des options).

## 4. État au moment de la passation

- `main` à jour, CI verte, démo redéployée après chaque merge. Fait la nuit du 2026-10-05 au 06 (PR #119 à #172) :
  - design : lecture et conversation (#148), sidebar (#149), recherche ouverte, filtres sur une ligne et recherche avancée
    (#150), libellés dans les lignes et fiche d'une adresse (#154, lignes étroites sous la taille desktop), arbre des dossiers
    au clavier (#156, motif APG), couleur libre des libellés (#165) ;
  - éditeur / composer : toolbar complète et emojis (#145), pièces jointes, signature, chips (#146), fenêtre agrandie et
    dialogue de lien (#147), passe au pixel (#151), barre du haut sur téléphone et fenêtre sur tablette (#153), modèles :
    sélecteur, dossiers d'équipe, course de création (#155), gros brouillons et audit RGAA (#158, budgets dans
    `docs/perf/composer.md`, grille dans `docs/a11y/composer-audit.md`), écarts RGAA (#164) ;
  - plateforme : React 19 + twake-mui 10 (#139), image drop-in du chart (#140), Sentry avec consentement (#123), brouillons
    locaux d'abord (#141), alertes X-TWP-Message (#143), PDF borné (#137), skeletons et bannière hors ligne (#169),
    brouillon annulé qui ne revient plus après un rechargement rapide (#172, pierre tombale `sessionStorage`), signature qui
    garde le curseur (#167), tests fiabilisés (#144, #152, #167, #171 ; MBX-51 seul dans le projet Playwright `bulk`).
  - autre session : façade team-mailbox pour TwakeSpace (#168 : `TWAKE_SPACE_URL`, login silencieux dans une frame). Ses
    worktrees (`twake-mail-frontend-embed`, `-wt/offline-messages`, `-wt/space-overlay`) et ses stacks e2e (`twakemail-e2e`,
    `twakemail-e2e-so`) ne sont pas à toucher sans savoir où elle en est.
- Issues fermées cette nuit : #54, #63, #102, #110, #132, #159 à #163 (et celles des PR ci-dessus). Ouverte : #173
  (`draftId` périmé après « Save as template » + rechargement ; specs des brouillons absentes sur téléphone en CI).
- Issues ouvertes : `gh issue list -R Crash--/twake-mail-frontend`. #96 (affichage des résultats de recherche avec les
  conversations) et #92 (largeur de sidebar) attendent une décision ; #59 reste ouverte pour « retirer une couleur »
  (tmail-backend refuse `color: null`) ; #65 pour l'audit NVDA / VoiceOver manuel.

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
- **Fait** : sidebar, barre du haut, liste, recherche (ouverte, filtres, avancée), lecture et conversation, composer et
  éditeur (desktop, tablette, téléphone), libellés, skeletons (liste, recherche, arbre, lecture) et bannière hors ligne (D8). Captures `after-*` par lot dans le cache.
- **Reste à faire** : mode sombre, réglages, mobile
  hors composer (`n29045`, menus `n29085…`), pages Figma sans équivalent Flutter (multi-comptes, délégation, migration,
  automatisations : périmètre à décider).
- **Décisions en attente de Quentin** : toutes dans `twake-mail-design-cache/questions-quentin.md` (une ligne par lot).
  Les principales : From / Cc / Bcc toujours visibles (maquette) ou comme Flutter ; « New Message » ou « New message » ;
  tablette paysage (barre téléphone ou fenêtre) ; typeahead de l'arbre qui capte les raccourcis à une lettre ; corps de 5 MB
  au-delà de `maxSizeRequest` ; refonte de `ds/RecipientField` pour 200 chips ; chat proposé pour toute adresse ; nombre de
  chips de libellé ; largeur de sidebar #92 ; #96 ; plafond de 3 rangées de chips ; avertissement d'image sans alt.
  Candidats d'issues tmail-backend (rien d'ouvert) : `color: null` dans `Label/set`, `Mailbox/clear` sur team-mailbox,
  namespaces `Delegated`, `serverFail` de la memory image, rôle `templates` absent, `ConcurrentModificationException`
  (`Email/set` qui ne répond plus sous charge), mail détruit encore listé juste après `Email/set destroy`, « Attachment not
  found » ~430 ms après l'upload à froid.

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
  `twake-mail-design-cache/tools/automerge.sh <pr> <worktree>` le fait : attend la CI du HEAD, relance une fois les jobs en
  échec, rebase (driver `union` local) si besoin, merge en rebase, redéploie la démo ; s'arrête sur un vrai conflit.
- Specs PDF (ATT-06/08/10) en local : servir l'app avec l'**image Docker** (le nginx statique sert le worker `.mjs` en
  `application/octet-stream`). `npm run perf` lance `perf:large` sur une stack neuve d'abord (voir `e2e/README.md`).
- Sous-agents : interdire `mcp__figma__*` et la copie des captures/SVG du cache dans le dépôt ; lignes ajoutées en **fin** de
  `docs/twake-mui-gaps.md`, `e2e/pages/README.md`, `e2e/e2e.md` pour limiter les conflits.
- Skills Twake : plugin `twake-guidelines` (scope utilisateur), sources dans `~/.claude/plugins/marketplaces/twake-guidelines/skills/`.

## 8. Message à coller pour démarrer la prochaine session

> On reprend la réécriture React de Twake Mail. Lis `docs/NEXT_SESSION.md` puis `AGENTS.md` du dépôt
> `~/Sites/Linagora/twake-mail-frontend`, puis `~/Sites/Linagora/twake-mail-design-cache/questions-quentin.md` : passe en
> revue avec moi les décisions en attente avant de lancer un lot qui en dépend. Ensuite : finitions design restantes (§5),
> déploiement Workplace (image Harbor à republier, MR en brouillon) et issues ouvertes. Même façon de travailler qu'avant :
> agents en parallèle dans des worktrees, une PR par lot mergée quand la CI du HEAD est verte, redéploiement de la démo,
> issues sur notre dépôt pour ce que je signale, rien d'externe sans mon accord.

(Le design de référence reste `~/Sites/Linagora/twake-mail-design-cache/design-reference.md` ; les captures `after-*` montrent
l'état de chaque lot.)
