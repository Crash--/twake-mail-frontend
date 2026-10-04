# Twake Mail React — passation (2026-10-04)

Réécriture de la version **web** de tmail-flutter en React. Le mobile reste en Flutter.
Ce document résume ce qui a été appris, ce qui est fait, ce qui tourne encore et ce qu'il reste à faire.

## 1. Décisions (validées par Quentin)

| Sujet | Décision |
|---|---|
| Dépôts | `Crash--/twake-mail-frontend` (public) et fork `Crash--/jmap-client-ts`, branche `v2`, clonés dans `~/Sites/Linagora/` |
| Modèle d'app | **Standalone** (pas une coquille Cozy). Squelette de `linagora/twake-contacts-frontend`, pratiques durcies de `linagora/twake-calendar-frontend` |
| UI | `@linagora/twake-mui` uniquement. **Jamais cozy-ui.** Pas d'import `@mui/*` ni de `sx`/`style` hors `@/ds/` |
| Design system local | UI absente de twake-mui → `@/ds/` (dossier `common/src/ds/`), **sans logique métier** : MUI, style, comportement. Candidats à remonter dans twake-ui |
| Liste virtualisée | `VirtualizedTable` de twake-mui, comme Contacts (`ContactsTable.tsx`, `ContactCell.tsx`, `ContactRowActions.tsx`) |
| Données | TanStack Query v5 (Calendar et Contacts sont sur Redux Toolkit : choix délibéré différent) |
| Client JMAP | v2 réécrite de `jmap-client-ts` (l'ancienne v1 était inutilisable). Contrat : `jmap-client-ts/docs/v2-api.md` |
| React | 18 aujourd'hui ; passage à 19 validé, en attente des PR twake-ui et cozy-libs |
| Éditeur riche | TipTap (pas de préférence de Quentin) |
| E2E | **Playwright TypeScript** (pas Java comme Calendar), un utilisateur neuf par test, backlog `e2e/e2e.md` |
| Auth | OIDC (`openid-client`, PKCE, tokens en mémoire, refresh) par défaut ; Basic activable par config |
| Accessibilité | **Obligatoire : RGAA 4.1** (référentiel de l'État, ≈ WCAG 2.1 AA). jsx-a11y + axe dans les e2e + tests clavier ; audit manuel avant prod |
| Façon de travailler | Enchaîner les phases sans redemander ; demander avant toute action publique sur un dépôt Linagora (PR, issue) |

## 2. Ce qu'on a appris

### tmail-flutter (le code à remplacer)
- ~205 000 lignes de Dart écrites à la main (169k `lib/`, 36k modules). Environ 130 à 150k lignes concernent le web.
- Les plus grosses features : composer (21k), email (18k, dont 5k d'invitations calendrier), mailbox_dashboard (17k), manage_account (16k), mailbox (12k), thread (11k).
- À ne pas porter (mobile uniquement) : sending_queue, offline_mode, starting_page, FCM et notifications locales.
- Extensions JMAP Linagora/James utilisées :
  - Label, Forward, Filter, Settings, EmailRecoveryAction, TMailContact/autocomplete ;
  - CalendarEvent/* et CalendarEventAttendance ;
  - PublicAsset, Mailbox/clear, Quota ;
  - WebSocket avec ticket ;
  - capabilities `com:linagora:params:*` (labels, forward, filter, settings, messages:vault, contact:autocomplete, aibot, upload:from-url, downloadAll, saas, calendar:event, ws:ticket), `urn:apache:james:params:jmap:mail:{shares,quota}`, `urn:ietf:params:jmap:principals`.
- Auth web : OIDC avec PKCE par redirection (`flutter_appauth_web`), repli Basic, découverte webfinger. Configuration par `env.file`.
- Éditeur actuel : fork de Summernote dans un iframe. Lecture : iframe après sanitisation (ADR 0054). i18n : ARB, 49 langues, 888 clés.
- Les 69 ADR de `docs/adr/` contiennent beaucoup de règles métier implicites.

### Tests e2e Flutter
- 116 tests Patrol. Seuls 24 sont tagués `web` et tournent en CI. **89 ne tournent nulle part** : le tag par défaut est iOS et aucun job ne le lance.
- Ils ne sont pas portables : Flutter web est un canvas, les tests sélectionnent par type de widget et lisent l'état des contrôleurs GetX. On les **réécrit** en Playwright.
- Réutilisable : `backend-docker/`, `provisioning.sh` avec `backup.zip`, le serveur de reset, `scripts/qa-environment/`.

### Bibliothèques
- **jmap-client-ts v1** (linagora) : ~15 % de couverture, un appel par requête, upload cassé, pas de refresh de token, build cassé sous Node 20. Réécrit en v2.
- **jmap-jam** (MIT) : bonne API, mais types fermés (on ne peut pas ajouter de méthodes), pas de WebSocket, fetch non injectable. On s'en est inspiré pour la v2 sans copier de code.
- **twake-mui 9.16** : MUI v9, peer `react ^18` à l'origine. Catalogue limité : Layout, Sidebar, Nav*, SearchBar, Dialog, ListItem*, VirtualizedTable, Avatar, Chip…
- **twake-libs** : contient seulement `@linagora/twake-utils` (URI templates des autres apps). C'est l'endroit prévu pour des paquets `@linagora/*` partagés, par exemple une auth OIDC commune.
- **twake-i18n 0.5.0** (cozy-libs) : peer `react ^16-18`. Sans override, npm installe deux copies de React en 19.
- Ticket WebSocket Linagora : capability `com:linagora:params:jmap:ws:ticket`, `POST /jmap/ws/ticket`, valeur passée en `?ticket=` sur `/jmap/ws`, sous-protocole `jmap`, valable 60 s.

### Twake Calendar / Contacts (conventions reprises)
- Configuration à l'exécution par `public/.env.js`, avec des globales typées dans `window.d.ts`, plus `appList.js` et `version.js`. Image nginx:alpine, `dist` construit hors Docker.
- Tokens gardés en mémoire, Bearer envoyé seulement vers l'origine du backend, retry réservé aux méthodes sûres, déconnexion propagée aux autres onglets par BroadcastChannel.
- Calendar ne rafraîchit pas le token : il redirige vers le SSO. Pour un webmail ce n'est pas acceptable (perte de brouillon), d'où le refresh chez nous.
- CHANGELOG au format Keep a Changelog, un fichier `upgrade-instructions/<version>.md` par release.
- Les e2e de Calendar sont en Java (Playwright Java + Testcontainers) avec un backlog `e2e.md` à identifiants stables. On a gardé le principe, en TypeScript.

### Backend (tmail-backend)
- Dex suffit comme fournisseur OIDC de test : tmail-backend appelle l'introspection et `userinfo`.
- Bug signalé dans **linagora/tmail-backend#2682** :
  - (A) l'image memory active `view.email.query.enabled=true` sans enregistrer `PopulateEmailQueryViewListener`, donc `Email/query` `{inMailbox}` trié par `receivedAt` desc renvoie 0 id pour toutes les boîtes ;
  - (B) la tâche `populateEmailQueryView` ignore les team mailboxes.
  - Twake Workplace n'est pas touché par A. Nos e2e utilisent `view.email.query.enabled=false`.
  - Reproduction : `~/Sites/Linagora/tmail-backend-issues/team-mailbox-email-query-view/`.

## 3. Ce qui est fait

### jmap-client-ts v2 (`Crash--/jmap-client-ts#v2`, poussé, CI verte)
- ESM, TS 5.9 strict, tsdown, vitest, ESLint 9.
- `createClient` avec auth injectable et retry unique sur 401, fetch injectable, session en cache avec `onSessionChange`.
- `call`, `request` avec références typées entre appels, `requestSettled`, `createdIds`.
- Registre `JmapMethods` extensible par declaration merging (et l'option `methodCapabilities` qui l'accompagne).
- Méthodes RFC 8620/8621, Quota (RFC 9425), MDN (RFC 9007).
- Upload et download, WebSocket avec ticket, reconnexion et ping.
- 78 tests unitaires et de types, 7 tests d'intégration contre tmail-backend.

### twake-mail-frontend (`Crash--/twake-mail-frontend`, `main`, poussé, CI et E2E vertes)
- Workspaces `apps/private` + `common`, rsbuild 2, TS 6, React 18, react-router 7, TanStack Query, twake-mui, twake-i18n (en/fr/ru/vi), Sentry 11 avec masquage des données sensibles, Docker/nginx, GitHub Actions.
- Auth OIDC (refresh sérialisé, `id_token_hint`, BroadcastChannel) et Basic.
- Arbre des dossiers (ordre Flutter, compteurs de non-lus).
- Liste paginée par `Email/query` + `Email/get` en une seule requête.
- Lecture : DOMPurify, iframe sandbox sans scripts, CSP, images `cid:` via object URLs, pièces jointes, marquage comme lu optimiste avec rollback.
- Étoile, WebSocket qui invalide les requêtes, proxy de dev `JMAP_PROXY_TARGET`.
- ESLint bloque `@mui/*`, cozy-ui, `sx`, `style`, `export default`.
- Script `scripts/import-flutter-arb.mjs` pour reprendre les traductions Flutter.
- 118 tests Jest.
- E2E : stack `e2e/docker` (projet compose `twakemail-e2e`, 127.0.0.1:18300-18302, nginx en même origine, profil Dex `oidc`), fixtures (utilisateur neuf par test, helpers JMAP, WebAdmin).
  - Specs vertes en CI : LOGIN-01, MBX-05, MBX-17, EML-01, EML-03, EML-28, PUSH-01.
- `docs/twake-mui-gaps.md` liste les manques de twake-mui.

### Contributions publiques
- **linagora/tmail-backend#2682** : issue sur le bug de vue de requête (voir plus haut).
- **linagora/twake-ui#130** « feat: support react 19 » (branche `Crash--/twake-ui:feat/react-19-support`). Checks verts, Argos sans écart.
  - peers `^18 || ^19` ;
  - corrections des types `JSX` ;
  - rooks 8.4.0 (la 9 est ESM-only et casse Jest) ;
  - job CI React 18.

## 4. État au soir du 2026-10-04 (après la passation initiale)

- **Fait et poussé sur `main`** (32 commits) : design system `@/ds/` (alias `@/ds/*` → `common/src/ds/*`, ESLint qui y interdit toute logique métier), liste sur `VirtualizedTable` via `ds/VirtualizedListTable` + `RowLink` (vrai lien, clic molette, focus clavier), RGAA (section dans `AGENTS.md`, `eslint-plugin-jsx-a11y-x`, axe dans les e2e avec `TWAKE_MUI_KNOWN_VIOLATIONS`, spec clavier A11Y-01, `<title>` par vue, live region des nouveaux mails), perfs (`e2e/scripts/seed-perf.ts`, `npm run perf` dans `e2e/`, `docs/perf/phase0.md`).
- **Perfs (stack e2e, 5 000 mails)** : 1re ligne 188 ms, ouverture 50 ms, scroll jusqu'à 2 000 mails sans long task (34 lignes DOM, heap 17 Mo). **Le push ne tient pas** : avec 2 000 mails chargés, 69 requêtes / 1,17 Mo / 6,2 s → chantier `/changes` prioritaire. James ignore `calculateTotal` et n'a pas `Email/queryChanges`.
- **Devbox** : https://mail-react.twake.valmoriq.fr (Tailscale), scripts dans `~/Sites/Linagora/twake-mail-react-devbox/` (`deploy.sh`, `register-oidc-client.sh`, `seed/seed-demo.mjs` : 3 400 mails pour `user1`). Mesures réelles React vs Flutter 0.30 : liste 0,3 s vs 3,8 s, 1 000 mails défilés en 2,7 s vs 20 s, 61 fps vs 24–29 fps. Client OIDC `twake-mail-react` actif en live seulement (à ajouter par Quentin aux templates LemonLDAP).
- **Spike composer** (branche locale `spike/composer`, worktree `../twake-mail-frontend-spike-composer`, doc `docs/spikes/composer-tiptap.md`) : GO TipTap 3 sous conditions, citation en nœud atomique, BlockNote écarté, 42–56 j-dev. À fusionner : conflit attendu sur `e2e/package.json` (axe ajouté des deux côtés) et scripts e2e paramétrés (`E2E_PROJECT`…).
- **PR ouvertes** : linagora/twake-ui#130 (React 19), linagora/cozy-libs#3165 (twake-i18n React 19). Issue linagora/tmail-backend#2682.
- **Candidats issues tmail-backend (en attente d'accord)** : `bodyStructure` ignoré à la création ; `Email/set` create+destroy détruit d'abord ; pas de back-reference vers un créé dans `Email/get` ; `Email/get` attachments+bodyValues → serverFail ; **image memory : tout `Email/set` en mise à jour ne répond plus après ~256 messages** (repro `~/Sites/Linagora/tmail-backend-issues/memory-email-set-update-hang/`). Conséquence e2e : ne jamais lancer la suite après le seed de perf sans `stop.sh` + `start.sh`.
- **Bugs app trouvés sur la devbox** : le logout OIDC ne déconnecte pas (`oidcAuth.ts` `logout()` : `startLogin` relancé par `RequireAuth` ; mettre `isRedirecting = true` avant `endLocalSession`) ; nom/email vides si absents de l'ID token (userinfo ou `session.username`).

## 5. Ce qu'il reste à faire

### Immédiat
- [ ] Reprendre les deux travaux de la section 4.
- [ ] Une fois twake-ui#130 publié (twake-mui ≥ 9.17, twake-icons ≥ 2.12) : passer l'app en React 19 (react, react-dom et types `^19`).
  - Corriger `FormEvent` dans `BasicLoginPage.tsx` (déprécié en 19.3).
  - Override `twake-i18n` tant que la PR cozy-libs n'est pas publiée.
- [ ] Mettre à jour le lockfile après chaque push sur `jmap-client-ts#v2`, puis `npm approve-scripts jmap-client-ts` (allowScripts épinglé sur le commit), sinon `npm ci` échoue.
- [ ] Proposer à twake-ui les composants de `@/ds/` et les manques de `VirtualizedTable` (ligne-lien pour le clic molette, en-tête masquable, accessibilité). Demander à Quentin avant d'ouvrir les PR.

### Phase 2 : lecture complète
- Synchronisation incrémentale : `Email/changes`, `Email/queryChanges`, `Mailbox/changes` au lieu de tout recharger à chaque push (à chiffrer avec `docs/perf/phase0.md`).
- Actions : archiver, supprimer, déplacer, spam, non-lu, sélection multiple, glisser-déposer, menu contextuel ; vider la corbeille et le spam (`Mailbox/clear`).
- Vue conversation (threads) ; recherche avec suggestions, filtres avancés, tri et surlignage (`SearchSnippet/get`).
- Team mailboxes : capability `urn:apache:james:params:jmap:mail:shares`.
- Images distantes bloquées par défaut (pixels de suivi), et liste blanche de sanitisation alignée sur l'ADR 0054.
- CRUD des dossiers.
- Porter les specs correspondantes de `e2e/e2e.md` (MBX, EML, SRCH, THR).

### Phase 3 : composer (le plus risqué)
- TipTap habillé avec twake-mui et `@/ds/`, destinataires avec autocomplétion (`TMailContact/autocomplete`).
- Pièces jointes et images inline, brouillons et modèles, identités et signatures.
- Restauration après rechargement, réponse, réponse à tous, transfert, rappel de pièce jointe oubliée, accusé de lecture (MDN), raccourcis clavier.
- Specs CMP-*.

### Phase 4 : réglages et extensions
- Identités, règles (`Filter`), transfert (`Forward`), message d'absence, labels (`Label/*`), restauration de mails supprimés (`EmailRecoveryAction`), quotas, préférences (`Settings`), langue.
- Créer une entrée `jmap-client-ts/linagora` qui déclare ces méthodes avec sa table `methodCapabilities`.

### Phase 5 : écosystème
- Invitations calendrier (`CalendarEvent/*`), grille d'apps, détection d'iframe Workplace (`cozy-external-bridge`, optionnelle).
- Sélecteur de fichiers Drive (`cozy-interapp`, derrière un flag), assistant IA (scribe, `aibot`), `PublicAsset`, paywall.

### Phase 6 : parité et bascule
- Les 110 scénarios web de `e2e/e2e.md` portés et verts en CI.
- Audit RGAA manuel (NVDA, VoiceOver) et déclaration d'accessibilité.
- Bêta derrière un flag, test interne, puis gel du web Flutter.
- Sujet produit à régler avec l'équipe : gel ou double implémentation du web Flutter pendant la réécriture.

## 6. Repères

- Skills Twake : plugin `twake-guidelines@twake-guidelines`, installé pour l'utilisateur. Sources dans `~/.claude/plugins/marketplaces/twake-guidelines/skills/`.
- Règles du dépôt : `AGENTS.md`. Interface du client : `jmap-client-ts/docs/v2-api.md`. Contrat des `data-testid` : `e2e/pages/README.md`.
- Commits en Conventional Commits, terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Machine de dev :
  - ne jamais toucher aux conteneurs d'autres environnements (`tmail-backend`, `tmail-web`, `e2e-*` de Drive, `lemonldap`…) ;
  - publier uniquement sur 127.0.0.1 ;
  - ports 80, 8080, 8090, 5984 et 6060 déjà pris ; ce projet utilise 18100-18101 (tests du client), 18200 (dev), 18300-18302 (e2e) et 18400-18401 (repro du bug backend).
- Node 24 : `source ~/.nvm/nvm.sh && nvm use 24`.
