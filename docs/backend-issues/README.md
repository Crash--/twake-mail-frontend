# Candidats issues tmail-backend — à relire avant ouverture (2026-10-05)

Chaque lien ouvre le texte de l'issue prêt à poster (`issue.md`). Les scripts de repro (`repro.mjs`, compose, résultats) restent sur la devbox dans `~/Sites/Linagora/tmail-backend-issues/<dossier>/`.
Rien n'est ouvert. Backend distribué de la devbox non testé (identifiants refusés par le contrôle de permissions).

## Déjà ouvertes
- #2682 vue de requête memory / team mailboxes — [`team-mailbox-email-query-view/`](team-mailbox-email-query-view.md)
- #2684 memory : Email/set update >3 ids modifie tout + blocage — [`memory-email-set-update-hang/`](memory-email-set-update-hang.md)
- #2685 bodyStructure ignoré — [`email-set-create-bodystructure-ignored/`](email-set-create-bodystructure-ignored.md)
- #2686 Email/get attachments → serverFail — [`email-get-attachments-readlevel-serverfail/`](email-get-attachments-readlevel-serverfail.md)

## À ouvrir (bugs vérifiés)
| # | Dossier | Titre proposé | Où | Gravité |
|---|---|---|---|---|
| A | [`email-submission-undo-send/`](email-submission-undo-send.md) | EmailSubmission/set: undoStatus "canceled" update silently ignored (reported as success), holdFor honoured while maxDelayedSend is 0, and dropped by the RabbitMQ queue while sendAt announces it | James (lié JAMES-3543) | Haute : bloque « Annuler l'envoi », succès mensonger |
| B | [`email-submission-forbidden-from-swapped/`](email-submission-forbidden-from-swapped.md) | EmailSubmission/set swaps forbiddenFrom and forbiddenMailFrom (RFC 8621 §7.5) | James | Moyenne |
| C | [`email-submission-unknown-identity/`](email-submission-unknown-identity.md) | EmailSubmission/set create ignores identityId and answers an unknown emailId with invalidArguments instead of invalidProperties | James | Faible (pas d'impact sécu) |
| D | [`memory-lucene-expunge-range/`](memory-lucene-expunge-range.md) | Memory/Lucene: expunging two or more consecutive UIDs removes every message of the mailbox from the search index (createQuery has no RANGE case) | James (memory/Lucene) | Haute sur memory |
| E | [`get-omits-null-properties/`](get-omits-null-properties.md) | /get methods omit requested properties whose value is null instead of returning null | James | Faible (conformité) |
| F | [`mailbox-templates-role/`](mailbox-templates-role.md) | Mailbox/set: a folder named "x-…" gets a custom role from its name and can no longer be renamed nor destroyed | James | Faible |
| G | [`mailbox-set-create-parent-creation-id/`](mailbox-set-create-parent-creation-id.md) | Mailbox/set create: parentId referencing a mailbox created in the same call (#creationId) fails with serverFail | James | Moyenne |
| H | [`identity-set-null-replyto-bcc/`](identity-set-null-replyto-bcc.md) | Identity/set update ignores null (replyTo, bcc, signatures, name), and the first update of a server-provided identity drops the properties the patch does not carry | TMail | Moyenne (perte de données sur 1re maj) |
| I | [`forward-set-partial-patch/`](forward-set-partial-patch.md) | Forward/set rejects partial patches: localCopy and forwards are both required in every update | TMail | Faible |
| J | [`label-set-color-null-and-changes-state/`](label-set-color-null-and-changes-state.md) | Label/set: the colour of a label cannot be removed (color: null refused on update) | TMail | Faible |
| K | [`filter-get-rule-ids/`](filter-get-rule-ids.md) | Filter/get output cannot be sent back to Filter/set: rules come without id and with the legacy condition next to conditionGroup | TMail | Moyenne |
| L | [`email-recovery-action-model/`](email-recovery-action-model.md) | EmailRecoveryAction and the vault capability deviate from the documented model (completed vs done, maxEmailRecoveryPerRequest as a string, no accountId/state) | TMail (doc surtout) | Faible |
| M | [`public-asset-uri-username/`](public-asset-uri-username.md) | PublicAsset: publicURI uses the username, not the documented account id, and public assets are not moved on username change | TMail (doc + rename) | Moyenne (alias → login exposé) |
| N | [`mailbox-query-role-filter/`](mailbox-query-role-filter.md) | Mailbox/query filter.role rejects the role values returned by Mailbox/get (sent, trash, junk…) and accepts folder names instead | James (Flutter dépend du bug) | Moyenne |
| O | [`memory-lucene-keyword-uid-collision/`](memory-lucene-keyword-uid-collision.md) | [Memory/Lucene] Email/query hasKeyword / notKeyword without inMailbox matches messages by UID across mailboxes | James (déjà évoqué dans un commentaire de #2039, sans cause : issue dédiée ou commentaire ?) | Haute sur memory : vues Favoris/libellés fausses |
| P | [`memory-lucene-text-search-prefix-shingles/`](memory-lucene-text-search-prefix-shingles.md) | [Memory/Lucene] Email/query subject / text / body never match strings of more than 4 words or words after punctuation | James | Moyenne sur memory |
| Q | [`memory-lucene-search-snippet-npe/`](memory-lucene-search-snippet-npe.md) | [Memory/Lucene] SearchSnippet/get: NPE with a non-matching text attachment, ParseException on [ or (, lost snippet for an email in two mailboxes | James | Moyenne (serverFail de tout l'appel) |

## Pas d'issue (conforme)
- `email-set-create-destroy-inline-blob/` : create+destroy dans un même Email/set, blobs inline OK.
- `email-get-creation-id-reference/` : `#creationId` dans Email/get OK (RFC 8620 §3.7).
- Rôle `templates` auto pour « Templates » : voulu ; rôle non modifiable = JAMES-3530.
- Label/changes `invalidArguments` : seulement si l'état n'est pas un UUID, comme les autres /changes de James.

## Notes
- L'image postgresql répond `serverFail "not implemented"` à tout `SearchSnippet/get` (FakeSearchHighlighter) : constat, pas de candidat.

## Ajoutés en phase 5 (sans dossier de repro pour l'instant)
- `CalendarEventAttendance/get` renvoie `eventAttendanceStatus` alors que la doc dit `attendanceStatus`.
- L'image memory annonce `counterSupport` et `supportFreeBusyQuery` mais répond `serverFail` sans esn-sabre.
- `participationStatus` renvoyé en majuscules (`NEEDS-ACTION`), contrairement à la doc.

Statut : en attente de relecture, rien n'est ouvert hors #2682, #2684, #2685, #2686.
