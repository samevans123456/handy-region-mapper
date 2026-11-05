CREATE TABLE public.custom_regions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  parts jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_regions TO authenticated;
GRANT ALL ON public.custom_regions TO service_role;
ALTER TABLE public.custom_regions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner or map co-editor reads combined regions" ON public.custom_regions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.maps m WHERE m.user_id = custom_regions.user_id AND public.can_edit_map(m.id)));
CREATE POLICY "owner creates combined regions" ON public.custom_regions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "owner updates combined regions" ON public.custom_regions FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "owner deletes combined regions" ON public.custom_regions FOR DELETE TO authenticated USING (user_id = auth.uid());