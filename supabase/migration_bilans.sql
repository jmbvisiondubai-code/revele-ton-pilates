-- Migration: Client bilans (assessments) tracking
-- Marjorie does 3 bilans per client during 1-year coaching: debut, milieu, fin

CREATE TABLE IF NOT EXISTS public.bilans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  phase TEXT NOT NULL CHECK (phase IN ('debut', 'milieu', 'fin')),
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, phase)
);

ALTER TABLE public.bilans ENABLE ROW LEVEL SECURITY;

-- Only admins can manage bilans
CREATE POLICY "Admins manage bilans"
  ON public.bilans
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );
