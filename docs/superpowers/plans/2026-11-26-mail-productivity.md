# Implementation and verification

1. Add owner-scoped saved draft schema/API with partial-field validation, timestamp concurrency, search, softdelete/restore and upload-reference restoration.
2. Extend native list/search/category and recoverable Trash APIs with mailbox/UUID validation. Preserve merged pagination ordering.
3. Add Toast, quoted replies, draft persistence/navigation guards, search/scopes, categories management/assignment and Trash restore UI. Separate shared mailAPI and photo processing modules.
4. Exercise search forwarding, category assignment, Trash semantics, saved draft isolation/concurrency/restore and signature quote positioning in regression tests. Independent review before release.
5. Apply migration0020, build/typecheck/API checks, deploymain, inspect actual UI and send own synthetic attachment only for verification. Do not alter user signature settings or real customer conversations.
