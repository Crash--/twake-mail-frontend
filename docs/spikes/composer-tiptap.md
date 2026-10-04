# Spike composer : TipTap convient-il ? (2026-10-04)

Fusionné dans `main` (branche `feat/composer-foundation`) : le code du spike reste derrière `DEBUG`.
Route de démo `/spike/composer` (visible seulement avec `DEBUG`), qui envoie de vrais mails
sur une stack JMAP jetable.

## Verdict : GO sous conditions

TipTap 3 (MIT) convient pour le composer. Aucun point n'est KO. Le risque principal, la
citation des mails complexes, est levé par un **nœud atomique** qui garde le HTML cité tel
quel : fidélité de 100 % mesurée sur quatre mails réels, et typage fluide sur une citation de
200 Ko. Injecter la citation dans le schéma de l'éditeur (approche a) détruit les mises en
page : on ne la retient que comme option explicite (« Modifier le message cité »).

Conditions du GO (elles font partie de l'estimation) :

1. **Citation en nœud atomique** (`HtmlBlock`), avec l'option « Modifier le message cité ».
   Ne jamais parser une citation dans le schéma par défaut.
2. **Brouillons en deux requêtes** et relecture des blob ids des images inline après chaque
   sauvegarde (contraintes de tmail-backend, voir « Constats backend »).
3. **Envoi par `htmlBody` + `textBody` + `attachments`** inline, pas par `bodyStructure`
   (ignoré à la création par tmail-backend 1.0.21).
4. Avant la production : redimensionnement des images au clavier (RGAA), `data-testid` en
   props dans `@/ds/`, contraste du thème twake-mui (3 échecs AA hérités, déjà présents ailleurs
   dans l'app).

## Tableau point par point

Les specs sont dans `e2e/spike/` (`./scripts/spike.sh test`, 23 tests verts, plus 8 de perf et 1
lab BlockNote). Les captures sont dans `/tmp/twake-mail-shots/spike-composer-*.png`.

| # | Point | Statut | Preuve |
|---|---|---|---|
| 1 | Éditeur `@/ds/RichTextEditor` : gras, italique, souligné, barré, listes, citation, lien (dialogue + Ctrl/Cmd+K), couleur, alignement, taille, effacer, undo/redo, image inline | **OK** | `editor.spec.ts` SPIKE-EDIT ; `link-dialog.png`, `editor-preview.png`, `smoke.png` |
| 2a | `role=textbox`, `aria-multiline`, nom accessible, aide clavier (`aria-describedby`) | **OK** | SPIKE-A11Y + `RichTextEditor.spec.tsx` |
| 2b | `role=toolbar`, tabindex itinérant (flèches, Début, Fin), `aria-pressed`, tooltip = `aria-label` | **OK** | SPIKE-A11Y, `toolbar-tooltip.png` |
| 2c | Sortie au clavier : Tab sort (sauf dans une liste, où il indente) ; Échap et Alt+F10 vont à la barre, Échap revient ; Tab atteint le bouton « Modifier le message cité » | **OK** | SPIKE-A11Y, SPIKE-QUOTE-EDIT |
| 2d | axe WCAG 2.1 AA sur l'éditeur, ses menus et son dialogue | **OK pour l'éditeur, risque thème** : 0 violation propre à l'éditeur ; 3 contrastes du thème twake-mui (label 3,63:1, label focus 3,82:1, bouton contained 3,64:1), aussi présents sur le shell | SPIKE-AXE, `docs/twake-mui-gaps.md` |
| 2e | Redimensionnement d'image | **Risque** : poignées TipTap à la souris seulement, sans style. Il faut une alternative clavier (100/50/25 % comme Summernote) | — |
| 3a | HTML sortant compatible mail : styles inline, pas de classe ni de CSS externe, `<div>` par ligne, listes et citations stylées inline | **OK** | `emailHtml.spec.tsx`, exemple ci-dessous |
| 3b | `textBody` (alternative texte : listes `-`/`1.`, citations `>`, liens `texte <url>`) | **OK** (Flutter n'en produit pas) | `emailHtml.spec.tsx`, `forward-sent.txt` |
| 3c | Rendu dans notre lecteur et dans **tmail-flutter web** (`linagora/tmail-web:v0.39.0`, 127.0.0.1:18503) | **OK**, avec une limite : tmail-web retire les attributs `data-*`, donc les styles par classe d'une newsletter citée (portée `[data-html-block="quote"]`) sont perdus. Les styles inline restent | `inline-images-reader.png`, `inline-images-tmailweb.png`, `forward-reader.png`, `forward-tmailweb.png` |
| 4a | Images inline par bouton, collage et glisser-déposer, upload `client.upload` | **OK** | SPIKE-SEND, `inline-images-editor.png` |
| 4b | À l'envoi : multipart/related, `cid`, `disposition: inline` | **OK** via `htmlBody`/`textBody`/`attachments` ; `bodyStructure` est ignoré par le backend | SPIKE-SEND, `backend.spec.ts` |
| 4c | Réhydratation des `cid:` en object URLs (brouillon rouvert, rechargement) | **OK** | SPIKE-DRAFT CMP-18 et CMP-22, `draft-reopened.png`, `restored-after-reload.png` |
| 4d | Redimensionnement à l'insertion (Flutter : pica) | **OK** sans dépendance : `createImageBitmap` (`resizeQuality: 'high'`) + `OffscreenCanvas`. PNG de 2400 px et 7,7 Mo envoyé en 1280 px et 1,66 Mo. Flutter web n'en fait aucun | SPIKE-SEND (log) |
| 5a | Citation (a) dans le schéma (tables + styles gardés) | **KO pour la fidélité** : newsletter 9 % de pixels différents et hauteur 675 px au lieu de 1 036, Outlook 24 %, base64 24 %, calendrier Google illisible | `quote.spec.ts`, `quote-*-schema.png` |
| 5b | Citation (b) nœud atomique, HTML d'origine sanitisé, rendu dans un iframe sandboxé, réinjecté tel quel, option « Modifier » | **OK** : 0 pixel différent et 100 % des balises et styles gardés sur les 4 mails | `quote.spec.ts`, `quote-*-atom.png`, SPIKE-QUOTE-EDIT |
| 5c | En-têtes localisés comme Flutter (« Le …, de … », « Message transféré » avec Sujet, Date, De, À, Cc, Cci, Répondre à) | **OK** | SPIKE-REPLY, `forward-sent.html` |
| 6 | Collage Word, Google Docs, LibreOffice, page web ; Ctrl+Shift+V en texte brut | **OK** : listes Word reconstruites (imbriquées, puces et numéros), aucun `mso-`, classe, police ni noir par défaut, tables gardées | `paste.spec.ts`, `cleanPastedHtml.spec.tsx`, `paste-*.png` |
| 7 | Signature d'identité insérée, remplacée au changement d'identité, au-dessus de la citation ; images de `reply_inline_*` (CMP-10, CMP-12) | **OK**. Flutter n'a pas de réglage avant/après : la signature est toujours au-dessus de la citation | `signature.spec.ts`, `signature-switched.png`, `reply-inline-images.png` |
| 8 | Brouillon auto (debounce 1,5 s), nouvelle version puis destruction de l'ancienne, restauration après rechargement, coût réseau | **OK** : 140 frappes donnent 2 sauvegardes de 2 requêtes chacune (≈ 0,9 Ko + 0,4 Ko) | `drafts.spec.ts`, `draft-stats.json` |
| 9a | Poids : chargé à la demande | **OK** : chunks lazy de 146,7 + 16,4 = **163 Ko gzip** ; initial +4,8 Ko gzip (chaînes des 4 langues, composants MUI tirés dans `lib-ui`) | `npm run build`, voir « Poids » |
| 9b | Frappe sur une citation de 200 Ko | **OK** avec l'atome (p95 5,9 ms, CPU ×4 : 16,8 ms). **Risque** avec le schéma (4 402 nœuds, `getHTML` à 73 ms en CPU ×4) | `perf.spec.ts`, `perf.json` |
| 10 | Alternative (Lexical, BlockNote) | Lexical non construit : aucun point KO, et son modèle demanderait le même nœud atomique (DecoratorNode). BlockNote évalué (option C) : **non retenu** | `blocknote-lab.spec.ts` |

## Citation : approche recommandée

**Le nœud atomique `HtmlBlock` (approche b).** Le HTML cité n'entre jamais dans le schéma
ProseMirror :

- Construction comme Flutter (`editor_view_mixin.dart`) :
  `<cite style="text-align: left;display: block;">Le 4 oct. 2026 16:23, de Nom &lt;mail&gt;</cite><blockquote style="margin-left:8px;…;border-left:5px solid #eee;">ORIGINAL</blockquote>`.
  Le tout est enveloppé dans `<div data-html-block="quote">`.
- `ORIGINAL` est sanitisé par DOMPurify comme dans le lecteur (`sanitizeEmailHtml`) :
  - les `cid:` sont gardés (c'est la forme stockée et envoyée) ;
  - les `<style>` du mail cité sont **confinés** à la citation (sélecteurs préfixés, `body` →
    `> blockquote`). Flutter ne les confine pas, quand ils survivent à sa sanitisation ;
  - la signature citée perd sa classe `tmail-signature`, comme Flutter.
- Affichage dans un iframe sandboxé (pas de script, CSP du lecteur), `cid:` résolus en object
  URLs à l'affichage seulement, hauteur suivant le contenu.
  - L'iframe a `pointer-events: none` et `tabindex=-1` : un clic sélectionne le bloc au lieu
    d'envoyer le focus dans un document où la frappe se perd (bug trouvé pendant le spike).
  - Taper sur le bloc sélectionné écrit **au-dessus** au lieu de le remplacer. Suppr et
    Retour arrière le suppriment toujours (Ctrl+Z le rend).
- À l'envoi et dans les brouillons : `renderHTML` restitue le HTML tel quel, et `parseHTML`
  (priorité 1000) reconnaît le `div` d'un brouillon rouvert. L'aller-retour est sans perte.
- « Modifier le message cité » : le bloc devient du contenu éditable (approche a à la demande).
- Les images du mail cité sont référencées par leur blob existant (pas de ré-upload). Les images
  `data:` (CMP-09) sont uploadées à l'envoi et réécrites en `cid:`.

Mesures (`quote.spec.ts`, rendu identique au lecteur, iframe de 900 px) :

| Mail | Atome : pixels ≠ / balises / styles | Schéma : pixels ≠ | Schéma : hauteur | Schéma : balises gardées | Schéma : styles |
|---|---|---|---|---|---|
| Newsletter (tables, `<style>`, cid) | 0 / 100 % / 100 % | 9,2 % | 675 px au lieu de 1 036 | 77 % | 88 % |
| Outlook 15 (`no_disposition_inline`) | 0 / 100 % / 100 % | 24,5 % | 579 px au lieu de 705 | 39 % | — |
| Invitation Google Calendar (20 tables) | 0 / 100 % / 100 % | 8,3 % (contenu des cellules illisible) | 519 px au lieu de 648 | 81 % | 69 % |
| `Mail with base64` (images data + cid) | 0 / 100 % / 100 % | 24,4 % | 1 941 px au lieu de 2 008 | 67 % | 70 % |

Le ratio de pixels sous-estime la casse des mails surtout blancs : voir
`quote-calendar-schema.png` (texte des cellules disparu) et `quote-newsletter-schema.png`
(classes, titres, centrage et bouton perdus).

Il manque une fixture « vraie newsletter » dans `e2e/fixtures/eml/`. J'en ai écrit une,
générée par `e2e/fixtures/eml/spike_composer/generate.py` :

- `newsletter.eml` : tables, `<style>` avec media queries, `bgcolor`, `<center>`, `<font>`,
  logo en cid ;
- `newsletter-200k.eml` : la même, avec 201 Ko de HTML.

## HTML sortant : document type

Saisi au clavier (`SPIKE-EDIT`) : « Hello **world** », une liste à puces, un texte rouge, un
lien Ctrl+K.

```html
<div>Hello <strong>world</strong></div><ul style="margin:0 0 0 0;padding-left:24px;"><li>first</li><li>second</li></ul><div><span style="color: rgb(198, 40, 40);">red text </span><a target="_blank" rel="noopener noreferrer nofollow" href="https://twake.app">Twake</a></div><div><br></div>
```

```text
Hello world
- first
- second
red text Twake <https://twake.app>
```

Règles de `toEmailHtml` (`common/src/features/composer/emailHtml.ts`) :

- `<p>` devient `<div>`, et une ligne vide devient `<div><br></div>`. C'est ce qu'écrivent
  Gmail, Thunderbird et Summernote.
- `li > p` est déballé. Les listes, citations et tables reçoivent des styles inline.
- Les images passent à `src="cid:…"`.
- La signature reçoit `class="tmail-signature" style="clear: both; display: block;"`, pour que
  Flutter la reconnaisse.
- Les blocs gardés (citation, signature) ne sont pas touchés.

Envoi d'une réponse avec citation (début de `forward-sent.html`) :

```html
<div><br></div><div><br></div><div>Have a look at this newsletter.</div><div data-html-block="quote"><cite style="text-align: left;display: block;">------- Forwarded message -------<br>Subject: ACME Weekly newsletter<br>Date: Oct 4, 2026 4:26 PM<br>From: ACME Weekly &lt;news@acme.example&gt;<br>To: &lt;reader@example.com&gt;</cite><blockquote style="margin-left:8px;margin-right:8px;padding-left:12px;padding-right:12px;border-left:5px solid #eee;"><style type="text/css">[data-html-block="quote"] > blockquote { margin: 0px; … }
[data-html-block="quote"] .heading { font-size: 26px; … }…</style>…<img src="cid:logo@newsletter" …>
```

## Collage

`cleanPastedHtml` (`transformPastedHTML`, dans `@/ds/`) part du principe de Messages : une
couleur que l'utilisateur ne voit pas ne doit pas partir dans le HTML envoyé.

- **Word** :
  - les paragraphes `mso-list` deviennent de vraies `<ul>`/`<ol>`, imbriquées par `level` ;
  - le type est déduit du marqueur `mso-list:Ignore`, qui est ensuite retiré ;
  - deux listes Word différentes restent séparées ;
  - `<o:p>`, commentaires conditionnels, `<style>`, classes `Mso*` et `mso-*` sont supprimés.
- **Google Docs** : le `<b style="font-weight:normal" id="docs-internal-guid…">` est déballé.
  `font-weight:700`, `font-style:italic` et `text-decoration` deviennent
  `<strong>`/`<em>`/`<u>`/`<s>`.
- **LibreOffice** : `<font color>` devient un span coloré, `<font face/size>` est déballé et
  `align` devient `text-align`.
- **Page web** :
  - les titres deviennent des lignes en gras ;
  - les liens prennent le style de l'éditeur ;
  - les tables sont gardées (TableKit est actif dans l'éditeur) ;
  - le noir et le blanc par défaut, les polices, tailles, interlignes et marges disparaissent.
- Styles gardés : couleur et fond **choisis** (non gris foncé, non blanc), gras, italique,
  souligné, barré, alignement.
- **Ctrl+Shift+V** colle en texte brut (natif dans ProseMirror, vérifié).

## Signature, brouillons, restauration

- **Signature** : la signature de l'identité par défaut (celle que le serveur ne laisse pas
  supprimer) est un `HtmlBlock` en ligne :
  `<span class="tmail_signature_prefix">--&nbsp;</span><br>{signature}<br>`, comme Flutter.
  - Changer d'identité remplace le bloc.
  - Dans une réponse, elle est placée au-dessus de la citation, après deux lignes vides.
  - Pour éviter d'écrire après la signature par mégarde, l'éditeur s'ouvre avec le curseur au
    début, sans paragraphe final automatique (`trailingNode: false`). Un gap cursor permet
    d'écrire entre la signature et la citation (CMP-12).
- **Brouillons** : debounce de 1,5 s, une sauvegarde à la fois. Chaque sauvegarde fait :
  1. `Email/set create` de la nouvelle version ;
  2. une deuxième requête avec `Email/get attachments` (nouveaux blob ids des images) +
     `Email/set destroy` de l'ancienne version.

  Flutter fait 3 requêtes, et uniquement à la fermeture ou sur « Enregistrer » : il n'a pas
  d'autosave web. Coût mesuré : 1,3 Ko par sauvegarde pour un message court ; le HTML cité
  pèse ensuite à chaque sauvegarde.
- **Rechargement** (CMP-22, ADR 0009 et 0112) : un snapshot est écrit dans `sessionStorage` au
  `beforeunload`. Il contient les champs, le HTML avec les images en `cid:` et les blob ids,
  jamais d'object URL. Il est relu à l'ouverture (avec réhydratation des images) et supprimé à
  l'envoi.

## Performance et poids

Frappe de 62 caractères dans une réponse citant `newsletter-200k.eml` (201 Ko de HTML). La
latence est mesurée de la touche à la frame suivante :

| Citation | CPU | getHTML à chaque touche | p50 | p95 | max | long tasks | `getHTML()` | nœuds |
|---|---|---|---|---|---|---|---|---|
| atome | ×1 | non | 2,3 ms | 5,9 ms | 10 ms | 0 | 5 ms | 4 |
| atome | ×4 | non | 9,4 ms | 16,8 ms | 58 ms | 1 | 21 ms | 4 |
| atome | ×4 | oui | 26,9 ms | 32,8 ms | 62 ms | 1 | 19 ms | 4 |
| schéma | ×1 | non | 6,1 ms | 9,9 ms | 18 ms | 0 | 16 ms | 4 402 |
| schéma | ×4 | non | 21 ms | 25,6 ms | 64 ms | 0 | 73 ms | 4 402 |
| schéma | ×4 | oui | 73,8 ms | 80,1 ms | 126 ms | 54 (3,4 s) | 39 ms | 4 402 |

Conclusion : l'autosave doit rester débouncé (jamais de `getHTML()` à chaque frappe).
L'atome rend la taille de la citation indifférente.

Poids (`npm run build`, gzip) :

| Morceau | Avant | Après | Δ |
|---|---|---|---|
| Chunk lazy TipTap + ProseMirror | — | 146,7 Ko | lazy |
| Chunk lazy composer (page, `@/ds/RichTextEditor`, features) | — | 16,4 Ko | lazy |
| `index` (dont les chaînes du composer dans 4 langues) | 21,7 Ko | 24,5 Ko | +2,8 |
| `lib-ui` (Menu, Dialog, TextField select, SvgIcon tirés par `cacheGroups`) | 113,2 Ko | 114,9 Ko | +1,7 |

En comparaison, BlockNote 0.55 avec l'UI Ariakit pèse environ 290 Ko gzip hors React (plus
108 Ko lazy pour les emojis).

## Extensions TipTap retenues et licences

Toutes sont sur le registre npm public, en **MIT** et en 3.31.4. Aucune `@tiptap-pro/*` ni
`registry.tiptap.dev` (vérifié dans le lockfile).

| Paquet | Pour |
|---|---|
| `@tiptap/core`, `@tiptap/pm`, `@tiptap/react` | Noyau, ProseMirror, React (peer React 17 à 19) |
| `@tiptap/starter-kit` | Paragraphe, gras, italique, souligné, barré, listes, citation, lien, undo/redo, gap/drop cursor. `code`, `codeBlock`, `heading`, `horizontalRule` et `trailingNode` sont désactivés |
| `@tiptap/extension-text-style` (`TextStyleKit`) | Couleur, fond, taille (police et interligne désactivés) |
| `@tiptap/extension-text-align` | Alignement |
| `@tiptap/extension-image` | Images inline (étendue en `InlineImage`, `data-reference`), redimensionnement |
| `@tiptap/extension-table` (`TableKit`) | Tables collées, approche (a) |
| `@tiptap/extension-file-handler` | Collage et dépôt de fichiers (passé en MIT avec la v3) |

Dépendances de test ajoutées à `e2e/` (paquet séparé) : `@axe-core/playwright` 4.13 (MPL-2.0),
`pixelmatch` 7 (ISC), `pngjs` (MIT), `@types/pngjs` (MIT). Aucune nouvelle dépendance pour pica
ou html-to-text : le code maison suffit.

## Constats backend (tmail-backend 1.0.21.2)

Ce sont des candidats à des issues. Demander à Quentin avant d'en ouvrir.

1. **`bodyStructure` ignoré à la création** (`Email/set`) : le message ne garde qu'une partie
   `text/plain` vide (591 octets), sans erreur. `htmlBody` + `textBody` + `attachments` inline
   produisent bien `multipart/related[multipart/alternative[text, html], images]`
   (`backend.spec.ts`).
2. **`create` + `destroy` dans le même `Email/set`** : la destruction passe en premier. Les
   images de la nouvelle version, qui pointent vers les parties de l'ancienne
   (`<emailId>_<partId>`), sont alors introuvables (« Attachment not found »).
3. **Pas de référence à un id créé dans `Email/get`** : `#creationId` renvoie `serverFail` et
   `/created/x/id` renvoie « '/ids' property need to be an array ». Il faut donc une deuxième
   requête après la création.
4. **`Email/get` avec `attachments` + `bodyValues`** (sans `htmlBody` avant) :
   `NotImplementedError` dans `ReadLevel.combine`, d'où un `serverFail`. Avec `htmlBody` en tête
   de liste, ça passe.

## Écarts avec le brief et avec Flutter

- L'en-tête de réponse Flutter est « On {date}, from {adresse} » / « Le {date}, de {adresse} »
  (ARB `header_email_quoted`), pas « a écrit ». La date est celle de `receivedAt`, au format
  `MMM d, y h:mm a`. Il est repris tel quel.
- Flutter n'a **pas** de réglage de position de la signature : elle est toujours au-dessus de la
  citation.
- Flutter web n'a ni autosave, ni `textBody`, ni redimensionnement d'image, ni nettoyage du
  collage : le spike ajoute les quatre.
- Les tests `reply_inline_*` de Flutter ne tournent que sur mobile. CMP-10 et CMP-12 sont
  couverts ici.

## Option C : BlockNote (Messages / DINUM)

Lab dans `/tmp/blocknote-lab`, recette pour le rejouer :

1. `npm i @blocknote/core@0.55.0 @blocknote/react@0.55.0 @blocknote/ariakit@0.55.0 react@18 react-dom@18 esbuild` ;
2. `BlockNoteView` d'Ariakit dans une page ;
3. `esbuild app.jsx --bundle --minify` ;
4. `python3 -m http.server 18504 --bind 127.0.0.1` ;
5. `BLOCKNOTE_LAB_URL=http://127.0.0.1:18504/ ./scripts/spike.sh test blocknote-lab.spec.ts`.

`@blocknote/mantine` 0.55 ne s'installe pas en React 18 : `@mantine/hooks` 9 exige React 19.2.

- **UI remplaçable** : oui. `@blocknote/react` expose un contexte de composants (`Components`) :
  - les catégories sont FormattingToolbar, FilePanel, LinkToolbar, SideMenu, SuggestionMenu,
    GridSuggestionMenu, TableHandle, Comments, Versioning et Generic (Menu, Popover, Form,
    Toolbar, Badge…) ;
  - l'implémentation Ariakit compte 34 fichiers et environ 1 600 lignes ;
  - une couche twake-mui coûterait environ 1 600 à 2 000 lignes, soit 8 à 12 jours avec les
    tests, à maintenir à chaque version de BlockNote (0.x, API mouvante).
- **Accessibilité, telle quelle** :
  - 2 violations axe (`aria-input-field-name` critique : l'éditeur n'a pas de nom ;
    `aria-allowed-attr`) et pas d'`aria-multiline` ;
  - la barre de formatage n'apparaît pas pour une sélection faite au clavier, et Tab sort de
    l'éditeur sans l'atteindre ;
  - les poignées de bloc (glisser, « + ») n'apparaissent qu'au survol et ne sont pas
    focusables ;
  - Messages contourne un piège de focus de la barre Mantine (`toolbar-focus.ts`).
- **UX par blocs** (menu `/`, poignées, glisser) : elle n'apporte rien à un mail et ajoute du
  bruit, au survol comme pour les lecteurs d'écran.
- **HTML** : l'export « lossy » produit des classes (`bn-inline-content`) et une imbrication de
  liste discutable. Pour l'import de la newsletter, il ne reste que 1 table sur 5, 0 style sur 33
  et 0 image sur 1. Il faudrait un exporteur maison (celui de Messages) et la citation hors
  éditeur dans tous les cas.
- **Poids** : environ 2 fois TipTap direct.
- **Verdict** : non retenu. BlockNote n'apporte que l'UX par blocs, dont on ne veut pas, et
  coûte une couche UI, des corrections d'accessibilité et du poids.

## Messages (DINUM) : ce qu'on reprend, ce qu'on ne reprend pas

Messages (`suitenumerique/messages`, MIT) écrit son composer avec BlockNote 0.52.

**Repris ou convergent.** L'attribution MIT figure dans les deux fichiers qui empruntent
réellement : `cleanPastedHtml.ts` (règle des couleurs) et `emailHtml.spec.tsx` (cas de test).
Le bloc de citation atomique et le bloc de signature ont été conçus avant la lecture de Messages
et convergent avec son design.

- Le principe du nettoyage des couleurs au collage (`paste-sanitizer.ts`) : une couleur que
  l'utilisateur ne voit pas ne doit pas partir. Chez nous, on retire les noirs, gris foncés et
  blancs par défaut au lieu de ramener à une palette (`cleanPastedHtml.ts`).
- La citation en bloc atomique non éditable (`quoted-message-block/`). C'est notre approche (b),
  mais **côté client**. Chez eux, le serveur (lib `jmap-email`, `make_reply`/`make_forward`)
  ajoute le mail cité à l'envoi et le bloc n'affiche qu'un résumé. Nous n'avons pas de serveur :
  le HTML cité vit dans le bloc.
- La signature en bloc non éditable (`signature-block/`), remplacée au changement d'identité.
  Chez eux, elle est rendue côté serveur depuis des modèles ; chez nous, elle vient des
  identités JMAP.
- Les cas de test de leur exporteur (94 tests : listes, styles, liens, images, imbrications)
  ont inspiré `emailHtml.spec.tsx` (attribution dans le fichier). Il reste à en porter
  davantage lors de l'implémentation.
- **À reprendre** : `smart-trailing-block.ts`, qui garde un bloc éditable vide avant les blocs
  de pied (signature, citation). C'est la bonne réponse au placement du curseur entre la
  signature et la citation, qui passe aujourd'hui par un gap cursor.

**Non repris** :

- BlockNote lui-même (voir l'option C).
- L'exporteur email (blocs BlockNote vers `@react-email/components` puis
  `renderToStaticMarkup`) : il dépend du modèle de blocs. Notre équivalent est
  `toEmailHtml`, un post-traitement de `getHTML()`.
- `@blocknote/xl-email-exporter` (GPL-3.0 OR PROPRIETARY) : exclu.
- La citation et la signature composées côté serveur, impossibles avec JMAP.
- `toolbar-focus.ts` : il contourne un bug de Mantine. Notre barre a son propre tabindex
  itinérant.
- Le remplacement des tables de mise en page par des `div` flex pour l'aperçu des signatures :
  l'iframe rend inutile.

## Composants `@/ds/` à prévoir

| Composant | État spike | Candidat twake-ui |
|---|---|---|
| `RichTextEditor` (TipTap + barre + aide clavier) | Fait, à durcir : ids en props, plus de libellés | Oui : Chat et Docs en ont besoin. À proposer après un an d'usage |
| `RichTextToolbar` (APG toolbar, roving tabindex, toggles `aria-pressed`, menus `menuitemradio`) | Fait | **Oui, en premier** : un `Toolbar` générique manque à twake-mui |
| `LinkDialog` | Fait | Avec l'éditeur |
| `HtmlBlock` (atome HTML + iframe) et `InlineImage` | Faits | Avec l'éditeur |
| `EditorIcon` (icônes de formatage) | Chemins Material Icons | **twake-icons** doit avoir ces icônes |
| `cleanPastedHtml` | Fait | Avec l'éditeur |
| À faire : champ destinataires (chips + autocomplétion), barre de pièces jointes, fenêtre composer (flottante, plein écran, réduite), popover d'image (taille au clavier) | — | Champ destinataires : oui, utile à Calendar |

## Découpage et estimation de l'implémentation complète

Hypothèse : un développeur qui connaît la base, e2e et accessibilité compris. Le composer
Flutter fait 21 000 lignes.

| Lot | Contenu | Estimation |
|---|---|---|
| L1 Éditeur ds | Durcir `RichTextEditor` (ids en props, i18n complète, titres ?, popover d'image avec taille au clavier, `smart-trailing-block`, tests Jest et Playwright), icônes twake-icons | 5 à 7 j |
| L2 Fenêtre composer | Composer flottant, plein écran ou réduit, plusieurs composers, champs To/Cc/Bcc/Reply-To avec chips et `TMailContact/autocomplete`, identité, objet, confirmation de fermeture (CMP-05, CMP-14) | 8 à 10 j |
| L3 Envoi, brouillons, PJ | Envoi (Outbox ou Drafts, `onSuccessUpdateEmail`, toasts, erreurs, quota), autosave et sauvegarde à la fermeture, snapshot, pièces jointes (upload avec progression, limites de taille) (CMP-01, 07, 14 à 18, 22) | 8 à 10 j |
| L4 Réponse et transfert | Règles de destinataires (ADR 0064 et 0065), citation atomique, `Re:`/`Tr:`, `inReplyTo`/`references`, `$answered`/`$forwarded`, images du mail cité, base64 vers cid, « Modifier la citation » (CMP-08 à 13) | 6 à 8 j |
| L5 Signatures et images | Signatures (texte ou HTML), images inline (collage, dépôt, redimensionnement), nettoyage du collage, cas de Messages | 4 à 6 j |
| L6 Fonctions annexes | Modèles, accusé de lecture (MDN), important, rappel de PJ oubliée, mailto, raccourcis (CMP-02 à 04, 19 à 21) | 5 à 7 j |
| L7 Qualité | Audit RGAA manuel (NVDA, VoiceOver) du composer, port des CMP restants, perf sur gros brouillons | 6 à 8 j |
| **Total** | | **42 à 56 jours-développeur** (environ 9 à 11 semaines) |

## Risques ouverts

- **Styles des citations dans les autres clients.** La portée par attribut
  (`[data-html-block="quote"]`) marche dans notre lecteur mais pas dans tmail-web, qui retire
  `data-*`. Gmail et Outlook ignorent les `<style>` du corps de toute façon. C'est mieux que
  Flutter (fuite des styles sur toute la réponse) mais incomplet. La piste est d'inliner le CSS
  cité dans les attributs `style` à l'envoi (inliner type juice, MIT), à chiffrer.
- ~~**Redimensionnement d'image à la souris seulement**~~ : réglé en L1 par la barre d'image
  (`ds/RichTextEditor/ImageToolbar`) : les flèches sélectionnent l'image, Entrée ouvre la barre
  (25, 50, 75 %, taille d'origine, plus petite, plus grande, supprimer).
- **Contraste du thème twake-mui** (3 échecs AA) : il faut une correction upstream. C'est
  documenté dans `docs/twake-mui-gaps.md`, et la spec axe filtre seulement ces trois cas.
- ~~**`data-testid` codés en dur dans `@/ds/RichTextEditor`**~~ : réglé en L1 (prop `testIds`,
  option `editTestId` de `HtmlBlock`, valeurs dans `features/composer/editorTestIds.ts`).
- **`getHTML()` construit le HTML cité dans le document principal.** Mesuré : une seule requête
  supplémentaire par session pour une image distante `no-store` (cache d'images du document),
  pas une par sauvegarde. À surveiller ; un document inerte n'y change rien.
- **Approche (a) via « Modifier le message cité »** : on retombe sur les pertes mesurées.
  `toEmailHtml` ajoute en plus des bordures aux cellules de tables de mise en page. Il faut
  avertir l'utilisateur, ou n'appliquer le style de table qu'aux tables de l'utilisateur.
- **Deux composers sur un même brouillon** se détruisent mutuellement leurs versions, comme dans
  Flutter. Il faut un verrou ou un `ifInState` (`Email/set`).
- **Taper sur une citation sélectionnée écrit au-dessus** (choix fait). Suppr et Retour arrière
  la suppriment : faut-il une confirmation ? À trancher avec le produit.
- **`DOMPurify` et le HTML d'identité** : la signature est sanitisée sans `<style>`. Les
  signatures riches (tables, images distantes) sont à vérifier avec de vraies données.
- **React 19** : TipTap (peer 17 à 19) est prêt et n'est pas bloquant.

## Rejouer le spike

```bash
cd ~/Sites/Linagora/twake-mail-frontend
source ~/.nvm/nvm.sh && nvm use 24
npm ci && npm run build
cd e2e && npm ci
./scripts/spike.sh start                 # stack e2e (twakemail-e2e) + DEBUG + tmail-web sur 18503
./scripts/spike.sh test --grep-invert PERF
./scripts/spike.sh test perf.spec.ts --workers 1
./scripts/spike.sh stop                  # avant de relancer la suite e2e
```

Démo manuelle : <http://127.0.0.1:18302/spike/composer>, avec un compte créé par
`curl -X PUT http://127.0.0.1:18301/users/alice@example.com -H 'Content-Type: application/json' -d '{"password":"secret"}'`. Les
paramètres sont `?reply=<emailId>&mode=reply|forward&quote=atom|schema` et `?draft=<emailId>`.
