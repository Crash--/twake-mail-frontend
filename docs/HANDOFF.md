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

## 4. État au 2026-10-05 (après les lots 1 à 4, le lot A de la phase 2 et les lots L1 à L3 du composer)

- **Méthode** : une branche par lot depuis `main`, vérifications sur clone propre (`npm ci`, lint, format, typecheck, tests, build) puis e2e, PR sur `Crash--/twake-mail-frontend`, merge une fois la CI verte, redéploiement devbox (`~/Sites/Linagora/twake-mail-react-devbox/deploy.sh`).
- **Phase 0** (avant les lots) : design system `@/ds/`, liste sur `VirtualizedTable` (`ds/VirtualizedListTable` + `RowLink`), RGAA (jsx-a11y, axe dans les e2e avec `TWAKE_MUI_KNOWN_VIOLATIONS`, A11Y-01), perfs (`npm run perf`, `docs/perf/phase0.md`). Responsive (téléphone, tablette) mergé en PR #4 (projets Playwright `mobile` et `tablet`).
- **Lot 1, spike composer fusionné** (PR #1) : `@/ds/RichTextEditor`, `features/composer/`, route `/spike/composer` derrière `DEBUG`, specs `e2e/spike/` (`./scripts/spike.sh`, sur la stack e2e avec un overlay DEBUG + tmail-web). Worktree et branche du spike supprimés.
- **Lot 2, synchronisation incrémentale** (PR #2, `features/push/pushSync.ts`, `docs/perf/sync.md`) :
  - sur `StateChange`, `Mailbox/changes` + `Email/changes` et les `/get` des créés et modifiés par back-references, en une requête ;
  - patch du cache : toutes les pages chargées de chaque liste, l'arbre, l'email ouvert ; chaque page garde l'état JMAP qu'elle reflète, ce qui rattrape une page chargée pendant un patch ;
  - repli par liste (première page seulement) si `/changes` échoue ou dure plus de 5 tours ; plus de rechargement à l'ouverture du WebSocket, rattrapage à la reconnexion.
  - **Mesure 5** (push avec 2 000 mails chargés, stack e2e) : 69 requêtes / 1,17 Mo / 7,0 s **→ 1 requête / 2 Ko / 32 ms**.
  - **Devbox** (1 000 mails chargés) : 35 requêtes / 742 Ko **→ 1 requête / 2,1 Ko / 34 ms**.
- **Lot 3, OIDC** (PR #3) :
  - le logout part bien vers `end_session` : `isRedirecting` est posé avant `endLocalSession`. LemonLDAP demande alors une confirmation, puis le rechargement de l'app affiche le formulaire SSO ;
  - nom et email lus via userinfo si l'ID token ne les porte pas, repli sur `session.username`.
  - Vérifié sur la devbox. Dex (e2e) n'a ni `end_session_endpoint` ni session SSO : il ne peut pas reproduire le bug.
- **Lot 4, sécurité de lecture** (PR #5) :
  - sanitisation DOMPurify alignée sur le fork `sanitize_html` de tmail-flutter : balises, attributs, schémas d'URL, liste blanche CSS, `<style>` filtré règle par règle ;
  - contenu distant bloqué par défaut (images, `srcset`, fonds et `url()` CSS, polices, `@import`), avec un bandeau « Afficher » / « Toujours afficher pour cet expéditeur » (préférence en `localStorage`) ;
  - après déblocage : `referrerpolicy=no-referrer` et iframe chargée en `blob:`, car Chromium envoie l'origine pour les images CSS d'un iframe `srcdoc` ;
  - spec EML-29 avec `page.route`, sur desktop, mobile et tablette.
- **Phase 2, lot A : actions sur les emails, sélection, dossiers** (PR #8, #10 et celle des dossiers) :
  - **infrastructure** (PR #8) : `ds/ToastRegion` (régions live toujours présentes, polite ou alert, pause au survol, au focus et onglet caché, action « Annuler » ou « Réessayer ») et `useNotify` ; `useConfirm` ; service d'actions `features/emailActions/` : mise à jour optimiste par `patchEmailList` / `patchSearchList` (idempotente : le push du même changement ne réapplique rien, les compteurs repris du serveur sont absolus), `Email/set` en lots de `min(maxObjectsInSet, 50)` par patchs de chemins (`mailboxIds/<id>`, `keywords/<k>`), rollback par patch inverse des emails refusés (pas de restauration d'instantané, qui effacerait les patchs du push), annulation par l'opération inverse, toast d'erreur avec « Réessayer » ;
  - **raccourcis** `c`, `/`, `j`, `k`, `e`, `#`, `s`, `u`, `z`, `?` (`features/shortcuts/`) : ignorés dans les champs, dialogues, menus et avec Ctrl/Alt/Meta (AltGr accepté pour `#` en AZERTY), listés par `?` et dans le menu du compte, désactivables (WCAG 2.1.4, préférence en `localStorage`) ;
  - **correctifs hérités** : `staleTime` infini tant que le WebSocket est ouvert (30 s sinon) ; un `fetchNextPage` sans page suivante, déclenché par virtuoso au montage, marquait la liste fraîche et bloquait son rechargement ; plus de retrait de 44 px quand aucun dossier n'a d'enfant ; `start.sh` attend que des appels JMAP authentifiés réussissent ; les comptes de test détruisent leurs emails à la fin (bug #2684) ;
  - **actions** (PR #10) : archiver, corbeille ou suppression définitive (Corbeille, Spam, Brouillons, avec confirmation), déplacer (`ds/FilterableListbox`, sélecteur filtrable), spam et non-spam, lu et non lu, étoile ; depuis la lecture (étoile, boutons, menu « Plus »), le survol d'une ligne, le clic droit, la touche menu ou Maj+F10 (`onRowMenu` de `ds/VirtualizedListTable`), la barre de sélection (cases, Maj+clic, Ctrl+A, tout le dossier par `Email/query` + `Email/get` en back-reference), le glisser-déposer vers l'arbre (`ds/DropTarget`) ; vider la Corbeille et le Spam (`Mailbox/clear` si la capability est là, sinon `Email/query` + `Email/set` destroy par back-reference ; sous-dossiers de la Corbeille détruits du plus profond au moins profond) ;
  - **dossiers** : créer (avec l'emplacement), renommer, déplacer, supprimer avec sous-dossiers et emails, tout marquer comme lu, masquer et réafficher, depuis le « + » et le menu d'un dossier (⋮, clic droit, touche menu) ; validation des noms de tmail-flutter ; dossier virtuel « Favoris » (`/starred`) ; team mailboxes dans leur section, droits `myRights` respectés, Corbeille propre à chaque team mailbox ; la capability `urn:apache:james:params:jmap:mail:shares` part dans chaque requête si la session l'annonce (`withExtraCapabilities` sous `JmapSessionProvider`) ; `namespace` et `isSubscribed` lus avec les dossiers, et les propriétés que James omet (`role` d'un dossier personnel) normalisées à `null` ;
  - e2e (Playwright, tags `@mobile` pour les projets téléphone et tablette) : KBD-01, KBD-02, EML-06, 07, 09, 10, 11, 12, 30, 31, MBX-08, 09, 13 (partie spam), 19 à 22, 26 à 30, 01, 02, 03, 06, 07 (partie réception), 10, 15.
- **Phase 3, composer, lots L1 à L3** (PR #17, #20 et celle de L3 ; découpage dans `docs/spikes/composer-tiptap.md`) :
  - **L1, éditeur** : `ds/RichTextEditor` sans `data-testid` en dur (prop `testIds`, valeurs dans `features/composer/editorTestIds.ts`) ; Alt+F10 va à la barre, Échap dans le texte est laissé au conteneur ; barre d'image au clavier (`ImageToolbar` : flèches pour sélectionner, Entrée, 25/50/75 %, taille d'origine, plus petite, plus grande, supprimer) ; `SmartTrailingBlock` repris de Messages (MIT) ; icônes twake-icons quand elles existent ;
  - **L2, fenêtre** : `ComposerProvider` (sous `AppLayout`), `ds/DockedWindow` + `WindowDock` + `fitWindows` (jusqu'à 3 fenêtres en bas à droite, réduites ou plein écran ; plein écran modal sous 1 200 px), `ds/RecipientField` (combobox ARIA 1.2 à chips, collage de listes, adresses invalides nommées, édition et suppression au clavier) et `ds/RecipientSummary`, autocomplétion `TMailContact/autocomplete`, identités (`features/identities/`, `sortOrder` puis l'identité du compte), `useChoose` (trois issues) ;
  - **L3, envoi, brouillons, pièces jointes** : envoi en une requête (`Email/set` dans Drafts + `EmailSubmission/set` avec `onSuccessUpdateEmail` : Sent, `$seen`, plus de `$draft`), l'ancien brouillon détruit dans une 2e requête une fois le message créé ; contrôles de Flutter avant envoi (`useAlert`) ; erreurs `overQuota`, `tooLarge`, `forbiddenMailFrom`, `invalidRecipients` ; brouillon en une requête (`Email/set` create + destroy, `Email/get` de `#draft`), autosave 1,5 s après le dernier changement, en-tête `X-JMAP-Identity`, réouverture depuis Drafts (`$draft` dans la liste), un composer par brouillon (en mémoire + Web Locks entre onglets), « Supprimer le brouillon », toast « Brouillon enregistré » avec « Supprimer » à la fermeture ; instantané `sessionStorage` des composers ouverts au `beforeunload`, restauré après rechargement, oublié à la déconnexion ; pièces jointes par XHR (progression, annulation, renouvellement du jeton sur 401), limites `maxSizeUpload` et `maxSizeAttachmentsPerEmail`, glisser-déposer (`ds/FileDropZone`), liste accessible (`ds/UploadList`) ;
  - e2e : CMP-01, 05, 06, 07, 14 à 18, 22, et 27 à 36 (fenêtre, destinataires, clavier, images, collage, autosave, envoi refusé) ; `INFRA-13` à `INFRA-16` (`tests/backend.spec.ts`) documentent ce que tmail-backend fait des requêtes du composer.
  - La route `/spike/composer` (DEBUG) reste pour la démo de réponse et de transfert (`e2e/spike/quote.spec.ts`, `signature.spec.ts`, `perf.spec.ts`) jusqu'à ce que L4 ouvre une réponse dans le vrai composer.
- **Devbox** : https://mail-react.twake.valmoriq.fr (Tailscale), à jour de `main`. Vérification Playwright rejouable (script hors dépôt, `~/tmp/devbox-check/run.sh`) : login SSO, nom et email, push à 1 000 mails, logout. Client OIDC `twake-mail-react` actif en live seulement (à ajouter par Quentin aux templates LemonLDAP).
- **PR ouvertes ailleurs** : linagora/twake-ui#130 (React 19), linagora/cozy-libs#3165 (twake-i18n React 19). Issue linagora/tmail-backend#2682.
- **Issues et candidats tmail-backend** :
  - `bodyStructure` ignoré à la création (tmail-backend#2685) ;
  - `Email/get` → `serverFail` quand `attachments` précède toute propriété de corps (tmail-backend#2686) ;
  - ~~`Email/set` create+destroy détruit d'abord~~ et ~~pas de back-reference vers un créé~~ : faux, corrigé (`INFRA-14`) ;
  - candidats (en attente d'accord) : `holdFor` appliqué alors que `maxDelayedSend` vaut 0, `undoStatus: canceled` ignoré sans erreur et `EmailSubmission/get` inconnu (pas d'annulation d'envoi possible) ; `forbiddenMailFrom` au lieu de `forbiddenFrom` ; un `identityId` inconnu accepté par `EmailSubmission/set` ;
  - **image memory : `Email/set` en mise à jour** ([linagora/tmail-backend#2684](https://github.com/linagora/tmail-backend/issues/2684), ouverte) : blocage quand (messages des autres comptes) × (ids de la mise à jour) ≈ 256, et une mise à jour de plus de 3 ids au même patch touche tous les messages d'un compte rangés dans une seule boîte. Les comptes e2e détruisent leurs emails en fin de test ; les specs en lot gardent un message dans une seconde boîte. Ne jamais lancer la suite après le seed de perf sans `stop.sh` + `start.sh`.
  - Un état inconnu passé à `Email/changes` donne `invalidArguments`, pas `cannotCalculateChanges`.

## 5. Ce qu'il reste à faire

### Immédiat
- [ ] Une fois twake-ui#130 publié (twake-mui ≥ 9.17, twake-icons ≥ 2.12) : passer l'app en React 19 (react, react-dom et types `^19`).
  - Corriger `FormEvent` dans `BasicLoginPage.tsx` (déprécié en 19.3).
  - Override `twake-i18n` tant que la PR cozy-libs n'est pas publiée.
- [ ] Mettre à jour le lockfile après chaque push sur `jmap-client-ts#v2`, puis `npm approve-scripts jmap-client-ts` (allowScripts épinglé sur le commit), sinon `npm ci` échoue.
- [ ] Proposer à twake-ui les composants de `@/ds/` et les manques de `VirtualizedTable`. Demander à Quentin avant d'ouvrir les PR.
- [ ] Problèmes ouverts des lots :
  - un email qui entre dans un dossier sous la fenêtre chargée n'est pas inséré : il arrive avec la page suivante ;
  - la fenêtre entre le chargement initial et la 1re ouverture du WebSocket n'est pas rattrapée (choix explicite) ;
  - expéditeurs de confiance en `localStorage` : à porter dans les settings JMAP Linagora (`Settings/set`) ;
  - le bloc citation du composer (`ds/RichTextEditor`, iframe `srcdoc`) garde les images distantes du mail cité et peut envoyer l'origine en referrer pour ses fonds CSS ;
  - e2e : le premier test lancé juste après `start.sh` recevait parfois un 401 de James ; `start.sh` attend désormais des appels authentifiés réussis, à surveiller dans les prochaines CI ;
  - e2e, image memory : des `serverFail` (`ConcurrentModificationException`) à l'approvisionnement sous 2 workers, rattrapés par le retry de la CI ; RESP-05 aussi vu une fois en retry.
- [ ] Problèmes ouverts du lot A de la phase 2 :
  - `/` ne déplie pas la recherche repliée des téléphones ;
  - dossiers masqués : réaffichés par un bouton « Afficher les dossiers masqués » de l'arbre (tmail-flutter le fait dans Réglages > Visibilité des dossiers, page absente ici) ;
  - en vue conversation (réglage « Thread » du lot B), la lecture n'a pas encore la barre d'actions de l'email seul ;
  - « Déplacer le contenu du dossier », « Créer un filtre », la recherche dans l'arbre (MBX-04) et la récupération des emails supprimés (MBX-11 à 14) restent à faire ;
  - l'envoi vers une team mailbox depuis l'interface (MBX-07) est possible avec le composer : spec à porter.

### Phase 2 : lecture complète
- ~~Actions : archiver, supprimer, déplacer, spam, non-lu, sélection multiple, glisser-déposer, menu contextuel ; vider la corbeille et le spam (`Mailbox/clear`).~~ Fait (lot A).
- Vue conversation (threads) ; recherche avec suggestions, filtres avancés, tri et surlignage (`SearchSnippet/get`).
- ~~Team mailboxes : capability `urn:apache:james:params:jmap:mail:shares`.~~ Fait (lot A).
- Normalisation de la taille des images (EML-04), bouton de repli des citations (comme le web Flutter).
- ~~CRUD des dossiers.~~ Fait (lot A), sauf « Déplacer le contenu du dossier ».
- Porter les specs correspondantes de `e2e/e2e.md` (MBX, EML, SRCH, THR).

### Phase 3 : composer (le plus risqué)
- ~~L1 éditeur, L2 fenêtre, L3 envoi, brouillons et pièces jointes.~~ Fait.
- **L4, réponse et transfert** : ce qui est prêt : `features/composer/composerSetup.ts` et `quote.ts` (citation atomique, en-têtes localisés, `Re:`/`Fwd:`, `inReplyTo`/`references`, images du mail cité), `ComposerInit` à étendre (`{ reply: { emailId, mode } }`), `sendEmail` qui accepte déjà `inReplyTo`/`references` ; à faire : règles de destinataires (ADR 0064, 0065), `$answered`/`$forwarded` dans la requête d'envoi, boutons de la lecture, specs CMP-08 à 13 depuis `e2e/spike/quote.spec.ts` et `signature.spec.ts`, puis retirer la route `/spike/composer`, `SpikeComposerPage`, `composer.spike.*`, `snapshot.ts` (remplacé par `composerContent.ts`) et l'overlay `spike.sh`.
- **L5, signatures et images** : la signature suit déjà l'identité ; à faire : position, signatures riches, images glissées dans le corps (aujourd'hui le dépôt les attache), cas de collage de Messages.
- **L6, fonctions annexes** : modèles (CMP-19 à 21 : `Save as template` dans le menu Plus, qui existe), MDN (CMP-03), important (CMP-02), rappel de pièce jointe (CMP-04), mailto, Bcc par défaut de l'identité.
- **L7, qualité** : audit RGAA manuel (NVDA, VoiceOver) de la fenêtre, des chips et de la barre d'image ; perf sur gros brouillons ; barre d'outils sur une ligne défilante sur téléphone.
- Problèmes ouverts du composer :
  - une sauvegarde de brouillon refusée (quota) a déjà détruit la version précédente côté serveur (`INFRA-16`) : le contenu reste dans le composer et son instantané ;
  - pas d'annulation d'envoi (voir les candidats tmail-backend) ;
  - un composer masqué par manque de place (`fitWindows`, écran étroit avec 3 composers) n'est joignable qu'en fermant ou réduisant les autres ;
  - une image glissée sur le corps devient une pièce jointe ; l'image inline passe par le bouton ou le collage ;
  - brouillons dans la vue conversation : la ligne ouvre la lecture, pas le composer.

### Phase 4 : réglages et extensions
- Identités, règles (`Filter`), transfert (`Forward`), message d'absence, labels (`Label/*`), restauration de mails supprimés (`EmailRecoveryAction`), quotas, préférences (`Settings`, dont les expéditeurs de confiance), langue.
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
