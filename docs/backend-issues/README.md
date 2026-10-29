# Candidats issues tmail-backend : suivi au 2026-10-28

Chaque candidat a un texte dans ce dossier (lien `issue.md`). Les textes datent du 2026-10-05 et ne sont pas mis à jour. Les scripts de repro (`repro.mjs`, compose, résultats) restent sur la devbox dans `~/Sites/Linagora/tmail-backend-issues/<dossier>/`.
Les états ci-dessous viennent d'un rejeu du 2026-10-28 sur l'image memory 1.0.22.2 et sur `memory-branch-master`. Backend distribué de la devbox non testé (identifiants refusés par le contrôle de permissions).
Les liens `james#` renvoient à linagora/james-project, les liens `tmail#` à linagora/tmail-backend.

## Corrigés, issue fermée
- #2682, vue de requête memory / team mailboxes : [tmail#2682](https://github.com/linagora/tmail-backend/issues/2682). Dossier : [`team-mailbox-email-query-view/`](team-mailbox-email-query-view.md)
- #2684, memory : Email/set update de plus de 3 ids modifie tout, avec blocage : [tmail#2684](https://github.com/linagora/tmail-backend/issues/2684). Dossier : [`memory-email-set-update-hang/`](memory-email-set-update-hang.md)
- #2685, bodyStructure ignoré : [tmail#2685](https://github.com/linagora/tmail-backend/issues/2685). Dossier : [`email-set-create-bodystructure-ignored/`](email-set-create-bodystructure-ignored.md)
- #2686, Email/get attachments en serverFail : [tmail#2686](https://github.com/linagora/tmail-backend/issues/2686). Dossier : [`email-get-attachments-readlevel-serverfail/`](email-get-attachments-readlevel-serverfail.md)
- D, Memory/Lucene : l'expunge de UID consécutifs vide l'index de recherche : [james#5607](https://github.com/linagora/james-project/issues/5607). Corrigé sur memory. Dossier : [`memory-lucene-expunge-range/`](memory-lucene-expunge-range.md)
- E, les /get omettent les propriétés null : [james#5608](https://github.com/linagora/james-project/issues/5608), corrigé par [tmail#2763](https://github.com/linagora/tmail-backend/pull/2763). Corrigé sur master, pas encore dans memory 1.0.22.2. Dossier : [`get-omits-null-properties/`](get-omits-null-properties.md)
- M, PublicAsset : l'URL publique contient le login : [tmail#2695](https://github.com/linagora/tmail-backend/issues/2695). Comportement inchangé, désormais documenté comme voulu. Dossier : [`public-asset-uri-username/`](public-asset-uri-username.md)
- L, EmailRecoveryAction et capability du vault : [tmail#2701](https://github.com/linagora/tmail-backend/pull/2701) (doc). Comportement inchangé, doc alignée sur l'implémentation. Dossier : [`email-recovery-action-model/`](email-recovery-action-model.md)

## Corrigés avant ouverture, pas d'issue
- B, EmailSubmission/set inverse forbiddenFrom et forbiddenMailFrom. Corrigé. Dossier : [`email-submission-forbidden-from-swapped/`](email-submission-forbidden-from-swapped.md)
- I, Forward/set refuse les patchs partiels. Corrigé. Dossier : [`forward-set-partial-patch/`](forward-set-partial-patch.md)
- J, Label/set ne peut pas retirer la couleur d'un label. Corrigé. Dossier : [`label-set-color-null-and-changes-state/`](label-set-color-null-and-changes-state.md)
- K, Filter/get ne peut pas être renvoyé tel quel à Filter/set. Corrigé. Dossier : [`filter-get-rule-ids/`](filter-get-rule-ids.md)

## Corrigés en partie, pas d'issue
- A, EmailSubmission/set, annulation d'envoi. Le faux succès est corrigé. Reste le stockage des soumissions (get, query, changes absents), déjà suivi par JAMES-3543. Pas d'issue, au mieux un commentaire sur JAMES-3543. Dossier : [`email-submission-undo-send/`](email-submission-undo-send.md)
- C, EmailSubmission/set, identityId et emailId inconnus. Corrigé, sauf un `identityId` omis qui est accepté. Pas d'issue pour l'instant. Dossier : [`email-submission-unknown-identity/`](email-submission-unknown-identity.md)

## Ouverts, toujours réels
- F, Mailbox/set : un dossier `x-…` reçoit un rôle et ne peut plus être renommé ni détruit : [james#5609](https://github.com/linagora/james-project/issues/5609). Dossier : [`mailbox-templates-role/`](mailbox-templates-role.md)
- G, Mailbox/set create : un parentId `#creationId` donne serverFail : [james#5610](https://github.com/linagora/james-project/issues/5610). Dossier : [`mailbox-set-create-parent-creation-id/`](mailbox-set-create-parent-creation-id.md)
- H, Identity/set ignore null, et la première mise à jour perd le `name` : [james#5615](https://github.com/linagora/james-project/issues/5615). La cause est dans James. Dossier : [`identity-set-null-replyto-bcc/`](identity-set-null-replyto-bcc.md)
- N, Mailbox/query : le filtre `role` refuse les rôles renvoyés par Mailbox/get : [james#5611](https://github.com/linagora/james-project/issues/5611). Aussi sur postgresql. Dossier : [`mailbox-query-role-filter/`](mailbox-query-role-filter.md)
- O, Memory/Lucene : hasKeyword et notKeyword sans inMailbox comparent les UID entre boîtes : [james#5612](https://github.com/linagora/james-project/issues/5612). Memory seulement. Dossier : [`memory-lucene-keyword-uid-collision/`](memory-lucene-keyword-uid-collision.md)
- P, Memory/Lucene : subject, text et body ne trouvent pas plus de 4 mots ni les mots après une ponctuation : [james#5613](https://github.com/linagora/james-project/issues/5613). Memory seulement. Dossier : [`memory-lucene-text-search-prefix-shingles/`](memory-lucene-text-search-prefix-shingles.md)
- Q, Memory/Lucene : SearchSnippet/get en NPE ou ParseException : [james#5614](https://github.com/linagora/james-project/issues/5614). Memory seulement. Dossier : [`memory-lucene-search-snippet-npe/`](memory-lucene-search-snippet-npe.md)
- Email/changes répond serverFail (ConcurrentModificationException) quand des changements du même compte s'écrivent pendant la lecture : [james#5625](https://github.com/linagora/james-project/issues/5625). Memory seulement. Pas de dossier.
- L'image postgresql répond `serverFail "not implemented"` à tout `SearchSnippet/get` : [james#5616](https://github.com/linagora/james-project/issues/5616). Pas de dossier.

## Pas d'issue (conforme)
- `email-set-create-destroy-inline-blob/` : create+destroy dans un même Email/set, blobs inline OK.
- `email-get-creation-id-reference/` : `#creationId` dans Email/get OK (RFC 8620 §3.7).
- Rôle `templates` auto pour « Templates » : voulu ; rôle non modifiable = JAMES-3530.
- Label/changes `invalidArguments` : seulement si l'état n'est pas un UUID, comme les autres /changes de James.

## Calendar, ajoutés en phase 5 (sans dossier de repro)
- `CalendarEventAttendance/get` renvoie `eventAttendanceStatus` alors que la doc dit `attendanceStatus` : [tmail#2697](https://github.com/linagora/tmail-backend/issues/2697), fermée, doc alignée par [tmail#2700](https://github.com/linagora/tmail-backend/pull/2700).
- `participationStatus` renvoyé en majuscules (`NEEDS-ACTION`), contrairement à la doc : [tmail#2698](https://github.com/linagora/tmail-backend/issues/2698), fermée, doc alignée par [tmail#2703](https://github.com/linagora/tmail-backend/pull/2703).
- L'image memory annonce `counterSupport` et `supportFreeBusyQuery` mais répond `serverFail` sans esn-sabre : pas d'issue ouverte.

## Pas ouverts, cause inconnue
- Un mail détruit encore lisible : non reproduit en plus de 2 600 essais.
- Un blob uploadé introuvable environ 430 ms après l'upload : rare, seulement sous saturation du CPU, cause non trouvée.

Statut au 2026-10-28 : les candidats F, G, H, N, O, P, Q, l'erreur d'Email/changes et la note postgresql sont ouverts dans James. Les autres sont corrigés ou n'ont pas d'issue, pour la raison donnée à chaque ligne.
