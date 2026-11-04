CREATE TABLE public.maps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL DEFAULT 'Untitled map',
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.layers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  map_id uuid NOT NULL REFERENCES public.maps(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'New layer',
  color text NOT NULL DEFAULT '#7f96ff',
  opacity real NOT NULL DEFAULT 0.45,
  visible boolean NOT NULL DEFAULT true,
  show_labels boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.field_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  layer_id uuid NOT NULL REFERENCES public.layers(id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  field_type text NOT NULL DEFAULT 'text',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (layer_id, key)
);
CREATE TABLE public.entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  layer_id uuid NOT NULL REFERENCES public.layers(id) ON DELETE CASCADE,
  region_type text NOT NULL,
  region_code text NOT NULL,
  region_name text NOT NULL,
  title text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.layers(map_id);
CREATE INDEX ON public.field_definitions(layer_id);
CREATE INDEX ON public.entries(layer_id);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['maps','layers','field_definitions','entries'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "own select" ON public.%I FOR SELECT TO authenticated USING (auth.uid() = user_id)', t);
    EXECUTE format('CREATE POLICY "own insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)', t);
    EXECUTE format('CREATE POLICY "own update" ON public.%I FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)', t);
    EXECUTE format('CREATE POLICY "own delete" ON public.%I FOR DELETE TO authenticated USING (auth.uid() = user_id)', t);
  END LOOP;
END $$;