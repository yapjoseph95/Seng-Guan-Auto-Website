# Mail productivity additions

User requests: floating Toast feedback, editable original quote on reply, larger photo capacity, drafts, recoverable delete, categories and search. Prior All mailbox/signature/upload/autorefresh features remain.

Use native Resend thread search, labels and Trash folder. Do not permanently purge emails. Categories are per mailbox with create/rename/color/delete and assignment/filtering. Search covers subjects, bodies, parties and attachment names, across folders or current folder. Native search indexing may lag about a minute.

Saved drafts use existing private D1/R2 rather than provider draftattachment replacement: per authenticated administrator, available across devices, autosave/manualsave, original upload references and stable send IDs preserved. Optimistic concurrency prevents stale windows overwriting edits. Softdelete/restore supports Undo. Native provider drafts continue to be created on actual send.

Resend native drafts enforce25 MB across attachments, including URL-downloaded files; cannot raise that hardcap. Increase file count to50 and add optional local JPEG/PNG/WebP compression to2400px/.85 quality; originals remain untouched.

Success/errors use Sonner Toast without moving page content. Replyquote stays editable; sender signature is inserted above it. No authentication or DNS changes.
