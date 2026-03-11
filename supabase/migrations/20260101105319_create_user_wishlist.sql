-- Canonical live migration filename for the existing user_wishlist schema.
-- Verified against live Supabase project ahntbtktjjmvfosgkmgn on 2026-03-06.

-- Wishlist Feature Migration
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/ahntbtktjjmvfosgkmgn/sql

-- Create user_wishlist table
CREATE TABLE IF NOT EXISTS public.user_wishlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    google_books_id TEXT NOT NULL,
    book_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, google_books_id)
);

-- Enable Row Level Security
ALTER TABLE public.user_wishlist ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own wishlist
CREATE POLICY "Users can view own wishlist"
    ON public.user_wishlist FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own wishlist"
    ON public.user_wishlist FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own wishlist"
    ON public.user_wishlist FOR DELETE
    USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_wishlist_user_id 
    ON public.user_wishlist(user_id);
    
CREATE INDEX IF NOT EXISTS idx_user_wishlist_google_id 
    ON public.user_wishlist(google_books_id);