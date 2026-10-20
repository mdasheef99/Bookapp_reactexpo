-- Local forward correction of applied 20261010221843, not a replay of the old candidate.
-- One atomic notes contract: revision metadata, content validation, policies and privileges.
-- No business-row repair. Incompatible stored text or catalog drift aborts the transaction.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_catalog;
LOCK TABLE public.user_books, public.reading_notes IN ACCESS EXCLUSIVE MODE;

-- Fingerprints cover full catalog definitions from the 2026-10-17 MCP receipt.
-- They deliberately exclude OIDs/ACL ordering and are reproducible on PostgreSQL 17.
-- Human-readable definitions and query provenance accompany the local evidence.
DO $baseline$
DECLARE
  v_digest text;
  v_role text;
  v_privilege text;
BEGIN
  IF current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999 THEN
    RAISE EXCEPTION 'LIBRARY_NOTE_CORRECTION_POSTGRES_17_REQUIRED';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations
    WHERE version='20261010221843' AND name='library_manual_note_persistence'
      AND md5(array_to_string(statements,E'\n'))='d187c32b7b0846e735d6696adff6a7ed'
  ) THEN
    RAISE EXCEPTION 'LIBRARY_NOTE_CORRECTION_LEDGER_CHANGED';
  END IF;

  SELECT md5(jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),
    a.attnotnull,pg_get_expr(d.adbin,d.adrelid),a.attidentity,a.attgenerated)
    ORDER BY a.attnum)::text) INTO v_digest
  FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
  WHERE a.attrelid='public.reading_notes'::regclass AND a.attnum>0 AND NOT a.attisdropped;
  IF v_digest IS DISTINCT FROM '28011b590302f769ffe126b65a05f3da' THEN
    RAISE EXCEPTION 'LIBRARY_NOTE_CORRECTION_COLUMNS_CHANGED';
  END IF;

  SELECT md5(jsonb_agg(jsonb_build_array(conname,pg_get_constraintdef(oid),convalidated,
    condeferrable,condeferred) ORDER BY conname)::text) INTO v_digest
  FROM pg_constraint WHERE conrelid='public.reading_notes'::regclass;
  IF v_digest IS DISTINCT FROM '177b24b7982e3c01f175ddf5b63517c0' THEN
    RAISE EXCEPTION 'LIBRARY_NOTE_CORRECTION_CONSTRAINTS_CHANGED';
  END IF;

  -- Constraint definitions/validation do not record disabled RI triggers.
  -- Match all four enforcement actions per FK without generated trigger names/OIDs.
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid='public.reading_notes'::regclass AND c.contype='f' AND (
      (SELECT count(*) FROM pg_trigger t WHERE t.tgconstraint=c.oid)<>4
      OR EXISTS (
        SELECT 1 FROM (VALUES
          (c.conrelid,5,'pg_catalog."RI_FKey_check_ins"()'::regprocedure),
          (c.conrelid,17,'pg_catalog."RI_FKey_check_upd"()'::regprocedure),
          (c.confrelid,9,'pg_catalog."RI_FKey_cascade_del"()'::regprocedure),
          (c.confrelid,17,CASE WHEN c.confupdtype='r'
            THEN 'pg_catalog."RI_FKey_restrict_upd"()'::regprocedure
            ELSE 'pg_catalog."RI_FKey_noaction_upd"()'::regprocedure END)
        ) expected(relation,event,function_oid)
        WHERE NOT EXISTS (
          SELECT 1 FROM pg_trigger t WHERE t.tgconstraint=c.oid
            AND t.tgrelid=expected.relation AND t.tgtype=expected.event
            AND t.tgfoid=expected.function_oid AND t.tgisinternal AND t.tgenabled='O'
        )
      )
    )
  ) THEN
    RAISE EXCEPTION 'LIBRARY_NOTE_CORRECTION_FK_ENFORCEMENT_CHANGED';
  END IF;

  SELECT md5(jsonb_agg(jsonb_build_array(polname,polcmd::text,polpermissive,
    (SELECT jsonb_agg(CASE WHEN r=0 THEN 'PUBLIC' ELSE pg_get_userbyid(r) END ORDER BY r)
      FROM unnest(polroles) r),
    pg_get_expr(polqual,polrelid),pg_get_expr(polwithcheck,polrelid))
    ORDER BY polname)::text) INTO v_digest
  FROM pg_policy WHERE polrelid='public.reading_notes'::regclass;
  IF v_digest IS DISTINCT FROM 'bc963d4c19d6cddf1d94327b8aa13398' THEN
    RAISE EXCEPTION 'LIBRARY_NOTE_CORRECTION_POLICIES_CHANGED';
  END IF;

  SELECT md5(jsonb_agg(jsonb_build_array(tgname,tgenabled,pg_get_triggerdef(oid))
    ORDER BY tgname)::text) INTO v_digest
  FROM pg_trigger WHERE tgrelid='public.reading_notes'::regclass AND NOT tgisinternal;
  IF v_digest IS DISTINCT FROM '755349a853fc51f8e11effd53cd3df20'
    OR md5(pg_get_functiondef('public.library_manage_note_revision()'::regprocedure))
      IS DISTINCT FROM 'c39ee612b276c6497cd05d509c0ed317'
    OR md5(pg_get_functiondef('public.check_note_word_limit(text)'::regprocedure))
      IS DISTINCT FROM '0bc5472498574f6489357d11f3f6528d' THEN
    RAISE EXCEPTION 'LIBRARY_NOTE_CORRECTION_FUNCTION_OR_TRIGGER_CHANGED';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class WHERE oid IN ('public.reading_notes'::regclass,'public.user_books'::regclass)
      AND (NOT relrowsecurity OR pg_get_userbyid(relowner)<>'postgres')
  ) OR EXISTS (
    SELECT 1 FROM pg_proc
    WHERE oid IN ('public.library_manage_note_revision()'::regprocedure,
                  'public.check_note_word_limit(text)'::regprocedure)
      AND pg_get_userbyid(proowner)<>'postgres'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid='public.user_books'::regclass
      AND conname='user_books_id_owner_key' AND convalidated AND NOT condeferrable
      AND pg_get_constraintdef(oid)='UNIQUE (id, user_id)'
  ) THEN
    RAISE EXCEPTION 'LIBRARY_NOTE_CORRECTION_OWNERSHIP_BOUNDARY_CHANGED';
  END IF;

  -- Effective table checks alone miss redundant column grants and grant options.
  -- Fresh MCP baseline: no column ACLs; 8 owner + 8 service + 4 authenticated grants,
  -- all issued by postgres without grant options. Reject drift instead of normalizing it.
  IF EXISTS (
    SELECT 1 FROM pg_attribute WHERE attrelid='public.reading_notes'::regclass
      AND attnum>0 AND NOT attisdropped AND attacl IS NOT NULL
  ) OR (SELECT count(*) FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a
      WHERE c.oid='public.reading_notes'::regclass)<>20
    OR EXISTS (
      SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a
      WHERE c.oid='public.reading_notes'::regclass AND (
        a.grantor<>(SELECT oid FROM pg_roles WHERE rolname='postgres') OR a.is_grantable
        OR a.grantee NOT IN (SELECT oid FROM pg_roles WHERE rolname IN ('postgres','authenticated','service_role'))
        OR (a.grantee=(SELECT oid FROM pg_roles WHERE rolname='authenticated')
          AND a.privilege_type NOT IN ('SELECT','INSERT','UPDATE','DELETE')))
    ) OR EXISTS (
      SELECT 1 FROM pg_proc p WHERE p.oid IN ('public.library_manage_note_revision()'::regprocedure,
        'public.check_note_word_limit(text)'::regprocedure)
        AND (SELECT count(*) FROM aclexplode(p.proacl))<>5
    ) OR EXISTS (
      SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a
      WHERE p.oid IN ('public.library_manage_note_revision()'::regprocedure,
        'public.check_note_word_limit(text)'::regprocedure) AND (
        a.grantor<>(SELECT oid FROM pg_roles WHERE rolname='postgres')
        OR a.is_grantable OR a.privilege_type<>'EXECUTE'
        OR (a.grantee<>0 AND a.grantee NOT IN (
          SELECT oid FROM pg_roles WHERE rolname IN ('postgres','anon','authenticated','service_role'))))
    ) THEN
    RAISE EXCEPTION 'LIBRARY_NOTE_CORRECTION_EXPLICIT_GRANTS_CHANGED';
  END IF;

  FOREACH v_role IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_roles WHERE rolname=v_role AND NOT rolsuper AND NOT rolbypassrls
        AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolreplication
    ) OR EXISTS (
      SELECT 1 FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=v_role)
    ) THEN
      RAISE EXCEPTION 'LIBRARY_NOTE_CORRECTION_ROLE_AUTHORITY_CHANGED: %',v_role;
    END IF;
    FOREACH v_privilege IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] LOOP
      IF has_table_privilege(v_role,'public.reading_notes',v_privilege)
        IS DISTINCT FROM (v_role='authenticated' AND v_privilege IN ('SELECT','INSERT','UPDATE','DELETE')) THEN
        RAISE EXCEPTION 'LIBRARY_NOTE_CORRECTION_TABLE_GRANTS_CHANGED: % %',v_role,v_privilege;
      END IF;
    END LOOP;
    IF v_role='anon' AND EXISTS (
      SELECT 1 FROM pg_attribute a CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','REFERENCES']) p
      WHERE a.attrelid='public.reading_notes'::regclass AND a.attnum>0 AND NOT a.attisdropped
        AND has_column_privilege(v_role,a.attrelid,a.attnum,p)
    ) THEN
      RAISE EXCEPTION 'LIBRARY_NOTE_CORRECTION_COLUMN_GRANTS_CHANGED';
    END IF;
  END LOOP;
  FOREACH v_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF NOT has_function_privilege(v_role,'public.check_note_word_limit(text)','EXECUTE')
      OR NOT has_function_privilege(v_role,'public.library_manage_note_revision()','EXECUTE') THEN
      RAISE EXCEPTION 'LIBRARY_NOTE_CORRECTION_FUNCTION_GRANTS_CHANGED';
    END IF;
  END LOOP;
  FOREACH v_privilege IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
    IF NOT has_table_privilege('service_role','public.reading_notes',v_privilege) THEN
      RAISE EXCEPTION 'LIBRARY_NOTE_CORRECTION_SERVICE_GRANTS_CHANGED';
    END IF;
  END LOOP;
  IF EXISTS (
    SELECT 1 FROM public.reading_notes n LEFT JOIN public.user_books b ON b.id=n.user_book_id
    WHERE b.id IS NULL OR n.user_id IS DISTINCT FROM b.user_id
      OR n.created_at IS NULL OR n.updated_at IS NULL OR n.version<1
  ) THEN
    RAISE EXCEPTION 'LIBRARY_NOTE_CORRECTION_DATA_REMEDIATION_REQUIRED' USING ERRCODE='23514';
  END IF;
END
$baseline$;

-- Re-add BOTH content CHECKs so the changed immutable helper revalidates existing rows.
-- Explicit ECMAScript whitespace: 25 characters, including FEFF, excluding NEL (0085).
ALTER TABLE public.reading_notes
  DROP CONSTRAINT reading_notes_content_not_empty,
  DROP CONSTRAINT reading_notes_500w_check;
CREATE OR REPLACE FUNCTION public.check_note_word_limit(p_content text)
RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path = ''
AS $words$
  SELECT pg_catalog.cardinality(pg_catalog.regexp_split_to_array(
    pg_catalog.btrim(COALESCE(p_content,''),
      U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'),
    U&'[\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF]+')) <= 500
$words$;
ALTER TABLE public.reading_notes
  ADD CONSTRAINT reading_notes_content_not_empty CHECK (
    pg_catalog.btrim(content,
      U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF') <> ''),
  ADD CONSTRAINT reading_notes_500w_check CHECK (public.check_note_word_limit(content));

CREATE OR REPLACE FUNCTION public.library_manage_note_revision()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $revision$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.version := 1;
    NEW.last_operation_id := NULL;
    NEW.created_at := pg_catalog.statement_timestamp();
  ELSE
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.user_id IS DISTINCT FROM OLD.user_id
      OR NEW.user_book_id IS DISTINCT FROM OLD.user_book_id THEN
      RAISE EXCEPTION 'LIBRARY_NOTE_IDENTITY_IMMUTABLE' USING ERRCODE='23514';
    END IF;
    NEW.version := OLD.version + 1;
    NEW.created_at := OLD.created_at;
    IF NEW.last_operation_id IS NOT DISTINCT FROM OLD.last_operation_id THEN
      NEW.last_operation_id := NULL;
    END IF;
  END IF;
  NEW.updated_at := pg_catalog.statement_timestamp();
  RETURN NEW;
END
$revision$;
-- The existing trigger keeps its identity/binding. Direct invocation is unnecessary.
REVOKE ALL ON FUNCTION public.library_manage_note_revision() FROM PUBLIC,anon,authenticated,service_role;

DROP POLICY "Users can view own notes" ON public.reading_notes;
DROP POLICY "Users can insert own notes" ON public.reading_notes;
DROP POLICY "Users can update own notes" ON public.reading_notes;
DROP POLICY "Users can delete own notes" ON public.reading_notes;
CREATE POLICY library_note_select_owned_book ON public.reading_notes
  FOR SELECT TO authenticated USING (user_id=(SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.user_books b WHERE b.id=reading_notes.user_book_id AND b.user_id=(SELECT auth.uid())));
CREATE POLICY library_note_insert_owned_book ON public.reading_notes
  FOR INSERT TO authenticated WITH CHECK (user_id=(SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.user_books b WHERE b.id=reading_notes.user_book_id AND b.user_id=(SELECT auth.uid())));
CREATE POLICY library_note_update_owned_book ON public.reading_notes
  FOR UPDATE TO authenticated USING (user_id=(SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.user_books b WHERE b.id=reading_notes.user_book_id AND b.user_id=(SELECT auth.uid())))
  WITH CHECK (user_id=(SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.user_books b WHERE b.id=reading_notes.user_book_id AND b.user_id=(SELECT auth.uid())));
CREATE POLICY library_note_delete_owned_book ON public.reading_notes
  FOR DELETE TO authenticated USING (user_id=(SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.user_books b WHERE b.id=reading_notes.user_book_id AND b.user_id=(SELECT auth.uid())));

-- Table grants override column revocations, so remove both layers before narrowing.
REVOKE ALL ON public.reading_notes FROM PUBLIC,anon,authenticated;
REVOKE ALL (id,user_id,user_book_id,content,tag,page_number,created_at,updated_at,version,last_operation_id)
  ON public.reading_notes FROM PUBLIC,anon,authenticated;
GRANT SELECT,DELETE ON public.reading_notes TO authenticated;
GRANT INSERT (id,user_id,user_book_id,content,tag,page_number) ON public.reading_notes TO authenticated;
-- updated_at remains accepted for legacy payloads, but the server overwrites its value.
GRANT UPDATE (content,tag,page_number,last_operation_id,updated_at) ON public.reading_notes TO authenticated;

DO $postconditions$
DECLARE
  v_role text;
  v_privilege text;
  v_column record;
  v_expected boolean;
BEGIN
  FOREACH v_role IN ARRAY ARRAY['anon','authenticated'] LOOP
    FOREACH v_privilege IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] LOOP
      IF has_table_privilege(v_role,'public.reading_notes',v_privilege)
        IS DISTINCT FROM (v_role='authenticated' AND v_privilege IN ('SELECT','DELETE')) THEN
        RAISE EXCEPTION 'LIBRARY_NOTE_CORRECTION_FINAL_TABLE_GRANTS: % %',v_role,v_privilege;
      END IF;
    END LOOP;
    FOR v_column IN SELECT attname,attnum FROM pg_attribute
      WHERE attrelid='public.reading_notes'::regclass AND attnum>0 AND NOT attisdropped LOOP
      FOREACH v_privilege IN ARRAY ARRAY['SELECT','INSERT','UPDATE','REFERENCES'] LOOP
        v_expected := v_role='authenticated' AND (
          v_privilege='SELECT'
          OR (v_privilege='INSERT' AND v_column.attname IN ('id','user_id','user_book_id','content','tag','page_number'))
          OR (v_privilege='UPDATE' AND v_column.attname IN ('content','tag','page_number','last_operation_id','updated_at')));
        IF has_column_privilege(v_role,'public.reading_notes',v_column.attnum,v_privilege) IS DISTINCT FROM v_expected THEN
          RAISE EXCEPTION 'LIBRARY_NOTE_CORRECTION_FINAL_COLUMN_GRANTS: % % %',v_role,v_column.attname,v_privilege;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
  FOREACH v_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF has_function_privilege(v_role,'public.library_manage_note_revision()','EXECUTE')
      OR NOT has_function_privilege(v_role,'public.check_note_word_limit(text)','EXECUTE') THEN
      RAISE EXCEPTION 'LIBRARY_NOTE_CORRECTION_FINAL_FUNCTION_GRANTS';
    END IF;
  END LOOP;
  FOREACH v_privilege IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
    IF NOT has_table_privilege('service_role','public.reading_notes',v_privilege) THEN
      RAISE EXCEPTION 'LIBRARY_NOTE_CORRECTION_FINAL_SERVICE_GRANTS';
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM pg_policy WHERE polrelid='public.reading_notes'::regclass)<>4
    OR EXISTS (
      SELECT 1 FROM pg_policy WHERE polrelid='public.reading_notes'::regclass
        AND (NOT polpermissive OR polroles<>ARRAY[(SELECT oid FROM pg_roles WHERE rolname='authenticated')]
          OR polname NOT IN ('library_note_select_owned_book','library_note_insert_owned_book',
                             'library_note_update_owned_book','library_note_delete_owned_book'))
    ) OR (SELECT count(*) FROM pg_constraint WHERE conrelid='public.reading_notes'::regclass AND convalidated)<>9
    OR (SELECT count(*) FROM pg_trigger WHERE tgrelid='public.reading_notes'::regclass
      AND NOT tgisinternal AND tgenabled='O' AND tgfoid='public.library_manage_note_revision()'::regprocedure)<>1
    OR EXISTS (
      SELECT 1 FROM pg_proc WHERE oid IN ('public.library_manage_note_revision()'::regprocedure,
        'public.check_note_word_limit(text)'::regprocedure)
        AND (prosecdef OR proconfig IS DISTINCT FROM ARRAY['search_path=""'])
    ) THEN
    RAISE EXCEPTION 'LIBRARY_NOTE_CORRECTION_FINAL_CATALOG';
  END IF;
END
$postconditions$;
COMMIT;
