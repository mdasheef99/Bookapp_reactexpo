-- Canonical live migration filename for the existing reading_notes schema.
-- Verified against live Supabase project ahntbtktjjmvfosgkmgn on 2026-03-06.

-- Reading Notes Feature Migration
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/ahntbtktjjmvfosgkmgn/sql

-- Create reading_notes table
CREATE TABLE IF NOT EXISTS public.reading_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_book_id UUID NOT NULL,
    content TEXT NOT NULL,
    tag TEXT NOT NULL CHECK (tag IN ('quote', 'reflect', 'distill', 'apply')),
    page_number INT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.reading_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own notes
CREATE POLICY "Users can view own notes"
    ON public.reading_notes FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notes"
    ON public.reading_notes FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notes"
    ON public.reading_notes FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notes"
    ON public.reading_notes FOR DELETE
    USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_reading_notes_user_book
    ON public.reading_notes(user_book_id);

CREATE INDEX IF NOT EXISTS idx_reading_notes_user
    ON public.reading_notes(user_id);

CREATE INDEX IF NOT EXISTS idx_reading_notes_tag
    ON public.reading_notes(tag);

CREATE INDEX IF NOT EXISTS idx_reading_notes_created
    ON public.reading_notes(created_at DESC);