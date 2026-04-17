-- 1. Create a table for books
CREATE TABLE IF NOT EXISTS books (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  library_code TEXT NOT NULL,
  title TEXT NOT NULL,
  author TEXT,
  total_pages INTEGER DEFAULT 0,
  current_page INTEGER DEFAULT 1,
  file_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  last_read TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create index for fast retrieval by library code
CREATE INDEX IF NOT EXISTS idx_books_library_code ON books(library_code);

-- 3. Storage Setup (Run these in the SQL editor or create manually in Storage tab)
-- Create a bucket named 'pdfs'
-- Ensure it is 'Public' or set up RLS policies to allow authenticated/anon access.
INSERT INTO storage.buckets (id, name, public) 
VALUES ('pdfs', 'pdfs', true)
ON CONFLICT (id) DO NOTHING;
