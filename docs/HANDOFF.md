# Twake Mail React — passation (2026-10-05)

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
- **Point d'entrée `jmap-client-ts/linagora`** (Crash--/jmap-client-ts#1, phase 4) : `Label/*`, `Forward/*`, `Filter/*`, `Settings/*`, `EmailRecoveryAction/*`, `TMailContact/autocomplete`, `PublicAsset/*`, `Mailbox/clear`, `CalendarEvent/parse|accept|reject|maybe`, `CalendarEventAttendance/get` ; `LINAGORA_CAPABILITIES`, `LINAGORA_METHOD_CAPABILITIES` ; `Mailbox.namespace` et `Identity.sortOrder` (James). Programmes TypeScript à part (`src/linagora/tsconfig.json`, `tests/linagora/`) : l'importer rend `methodCapabilities` obligatoire. Types calés sur ce que renvoie tmail-backend (voir ses écarts plus bas). 10 tests d'intégration de plus (stack de test avec le coffre des messages supprimés). Phase 5 (Crash--/jmap-client-ts#2) : `CalendarEventCounter/accept` (avec `counterSupport`), `CalendarEventAttendance/get` typé `eventAttendanceStatus` (la doc de tmail-backend dit `attendanceStatus`), `utcStart`, `utcEnd` et `status` des événements. Non déclaré : `FolderFilteringAction/*`.

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

## 4. État au 2026-10-05 (après les lots 1 à 4, le lot A de la phase 2, les lots L1 à L6 du composer et la phase 4)

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
- **Phase 3, composer, lots L1 à L6** (PR #17, #20, celle de L3, #24 pour le lot 0, #26 pour L4, #27 pour L5, #29, #31 et #33 pour L6 ; découpage dans `docs/spikes/composer-tiptap.md`) :
  - **L1, éditeur** : `ds/RichTextEditor` sans `data-testid` en dur (prop `testIds`, valeurs dans `features/composer/editorTestIds.ts`) ; Alt+F10 va à la barre, Échap dans le texte est laissé au conteneur ; barre d'image au clavier (`ImageToolbar` : flèches pour sélectionner, Entrée, 25/50/75 %, taille d'origine, plus petite, plus grande, supprimer) ; `SmartTrailingBlock` repris de Messages (MIT) ; icônes twake-icons quand elles existent ;
  - **L2, fenêtre** : `ComposerProvider` (sous `AppLayout`), `ds/DockedWindow` + `WindowDock` + `fitWindows` (jusqu'à 3 fenêtres en bas à droite, réduites ou plein écran ; plein écran modal sous 1 200 px), `ds/RecipientField` (combobox ARIA 1.2 à chips, collage de listes, adresses invalides nommées, édition et suppression au clavier) et `ds/RecipientSummary`, autocomplétion `TMailContact/autocomplete`, identités (`features/identities/`, `sortOrder` puis l'identité du compte), `useChoose` (trois issues) ;
  - **L3, envoi, brouillons, pièces jointes** : envoi en une requête (`Email/set` dans Drafts + `EmailSubmission/set` avec `onSuccessUpdateEmail` : Sent, `$seen`, plus de `$draft`), l'ancien brouillon détruit dans une 2e requête une fois le message créé ; contrôles de Flutter avant envoi (`useAlert`) ; erreurs `overQuota`, `tooLarge`, `forbiddenMailFrom`, `invalidRecipients` ; brouillon en deux requêtes depuis le lot 0 (voir plus bas), autosave 1,5 s après le dernier changement, en-tête `X-JMAP-Identity`, réouverture depuis Drafts (`$draft` dans la liste), un composer par brouillon (en mémoire + Web Locks entre onglets), « Supprimer le brouillon », toast « Brouillon enregistré » avec « Supprimer » à la fermeture ; instantané `sessionStorage` des composers ouverts au `beforeunload`, restauré après rechargement, oublié à la déconnexion ; pièces jointes par XHR (progression, annulation, renouvellement du jeton sur 401), limites `maxSizeUpload` et `maxSizeAttachmentsPerEmail`, glisser-déposer (`ds/FileDropZone`), liste accessible (`ds/UploadList`) ;
  - e2e : CMP-01, 05, 06, 07, 14 à 18, 22, et 27 à 36 (fenêtre, destinataires, clavier, images, collage, autosave, envoi refusé) ; `INFRA-13` à `INFRA-16` (`tests/backend.spec.ts`) documentent ce que tmail-backend fait des requêtes du composer.
  - **Lot 0, un brouillon n'est jamais perdu** : la sauvegarde crée la nouvelle version et relit ses blobIds (`Email/set` create + `Email/get` de `#draft`), puis détruit les anciennes dans une 2e requête, seulement si la création a réussi, comme l'envoi. Avant, une création refusée (quota, `tooLarge`) détruisait quand même l'ancienne version (`INFRA-16`), et ses blobs avec, dont dépendaient les images et pièces jointes du composer. Une destruction ratée (réseau, refus) laisse un doublon : ses ids (`leftovers`, gardés dans l'instantané) sont détruits par la sauvegarde suivante, l'envoi, « Supprimer le brouillon » et la fermeture. Conséquence assumée : les deux versions coexistent un instant, un compte au ras du quota ne peut plus réenregistrer un brouillon. ~~Reste non couvert : une 1re requête perdue après la création côté serveur laisse une version dont l'id n'est pas connu.~~ Couvert en L6b (`X-Twake-Draft-Session`, `CMP-47`). Jest (`composeEmail.spec.tsx`, `ComposerForm.spec.tsx`) et `CMP-37`.
  - **L4, répondre, répondre à tous, à la liste, transférer** :
    - points d'entrée : boutons sous l'email et sous chaque message déplié d'une conversation (`ReplyActions`, « Répondre à tous » si l'email touche plus d'une autre adresse, « Répondre à la liste » avec un `List-Post`), menus d'actions (ligne, « Plus », un seul email, pas dans Brouillons), raccourcis de Flutter `r`, `Shift+R`, `f` sur l'email ouvert (listés par `?`) ;
    - destinataires (`replyRecipients.ts`) : règles du code de Flutter (ADR 0064 et 0065), deux écarts voulus : « soi » = le compte et toutes ses identités, sans casse ; « répondre à tous » à son propre message retire aussi soi-même (l'ADR le dit, le code Flutter non) ;
    - préfixes de la langue de l'interface (`Re:`, `Tr:` en français, `Chuyển tiếp:` en vietnamien), pas de doublon avec le préfixe anglais ni le local, comme `EmailUtils.applyPrefix` ;
    - `In-Reply-To` = Message-ID de l'original, `References` = ses `References` puis son Message-ID (ordre RFC 5322 ; Flutter met le Message-ID en tête), un transfert n'a que `References` ;
    - `$answered` ou `$forwarded` sur l'original dans une requête après l'envoi réussi (Flutter le met dans la requête d'envoi, même si la soumission échoue) ; un brouillon de réponse rouvert depuis Brouillons ne connaît plus l'original et ne le marque pas ;
    - citation atomique (`replyContent.ts`, `quote.ts`) : en-tête de réponse ou de transfert localisé, images `cid:` de l'original reprises en parties inline (mêmes blobs), base64 converti en `cid:` à l'envoi, styles du mail cité confinés à la citation ; cadre de la citation chargé en `blob:`, CSP sans contenu distant, sans referrer ; « Modifier le message cité » garde les images distantes sans les charger (`data-blocked-src`, rendu à l'envoi) ;
    - un transfert reprend les pièces jointes (mêmes blobs, retirables), une réponse non ;
    - la réponse s'ouvre sur le texte, destinataires repliés ; un transfert dans « À » ;
    - spike retiré (route, page, `composer.spike.*`, `snapshot.ts`, `composerSetup.ts`, `schemaQuoteExtensions.ts`, `e2e/spike/`, `spike.sh` et son overlay tmail-web, dépendances pixelmatch/pngjs) ; ses specs utiles portées : `CMP-10` à `CMP-12` (signature), `CMP-39` (modifier la citation), `CMP-41` (fidélité de la citation), `PERF-04` (`e2e/perf/composer.perf.ts` : 160 ms du clic au curseur, 7 ms par touche en médiane sur une réponse à 200 Ko, 480 ms et 16 ms avec le CPU ralenti 4 fois) ;
    - e2e : `CMP-08`, `09`, `10` à `13`, `38` à `42`, `EML-14` à `22` (préfixes dans les 4 langues de l'app), `KBD-03`.
  - **L5, signatures et images** :
    - signature HTML nettoyée comme un corps d'email (balises, attributs, CSS de la liste de Flutter), sans feuille de style (elle s'affiche dans la page du composer) ; signature texte échappée, ses lignes gardées (Flutter l'insère brute) ; entre le texte et la citation ; un changement d'identité la remplace en place ; à l'envoi, l'enveloppe `tmail-signature` que Flutter reconnaît ;
    - `PublicAsset` : Flutter ne s'en sert que dans l'éditeur de signature des réglages (images envoyées en blob puis publiées, URL publique dans le HTML) ; le composer n'a rien à faire, les images de signature restent des URL distantes, gardées (`allowRemoteContent`) : à porter avec les réglages d'identité (phase 4) ;
    - une image déposée sur le corps est insérée en ligne là où elle tombe (`FileDropZone` laisse la main à l'éditeur, `isForChild`) ; ailleurs, ou un autre fichier, devient une pièce jointe ;
    - les poignées de redimensionnement de TipTap n'avaient pas de taille : coins visibles au survol et à la sélection, redimensionnement à la souris (`CMP-45`) ; au clavier, `CMP-30` ;
    - collage (Word, Google Docs, LibreOffice, page web, texte brut) : déjà couvert par `CMP-32`, inchangé ;
    - e2e : `CMP-43` à `CMP-45`.
  - **L6b, suivis de L4 et L5** (PR #29) :
    - menu d'une ligne de conversation : répondre, répondre à tous, transférer sur l'email qui la représente (le plus récent du dossier, celui sur lequel la conversation s'ouvre) ; Flutter n'a aucune réponse sur ses lignes (vérifié : menu contextuel et survol), la vue conversation répond à l'email déplié ;
    - deux « Répondre » (même email, même action) ou deux ouvertures du même modèle ramènent le composer ouvert, le focus dans le texte ; Flutter n'a pas de garde ;
    - les lettres des raccourcis se lisent avec `shiftKey` (`shortcutKeyOf`) : Verr. Maj. donne `r`, pas `R` ;
    - `ShortcutsProvider.suspend()` coupe les raccourcis de l'ouverture d'un composer jusqu'à ce que le focus y entre (au plus 10 s) : une touche tapée entre-temps est avalée ;
    - un brouillon de réponse garde l'original dans `X-Twake-Answering: $answered <emailId>` (brouillons seulement, absent du message envoyé) : rouvert depuis Brouillons, l'envoi pose `$answered` ou `$forwarded` (Flutter perd l'original, et même `In-Reply-To`) ;
    - images distantes d'un brouillon rouvert (hors citation et signature) bloquées (`data-blocked-src`), bandeau du lecteur « Afficher » (sans « toujours ») ; rendues telles quelles à l'envoi ;
    - chaque version de brouillon porte `X-Twake-Draft-Session: <uuid du composer>` : après une sauvegarde sans réponse (réseau), la suivante cherche par `Email/query` `header` les versions de ce composer qu'elle ne connaît pas et les détruit (`findStrayVersions`) ;
    - le compteur d'une ligne de conversation ne compte plus la copie dans Envoyés d'un mail à soi-même (`isOwnSentCopy`, partagé avec la vue conversation) ; les actions la visent toujours (ADR 0068) ;
    - e2e : `CMP-40` (étendu : `$answered` posé), `CMP-46`, `CMP-47`, `KBD-04`, `THR-06`.
  - **L6a, fonctions annexes** (PR #31 : options d'envoi ; PR #33 : modèles et mailto) :
    - « Demander un accusé de lecture » et « Marquer comme important » dans le menu « Plus » (`menuitemcheckbox`, toasts de Flutter) : `Disposition-Notification-To` et `Return-Path` = adresse du compte (celle du From pour un brouillon rouvert, comme Flutter), `X-Priority: 1`, `Importance: high`, `Priority: urgent` ; gardés dans les brouillons ; aucun mot-clé ;
    - réglages Linagora lus par `features/settings/serverSettings.ts` (`Settings/get`, défauts de Flutter) : `read.receipts.always` coche l'accusé des nouveaux messages, réponses et transferts ; `display.sender.priority` (vrai par défaut et en cas d'échec) affiche le drapeau. **La phase 4 doit réutiliser ce module pour les bascules (`Settings/set`)** ;
    - lecture (email seul et chaque message déplié d'une conversation) : en-tête présent, pas de `$mdnsent`, pas dans Envoyés → dialogue « Read receipt request » (Oui/Non, `cancelLabel` ajouté à `useConfirm`) ; Oui → `MDN/send` (première identité, `manual-action`/`mdn-sent-manually`/`displayed`, sujet et texte de Flutter) avec `onSuccessUpdateEmail` `$mdnsent`, cache patché ; Non → rien, la question revient (Flutter). Sans la capability MDN, toast « not supported » comme Flutter ;
    - drapeau « important » : liste (icône + « Important » dans le nom du lien de la ligne), conversation et lecture (Flutter : liste seule) ; `WarningCircle` faute d'icône twake-icons ;
    - identité : `Reply-To` posé à l'envoi quand aucun n'est saisi (celui de l'identité, nommé comme elle, sinon l'identité elle-même), jamais dans les brouillons ni les modèles (`createReplyToRecipients`) ; son Bcc ajouté à l'ouverture (nouveau, réponse, transfert, mailto ; pas un brouillon rouvert), remplacé au changement d'identité ;
    - rappel de pièce jointe : mots-clés en dur de Flutter (en, fr, ru, vi, ar ; `attachment_keywords.json` de Flutter est vide, il n'ajoute ou n'exclut que des mots), mots entiers sans casse, sujet + texte écrit, sans la citation (en-tête compris, Flutter le lit), la signature ni les cartes Drive ; images en ligne ignorées ; dialogue de Flutter à l'envoi seulement ;
    - `?` liste aussi les touches d'un message (Ctrl/⌘+Entrée, Ctrl+K, Ctrl+B/I/U, Ctrl+Maj+V, Alt+F10, Échap) ; Flutter : Échap ferme, Ctrl+K ;
    - modèles : « Save as template » range le message dans le dossier Templates (créé au premier enregistrement, nommé comme chez Flutter ; James lui donne seul le rôle `templates`), `$seen` sans `$draft`, sans `X-Twake-*` ni Reply-To automatique ; mise à jour = nouvelle version puis destruction de l'ancienne dans une 2e requête ; les brouillons créés par ce composer sont détruits et l'empreinte marquée sauvée (fermer ne demande rien : écart voulu avec Flutter, qui n'a pas d'autosave). Une ligne du dossier Templates (`isTemplatesMailbox` : rôle, ou dossier personnel de premier niveau nommé Templates) ouvre le composer en nouveau message lié au modèle. Pas de sélecteur « insérer un modèle » : Flutter n'en a pas ;
    - mailto : route `/mailto?uri=mailto:…` (et les champs à côté de `uri`, comme Flutter), RFC 6068 décodé une fois (`+` reste `+`), `to`, `cc`, `bcc`, `subject`, `body` ; corps en **texte** échappé (Flutter l'injecte en HTML) ; la route survit à la connexion (chemin de retour), le composer attend lui-même identités et dossiers ; pas de `registerProtocolHandler` (Flutter non plus) ;
    - correctif push : James omet les propriétés sans valeur (`from`, `to` d'un modèle ou d'un brouillon sans destinataire) ; une conversation d'un tel email n'entrait jamais dans la liste par push ;
    - e2e : `CMP-02`, `CMP-03`, `CMP-04`, `CMP-48`, `KBD-05`, `CMP-19` à `CMP-21`, `CMP-24` (variante web).
- **Phase 4, réglages et extensions** (PR #28 pour l'entrée `jmap-client-ts/linagora`, #30 réglages et identités, #32 règles et transfert, #34 absence, préférences, langue et visibilité des dossiers, #35 libellés, et celle du quota et de la récupération) :
  - **réglages** `/settings/<section>` (`features/settings/`), ouverts par « Paramètres » du menu du compte : sections dans la colonne de gauche sur un ordinateur (« Retour aux e-mails » revient au dossier quitté, `SettingsExitProvider`), liste des sections avec leur description sur téléphone et tablette ; une section absente du serveur est masquée (`sections.ts`, `isAvailable`), son URL renvoie à `/settings` ; titre de section en `h1` focalisé, titre de page `<section> - Paramètres - Twake Mail`. Le réglage Thread et les raccourcis ont quitté le menu du compte ;
  - **identités** (Profils, `Identity/set`) : création, modification (l'adresse ne change plus), suppression (pas celle du compte, `mayDelete`), Reply-To et Bcc (plusieurs adresses, `[]` pour vide car James ignore `null`), signature riche (`ds/RichTextEditor`, `textSignature` tiré du texte), identité par défaut par `sortOrder` (0 pour elle, 100 pour les anciennes, comme Flutter ; radio `select_identity_as_default`) ; images de signature publiées en `PublicAsset` (attribut `public-asset-id` lu par Flutter, liées à l'identité, libérées ou détruites quand elles quittent la signature ; en base64 sans la capability) ;
  - **règles** (`Filter/set` de la liste entière, ids = positions car `Filter/get` n'en donne pas) : conditions From, To, Cc, Recipient, Subject, toutes ou l'une ; actions déplacer, lu, étoile (`markAsImportant`), rejeter (avertissement à la création et à la modification, sans autre action), spam ; ce que le créateur n'affiche pas (mots-clés, transfert, `moveTo`) est gardé. « Créer une règle avec cet e-mail » depuis l'expéditeur d'un email lu seul (`EmailAddressMenu`, menu copier / créer une règle) ;
  - **transfert** (`Forward/set`, toujours avec `localCopy` : tmail-backend refuse un patch partiel) : ajout avec avertissement hors domaine (texte de `FORWARD_WARNING_MESSAGE`, nouvelle variable de `.env.js`, `AppConfigProvider`), bandeau tant qu'une adresse externe est là, « Garder une copie », suppression confirmée ;
  - **absence** (`VacationResponse/set`) : dates et heures locales converties en UTC, fin facultative, sujet, message riche (+ texte) ; désactiver garde le message (Flutter) ; bandeau « Votre répondeur automatique est activé » sur tous les écrans avec « Terminer maintenant » ; une absence dont la fin est passée est désactivée à l'ouverture ;
  - **préférences** : `read.receipts.always`, `display.sender.priority` (`Settings/set` en patch `settings/<clé>`, sur `serverSettings.ts` du lot L6), Thread et « Visibilité des libellés » (locales) ;
  - **langue** : appliquée à chaud (`useLanguage` de `I18nProvider`), gardée dans le navigateur et dans `language` du compte, qui l'emporte une fois lu (`ServerLanguageSync`) ; section masquée si le serveur la rend en lecture seule (cas de la devbox) ;
  - **visibilité des dossiers** : dossiers personnels et team mailboxes, Masquer / Afficher par les actions de dossier existantes ;
  - **libellés** (`features/labels/`) : section de la barre latérale (création, modification, suppression, couleur parmi les 20 de Flutter, `ds/ColorSwatchPicker`), vue `/label/<id>` (`hasKeyword`, dossier de chaque email), « Labelliser » depuis les menus et la sélection (modale à cases, création sur place), puces (`ds/ColorTag`, texte noir ou blanc selon le contraste) sur les lignes et sous le sujet (× pour retirer), push `Label` suivi par `Label/changes` (rechargement si l'état est inconnu), recherche avancée par libellé ;
  - **quota** (`Quota/get`, octets) : jauge en bas de la barre latérale (couleur d'alerte au `warnLimit`, rafraîchie par le push des emails), bandeau au seuil d'alerte ou plein, Réglages > Stockage ;
  - **récupération** (`EmailRecoveryAction`) : « Récupérer les messages supprimés » du menu de la Corbeille, formulaire de Flutter (périodes de suppression dans l'horizon du coffre, période de réception, objet, expéditeur, destinataires, pièces jointes ; pas de plage personnalisée), suivi toutes les 2 s avec un bandeau, toast « N messages récupérés » avec « Ouvrir » vers le dossier « Récupérés » (rôle `restored messages`) ;
  - e2e : `SET-01` à `SET-09`, `RULE-01`, `RULE-02`, `LBL-01` à `LBL-12`, `SRCH-07`, `SRCH-08`, `MBX-11`, `MBX-13`, `MBX-14`, `MBX-18` (stack de la phase : projet `twakemail-p4`, 127.0.0.1:18980-18982) ;
  - écarts voulus avec Flutter : identité du compte listée et modifiable (Flutter la masque) ; Reply-To et Bcc libres et multiples ; bouton « Enregistrer » du créateur de règles en modification ; pas d'ajout d'action à côté de « Rejeter » ; jauge de stockage toujours visible (Flutter : au-delà de 80 %) ; libellés appliqués après « Ajouter un libellé » dans la modale (Flutter applique au clic sur mobile) ;
  - vérifié sur la devbox (scripts `~/tmp/devbox-check/{settings,rules,p4c,p4d}-check.mjs`, état initial relevé puis restauré par JMAP) : une identité créée, mise par défaut puis supprimée (ordre `sortOrder` restauré) ; une règle créée puis supprimée ; transfert lu seulement ; « Afficher l'importance » basculé puis remis ; absence programmée en 2099 (bandeau « sera activé le… ») puis désactivée et vidée ; visibilité des dossiers lue ; un libellé créé, posé sur un email, retiré, supprimé (mot-clé nettoyé) ; menu de récupération lu, aucune récupération lancée.
- **Phase 5, écosystème** (PR #71 invitations, #72 grille d'apps et Workplace, #74 sélecteur Drive, et celle de l'assistant IA ; stack de la phase : projet `twakemail-p5`, 127.0.0.1:18990-18992) :
  - **invitations calendrier** (`features/calendar/`, `ds/EventCard`) : carte « Orange Bar » de tmail-flutter (#4623, #4831, #4851 ; la « Blue Bar » est abandonnée) au-dessus du corps d'un email portant un `.ics` (préféré) ou une partie `text/calendar` ; `CalendarEvent/parse` + `CalendarEventAttendance/get` en une requête (`requestSettled` : sans CalDAV l'attendance échoue, la carte reste) ; badge d'état coloré (invité, mis à jour, annulé, accepté, peut-être, refusé, contre-proposition), quand (fuseau de l'utilisateur, journée entière, plusieurs jours) et récurrence lisible (Flutter ne l'affiche pas), où (liens), lien de visio affiché et copié (pas de « Join » : tmail-flutter#4622), organisateur puis tous les invités avec leur réponse (repliés au-delà de 6), description en texte après la carte ; Oui / Peut-être / Non (`aria-pressed`, langue de l'UI si le serveur l'a), Oui seul sur un `COUNTER` (`CalendarEventCounter/accept`), « Écrire aux invités » (composer, sujet `Re: <titre>`), « Voir dans votre Agenda » vers `<CALENDAR_SPA_URL>/events/<uid>` (route de Twake Calendar ; `buildCalendarEventUrl` de twake-utils ne fait que `/newEvent`) ; « Plus d'options » n'existe ni dans Flutter ni dans le design system, non porté ; couleurs du design assombries pour l'AA (voir `docs/twake-mui-gaps.md`) ;
  - **grille d'apps** : `link` et `icon` de `appList.js` en URI templates (`{localpart}`, `{workplaceFqdn…}`), résolus avec le claim `workplaceFqdn` du SSO ou `WORKPLACE_FQDN_FALLBACK` (le Drive de chaque utilisateur) ; tmail-flutter web lit sa grille dans `app_dashboard.json`, pas dans `.well-known/linagora-ecosystem` (mobile seulement), que la devbox ne sert d'ailleurs pas (404) ;
  - **Workplace** : `WORKPLACE_EMBEDDING` ; dans une iframe (`isInIframe` de cozy-external-bridge, comme l'`EmbeddingContext` de Calendar), ni logotype ni grille, l'avatar devient un engrenage ;
  - **Drive** (`features/drive/`, `ds/FramedDialog`, issue #42) : `TDRIVE_ENABLED`, `TDRIVE_INTENT_URL` (URI template), OIDC seulement ; `token_exchange` de l'ID token (un essai de plus après refresh), intent `PICK io.cozy.files` par `fetch` (protocole de cozy-interapp écrit à la main, sans sa dépendance), messages acceptés seulement de l'origine de l'intent, de sa frame, avec son id ; « lien » = carte Drive de Flutter (`a.tmail-file-link-card`, bloc `drive-card`), « pièce jointe » = téléchargement puis upload JMAP habituel ; pas de chemin par le bridge cozy (Flutter l'utilise dans Workplace), pas d'upload-from-url ;
  - **IA** (`features/scribe/`, `ScribeMenu`) : derrière `com:linagora:params:jmap:aibot` (`scribeEndpoint`), menu et prompts de Flutter, réponse dans un dialogue (Insérer, Remplacer la sélection, Réessayer, Annuler) ; la capability n'est annoncée ni par l'image memory ni par la devbox : rien n'a été envoyé à une IA, e2e avec doubles ;
  - **paywall** : capability `saas` absente (memory et devbox), hors périmètre ; Flutter l'affiche seulement dans Cozy (`isPaying`, `canUpgrade`, `/settings/premium` du Workplace ou `paywallUrlTemplate` de l'écosystème) ;
  - e2e : `CAL-01` à `CAL-05` (`CAL-06`, `CAL-07` en `fixme` : l'image memory n'a pas d'esn-sabre, `CalendarEvent/accept` répond `serverFail`), `APPGRID-01`, `APPGRID-02`, `DRIVE-01` à `DRIVE-03` (mode OIDC : `E2E_OIDC=1 E2E_APP_ENV=docker/app-env-oidc.js`, sautées sinon, donc pas en CI par défaut), `AI-01`, `AI-02` ;
  - vérifié sur la devbox (`~/tmp/devbox-check/p5a-check.mjs`, `p5b-check.mjs`) : une invitation de user1 à user1 seul, carte affichée, « Oui » → `accepted` (attendance relue), lien « Voir dans votre Agenda » ouvert dans Twake Calendar sur l'événement ; puis les 2 emails détruits et l'événement supprimé de l'agenda de user1 ; « Invitation CalDavCollect » non touchée (`needsAction`) ; grille : Drive résolu en `https://user1-drive.twake.valmoriq.fr`. Sélecteur Drive non vérifiable sur la devbox (voir plus bas).
- **Devbox** : https://mail-react.twake.valmoriq.fr (Tailscale), à jour de `main` ; `config/.env.js` a `CALENDAR_SPA_URL`, `config/appList.js` le Drive en template. Vérification Playwright rejouable (script hors dépôt, `~/tmp/devbox-check/run.sh`) : login SSO, nom et email, push à 1 000 mails, logout. Réponse de L4 vérifiée le 2026-10-05 (`SCRIPT=reply-check.mjs ./run.sh`, étapes `pick`, `reply`, `read`, `flutter`, `cleanup`) : une réponse de user1 à un mail de sa boîte, adressée à lui-même, reçue avec `In-Reply-To` et `References` du mail cité, citation rendue dans React et dans tmail-web (citation repliée « ••• » puis dépliée) ; `$answered` posé sur l'original seul, puis retiré, la réponse détruite. Le serveur refuse un `Email/get` de plus de 5 emails avec leurs corps (`requestTooLarge`). L6 vérifié le 2026-10-05 (`SCRIPT=l6-check.mjs ./run.sh`, étapes `send`, `react`, `flutter`, `cleanup`) : un seul mail de user1 à lui-même depuis le composer React, accusé demandé et important, reçu avec `Disposition-Notification-To`, `X-Priority: 1`, `Importance: high`, `Priority: urgent` et le `Reply-To` de l'identité ; React : drapeau dans la liste, ligne « Moi » sans « (2) », dialogue d'accusé (répondu Non) ; tmail-web : drapeau dans la liste, son propre dialogue d'accusé (répondu Non) ; copies de Réception et d'Envoyés détruites, aucun accusé parti. Client OIDC `twake-mail-react` actif en live seulement (à ajouter par Quentin aux templates LemonLDAP).
- **PR ouvertes ailleurs** : linagora/twake-ui#130 (React 19), linagora/cozy-libs#3165 (twake-i18n React 19). Issue linagora/tmail-backend#2682.
- **Issues et candidats tmail-backend** :
  - `bodyStructure` ignoré à la création (tmail-backend#2685) ;
  - `Email/get` → `serverFail` quand `attachments` précède toute propriété de corps (tmail-backend#2686) ;
  - ~~`Email/set` create+destroy détruit d'abord~~ et ~~pas de back-reference vers un créé~~ : faux, corrigé (`INFRA-14`) ;
  - candidats (en attente d'accord) : `holdFor` appliqué alors que `maxDelayedSend` vaut 0, `undoStatus: canceled` ignoré sans erreur et `EmailSubmission/get` inconnu (pas d'annulation d'envoi possible) ; `forbiddenMailFrom` au lieu de `forbiddenFrom` ; un `identityId` inconnu accepté par `EmailSubmission/set` ;
  - **image memory : `Email/set` en mise à jour** ([linagora/tmail-backend#2684](https://github.com/linagora/tmail-backend/issues/2684), ouverte) : blocage quand (messages des autres comptes) × (ids de la mise à jour) ≈ 256, et une mise à jour de plus de 3 ids au même patch touche tous les messages d'un compte rangés dans une seule boîte. Les comptes e2e détruisent leurs emails en fin de test ; les specs en lot gardent un message dans une seconde boîte. Ne jamais lancer la suite après le seed de perf sans `stop.sh` + `start.sh`.
  - Un état inconnu passé à `Email/changes` donne `invalidArguments`, pas `cannotCalculateChanges`.
  - `Email/get` omet les propriétés sans valeur (`from`, `to` vides, `name` nul d'une adresse) au lieu de les rendre à `null` (RFC 8620 §5.1) : l'app les traite comme nulles (L6). Candidat à une issue (en attente d'accord).
  - Un dossier créé sous le nom « Templates » reçoit seul le rôle `templates` (pratique, mais non standard : RFC 8621 ne définit pas ce rôle).
  - Candidats de la phase 4 (en attente d'accord) :
    - `Identity/set` en mise à jour ignore `replyTo: null` et `bcc: null` (RFC : retour à la valeur par défaut) ; l'app envoie `[]` ;
    - `Forward/set` refuse un patch sans `localCopy` (« Missing '/localCopy' property ») ;
    - `Label/set` en mise à jour refuse `color: null` : on ne peut pas retirer la couleur d'un libellé ;
    - `Filter/get` ne renvoie pas l'`id` des règles, que `Filter/set` exige ;
    - `EmailRecoveryAction/get` et `/set` sans `accountId` ni `state` ; statuts `completed` et `canceled` (la doc dit `done`) ; `maxEmailRecoveryPerRequest` en chaîne (`"5"`) ;
    - `PublicAsset.publicURI` contient le nom d'utilisateur là où la doc dit l'id du compte ;
    - `Label/changes` répond `invalidArguments` à un état inconnu (pas `cannotCalculateChanges`) ;
    - les candidats ci-dessus valent pour toute image (lus dans les sources de tmail-backend : `FilterSet.scala`, `EmailRecoveryAction.scala`, `PublicAssetGetRequest.scala`, ou constatés aussi sur la devbox 1.0.19.1) ; les deux suivants n'ont été vus que sur l'image memory :
    - image memory : `Email/query` `{hasKeyword: <libellé>}` renvoie aussi la copie Envoyés d'un email à soi-même, qui n'a pas le mot-clé ; `Email/query` `{subject}` ne trouve pas certains sujets (« Email 1 subject Tag 1 », « Mail 1 of Tag 1 ») ;
    - doc des extensions : rôle `restored messages` du dossier de récupération à documenter (Flutter cherche aussi `Restored-Messages`).
  - Candidats de la phase 5 (en attente d'accord) :
    - doc `calendarEventReply.adoc` : `CalendarEventAttendance/get` renvoie `eventAttendanceStatus`, pas `attendanceStatus` ;
    - image memory : `CalendarEvent/accept|maybe|reject` et `CalendarEventAttendance/get` répondent `serverFail` (« Failed to resolve 'esn_sabre' ») alors que la capability annonce `counterSupport: true` et `supportFreeBusyQuery: true` ;
    - `CalendarEvent/parse` renvoie `participationStatus` tel qu'écrit dans le fichier (`NEEDS-ACTION`, `TENTATIVE`) et non en minuscules comme la doc ;
    - twake-utils : un `buildCalendarEventUrl` vers `/events/<uid>` (il ne fait que `/newEvent`) ;
    - twake-calendar-frontend : le `stop` de l'intent Drive est pris sur la promesse de `create()` et non de `start()`, l'iframe et son écouteur ne sont jamais détruits ;
    - linagora-design-flutter / tmail-flutter : couleurs de la carte d'événement sous l'AA (pastilles #0A84FF, orange #F67E35 sous texte blanc, libellés à 64 %).
  - **Image memory : détruire deux emails dans un même `Email/set`** retire les autres emails de leur dossier des résultats d'`Email/query`, alors qu'`Email/get` et `Email/changes` les voient (`INFRA-17`, proche de #2684). `CMP-37` lit donc les brouillons par `Email/changes`. Candidat à une issue (en attente d'accord).

## 5. Ce qu'il reste à faire

### Immédiat
- [ ] React 19 une fois twake-ui#130 publié (twake-mui ≥ 9.17, twake-icons ≥ 2.12) → [#63](https://github.com/Crash--/twake-mail-frontend/issues/63). `twake-i18n` 0.6.0 (cozy-libs#3165) accepte déjà React 19 : plus d'override à prévoir.
- [ ] Mettre à jour le lockfile après chaque push sur `jmap-client-ts#v2`, puis `npm approve-scripts jmap-client-ts` (allowScripts épinglé sur le commit), sinon `npm ci` échoue.
- [ ] Proposer à twake-ui les composants de `@/ds/` et les manques de `VirtualizedTable`. Demander à Quentin avant d'ouvrir les PR → [#64](https://github.com/Crash--/twake-mail-frontend/issues/64).
- [ ] Ouvrir (après accord de Quentin) l'issue tmail-backend du candidat `INFRA-17` (image memory : deux emails détruits dans un `Email/set` font disparaître le reste du dossier d'`Email/query`), et demander à twake-icons `ReplyAll` et `Forward` ([#64](https://github.com/Crash--/twake-mail-frontend/issues/64)).
- [ ] Problèmes ouverts des lots :
  - synchronisation : un email qui entre dans un dossier sous la fenêtre chargée n'est pas inséré ; la fenêtre entre le chargement initial et la 1re ouverture du WebSocket n'est pas rattrapée ; dans la recherche groupée, un email d'un autre fil relance la requête (limite de 256 lignes) → [#43](https://github.com/Crash--/twake-mail-frontend/issues/43) ;
  - expéditeurs de confiance en `localStorage` : à porter dans les settings JMAP Linagora (`Settings/set`) → [#44](https://github.com/Crash--/twake-mail-frontend/issues/44) ;
  - ~~le bloc citation du composer garde les images distantes du mail cité~~ : corrigé en L4 (`CMP-38`) ;
  - e2e : 401 de James après `start.sh` (à surveiller), `serverFail` d'approvisionnement de l'image memory sous 2 workers, RESP-05 vu une fois en retry → [#66](https://github.com/Crash--/twake-mail-frontend/issues/66).
- [ ] Problèmes ouverts du lot A de la phase 2 :
  - ~~`/` ne déplie pas la recherche repliée des téléphones~~ : corrigé ([#45](https://github.com/Crash--/twake-mail-frontend/issues/45), PR #82, `KBD-06`) ;
  - ~~dossiers masqués sans page de réglage~~ : Réglages > Visibilité des dossiers (phase 4) ;
  - en vue conversation (réglage « Thread » du lot B), la lecture n'a pas encore la barre d'actions de l'email seul → [#46](https://github.com/Crash--/twake-mail-frontend/issues/46) ;
  - « Déplacer le contenu du dossier », « Créer un filtre » depuis le menu d'un dossier (Flutter pré-remplit l'action) et la recherche dans l'arbre (MBX-04) restent à faire → [#47](https://github.com/Crash--/twake-mail-frontend/issues/47) ; ~~la récupération des emails supprimés (MBX-11 à 14)~~ : faite (MBX-12 reste N/A web) ;
  - l'envoi vers une team mailbox depuis l'interface (MBX-07) est possible avec le composer : spec à porter → [#48](https://github.com/Crash--/twake-mail-frontend/issues/48).

### Phase 2 : lecture complète
- ~~Actions : archiver, supprimer, déplacer, spam, non-lu, sélection multiple, glisser-déposer, menu contextuel ; vider la corbeille et le spam (`Mailbox/clear`).~~ Fait (lot A).
- ~~Vue conversation (threads) ; recherche avec suggestions, filtres avancés, tri et surlignage (`SearchSnippet/get`).~~ Fait (PR #7, #9, #23).
- ~~Team mailboxes : capability `urn:apache:james:params:jmap:mail:shares`.~~ Fait (lot A).
- ~~URL et adresses nues non cliquables dans le lecteur~~ : corrigé, liens posés sur le DOM nettoyé (`linkifyjs`, déjà embarqué par TipTap), les `mailto:` du corps ouvrent le composer ([#70](https://github.com/Crash--/twake-mail-frontend/issues/70), PR #81, `EML-34`).
- Normalisation de la taille des images (EML-04), bouton de repli des citations (comme le web Flutter) → [#49](https://github.com/Crash--/twake-mail-frontend/issues/49).
- ~~CRUD des dossiers.~~ Fait (lot A), sauf « Déplacer le contenu du dossier » ([#47](https://github.com/Crash--/twake-mail-frontend/issues/47)).
- Porter les specs correspondantes de `e2e/e2e.md` (MBX, EML, SRCH, THR).

### Phase 3 : composer (le plus risqué)
- ~~L1 éditeur, L2 fenêtre, L3 envoi, brouillons et pièces jointes.~~ Fait.
- ~~**L4, réponse et transfert**~~ : fait (voir plus haut).
- ~~**L5, signatures et images**~~ : fait (voir plus haut).
- ~~**L6, fonctions annexes**~~ : fait (voir plus haut).
- **L7, qualité** : audit RGAA manuel (NVDA, VoiceOver) de la fenêtre, des chips et de la barre d'image ; perf sur gros brouillons → [#65](https://github.com/Crash--/twake-mail-frontend/issues/65) ; barre d'outils sur une ligne défilante sur téléphone → [#55](https://github.com/Crash--/twake-mail-frontend/issues/55).
- Problèmes ouverts du composer :
  - ~~une sauvegarde de brouillon refusée (quota) a déjà détruit la version précédente côté serveur (`INFRA-16`)~~ : corrigé (lot 0, `CMP-37`) ;
  - pas d'annulation d'envoi (voir les candidats tmail-backend) → [#56](https://github.com/Crash--/twake-mail-frontend/issues/56) ;
  - ~~un composer masqué par manque de place n'est joignable qu'en fermant ou réduisant les autres~~ : corrigé, menu « +N messages » au début du dock ou dans la barre de titre du composer plein écran ([#50](https://github.com/Crash--/twake-mail-frontend/issues/50), PR #85, `CMP-49`) ;
  - ~~une image glissée sur le corps devient une pièce jointe~~ : corrigé en L5 (`CMP-44`) ;
  - ~~brouillons dans la vue conversation : la ligne ouvre la lecture, pas le composer~~ : corrigé, marque « Brouillon », boutons « Modifier » et « Supprimer le brouillon » ; un brouillon ne demande plus d'accusé de lecture ([#51](https://github.com/Crash--/twake-mail-frontend/issues/51), PR #86, `THR-09`) ;
  - ~~deux « Répondre » sur le même email ouvrent deux composers ; `R` part aussi avec Verr. Maj.~~ : corrigé en L6b (`KBD-04`) ;
  - L4 : ~~le menu d'une ligne de conversation n'offre pas de réponse~~, ~~le `Reply-To` de l'identité n'est pas posé~~, ~~les images distantes d'un brouillon rouvert se chargent~~, ~~une touche tapée pendant l'ouverture part aux raccourcis~~ : corrigés en L6. Reste : Flutter n'ajoute pas l'identité qui a reçu l'email, nous non plus (identité par défaut) → [#39](https://github.com/Crash--/twake-mail-frontend/issues/39) ;
  - L6 :
    - ~~une réponse rechargée dont l'autosave est passée rouvre dans « À »~~ : corrigé, l'instantané garde `opensOn` ([#52](https://github.com/Crash--/twake-mail-frontend/issues/52), PR #88, `CMP-50`). Reste à trancher : un brouillon de réponse rouvert depuis Brouillons s'ouvre toujours dans « À » ;
    - ~~plusieurs messages d'une conversation demandant un accusé : chaque dialogue remplace le précédent~~ : corrigé, option `queue` de `ConfirmProvider` ([#53](https://github.com/Crash--/twake-mail-frontend/issues/53), PR #89, `THR-10`). Les dialogues successifs ont le même texte : y nommer l'expéditeur aiderait ;
    - l'accusé part avec la première identité ; Flutter prend celle de la team mailbox quand l'email y est → [#39](https://github.com/Crash--/twake-mail-frontend/issues/39) ;
    - le dossier Templates d'une team mailbox n'est pas utilisé (modèles personnels seulement) ; deux composers qui créent le premier modèle avant que le push n'apporte le dossier en créent deux → [#54](https://github.com/Crash--/twake-mail-frontend/issues/54) ;
    - « Save as template » d'un composer ouvert sur un brouillon garde le brouillon (seuls ceux créés par ce composer sont détruits) → [#54](https://github.com/Crash--/twake-mail-frontend/issues/54) ;
    - pas de sélecteur « insérer un modèle » ni de modèle depuis la recherche (Flutter ouvre la lecture) → [#54](https://github.com/Crash--/twake-mail-frontend/issues/54) ;
    - ~~`display.sender.priority` et `read.receipts.always` pas encore modifiables~~ : Réglages > Préférences (phase 4) ;
    - le Reply-To automatique (identité) part sur tous les messages, comme Flutter : une réponse à un de ses propres messages le lit et vise bien les destinataires d'origine (règles de `replyRecipients`).

### Phase 4 : réglages et extensions
- ~~Identités, règles, transfert, absence, libellés, récupération, quota, préférences, langue, entrée `jmap-client-ts/linagora`~~ : faits (voir plus haut).
- Reste, problèmes ouverts :
  - expéditeurs de confiance des images distantes toujours en `localStorage` : aucune clé `Settings` documentée par tmail-backend, à convenir avant de les y mettre → [#44](https://github.com/Crash--/twake-mail-frontend/issues/44) ;
  - transfert : pas d'autocomplétion des contacts ni de sélection multiple pour retirer (Flutter les a) → [#57](https://github.com/Crash--/twake-mail-frontend/issues/57) ;
  - règles : pas de réordonnancement (Flutter non plus), pas de condition `sentDate` / en-tête (affichées telles quelles si un autre client les a posées) → [#58](https://github.com/Crash--/twake-mail-frontend/issues/58) ;
  - vue conversation (réglage Thread, par défaut) : les libellés de la conversation sont sous son sujet (× les retire de tous ses emails), mais un message déplié n'a ni ses propres puces ni le menu de l'adresse de l'expéditeur (« Créer une règle avec cet e-mail » seulement dans la lecture d'un email seul) → [#46](https://github.com/Crash--/twake-mail-frontend/issues/46) ;
  - libellés : pas de couleur personnalisée (sélecteur de Flutter), la couleur d'un libellé ne peut pas être retirée (backend) → [#59](https://github.com/Crash--/twake-mail-frontend/issues/59) ;
  - récupération : pas de plage de dates personnalisée ([#60](https://github.com/Crash--/twake-mail-frontend/issues/60)) ; `maxEmailRecoveryPerRequest` non affiché (Flutter non plus) ;
  - ~~absence : l'éditeur reste modifiable quand la réponse est coupée~~ : corrigé, prop `disabled` de `ds/RichTextEditor` ([#61](https://github.com/Crash--/twake-mail-frontend/issues/61), PR #90, `SET-08`) ;
  - backend distribué (devbox) : l'index de recherche suit les mots-clés avec un délai ; la vue d'un libellé ouverte juste après « Labelliser » peut être vide jusqu'au rechargement (le push ne rafraîchit pas encore les listes de recherche sur ce cas) → [#67](https://github.com/Crash--/twake-mail-frontend/issues/67) ;
  - devbox : `Quota/get` ne renvoie aucun quota pour user1, la jauge est absente et Réglages > Stockage dit « Pas de limite de stockage pour ce compte » ;
  - langue : seulement en, fr, ru, vi (Flutter en a 9) → [#62](https://github.com/Crash--/twake-mail-frontend/issues/62) ;
  - langue : section masquée quand le serveur met `language` en lecture seule (Flutter aussi), comportement à confirmer → [#68](https://github.com/Crash--/twake-mail-frontend/issues/68) ;
  - e2e flakies sous charge locale (passent seuls et en CI) : `THR-05`, `CMP-12`, `MBX-21`, `CMP-04` ; à 4 workers, `Email/import` perd parfois son blob (`EML-17`, `CMP-39`) → [#66](https://github.com/Crash--/twake-mail-frontend/issues/66).

### Phase 5 : écosystème
- ~~Invitations calendrier, grille d'apps, iframe Workplace, sélecteur Drive (#42), assistant IA~~ : faits (voir plus haut). Paywall : hors périmètre tant que `saas` n'est pas annoncée.
- Problèmes ouverts :
  - Drive sur la devbox : `app_token_exchange` `twake-mail-react` → `registry://mail` est configuré, mais le cozy-stack refuse toujours `POST /auth/token_exchange` depuis `https://mail-react.twake.valmoriq.fr` (pré-requête CORS `OPTIONS` en 403, `POST` en 403 `{"error":"the origin of this application is not allowed"}`). Il n'accepte que l'origine de l'app du `software_id` (`https://mail.twake.valmoriq.fr` et `https://calendar.twake.valmoriq.fr` répondent 204) : servir le webmail React sur `mail.<domaine>`, ou faire accepter cette origine au cozy-stack. Sélecteur non testable de bout en bout d'ici là ;
  - Drive dans Workplace sans OIDC (bridge `fetchJSON` comme Flutter) et upload-from-url (`com:linagora:params:jmap:upload:from-url`, absente de la devbox) non faits ;
  - invitations : `CAL-06` et `CAL-07` à faire tourner sur une stack avec esn-sabre ; « Plus d'options » non défini ; statut des invités affiché (Calendar le fait, la carte Flutter non) ; une seule carte par email (premier événement du premier blob, comme Flutter) ;
  - IA : pas de réglage utilisateur pour masquer l'assistant (Flutter en a un), pas de bouton dans la sélection ni de copie du résultat ; à vérifier sur un serveur qui annonce `aibot` (destination = `scribeEndpoint` de la session) ;
  - Workplace : pas de synchronisation de route avec le conteneur (Calendar non plus) ;
  - e2e Drive : un job CI en mode OIDC les ferait tourner.

### Phase 6 : parité et bascule
- Les 110 scénarios web de `e2e/e2e.md` portés et verts en CI.
- Audit RGAA manuel (NVDA, VoiceOver) et déclaration d'accessibilité.
- Image Docker publiée par la CI (non-root, rootfs en lecture seule), `docker-compose` d'exemple, chart Helm ou manifests Kubernetes, documentation de déploiement → [#41](https://github.com/Crash--/twake-mail-frontend/issues/41).
- Bêta derrière un flag, test interne, puis gel du web Flutter.
- Sujet produit à régler avec l'équipe : gel ou double implémentation du web Flutter pendant la réécriture.

### Plus tard / non prioritaire
- Détection des pièces jointes oubliées plus fine (langue du message, expressions, négation, URL, liens Drive, mots-clés configurables) : non planifiée → [#40](https://github.com/Crash--/twake-mail-frontend/issues/40).

## 6. Repères

- Skills Twake : plugin `twake-guidelines@twake-guidelines`, installé pour l'utilisateur. Sources dans `~/.claude/plugins/marketplaces/twake-guidelines/skills/`.
- Règles du dépôt : `AGENTS.md`. Interface du client : `jmap-client-ts/docs/v2-api.md`. Contrat des `data-testid` : `e2e/pages/README.md`.
- Commits en Conventional Commits, terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Machine de dev :
  - ne jamais toucher aux conteneurs d'autres environnements (`tmail-backend`, `tmail-web`, `e2e-*` de Drive, `lemonldap`…) ;
  - publier uniquement sur 127.0.0.1 ;
  - ports 80, 8080, 8090, 5984 et 6060 déjà pris ; ce projet utilise 18100-18101 (tests du client), 18200 (dev), 18300-18302 (e2e), 18400-18401 (repro du bug backend), 18980-18982 (stack e2e de la phase 4, projet `twakemail-p4`) et 18990-18992 (phase 5, projet `twakemail-p5`).
- Node 24 : `source ~/.nvm/nvm.sh && nvm use 24`.
