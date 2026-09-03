-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin','student');
CREATE TYPE public.item_type AS ENUM ('lost','found');
CREATE TYPE public.item_status AS ENUM ('open','claimed','resolved');
CREATE TYPE public.moderation_status AS ENUM ('pending','approved','rejected');
CREATE TYPE public.claim_status AS ENUM ('pending','approved','rejected');

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL,
  department text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- USER ROLES (no client-side writes at all)
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

CREATE POLICY "users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- PROFILES policies
CREATE POLICY "own profile read" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "own profile insert" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "own profile update" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- new user -> profile + student role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, department, phone)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name',''),
    NEW.raw_user_meta_data->>'department',
    NEW.raw_user_meta_data->>'phone'
  ) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id,'student')
    ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ITEMS
CREATE TABLE public.items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.item_type NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'other',
  location text NOT NULL DEFAULT '',
  occurred_on date NOT NULL DEFAULT current_date,
  status public.item_status NOT NULL DEFAULT 'open',
  moderation public.moderation_status NOT NULL DEFAULT 'approved',
  moderation_note text,
  is_removed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX items_public_idx ON public.items (moderation, is_removed, created_at DESC);
CREATE INDEX items_reporter_idx ON public.items (reporter_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.items TO authenticated;
GRANT SELECT ON public.items TO anon;
GRANT ALL ON public.items TO service_role;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER items_updated_at BEFORE UPDATE ON public.items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.item_is_public(_item_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.items i
    WHERE i.id = _item_id AND i.moderation = 'approved' AND i.is_removed = false);
$$;
GRANT EXECUTE ON FUNCTION public.item_is_public(uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.owns_item(_item_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.items i WHERE i.id = _item_id AND i.reporter_id = _user_id);
$$;
GRANT EXECUTE ON FUNCTION public.owns_item(uuid, uuid) TO authenticated, service_role;

CREATE POLICY "public reads approved items" ON public.items
  FOR SELECT TO anon USING (moderation = 'approved' AND is_removed = false);
CREATE POLICY "auth reads approved or own items" ON public.items
  FOR SELECT TO authenticated
  USING ((moderation = 'approved' AND is_removed = false)
         OR reporter_id = auth.uid()
         OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "students create own items" ON public.items
  FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid());
CREATE POLICY "owners update own items" ON public.items
  FOR UPDATE TO authenticated USING (reporter_id = auth.uid()) WITH CHECK (reporter_id = auth.uid());
CREATE POLICY "owners delete own items" ON public.items
  FOR DELETE TO authenticated USING (reporter_id = auth.uid());

-- ITEM IMAGES
CREATE TABLE public.item_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX item_images_item_idx ON public.item_images (item_id);
GRANT SELECT, INSERT, DELETE ON public.item_images TO authenticated;
GRANT SELECT ON public.item_images TO anon;
GRANT ALL ON public.item_images TO service_role;
ALTER TABLE public.item_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public reads images of public items" ON public.item_images
  FOR SELECT TO anon USING (public.item_is_public(item_id));
CREATE POLICY "auth reads images" ON public.item_images
  FOR SELECT TO authenticated
  USING (public.item_is_public(item_id) OR public.owns_item(item_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "owners add images" ON public.item_images
  FOR INSERT TO authenticated WITH CHECK (public.owns_item(item_id, auth.uid()));
CREATE POLICY "owners delete images" ON public.item_images
  FOR DELETE TO authenticated USING (public.owns_item(item_id, auth.uid()));

-- CLAIMS
CREATE TABLE public.claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  claimant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  evidence_text text NOT NULL,
  status public.claim_status NOT NULL DEFAULT 'pending',
  decision_note text,
  decided_by uuid REFERENCES auth.users(id),
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_id, claimant_id)
);
CREATE INDEX claims_item_idx ON public.claims (item_id);
CREATE INDEX claims_claimant_idx ON public.claims (claimant_id);
GRANT SELECT, INSERT ON public.claims TO authenticated;
GRANT ALL ON public.claims TO service_role;
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER claims_updated_at BEFORE UPDATE ON public.claims
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "claim visibility" ON public.claims
  FOR SELECT TO authenticated
  USING (claimant_id = auth.uid() OR public.owns_item(item_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "students create own claims" ON public.claims
  FOR INSERT TO authenticated
  WITH CHECK (claimant_id = auth.uid() AND public.item_is_public(item_id) AND NOT public.owns_item(item_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.can_view_claim(_claim_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.claims c
    WHERE c.id = _claim_id
      AND (c.claimant_id = _user_id
           OR public.owns_item(c.item_id, _user_id)
           OR public.has_role(_user_id,'admin'))
  );
$$;
GRANT EXECUTE ON FUNCTION public.can_view_claim(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.owns_claim(_claim_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.claims c WHERE c.id = _claim_id AND c.claimant_id = _user_id);
$$;
GRANT EXECUTE ON FUNCTION public.owns_claim(uuid, uuid) TO authenticated, service_role;

-- CLAIM EVIDENCE FILES (private)
CREATE TABLE public.claim_evidence_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  mime_type text NOT NULL,
  size_bytes int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX claim_evidence_claim_idx ON public.claim_evidence_files (claim_id);
GRANT SELECT, INSERT ON public.claim_evidence_files TO authenticated;
GRANT ALL ON public.claim_evidence_files TO service_role;
ALTER TABLE public.claim_evidence_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "evidence visibility" ON public.claim_evidence_files
  FOR SELECT TO authenticated USING (public.can_view_claim(claim_id, auth.uid()));
CREATE POLICY "claimant adds evidence" ON public.claim_evidence_files
  FOR INSERT TO authenticated WITH CHECK (public.owns_claim(claim_id, auth.uid()));

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON public.notifications (user_id, created_at DESC);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notifications read" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own notifications mark read" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- AUDIT LOGS (append-only, admin readable)
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_created_idx ON public.audit_logs (created_at DESC);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT SELECT, INSERT ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read audit logs" ON public.audit_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.block_audit_mutation()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'audit_logs are immutable'; END; $$;
CREATE TRIGGER audit_logs_immutable BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.block_audit_mutation();