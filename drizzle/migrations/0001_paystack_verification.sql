ALTER TABLE public.contributions ADD COLUMN status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','pending'));
ALTER TABLE public.contributions ADD COLUMN source text NOT NULL DEFAULT 'claim' CHECK (source IN ('paystack','claim'));
ALTER TABLE public.contributions ADD COLUMN paystack_reference text UNIQUE;
ALTER TABLE public.contributions ADD COLUMN is_demo boolean NOT NULL DEFAULT false;
UPDATE public.contributions SET is_demo = true WHERE status = 'confirmed' AND source = 'claim';
ALTER TABLE public.contributions ALTER COLUMN status SET DEFAULT 'pending';
DROP POLICY IF EXISTS "prototype insert contributions" ON public.contributions;
ALTER TABLE public.contributions REPLICA IDENTITY FULL;

CREATE TABLE public.payment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id),
  member_id uuid NOT NULL REFERENCES public.members(id),
  month text NOT NULL,
  amount numeric NOT NULL,
  reference text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'initialized',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.payment_attempts TO service_role;
ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;