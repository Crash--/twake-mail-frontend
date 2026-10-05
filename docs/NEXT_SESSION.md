# Reprendre le projet dans une nouvelle session (état au 2026-10-05)

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
| Référence Flutter | `~/.paseo/worktrees/1d578va0/sharp-mouse` (worktree de tmail-flutter, à jour avec la Orange Bar) |
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
- React 18 tant que **linagora/twake-ui#130** (React 19, approuvée) n'est pas publiée ; `twake-i18n` 0.6.0 accepte déjà React 19 (cozy-libs#3165 mergée).
- Workflow : **une branche + une PR par lot sur `Crash--/twake-mail-frontend`, merge en rebase quand la CI est verte**, puis redéploiement démo (`deploy.sh`). Conventional Commits, trailer `Co-Authored-By: Claude …`.
- Issues : Quentin en crée souvent en cours de route → les créer sur **notre** dépôt (anglais, checklist, labels existants).
  **Rien d'externe** (tmail-backend, twake-ui, Drive…) sans son feu vert.
- **Les 20 candidats tmail-backend restent en attente** (déjà ouvertes : #2682, #2684, #2685, #2686). Ne rien ouvrir.
- **#40 (détection de pièce jointe) : ne pas implémenter** (low priority).
- Registre d'images : **Docker Hub** retenu, mais **en attente** du username de Quentin (variable `IMAGE_REPOSITORY`) et de ses secrets `REGISTRY_USERNAME` / `REGISTRY_PASSWORD`. `ghcr.io/crash--` est un nom OCI invalide.
- Lien public créé par l'intent Drive : Quentin considère que c'est géré par les options passées à l'intent (voir le rapport de la PR #97 pour le détail des options).

## 4. État au moment de la passation

- `main` = `16f7cbc`, CI verte, aucune PR ouverte, aucun worktree, déployé sur la démo.
- **Issues ouvertes** (`gh issue list -R Crash--/twake-mail-frontend`) : 23, dont
  - nouvelles de Quentin à traiter : **#93** composer qui clignote en naviguant (piste : View Transitions), **#95** défiler vers le message à lire dans une conversation, **#96** (question) affichage de la recherche avec les conversations, **#98** Favoris placé entre la boîte de réception et ses sous-dossiers, **#92** sidebar trop étroite ;
  - améliorations : #44, #47, #48 (spec MBX-07), #54, #55 (barre d'outils mobile du composer), #57–#60, #62 ;
  - bloquées en amont : #56 (annulation d'envoi), #63 (React 19), #64 (suivi twake-ui), #66 (flakes e2e image memory) ;
  - questions : #67, #68 ; audit RGAA manuel : #65 ; non prioritaire : #40.
- Démo : Drive activé (`TDRIVE_ENABLED`), app embarquée dans le Workplace de `user1` (`https://user1-mail.twake.valmoriq.fr`).
  Le sélecteur Drive corrigé par la PR #97 **n'a pas été vérifié avec le vrai Drive** (identifiants refusés à l'agent) : à tester à la main.

## 5. Prochain chantier : le design (demandé par Quentin)

1. **Vérifier que les outils Figma sont chargés** (serveur MCP `figma` en scope utilisateur, `https://mcp.figma.com/mcp`,
   authentifié) : `ToolSearch` « figma » doit renvoyer des outils `mcp__figma__*`. Sinon, demander à Quentin de relancer la
   session après `/mcp` → figma → Authenticate. Les sous-agents n'ont les outils que s'ils existent dans la session principale.
2. **Lire le design** : fichier **Teammail 1.1**
   https://www.figma.com/design/XqLqMINlZw09BdEHI8yLb9/Teammail---1.1?node-id=9152-12 (nœud donné par Quentin), puis ses pages
   de composants et ses variables (couleurs, typographie, espacements, rayons, ombres). Autre fichier vu : *Cozy new UI*
   `NYgsH6s0LKkpo0aQRG9fAI`. Demander à Quentin les liens de la sidebar, du composer, de la vue conversation s'ils manquent.
3. **Comparer** avec twake-mui (`node_modules/@linagora/twake-mui`, `/tmp/twake-ui`) et nos composants `@/ds/` ; noter les écarts.
4. **Corriger par lots** (une PR par lot, captures avant/après regardées, axe et responsive) : boutons, champs, sidebar (#92, #98),
   barre du haut, liste, lecture, composer. Ce qui manque à twake-mui → `@/ds/` + entrée dans `docs/twake-mui-gaps.md`.
5. En parallèle si utile : #93 (clignotement du composer, à vérifier avec `prefers-reduced-motion`), #95.

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
- Skills Twake : plugin `twake-guidelines` (scope utilisateur), sources dans `~/.claude/plugins/marketplaces/twake-guidelines/skills/`.

## 8. Message à coller pour démarrer la prochaine session

> On reprend la réécriture React de Twake Mail. Lis `docs/NEXT_SESSION.md` puis `AGENTS.md` du dépôt
> `~/Sites/Linagora/twake-mail-frontend`. Vérifie que les outils Figma sont disponibles, puis attaque le chantier design
> (§5) en commençant par lire le design system du fichier Teammail 1.1 (lien dans le doc). Même façon de travailler
> qu'avant : agents en parallèle dans des worktrees, une PR par lot mergée quand la CI est verte, redéploiement de la démo,
> issues sur notre dépôt pour ce que je signale, rien d'externe sans mon accord.
