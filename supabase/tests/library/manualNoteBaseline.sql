-- Projected pre-migration Library catalog from the 2026-10-10 MCP receipt.
-- Synthetic data only; intentionally includes current broad ACLs.
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
-- Preserve the helper body/configuration from the fresh shared-project receipt.
CREATE FUNCTION public.check_note_word_limit(p_content text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $function$
  SELECT COALESCE(array_length(regexp_split_to_array(btrim(COALESCE(p_content,'')), '\s+'), 1), 0) <= 500
$function$;
CREATE TABLE public.books (id uuid PRIMARY KEY);
CREATE TABLE public.user_books (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
 book_id uuid REFERENCES public.books(id), UNIQUE(user_id,book_id)
);
ALTER TABLE public.user_books ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own books" ON public.user_books FOR SELECT USING (auth.uid()=user_id);
CREATE POLICY "Users can add books to their library" ON public.user_books FOR INSERT WITH CHECK (auth.uid()=user_id);
CREATE POLICY "Users can update their books" ON public.user_books FOR UPDATE USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE POLICY "Users can delete their books" ON public.user_books FOR DELETE USING (auth.uid()=user_id);
GRANT ALL ON public.user_books TO anon,authenticated,service_role;
-- Saved Pages canary: this proposal must not modify it.
CREATE TABLE public.user_book_pages (id uuid PRIMARY KEY, full_text text);
INSERT INTO public.user_book_pages VALUES ('80000000-0000-4000-8000-000000000001','Retained passage');

