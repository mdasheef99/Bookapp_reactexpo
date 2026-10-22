-- Projected pre-migration catalog for SDD-09 Unit 1 from the 2026-10-22 MCP read-only checks.
-- Synthetic data only. Mirrors Supabase's default table grants so the migration's REVOKEs are tested.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

CREATE TABLE public.books (id uuid PRIMARY KEY, page_count integer);
CREATE TABLE public.user_books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id uuid REFERENCES public.books(id),
  reading_status text DEFAULT 'want_to_read' CHECK (reading_status = ANY (ARRAY['want_to_read','reading','completed'])),
  ownership text DEFAULT 'owned',
  rating integer CHECK (rating >= 1 AND rating <= 5),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT user_books_user_id_book_id_key UNIQUE (user_id, book_id),
  CONSTRAINT user_books_id_owner_key UNIQUE (id, user_id)
);
ALTER TABLE public.user_books ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own books" ON public.user_books FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can add books to their library" ON public.user_books FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their books" ON public.user_books FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their books" ON public.user_books FOR DELETE USING (auth.uid() = user_id);
GRANT ALL ON public.user_books, public.books TO anon, authenticated, service_role;

-- Minimal clubs projection and the live clubs status RPC body (insert ... on conflict).
CREATE TABLE public.book_clubs (id uuid PRIMARY KEY, current_book_id uuid REFERENCES public.books(id));
CREATE TABLE public.club_members (club_id uuid, user_id uuid, status text, PRIMARY KEY (club_id, user_id));
CREATE FUNCTION public.set_club_current_book_reading_status(p_club_id uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $club$
declare
  current_user_id uuid := auth.uid();
  club_record public.book_clubs%rowtype;
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  if p_status not in ('want_to_read', 'reading', 'completed') then raise exception 'bad status'; end if;
  select * into club_record from public.book_clubs where id = p_club_id;
  if not exists (select 1 from public.club_members cm where cm.club_id = p_club_id
                 and cm.user_id = current_user_id and cm.status = 'active') then
    raise exception 'Only active club members can update current-book reading status';
  end if;
  insert into public.user_books (user_id, book_id, reading_status, completed_at)
  values (current_user_id, club_record.current_book_id, p_status,
          case when p_status = 'completed' then now() else null end)
  on conflict (user_id, book_id)
  do update set
    reading_status = excluded.reading_status,
    completed_at = case when excluded.reading_status = 'completed' then now() else null end,
    updated_at = now();
end;
$club$;
GRANT EXECUTE ON FUNCTION public.set_club_current_book_reading_status(uuid, text) TO authenticated;
