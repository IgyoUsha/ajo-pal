CREATE TABLE public.groups (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, monthly_amount numeric NOT NULL CHECK (monthly_amount > 0), start_month text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.members (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE, name text NOT NULL, payout_order int NOT NULL);
CREATE TABLE public.contributions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE, group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE, month text NOT NULL, amount numeric NOT NULL CHECK (amount > 0), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.chat_messages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE, role text NOT NULL CHECK (role IN ('user','assistant')), content text NOT NULL, action text, created_at timestamptz NOT NULL DEFAULT now());

GRANT SELECT, INSERT ON public.groups, public.members, public.contributions, public.chat_messages TO anon, authenticated;
GRANT ALL ON public.groups, public.members, public.contributions, public.chat_messages TO service_role;

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prototype read groups" ON public.groups FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "prototype insert groups" ON public.groups FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "prototype read members" ON public.members FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "prototype insert members" ON public.members FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "prototype read contributions" ON public.contributions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "prototype insert contributions" ON public.contributions FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "prototype read chat" ON public.chat_messages FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "prototype insert chat" ON public.chat_messages FOR INSERT TO anon, authenticated WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.contributions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

DO $$
DECLARE g uuid := '11111111-1111-1111-1111-111111111111'; m text := to_char(now(),'YYYY-MM');
BEGIN
INSERT INTO public.groups (id,name,monthly_amount,start_month) VALUES (g,'Batch C Stream 2 Ajo',10000,m);
INSERT INTO public.members (id,group_id,name,payout_order) VALUES
 ('a0000000-0000-0000-0000-000000000001',g,'Halima',1),
 ('a0000000-0000-0000-0000-000000000002',g,'Chidi',2),
 ('a0000000-0000-0000-0000-000000000003',g,'Amaka',3),
 ('a0000000-0000-0000-0000-000000000004',g,'Emeka',4),
 ('a0000000-0000-0000-0000-000000000005',g,'Tunde',5),
 ('a0000000-0000-0000-0000-000000000006',g,'Zainab',6);
INSERT INTO public.contributions (member_id,group_id,month,amount) VALUES
 ('a0000000-0000-0000-0000-000000000003',g,m,10000),
 ('a0000000-0000-0000-0000-000000000005',g,m,10000),
 ('a0000000-0000-0000-0000-000000000001',g,m,10000);
INSERT INTO public.chat_messages (group_id,role,content,action) VALUES (g,'assistant','Hi Batch C Stream 2! 👋 I''m your treasurer. Tell me when someone pays, ask whose turn it is, or ask me to draft your group rules.','answer');
END $$;