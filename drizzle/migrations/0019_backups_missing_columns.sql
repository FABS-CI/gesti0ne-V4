ALTER TABLE public.backups ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.backups ADD COLUMN IF NOT EXISTS message text;
ALTER TABLE public.backups ADD COLUMN IF NOT EXISTS completed_at timestamptz;