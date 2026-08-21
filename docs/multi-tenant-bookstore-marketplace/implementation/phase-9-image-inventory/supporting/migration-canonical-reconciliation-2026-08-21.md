# Canonical migration reconciliation (read-only) — 2026-08-21

Status: historical evidence-only release gate captured before the connected
rollout. At capture time, no migration was applied, no row in
`supabase_migrations.schema_migrations` was edited, no Vault secret was
provisioned, and `main` was not merged. M49-M51 were subsequently applied
forward-only and verified in
[unit8-connected-rollout-2026-08-21.md](./unit8-connected-rollout-2026-08-21.md);
this report remains the immutable mapping/review record and was not rewritten.

## Scope and hashing method

This inventory compares every SQL migration file under `supabase/migrations` with every applied row in the connected Supabase project `ahntbtktjjmvfosgkmgn` (Bookconnect_reactexpo). Local source hashes are SHA-256 of UTF-8 text after CRLF→LF normalization and trailing-whitespace trim. Live hashes are SHA-256 of the recoverable `rtrim(array_to_string(statements, E'\\n'), E'\\n\\r \\t')` value from `supabase_migrations.schema_migrations`. A hash match proves equivalent captured statement text under these normalizations. A mismatch is classified as divergent content for release-gate review; it is not silently treated as equivalent.

## Reconciliation summary

| Measure | Result |
| --- | ---: |
| Local migration files | 153 |
| Live migration rows | 150 |
| Shared logical names | 143 |
| Same logical name and exact version ID | 30 |
| Same logical name with different version IDs | 113 |
| Exact source/version matches | 4 |
| Same logical/different timestamp with matching captured source | 93 |
| Same logical/different timestamp with source mismatch | 20 |
| Exact version with source mismatch | 26 |
| Divergent-content rows | 46 |
| Live-only names | 7 |
| Local-only names | 10 |

The mismatch is not “local is ahead by three”. Supabase records application-time version IDs, while this checkout retains planned timestamp IDs for many shared logical migrations. The table below is the canonical name/version/source mapping. The 46 divergent rows are evidence flags requiring semantic review before any ledger repair or replay; they are not permission to rewrite history.

## M47/M48 boundary

| Logical migration | Local version | Live version | Local source SHA-256 | Live statements SHA-256 | Classification |
| --- | --- | --- | --- | --- | --- |
| `marketplace_phase9_legacy_rpc_security_remediation` | 20260817000047 | 20260817073341 | f1dd5dad3136a5d6f62cb07832f84d2a21f0aab3ec3b5df5a958f2219fdb46fe | f1dd5dad3136a5d6f62cb07832f84d2a21f0aab3ec3b5df5a958f2219fdb46fe | same_logical_different_timestamp |
| `marketplace_phase9_legacy_rpc_service_role_compatibility` | 20260817000048 | 20260817075825 | ab27933af36e3e977b4baf47380e7f9225d56614fbc25cadabab50583e449ea4 | ab27933af36e3e977b4baf47380e7f9225d56614fbc25cadabab50583e449ea4 | same_logical_different_timestamp |

M47 and M48 are present live under application-time IDs `20260817073341` and `20260817075825`, respectively, rather than the local planned IDs `20260817000047` and `20260817000048`. Both live statement hashes match their normalized local sources, so both map as the same logical migration with a different timestamp. The timestamp remap is evidence of application-time versioning, not a license to rewrite `schema_migrations`.

## Live-only migrations

- `harden_clubs_maintenance_rpc_execute_grants`
- `schedule_expired_club_member_actions_cleanup`
- `add_invitation_reminder_notifications`
- `marketplace_wishlist_notify_unify`
- `reading_notes_fk_and_cleanup`
- `library_user_book_pages_vault`
- `library_word_limit_hardening`

The four post-M48 live-only rows are `marketplace_wishlist_notify_unify`, `reading_notes_fk_and_cleanup`, `library_user_book_pages_vault`, and `library_word_limit_hardening`. They are unrelated to M49–M51 by logical name and must not be replayed or folded into this branch without a separately approved reconciliation.

## Local-only migrations

- `017_user_credit_balances_lockdown`
- `018_listings_city_visibility_policy`
- `019_book_public_reviews_contract`
- `016_set_current_book_from_nomination`
- `transfer_club_admin_rpc`
- `add_exchange_pickup_venue`
- `harden_club_primary_and_exchange_city`
- `marketplace_phase9_bookstore_first_discovery`
- `marketplace_phase9_storefront_detail`
- `marketplace_phase9_public_media_order_invariant`

The seven pre-Unit-8 local-only rows are `017_user_credit_balances_lockdown`, `018_listings_city_visibility_policy`, `019_book_public_reviews_contract`, `016_set_current_book_from_nomination`, `transfer_club_admin_rpc`, `add_exchange_pickup_venue`, and `harden_club_primary_and_exchange_city`. The remaining three local-only rows are the new Unit 8 migrations below.

## M49 → M50 → M51 apply boundary (still pending)

| Migration | Local version | Live version | Local source SHA-256 | Live version-name match |
| --- | --- | --- | --- | --- |
| `marketplace_phase9_bookstore_first_discovery` | 20260818000049 | — | 7685bf214083640ae9ca08a4b62dd2b3214e1e848136919c49b7ffe1e93606e8 | absent (local-only) |
| `marketplace_phase9_storefront_detail` | 20260820000050 | — | 467378213014a36233f34f7037a9151d71a120aa8d297f7afcff6a71795a9558 | absent (local-only) |
| `marketplace_phase9_public_media_order_invariant` | 20260821000051 | — | 47e67c9e7d793de17ed9f5866793847a87891089557911e12820e82f1dd6382d | absent (local-only) |

Read-only dependency evidence already collected:

- The live migration ledger contains no M49, M50, or M51 logical name; applying these three names would not replay a recorded migration.
- Live prerequisite relations/functions for the Unit 8 chain exist (stores, inventory/listing/media tables and the phase-9 eligibility/publication helpers), while the M49-created Q08/Q09/Q10 functions, cursor functions, and M51 public-order trigger are absent as expected before the chain.
- Live eligible media currently has zero invalid public orders, so M51's fail-closed preflight has no observed existing violation.
- M49, M50, and M51 each contain explicit fail-closed prerequisite/compatibility checks. The safe application sequence remains exactly M49, verify, M50, verify, M51, verify; no replay, ledger repair, or unrelated migration replay is authorized by this evidence alone.

## Canonical mapping table

Columns: logical name, local planned version, live applied version, normalized local source SHA-256, recoverable live statement SHA-256, live statement count, and classification. The live hash is recoverable from the stored `statements` array; no SQL text was modified.

| Logical migration | Local version | Live version | Local source SHA-256 | Live statements SHA-256 | Live statements | Classification |
| --- | --- | --- | --- | --- | ---: | --- |
| `001_initial_schema` | 20251228083154 | 20251228083154 | 2c88f079b141b8356d498f55b16909c487522925e0c622846a67549ea151f534 | c10c51f7f679d773873fc485d52b8525dbf588fd50039095610da3c860d168f3 | 1 | divergent_content |
| `002_p2p_exchange_system` | 20251228114030 | 20251228114030 | bff52b8f5509071b8cc8aa0ab08ec89ef28e9ef3268a1a154c968941b1dec06b | 0f237f6ffea6056524f065d5cce6ad85fba70660d2ce53de834282bfb14cb02a | 1 | divergent_content |
| `003_venues_and_clubs` | 20251228114057 | 20251228114057 | 8bf8e8c7be31a8f61a60561a7959dc6eb83454ffbc11e784a2e9da08b36e5e24 | 78d57b6cedb41c55157dcc763bbc23de7ee2d1c0ead8d8dee9fb930263ff738b | 1 | divergent_content |
| `004_chat_and_moderation` | 20251228114118 | 20251228114118 | 507022927ea37d55f70bdf7d0eb17ecf40e95f581744606096dc56133d3af13b | 957c40df2c19ded672c2da014ada48f236a44f73d71a6c7cd70686581ee421e0 | 1 | divergent_content |
| `005_add_missing_user_profile_fields` | 20251228114143 | 20251228114143 | 39d3783dd7640acf4b35fa9052cc7fdb6ce2d49378767154d506c89f1a1cbf68 | ff1214260f491badddd209337fb676fe6da8847ff066fbc3f62dc9712e4262e9 | 1 | divergent_content |
| `006_rls_policies_core_tables` | 20251228114353 | 20251228114353 | fdd46997d05f01a8ad56d8970acb8f6ab1d91ada2d0d4f67325d7dcbd985e073 | e5e036fc081d8c221a3bb6371673ae1ed929e3f9042c82689c0be204c2de31b4 | 1 | divergent_content |
| `007_rls_policies_exchange_system` | 20251228114414 | 20251228114414 | 6ed43431cae58d2f9cba401a54eff86914d02685ac9228183bfe28abca9665a4 | 15ba9bd745558b59e319560516ec9e797348dde54dda1d00693f2221424230dc | 1 | divergent_content |
| `008_rls_policies_venues_clubs` | 20251228114444 | 20251228114444 | f41bfc5b982ad18f1eabb694e6fc78f5fed3b4189ff3c5e923ab8bf8e5f60500 | be322ef979fbccd74dde9fabb6fd8f8ea4bdaba53bc0fa84ae3f6e9b0d58e0d7 | 1 | divergent_content |
| `009_rls_policies_chat_moderation` | 20251228114516 | 20251228114516 | 5864c17715caa1613277ce3384c211196c1d397dc58bdd71a737b1a60fc53411 | 1f6db10e2d0903e4c568cce89b01c7bbc8c9b41af24502a18b6dec935360da97 | 1 | divergent_content |
| `add_all_google_books_fields` | 20251231141336 | 20251231141336 | 0bf2941e0859c23a6401122426228ba7728ed86d04974d447aa11a7e0fcd0aa8 | 2c4dc51fbb856b6f38354778cb30c0a2562f831d1cefcb51e3232dd9d31d3c7c | 1 | divergent_content |
| `add_price_to_books` | 20251231142005 | 20251231142005 | 8638d9108c91493036e1e2c6f8d38b29110ef4a8da34f70f163c3f1a542e17d0 | 932ef56d3ac985fbe3a45e4eaa83c9f7547f2735aae6f83618344deeb0297c6c | 1 | divergent_content |
| `create_user_wishlist` | 20260101105319 | 20260101105319 | 08687635fa16cc0e77188a6c498949454f6038314048c8ac3cf08e754f9f920f | 400f552475dc5060939d4f5943ec7b8f42f3ec66db4cd54d4d5171fd8de6eb49 | 1 | divergent_content |
| `create_reading_notes` | 20260212150120 | 20260212150120 | 1e81dad83442b3013eefeb98aca5c1c19c82d0dee3aa01a06f15216410b24c8c | 805ae15cde5f915af7093ce19143489f5be355d4921473c1a52714534ec22bba | 1 | divergent_content |
| `010_clubs_identity_invitations_public_contract` | 20260307000500 | 20260307000500 | d89b3cdee1a3530cf36dbedbaade94239ea3e3ab6696c0a770d5e61e320639fd | — | — | divergent_content |
| `011_fix_club_members_select_policy_recursion` | 20260308222500 | 20260308222500 | 75025e302f3a548a0234204c197a0f285d3a3299b048e4fe9b29b72f6461850c | — | — | divergent_content |
| `012_club_book_workflow_contract` | 20260309143000 | 20260309143000 | 623924dbbe50b0a71292485de6c021bba9d725cd32962403d0d022df8c4c4913 | — | — | divergent_content |
| `013_clubs_entitlement_enforcement` | 20260310153000 | 20260310153000 | a47571c676f1e548fc264f40106fd6d026cb100c015cd06ef1e62013e791dc95 | — | — | divergent_content |
| `014_clubs_events_schema_policy_alignment` | 20260310170000 | 20260310170000 | c8211d03e564297f26fe70cc5489c7c02bfdd500943f8d978e4092fdce0c3cd7 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 | 0 | divergent_content |
| `015_clubs_events_rsvp_policy_cleanup` | 20260310173000 | 20260310173000 | 8ca495a8136b31ee3b7ec1a678b3aecd5c00e592ecdc7995d735f233d71b616c | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 | 0 | divergent_content |
| `014_club_book_finalize_manager_authorization` | 20260311113000 | 20260311113000 | 08f026a516219d80768b16abbc21d4c6afbcecb0d93a06617d7b920202207912 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 | 0 | divergent_content |
| `015_club_current_book_status_contract` | 20260311143000 | 20260311143000 | 29d99c5dc442c9edec3ccb8f2417c8b50a631e567e35980a1bd30bc4424149a9 | — | — | divergent_content |
| `017_user_credit_balances_lockdown` | 20260311183000 | — | 4a02fe95655d156b4de232933d07900d5ec263f24cc48a12b99c750404c22237 | — | — | local_only |
| `018_listings_city_visibility_policy` | 20260311190000 | — | 7100cccda93136f1da8baf280e5ddab55c3fa10fd23a14d9549c5f30a4cd1188 | — | — | local_only |
| `018_club_discussion_schema` | 20260311213000 | 20260311213000 | 2f2b2d29a77d64b9ed5f8532b2c1b9b7addd1bcaf5f8fe56b0102f6bd9014804 | — | — | divergent_content |
| `019_book_public_reviews_contract` | 20260312120000 | — | 72bd2229c3a1f9cb5aa36405c9a3b3c2166017135cf280e156405be81ea41929 | — | — | local_only |
| `016_set_current_book_from_nomination` | 20260507120000 | — | ac344d1dd474211ac03ee32390a181210ed3a8b3c68f9e4961a94ccbe47ed88e | — | — | local_only |
| `submit_transaction_rating_rpc` | 20260510174645 | 20260511005757 | 597ffc9b2441bb5d71dd8334df977554228629b6dbbd9b8e42ecc718ef555cbd | a6c020e51631074d8f45852e4c5120bc59e5e20eda60d2ddef61980b1f9e0322 | 1 | divergent_content |
| `restrict_submit_transaction_rating_execute` | 20260511005840 | 20260511005903 | 63ef72202103906c275a795e1312cf9a36ab8e8c63b2c9749a5405aa8baf8341 | 63ef72202103906c275a795e1312cf9a36ab8e8c63b2c9749a5405aa8baf8341 | 1 | same_logical_different_timestamp |
| `file_transaction_dispute_rpc` | 20260511010600 | 20260511010847 | 704b56405c7327d6f4419eb4fc54f5f85d7ff01c33ac204adc19303a862fc490 | 704b56405c7327d6f4419eb4fc54f5f85d7ff01c33ac204adc19303a862fc490 | 1 | same_logical_different_timestamp |
| `harden_exchange_schema` | 20260522053238 | 20260522223158 | bc8851bfb26726ad2902aeaaf15491c5aec327659c7abc2592fc757d9d82320d | bc8851bfb26726ad2902aeaaf15491c5aec327659c7abc2592fc757d9d82320d | 1 | same_logical_different_timestamp |
| `cleanup_exchange_rpc_security` | 20260522225437 | 20260522225437 | fdc4f84d3ceb656f00a2044c7c81658b4e7b4c895bee5a644f2fce8b3d50a813 | fdc4f84d3ceb656f00a2044c7c81658b4e7b4c895bee5a644f2fce8b3d50a813 | 1 | exact_match |
| `harden_exchange_rpc_actor_auth` | 20260522230352 | 20260522230352 | 83ebae28db9ae08cbc8f86f497978d6ca517ada05545fd484e0178fd8759d7b6 | 83ebae28db9ae08cbc8f86f497978d6ca517ada05545fd484e0178fd8759d7b6 | 1 | exact_match |
| `harden_clubs_rpc_execute_grants` | 20260523035706 | 20260523035706 | 3e63637faf2528a916b449dc2ca6127bc7d5bfc634c92be18153f38139d186f8 | 3e63637faf2528a916b449dc2ca6127bc7d5bfc634c92be18153f38139d186f8 | 1 | exact_match |
| `harden_clubs_member_entitlement_execute_grant` | 20260523035843 | 20260523035843 | 28d0ebaae8dccd4b712ddeb9ad9db35b912faa67cef53d0d09a564a651c815f9 | 304fb4a427097abdb743ac1eeed6b0eeaa6028d4421c9b681ea5baa3d0e2667d | 1 | divergent_content |
| `create_club_rpc` | 20260523054932 | 20260523091023 | 02d950b52302efb12d0eee74515cc2dbfe73358f2b494c7df357dab11978ef82 | 02d950b52302efb12d0eee74515cc2dbfe73358f2b494c7df357dab11978ef82 | 1 | same_logical_different_timestamp |
| `harden_club_public_details_view` | 20260523090700 | 20260523091641 | cea6c6befc867c5575451becb57bc6c0dca801e76afb607547880d7f97078117 | cea6c6befc867c5575451becb57bc6c0dca801e76afb607547880d7f97078117 | 1 | same_logical_different_timestamp |
| `restrict_club_public_details_view_grants` | 20260523091736 | 20260523091800 | 7cf69b9006905c30e3f380ca4a0e81003a698113e5d918dfd04c114c795a8a1e | 7cf69b9006905c30e3f380ca4a0e81003a698113e5d918dfd04c114c795a8a1e | 1 | same_logical_different_timestamp |
| `add_club_invitation_revoke_read_rpc` | 20260523092143 | 20260523092232 | 396554897491ccaca381f1b3c7dd8ec958f7550d8d5ac9005efc5a760c23d615 | 396554897491ccaca381f1b3c7dd8ec958f7550d8d5ac9005efc5a760c23d615 | 1 | same_logical_different_timestamp |
| `harden_profile_account_security` | 20260524043322 | 20260524043322 | 8381893b2179150a068d323a3e98dfaba4e435c97808fa774b6aab7e43a05079 | 8381893b2179150a068d323a3e98dfaba4e435c97808fa774b6aab7e43a05079 | 1 | exact_match |
| `transfer_club_admin_rpc` | 20260527104248 | — | 2bb26c5434ae9bf64666ee716aa383c2e85a80bc008690a7cd0112c456ab1101 | — | — | local_only |
| `clubs_moderation_cleanup_and_policy_notes` | 20260529143000 | 20260605123242 | 9d48d70f77bbf64875e5579976aee07fc40f83c0218a6f80b723634649d70a32 | 9d48d70f77bbf64875e5579976aee07fc40f83c0218a6f80b723634649d70a32 | 1 | same_logical_different_timestamp |
| `club_moderation_author_lifecycle_rpc` | 20260529154500 | 20260605123337 | 87d23624aa1431097450cb8aa5d063bd667e15c4298d6cc6aa029f08418066f4 | 87d23624aa1431097450cb8aa5d063bd667e15c4298d6cc6aa029f08418066f4 | 1 | same_logical_different_timestamp |
| `club_downgrade_grace_period` | 20260529170000 | 20260605123430 | c95abab2bdccfe22b932b3c770219b608a0cf35de963e72cb9e8d67a04612646 | c95abab2bdccfe22b932b3c770219b608a0cf35de963e72cb9e8d67a04612646 | 1 | same_logical_different_timestamp |
| `harden_clubs_maintenance_rpc_execute_grants` | — | 20260605123630 | — | 7ba0d02ca93214b7a8be2ff1132f80bcf0b787cf5fc731c01b2ede10c99bae7f | 1 | live_only |
| `schedule_expired_club_member_actions_cleanup` | — | 20260605123747 | — | 9986710522ed22879a50fcdeb91bf51b61d5ca70b293aaf2388605bd38bd2808 | 1 | live_only |
| `add_exchange_pickup_venue` | 20260605175646 | — | b0bcdf81ae9a36110f53bd0f4850825112209e2a0c79ad0870d577483bcf3ac6 | — | — | local_only |
| `enterprise_notifications` | 20260606103405 | 20260606103405 | 5bc156afe7868ff4907e2bc6d2c294bfc39dc88aa8f53c12570c6e7b034f33bc | 646360906613e7162be6894607a81562e11591b100dc2a72df61752b41e693fa | 1 | divergent_content |
| `notification_event_routing` | 20260606103516 | 20260606103516 | a434f5d6b20c4309ff6ac06146a64176aee24a570887f1ebb525a50fd77fd622 | edb756ed0d3988694e107a25a5d030c9eede20780c5a723e7f77fd2b1b625222 | 1 | divergent_content |
| `harden_notifications_advisor_findings` | 20260606103926 | 20260606103926 | 2ff1a5f5a853f351a34346b0e2542fb5d8ed7433a12a2c5a63335593b8f7bf34 | 028d90ed10e5670c33d323e25770dd919d341456db0cf975bb84a4b56640f40c | 1 | divergent_content |
| `complete_clubs_notifications_and_reminders` | 20260606142000 | 20260606155956 | 8e18962e1a1c18ca1fe6682653f84ba9f6d817e2e7455f0d1f1c85873c068dee | 5daa40daf8fa00b8d6c76d41a1e94e1d79d5ee835e7eed4a13f4ae8e75d736da | 1 | divergent_content |
| `wishlist_notify_rpc` | 20260606143000 | 20260606160224 | 43e020cd861f05cf852cf41be5baeb2ba125210cef20f71bd0d195843af4a473 | 43e020cd861f05cf852cf41be5baeb2ba125210cef20f71bd0d195843af4a473 | 1 | same_logical_different_timestamp |
| `add_invitation_reminder_notifications` | — | 20260606160722 | — | 5f348f2ef8920077fba0affbeaa0199a96d3a6b1e3482e6ee649221a37499379 | 1 | live_only |
| `marketplace_foundation_schema` | 20260619000001 | 20260619060411 | 1437a1a8865086cfb66e279ac0140cb70f664a3d1f5193f947bc71e6b32a51f0 | af542e4c799923c7c7470b7389f01e633b4565b8da6f5f3b12e04449a5998bbd | 1 | divergent_content |
| `marketplace_foundation_helpers` | 20260619000002 | 20260619060437 | 423f3318217c343d64aae202d186b25825c9d086c7b9496d1fd2dd8d8c1c3874 | 9c514aaa3a4e145d137db98c1ad1d5646c481e3d8e8a087b9bfb8f1af49a9b58 | 1 | divergent_content |
| `marketplace_foundation_rls` | 20260619000003 | 20260619060527 | b9e5a9462fca82df45960fd1145fab4312ad2e31c11e9c80caabd6a4e851124d | 198cf55fcaea7ef4377c66e7935983e55293f3ea1456d696c9fcbee607232aa5 | 1 | divergent_content |
| `marketplace_foundation_storage` | 20260619000004 | 20260619060547 | 66fd0d65eee5acf5a3d10ec62694d53925ea1ea8bb48aac28235870b7a13df9b | 253f8c9869c1d557c2d462a43c956a31ef0caa0b91667fcef2df6d34723ff812 | 1 | divergent_content |
| `marketplace_notifications_fk_indexes` | 20260619000005 | 20260619065834 | b704896fb960a5a15275879566694020eab7e1b8181521392898e2e857526023 | 468a82e92f1e55671b60a3a5f71899f48419a5f5c05bbbff52451fe35a9c69a5 | 1 | divergent_content |
| `marketplace_phase2_onboarding_hardening` | 20260627000001 | 20260627181341 | 7a4bcb25fa0820619e908d96b5719516e221b5943c9ad84741ace69930e7bcf8 | 7a4bcb25fa0820619e908d96b5719516e221b5943c9ad84741ace69930e7bcf8 | 1 | same_logical_different_timestamp |
| `marketplace_phase2b_application_metadata` | 20260628000001 | 20260628090815 | 69163694b5cb8ebde6a17145dee8c50c2979fb151873f5b02f95448142903e43 | 69163694b5cb8ebde6a17145dee8c50c2979fb151873f5b02f95448142903e43 | 1 | same_logical_different_timestamp |
| `marketplace_phase2c_review_metadata` | 20260628000002 | 20260628102752 | 95f027fcf94d62ae479a7882dde3132524891503c4f75aa327d312def9aaab3c | 23078df0253696422f603f4fa574e11802679ba6e8cfbd69ce22c174fe53f972 | 1 | divergent_content |
| `marketplace_phase3_inventory_canonical_listings` | 20260628000003 | 20260628181842 | 6a57e05ced678dcac130086093667c4f562dcf04c6c3660aa89f0abff59e02a9 | 6a57e05ced678dcac130086093667c4f562dcf04c6c3660aa89f0abff59e02a9 | 1 | same_logical_different_timestamp |
| `marketplace_phase5_consumer_discovery_schema` | 20260701000001 | 20260701062905 | 3009557ec68fc66b1acd67b831c876b1afeb81b53164a868605ff3e66c007808 | 3009557ec68fc66b1acd67b831c876b1afeb81b53164a868605ff3e66c007808 | 1 | same_logical_different_timestamp |
| `marketplace_phase3_public_listing_policy_split` | 20260713000001 | 20260715155047 | 8a399324a1655c57abeab58424313a0fdba8b07f9c677196da1dba29029a6e5f | 8a399324a1655c57abeab58424313a0fdba8b07f9c677196da1dba29029a6e5f | 1 | same_logical_different_timestamp |
| `harden_club_primary_and_exchange_city` | 20260714000001 | — | aefa4959c4743d495a492a09b75547045fd4654fcebd9c877f8cbccb65ce47b6 | — | — | local_only |
| `marketplace_phase4_security_hardening` | 20260715000001 | 20260715115929 | 91f8596577bc9dbe99216a27c22d5d659dc11a3e2028c26097744fe6258120e6 | 91f8596577bc9dbe99216a27c22d5d659dc11a3e2028c26097744fe6258120e6 | 1 | same_logical_different_timestamp |
| `marketplace_phase5_discovery_hardening` | 20260715000002 | 20260715155103 | 2bac1ee3af69f4f0b13091dea97121a901522d752d39bf1d6398d4ec3ca3d67a | 81ca2e6f9f12f1ed918a3bf8bce4d86cc1faa805259dfd6dfcab10480504f94d | 1 | divergent_content |
| `marketplace_phase5_public_policy_projection_fix` | 20260715000003 | 20260715174111 | 2218c3de6a0f5927a16b5da8cdcf9f53293184666aef2daab563505c018858ba | 2218c3de6a0f5927a16b5da8cdcf9f53293184666aef2daab563505c018858ba | 1 | same_logical_different_timestamp |
| `marketplace_phase6_order_request_core` | 20260716000001 | 20260716144007 | 081210204302db84b5f8b8be31174693cc682df3e76817c945b6f82b99ee06db | 081210204302db84b5f8b8be31174693cc682df3e76817c945b6f82b99ee06db | 1 | same_logical_different_timestamp |
| `marketplace_phase6_order_request_evidence` | 20260716000002 | 20260716144042 | 64be819f09433b7f6379d39ac861a5ce011bba0da9dd46995a9851b8c0735709 | 64be819f09433b7f6379d39ac861a5ce011bba0da9dd46995a9851b8c0735709 | 1 | same_logical_different_timestamp |
| `marketplace_phase6_infrastructure_extensions` | 20260716000003 | 20260716144055 | 110ba1b459d6a7d2bc12fd14a828d72373760e603d7996b09785a7f631e6bdba | 110ba1b459d6a7d2bc12fd14a828d72373760e603d7996b09785a7f631e6bdba | 1 | same_logical_different_timestamp |
| `marketplace_phase6_authorization_safe_reads` | 20260716000004 | 20260716144115 | aba0eb379e5642ede252af3f045044e31b4e3d9e76b8385f1cca754597ccca32 | aba0eb379e5642ede252af3f045044e31b4e3d9e76b8385f1cca754597ccca32 | 1 | same_logical_different_timestamp |
| `marketplace_phase6_eligibility_resolver` | 20260716000005 | 20260716144129 | 681cd626bbd417a58f526d3aad7be6d3b984d2688b38346673a101730d700efd | 681cd626bbd417a58f526d3aad7be6d3b984d2688b38346673a101730d700efd | 1 | same_logical_different_timestamp |
| `marketplace_phase6_cart_command_foundation` | 20260716000006 | 20260716144220 | 9930d37cf82f6afb6192ffc7730bb1163460c83dc2050839f7bec18c7f623890 | 9930d37cf82f6afb6192ffc7730bb1163460c83dc2050839f7bec18c7f623890 | 1 | same_logical_different_timestamp |
| `marketplace_phase6_cart_commands` | 20260716000007 | 20260716144241 | 1a93bae96bc35fe17695f1f970f0ad9db74fa589937e3c542cfa13f6a4739289 | 1a93bae96bc35fe17695f1f970f0ad9db74fa589937e3c542cfa13f6a4739289 | 1 | same_logical_different_timestamp |
| `marketplace_phase6_cart_replacement` | 20260716000008 | 20260716144258 | 6bc1ed3703c4e921f5d65c105c2d8ba5bea172f9e058259f6563840b4ce2c85b | 6bc1ed3703c4e921f5d65c105c2d8ba5bea172f9e058259f6563840b4ce2c85b | 1 | same_logical_different_timestamp |
| `marketplace_phase6_submission_helpers` | 20260716000009 | 20260716144312 | 51e72a832d3ed505389eead5b0fa842a2437db80609a0c2da4c0703a89dcf9f3 | 51e72a832d3ed505389eead5b0fa842a2437db80609a0c2da4c0703a89dcf9f3 | 1 | same_logical_different_timestamp |
| `marketplace_phase6_submit_order_request` | 20260716000010 | 20260716144326 | e543e46b24e59a98d433e723b890ce1b1f535b52432d4f4bbd962c896d34dbdd | e543e46b24e59a98d433e723b890ce1b1f535b52432d4f4bbd962c896d34dbdd | 1 | same_logical_different_timestamp |
| `marketplace_phase6_hold_helpers` | 20260716000011 | 20260716144411 | 3556e6946b5a1ca202fe3eae3922023dcebe92de9de7aa573c5f0ba071903f4c | 3556e6946b5a1ca202fe3eae3922023dcebe92de9de7aa573c5f0ba071903f4c | 1 | same_logical_different_timestamp |
| `marketplace_phase6_owner_review_outcomes` | 20260716000012 | 20260716144429 | d32294a60acf9199f9010c863e24e6e5b28a4aae4018fe24abd4fc5ee6733e89 | d32294a60acf9199f9010c863e24e6e5b28a4aae4018fe24abd4fc5ee6733e89 | 1 | same_logical_different_timestamp |
| `marketplace_phase6_clarification_support_schema` | 20260716000013 | 20260716144445 | ccfc6d07566ee22324c01a94150f9065ee656769e0a6942e8da1a749c7715ab1 | ccfc6d07566ee22324c01a94150f9065ee656769e0a6942e8da1a749c7715ab1 | 1 | same_logical_different_timestamp |
| `marketplace_phase6_clarification_commands` | 20260716000014 | 20260716144504 | 4054153f72afb2808eeb7c0a458af464e8231bb5bf2ed1ac017a6ad81aea5766 | 4054153f72afb2808eeb7c0a458af464e8231bb5bf2ed1ac017a6ad81aea5766 | 1 | same_logical_different_timestamp |
| `marketplace_phase6_owner_support_request` | 20260716000015 | 20260716144521 | 1046f5dff74b90d1c23253f5b1c7080b5c682daf765ca05c57ca22dda7e1149b | 1046f5dff74b90d1c23253f5b1c7080b5c682daf765ca05c57ca22dda7e1149b | 1 | same_logical_different_timestamp |
| `marketplace_phase6_support_interventions` | 20260716000016 | 20260716144535 | 2fda55d4cc182c0e09022384befa4fb0eeb031545787d22e1e6664c892c5d0a4 | 2fda55d4cc182c0e09022384befa4fb0eeb031545787d22e1e6664c892c5d0a4 | 1 | same_logical_different_timestamp |
| `marketplace_phase6_payment_ready_helpers` | 20260716000017 | 20260716144619 | 3f7415f4563f6858453bdf1d1b6995b154b5d3e85ed8df639fb3f3a1b210222d | 3f7415f4563f6858453bdf1d1b6995b154b5d3e85ed8df639fb3f3a1b210222d | 1 | same_logical_different_timestamp |
| `marketplace_phase6_customer_decision_commands` | 20260716000018 | 20260716144638 | d1b0499f7865222a3fcd6e95e4b54f5ee3921d9438ee06e8df1fa0731536537f | d1b0499f7865222a3fcd6e95e4b54f5ee3921d9438ee06e8df1fa0731536537f | 1 | same_logical_different_timestamp |
| `marketplace_phase6_terminal_expiry_commands` | 20260716000019 | 20260716144655 | 181555aca84b976e856a604efc8093ff720af9002183e974914450337c567d80 | 181555aca84b976e856a604efc8093ff720af9002183e974914450337c567d80 | 1 | same_logical_different_timestamp |
| `marketplace_phase6_schedule_engine` | 20260716000020 | 20260716144710 | baca1f495f2ecc4d7a44e791f26b45f0c77ca81c31951ad50f2d7cd2859bd86a | baca1f495f2ecc4d7a44e791f26b45f0c77ca81c31951ad50f2d7cd2859bd86a | 1 | same_logical_different_timestamp |
| `marketplace_phase6_deadline_integration` | 20260716000021 | 20260716144725 | 09a62b6d46fe158a9411770d4ffb7cc449b3dc0eef3c29d4e5c596d2d5fd0497 | 09a62b6d46fe158a9411770d4ffb7cc449b3dc0eef3c29d4e5c596d2d5fd0497 | 1 | same_logical_different_timestamp |
| `marketplace_phase6_clarification_timeout` | 20260716000022 | 20260716144742 | 81fbcf9cbf7d79baaa5af12df2d850616a0e00686e5bca06c8e15f3f01a97f8c | 81fbcf9cbf7d79baaa5af12df2d850616a0e00686e5bca06c8e15f3f01a97f8c | 1 | same_logical_different_timestamp |
| `marketplace_phase6_closure_commands` | 20260716000023 | 20260716144801 | e2d424aef03a7918cc59369d02f8956d8a96c1aa2167cd167a54cead798f7167 | e2d424aef03a7918cc59369d02f8956d8a96c1aa2167cd167a54cead798f7167 | 1 | same_logical_different_timestamp |
| `marketplace_phase6_event_notification_contract` | 20260716000024 | 20260716144903 | 52e74f93ec165853a0b048f8347d540fdf190cef046e311e831ae8d9a5d8ec98 | 52e74f93ec165853a0b048f8347d540fdf190cef046e311e831ae8d9a5d8ec98 | 1 | same_logical_different_timestamp |
| `marketplace_phase6_notification_transport` | 20260716000025 | 20260716144920 | 6900c084fb86796ccf01287242c423ec38b718cc24bcad29b966faee4e1c70cb | 6900c084fb86796ccf01287242c423ec38b718cc24bcad29b966faee4e1c70cb | 1 | same_logical_different_timestamp |
| `marketplace_phase6_task_claim_retry` | 20260716000026 | 20260716144938 | 84e37dd87625410a78f0f63ca65978d53b63dc5ff047de55c61b1feb288ceaa2 | 84e37dd87625410a78f0f63ca65978d53b63dc5ff047de55c61b1feb288ceaa2 | 1 | same_logical_different_timestamp |
| `marketplace_phase6_task_commands` | 20260716000027 | 20260716145003 | 5665fe49f27c165f04aa7e2e54e328e242e4894d9798b856ca2ee3de6a72f26b | 5665fe49f27c165f04aa7e2e54e328e242e4894d9798b856ca2ee3de6a72f26b | 1 | same_logical_different_timestamp |
| `marketplace_phase6_scheduler_contract` | 20260716000028 | 20260716145021 | 4564ca75e39465e42b8076703b48fad6c92bc347d891bd187b31ecf2559acfd4 | 4564ca75e39465e42b8076703b48fad6c92bc347d891bd187b31ecf2559acfd4 | 1 | same_logical_different_timestamp |
| `marketplace_phase6_ui_safe_projections` | 20260716000029 | 20260716145132 | 63b858d728f44a0d0f83128bd8ca1c0e776ba482652d414e39fa56eaf226a988 | 63b858d728f44a0d0f83128bd8ca1c0e776ba482652d414e39fa56eaf226a988 | 1 | same_logical_different_timestamp |
| `marketplace_phase6_owner_ui_safe_projections` | 20260716000030 | 20260716145159 | 835af29b2b880e02dcfb90493f79959a31bee40c5cc633df8e1a04d70fb77b9d | 835af29b2b880e02dcfb90493f79959a31bee40c5cc633df8e1a04d70fb77b9d | 1 | same_logical_different_timestamp |
| `marketplace_phase6_reconciliation_foundation` | 20260716000031 | 20260716145214 | deb19fc0159ef097a4bae481b00fb0aebc2593ca2c6dc8cbd6696a531a8ffd98 | deb19fc0159ef097a4bae481b00fb0aebc2593ca2c6dc8cbd6696a531a8ffd98 | 1 | same_logical_different_timestamp |
| `marketplace_phase6_reconciliation_scans` | 20260716000032 | 20260716145234 | 82b3c1c1a2fa9a21e8d46b3bb5976fe1e0f091d36d0a7788a870c5b3f2f702c3 | 82b3c1c1a2fa9a21e8d46b3bb5976fe1e0f091d36d0a7788a870c5b3f2f702c3 | 1 | same_logical_different_timestamp |
| `marketplace_phase6_observability` | 20260716000033 | 20260716145253 | ec06f44211bd7c654b6a86aba69750e93aabb158e3c5705f9390e4ce8112e27b | ec06f44211bd7c654b6a86aba69750e93aabb158e3c5705f9390e4ce8112e27b | 1 | same_logical_different_timestamp |
| `marketplace_phase6_support_task_provenance_fix` | 20260716000034 | 20260716145821 | b772bff4c64ab2db62257e8fdedba2ea87635e16073a1916a9c4ab5f2a07c81d | b772bff4c64ab2db62257e8fdedba2ea87635e16073a1916a9c4ab5f2a07c81d | 1 | same_logical_different_timestamp |
| `marketplace_phase6_support_event_source_fix` | 20260716000035 | 20260716150214 | 99b306bd13d3d6a60494e07a4e6348d6f8269090fb8311baac1cfbbffc96e834 | 99b306bd13d3d6a60494e07a4e6348d6f8269090fb8311baac1cfbbffc96e834 | 1 | same_logical_different_timestamp |
| `marketplace_phase6_support_deadline_task_fix` | 20260716000036 | 20260716150557 | 52b146ee768c7b33cf31e4bdad7cded6fa12842c1e94530b6c7d9199f4062e6d | 52b146ee768c7b33cf31e4bdad7cded6fa12842c1e94530b6c7d9199f4062e6d | 1 | same_logical_different_timestamp |
| `marketplace_phase6_listing_evidence_projection_fix` | 20260716000037 | 20260716151037 | 7dc18c1a2ac5be6fde0ca1f3812036aa2473676ed7d716cc9a5e8da067f890d0 | 7dc18c1a2ac5be6fde0ca1f3812036aa2473676ed7d716cc9a5e8da067f890d0 | 1 | same_logical_different_timestamp |
| `marketplace_phase6_emergency_pause_remainder_fix` | 20260716000038 | 20260716151452 | 9ee3389c9f5125f2be453deb1fe3f1c15cc5560a3600cea19b9fc733c3ac99ca | 9ee3389c9f5125f2be453deb1fe3f1c15cc5560a3600cea19b9fc733c3ac99ca | 1 | same_logical_different_timestamp |
| `marketplace_phase6_emergency_resume_zero_fix` | 20260716000039 | 20260716151841 | fd5333b2383a096433c859e410330aa0b10191e9b3cf7fbc5a4f67738a38b190 | fd5333b2383a096433c859e410330aa0b10191e9b3cf7fbc5a4f67738a38b190 | 1 | same_logical_different_timestamp |
| `marketplace_phase9_catalogue_metadata_expand` | 20260722000001 | 20260722090236 | 7aaa3af2c5dd0d3e97dd3cd9d7370ea72152ca9a1562d20821686c279d6dbbde | 25f55f6c80d1cafc7e2be4ed0a0697ab365249aa253b515b2a936468c5ffa014 | 1 | divergent_content |
| `marketplace_phase9_extraction_persistence` | 20260722000002 | 20260722090256 | 837bcbca01a8a9d2674acceac6a7c8ee5d59d7f4a562971d8c81612e3a513fe8 | 8525896d083300e77a02c9e0bde6ec3abfb192ba0c34ae060b3444bb47fa8a0c | 1 | divergent_content |
| `marketplace_phase9_media_registry` | 20260722000003 | 20260722090321 | c377ae66786294d981fb007aa2ba4cc7e35687503082bbff239477a445ee6564 | e90a0d86a9b1ef99f8ea3b682a295827dbcfa632a3594531d03f152c44669168 | 1 | divergent_content |
| `marketplace_phase9_condition_damage_transition` | 20260722000004 | 20260722090341 | 1d48cb51f299c514a21756ed94149bd913602c098a41d5a963a79d69b64fcb04 | 6f3cf76b03d7abf0d42ce4fc234f4ec5ec0601eb38552bd4ad60bec65d4d5c2a | 1 | divergent_content |
| `marketplace_phase9_controlled_inventory_commands` | 20260722000005 | 20260722090407 | 750970f6a22c5e400e45525500aeaf61cb117e1afad68d4d6cc0d8ace0b19b48 | ddf78bbf5d2309fcf74d828a86dfae7af9bcaa50bbe7957adaa93db2ca820aa4 | 1 | divergent_content |
| `marketplace_phase9_storage_boundaries` | 20260722000006 | 20260722095443 | 11729c94ae4cd40f0968cc8acff237fce3fe6846816fe996d27ba44e639d91ed | 11729c94ae4cd40f0968cc8acff237fce3fe6846816fe996d27ba44e639d91ed | 1 | same_logical_different_timestamp |
| `marketplace_phase9_public_projection_search` | 20260722000007 | 20260722095545 | b1cf402dc020c1aa45f51f8a6b70371ee8f26f6e95d31f5e7aa3ca1cc1c39b1f | b1cf402dc020c1aa45f51f8a6b70371ee8f26f6e95d31f5e7aa3ca1cc1c39b1f | 1 | same_logical_different_timestamp |
| `marketplace_phase9_request_photo_seam` | 20260722000008 | 20260722095729 | 6c32413f7b7fd9546a388fbadda5abcfaab656ed37bf9827ecf739f88d0fc0a0 | fb6c409b642b3cca9307e5809f5ebf93b7f87e7fbc1dfe2199bf9514a7c6b462 | 1 | divergent_content |
| `marketplace_phase9_public_boundary_security_correction` | 20260722000010 | 20260722125256 | 7c3250be6dc3bafdf1be5f476d4646f9c48af76365240962686d28b71521ad6d | 7c3250be6dc3bafdf1be5f476d4646f9c48af76365240962686d28b71521ad6d | 1 | same_logical_different_timestamp |
| `marketplace_phase9_ingestion_runtime_foundation` | 20260723000011 | 20260726182238 | 65e904fd882f972ccaeb52165d5a7ba77222c01e7570e11f5786d34a96ff8cff | 809e48a2bda416938b4a6079aa3b8c5e3938bbf65158159ef897a6dfe6889977 | 1 | divergent_content |
| `marketplace_phase9_vision_analysis_runtime` | 20260726000012 | 20260726182539 | c7abaf27b62e0c347ad2d4669007e0e80c0821e1a5586f90bda44e72fdf86be1 | 30c2712fba4a3b2cc543b65569747d30c91bbcf6d6ca9f6c626227ae761f06c1 | 1 | divergent_content |
| `marketplace_phase9_service_rpc_wrappers` | 20260727000013 | 20260727025046 | cddc7668614b57c08d1fc38efe3144a8dc1a49d82ae855e4877d38384b18ab8e | cddc7668614b57c08d1fc38efe3144a8dc1a49d82ae855e4877d38384b18ab8e | 1 | same_logical_different_timestamp |
| `marketplace_phase9_vision_provider_attempts` | 20260727000014 | 20260727183546 | b1e7216a6de3c4773ca8c864888500e073d1327f59c58d68c18c11d6d4e1d0b2 | f8e1ead7ab8a49571147020385fc6b79c13ebfb3a8899b6ab4449fec6b669bea | 1 | divergent_content |
| `marketplace_phase9_metadata_foundation` | 20260728000015 | 20260727222159 | b8067e8ee20af988e7d2a7f31d3a28a40281d0c9a52de55d934f112b7ed64569 | 01b6691fdfd578d41adf7c5d7d7d974e26acd4b9fa2dc1e92b5b7245e00c4f4b | 1 | divergent_content |
| `marketplace_phase9_sensitive_table_acl_correction` | 20260728000016 | 20260727231217 | 888eb2308f737b224f3bb59602197de77f5d092bf5dd9fe0c28368bfd55f5691 | 888eb2308f737b224f3bb59602197de77f5d092bf5dd9fe0c28368bfd55f5691 | 1 | same_logical_different_timestamp |
| `marketplace_phase9_maintain_acl_correction` | 20260728000017 | 20260727233457 | 5901d9fd26a7761434a3695402c3304bbc8fb27298d87a8824c3c1e09e22841f | 5901d9fd26a7761434a3695402c3304bbc8fb27298d87a8824c3c1e09e22841f | 1 | same_logical_different_timestamp |
| `marketplace_phase9_search_variant_proposals` | 20260729000018 | 20260729004216 | 8639acb196bbec9753603bd2beefb38b34d199cef3a496d1945c044f49f06be6 | 8639acb196bbec9753603bd2beefb38b34d199cef3a496d1945c044f49f06be6 | 1 | same_logical_different_timestamp |
| `marketplace_phase9_search_variant_replay_fence` | 20260729000019 | 20260729020008 | 05f6420b7d2cde7239601b5469ee90f30f7d0bddadedcf8370bf69ca4a89d009 | 05f6420b7d2cde7239601b5469ee90f30f7d0bddadedcf8370bf69ca4a89d009 | 1 | same_logical_different_timestamp |
| `marketplace_phase9_variant_runtime_search` | 20260729000020 | 20260729054842 | ae974218f121407ab672964624da805f36dc4ba95ab06bc97288418f582b6cd1 | ae974218f121407ab672964624da805f36dc4ba95ab06bc97288418f582b6cd1 | 1 | same_logical_different_timestamp |
| `marketplace_phase9_defer_active_variant_search` | 20260729000021 | 20260729060238 | b0ad7680fb4756cba632b216d9cb62f2d73c5ec9f0be3ca66587d863d09996b6 | b0ad7680fb4756cba632b216d9cb62f2d73c5ec9f0be3ca66587d863d09996b6 | 1 | same_logical_different_timestamp |
| `marketplace_phase9_active_variant_search` | 20260729000022 | 20260729075459 | 5dbf5279b52886febec020544602fe2e71713e8f2b6fc4b716fc487d3c05d373 | 5dbf5279b52886febec020544602fe2e71713e8f2b6fc4b716fc487d3c05d373 | 1 | same_logical_different_timestamp |
| `marketplace_phase9_active_variant_search_correction` | 20260729000023 | 20260729082153 | 6780ca3f74669fe0baf7e4466ceb6358cdf4c9ce235817fe2dc516999355b906 | 6780ca3f74669fe0baf7e4466ceb6358cdf4c9ce235817fe2dc516999355b906 | 1 | same_logical_different_timestamp |
| `marketplace_phase9_owner_variant_decisions` | 20260729000024 | 20260730022442 | 73eff041b3b2b0d4b31e6a2f410bc6be3f5034f59df48686db8e8c98ffede508 | 73eff041b3b2b0d4b31e6a2f410bc6be3f5034f59df48686db8e8c98ffede508 | 1 | same_logical_different_timestamp |
| `marketplace_phase9_owner_variant_corrections` | 20260729000025 | 20260730022524 | 1df2c3914562ad15f9689d3af7597e86b63c768b7ca7659fd9dca09fd74ac105 | 1df2c3914562ad15f9689d3af7597e86b63c768b7ca7659fd9dca09fd74ac105 | 1 | same_logical_different_timestamp |
| `marketplace_phase9_variant_benchmark_rollout` | 20260729000026 | 20260730022559 | e930697d32b153eb685bf35bddf5c5b19683807294fd5e460f7139874daf0916 | e930697d32b153eb685bf35bddf5c5b19683807294fd5e460f7139874daf0916 | 1 | same_logical_different_timestamp |
| `marketplace_phase9_exact_rollout_activation` | 20260729000027 | 20260730022636 | 4d6881eee124f23babb2f37c9f692668683e196ed8296d1c0a3e456bb3c81db7 | 4d6881eee124f23babb2f37c9f692668683e196ed8296d1c0a3e456bb3c81db7 | 1 | same_logical_different_timestamp |
| `marketplace_phase9_variant_benchmark_evidence_read` | 20260729000028 | 20260730022713 | 415d5b636f97e413bdf71046b9785df07c58885393670c63196f5a4565385534 | 415d5b636f97e413bdf71046b9785df07c58885393670c63196f5a4565385534 | 1 | same_logical_different_timestamp |
| `marketplace_phase9_owner_safe_contracts` | 20260730000029 | 20260730162700 | aeeed1009dc71017f2b32385d30334f7288f6c7beef87dbb0c20fdd69c131441 | aeeed1009dc71017f2b32385d30334f7288f6c7beef87dbb0c20fdd69c131441 | 1 | same_logical_different_timestamp |
| `marketplace_phase9_unit6e_review_corrections` | 20260801000030 | 20260801093048 | d6d69ca641412cd162eed6ef981e9bbab6d6b27083fc2aad8b5a168509e060aa | d6d69ca641412cd162eed6ef981e9bbab6d6b27083fc2aad8b5a168509e060aa | 1 | same_logical_different_timestamp |
| `marketplace_phase9_owner_inventory_read_boundary` | 20260803000031 | 20260803221216 | e20485f7e314f932219d89e148648a307717097a16e4df30fbf82a9259ac8410 | e20485f7e314f932219d89e148648a307717097a16e4df30fbf82a9259ac8410 | 1 | same_logical_different_timestamp |
| `marketplace_phase9_structural_metadata_integration` | 20260807000032 | 20260808020404 | f9c28eff3930ee13d19414cec22f6ad907ea6879c1403372f28a4693702f1141 | f9c28eff3930ee13d19414cec22f6ad907ea6879c1403372f28a4693702f1141 | 1 | same_logical_different_timestamp |
| `marketplace_phase9_vision_reservation_correction` | 20260809000033 | 20260809023834 | f2a52ccd21f5c5bea9810129c711e90b38a30a1f38a7fac47bfa139864dcefcd | f2a52ccd21f5c5bea9810129c711e90b38a30a1f38a7fac47bfa139864dcefcd | 1 | same_logical_different_timestamp |
| `marketplace_phase9_vision_language_hint_correction` | 20260809000034 | 20260809182407 | ee9da144e23c9d0e0e3e352866083e95d818b2fc9ed53e17d23c55cc475d9a65 | ee9da144e23c9d0e0e3e352866083e95d818b2fc9ed53e17d23c55cc475d9a65 | 1 | same_logical_different_timestamp |
| `marketplace_phase9_single_image_removal` | 20260810000035 | 20260809223135 | 8c3a72b1752e8e809f4d12c6dd38a29510bf35d531d34f1e4c26139052edb1df | 8c3a72b1752e8e809f4d12c6dd38a29510bf35d531d34f1e4c26139052edb1df | 1 | same_logical_different_timestamp |
| `marketplace_phase9_worker_wake_dispatcher` | 20260810000036 | 20260810105448 | abf724ddb9c82bf6be101b1b2ebbf3c8dcdf3aecd05f2edd33ed6fc31651c433 | abf724ddb9c82bf6be101b1b2ebbf3c8dcdf3aecd05f2edd33ed6fc31651c433 | 1 | same_logical_different_timestamp |
| `marketplace_phase9_owner_discovery_scope_correction` | 20260810000037 | 20260810105517 | a3b97e585b83c8786be0bafa6d05bc0e2ac4e7e54b77ac92ab12886329a6f3d1 | a3b97e585b83c8786be0bafa6d05bc0e2ac4e7e54b77ac92ab12886329a6f3d1 | 1 | same_logical_different_timestamp |
| `marketplace_phase9_metadata_retry_correction` | 20260810000038 | 20260810130638 | f83339a899e4efe36f4ad00505eddfc6220ab329f9822c25b94d18e699cb057d | f83339a899e4efe36f4ad00505eddfc6220ab329f9822c25b94d18e699cb057d | 1 | same_logical_different_timestamp |
| `marketplace_phase9_create_only_inventory_commit` | 20260812000039 | 20260812003419 | fe5c3ab60234215104ad6d064148c8de886bd523801c5059c08358c917fb2427 | fe5c3ab60234215104ad6d064148c8de886bd523801c5059c08358c917fb2427 | 1 | same_logical_different_timestamp |
| `marketplace_phase9_safe_publication` | 20260812000040 | 20260813000040 | 12bda28a37528a4856d2cb55ae58f2a6e9ee1099ca97ce4e2a03f75060d3b93c | f80ba42ccb6c1b97fce2d653f4823c7451582568c84491a7fc46f8e13b7166b0 | 86 | divergent_content |
| `marketplace_phase9_unit7a_quality_handoff` | 20260813000041 | 20260813070104 | b343194844f16879fe2c33ff1a342a905f8e08d054ad877134592cb16503a57d | b343194844f16879fe2c33ff1a342a905f8e08d054ad877134592cb16503a57d | 1 | same_logical_different_timestamp |
| `marketplace_phase9_generated_authors_projection` | 20260814000042 | 20260814013536 | 71130b3844968568c6581cbc935270ce15e4038a2599e6c90b2f82187ff53dcc | 71130b3844968568c6581cbc935270ce15e4038a2599e6c90b2f82187ff53dcc | 1 | same_logical_different_timestamp |
| `marketplace_phase9_unit7c_inventory_management` | 20260814000043 | 20260816122822 | 9dfbdcf0b98aee775c7c0fcbb2f96d8dcfdadbcf48144c5edce22d3bc9f28f59 | 9dfbdcf0b98aee775c7c0fcbb2f96d8dcfdadbcf48144c5edce22d3bc9f28f59 | 1 | same_logical_different_timestamp |
| `marketplace_phase9_store_view_filter_contract` | 20260814000044 | 20260816122901 | e0cfe54e8e549a1f0029746603bf34cab830013c4236e69b5228f3812f3287de | e0cfe54e8e549a1f0029746603bf34cab830013c4236e69b5228f3812f3287de | 1 | same_logical_different_timestamp |
| `marketplace_phase9_unit7c_media_history` | 20260815000045 | 20260816122929 | f49ca284b7bde5e206ea71c6ac4886dc73e563d0963a5fbb14063ce7a8ba93d9 | f49ca284b7bde5e206ea71c6ac4886dc73e563d0963a5fbb14063ce7a8ba93d9 | 1 | same_logical_different_timestamp |
| `marketplace_phase9_unit7c_private_save_revision_correction` | 20260816000046 | 20260816150126 | 3ace71c9854a01c63a662585ba7cc6ee0fca8840ad1ff4d50a1f1b9a7f773612 | 3ace71c9854a01c63a662585ba7cc6ee0fca8840ad1ff4d50a1f1b9a7f773612 | 1 | same_logical_different_timestamp |
| `marketplace_phase9_legacy_rpc_security_remediation` | 20260817000047 | 20260817073341 | f1dd5dad3136a5d6f62cb07832f84d2a21f0aab3ec3b5df5a958f2219fdb46fe | f1dd5dad3136a5d6f62cb07832f84d2a21f0aab3ec3b5df5a958f2219fdb46fe | 1 | same_logical_different_timestamp |
| `marketplace_phase9_legacy_rpc_service_role_compatibility` | 20260817000048 | 20260817075825 | ab27933af36e3e977b4baf47380e7f9225d56614fbc25cadabab50583e449ea4 | ab27933af36e3e977b4baf47380e7f9225d56614fbc25cadabab50583e449ea4 | 1 | same_logical_different_timestamp |
| `marketplace_phase9_bookstore_first_discovery` | 20260818000049 | — | 7685bf214083640ae9ca08a4b62dd2b3214e1e848136919c49b7ffe1e93606e8 | — | — | local_only |
| `marketplace_phase9_storefront_detail` | 20260820000050 | — | 467378213014a36233f34f7037a9151d71a120aa8d297f7afcff6a71795a9558 | — | — | local_only |
| `marketplace_wishlist_notify_unify` | — | 20260820033938 | — | 938362617ed1f02d4e950a8153a5af557651a5a4f7f034180ffb039cb26aac61 | 1 | live_only |
| `reading_notes_fk_and_cleanup` | — | 20260820034004 | — | 2df0269a5457f9b5c2c31eb4a4010738ee002ca97699364bdbc48c898279344d | 1 | live_only |
| `library_user_book_pages_vault` | — | 20260820064258 | — | 8a20a37f32ab94bc2cffc91b49a25e2951621a7ba7603de4c37c96da4f453480 | 1 | live_only |
| `library_word_limit_hardening` | — | 20260820071215 | — | 8f01332df6f6f2bf43d4ea53747fd0d37d57d26a94c4947ece934b3d3b48cc32 | 1 | live_only |
| `marketplace_phase9_public_media_order_invariant` | 20260821000051 | — | 47e67c9e7d793de17ed9f5866793847a87891089557911e12820e82f1dd6382d | — | — | local_only |

## Decision

This artifact is a read-only canonical mapping, not an approval to apply. A reviewer must approve this mapping and the bounded M49→M50→M51 plan before Vault provisioning or connected migration execution. Until then, the migration-history gate remains open and `main` remains untouched.
