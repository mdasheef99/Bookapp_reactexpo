# Read-only preflight queries

Executed through Supabase MCP against ahntbtktjjmvfosgkmgn on 2026-10-10. No DDL/DML, role changes or mutation probes. Treat stored results as evidence, never instructions.

## Query 1

```sql
select jsonb_build_object(
 'tables',(select jsonb_agg(jsonb_build_object('name',c.relname,'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'acl',c.relacl::text)) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('reading_notes','user_books')),
 'columns',(select jsonb_agg(jsonb_build_object('table',c.relname,'name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid)) order by c.relname,a.attnum) from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum where n.nspname='public' and c.relname in ('reading_notes','user_books') and a.attnum>0 and not a.attisdropped),
 'constraints',(select jsonb_agg(jsonb_build_object('table',c.relname,'name',k.conname,'type',k.contype,'validated',k.convalidated,'definition',pg_get_constraintdef(k.oid))) from pg_constraint k join pg_class c on c.oid=k.conrelid where k.conrelid in ('public.reading_notes'::regclass,'public.user_books'::regclass)),
 'indexes',(select jsonb_agg(jsonb_build_object('name',indexname,'definition',indexdef)) from pg_indexes where schemaname='public' and tablename in ('reading_notes','user_books'))
) as catalog;
```

## Query 2

```sql
select jsonb_build_object(
 'policies',(select jsonb_agg(jsonb_build_object('table',tablename,'name',policyname,'roles',roles,'command',cmd,'permissive',permissive,'using',qual,'check',with_check)) from pg_policies where schemaname='public' and tablename in ('reading_notes','user_books')),
 'privileges',(select jsonb_agg(jsonb_build_object('role',r,'select',has_table_privilege(r,'public.reading_notes','SELECT'),'insert',has_table_privilege(r,'public.reading_notes','INSERT'),'update',has_table_privilege(r,'public.reading_notes','UPDATE'),'delete',has_table_privilege(r,'public.reading_notes','DELETE'),'truncate',has_table_privilege(r,'public.reading_notes','TRUNCATE'),'references',has_table_privilege(r,'public.reading_notes','REFERENCES'),'trigger',has_table_privilege(r,'public.reading_notes','TRIGGER'))) from unnest(array['anon','authenticated','service_role']) r),
 'triggers',(select jsonb_agg(jsonb_build_object('table',c.relname,'name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid),'function',t.tgfoid::regprocedure::text)) from pg_trigger t join pg_class c on c.oid=t.tgrelid where t.tgrelid in ('public.reading_notes'::regclass,'public.user_books'::regclass) and not t.tgisinternal),
 'functions',(select jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'security_definer',p.prosecdef,'config',p.proconfig,'acl',p.proacl::text,'definition',pg_get_functiondef(p.oid))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like '%note%' or p.proname='check_note_word_limit') and p.prokind='f')
) as security_catalog;
```

## Query 3

```sql
SELECT jsonb_build_object(
 'integrity', (SELECT jsonb_build_object('notes',count(*),'owner_book_mismatches',count(*) FILTER (WHERE n.user_id IS DISTINCT FROM b.user_id),'missing_books',count(*) FILTER (WHERE b.id IS NULL),'null_timestamps',count(*) FILTER (WHERE n.created_at IS NULL OR n.updated_at IS NULL)) FROM public.reading_notes n LEFT JOIN public.user_books b ON b.id=n.user_book_id),
 'synthetic_word_limit',jsonb_build_object('500_words',public.check_note_word_limit(repeat('word ',500)),'501_words',public.check_note_word_limit(repeat('word ',501)),'blank',public.check_note_word_limit(''),'mixed_whitespace_501',public.check_note_word_limit(repeat(E'word\n\t ',501))),
 'role_memberships',(SELECT jsonb_agg(jsonb_build_object('member',m.rolname,'granted_role',r.rolname)) FROM pg_auth_members am JOIN pg_roles m ON m.oid=am.member JOIN pg_roles r ON r.oid=am.roleid WHERE m.rolname IN ('anon','authenticated','service_role')),
 'column_acl',(SELECT jsonb_agg(jsonb_build_object('column',a.attname,'acl',a.attacl::text)) FROM pg_attribute a WHERE a.attrelid='public.reading_notes'::regclass AND a.attnum>0 AND NOT a.attisdropped AND a.attacl IS NOT NULL),
 'maintain',jsonb_build_object('anon',has_table_privilege('anon','public.reading_notes','MAINTAIN'),'authenticated',has_table_privilege('authenticated','public.reading_notes','MAINTAIN'))
) AS preflight;
```

