CREATE OR REPLACE FUNCTION public.replace_map_entries(_map_id uuid, _entries jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE inserted_count integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_edit_map(_map_id) THEN
    RAISE EXCEPTION 'You cannot edit this map';
  END IF;
  IF jsonb_typeof(_entries) IS DISTINCT FROM 'array' OR jsonb_array_length(_entries) = 0 THEN
    RAISE EXCEPTION 'Replacement requires at least one valid entry';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(_entries) AS r(layer_id uuid)
    WHERE NOT EXISTS (SELECT 1 FROM public.layers l WHERE l.id = r.layer_id AND l.map_id = _map_id)
  ) THEN RAISE EXCEPTION 'Every entry must belong to this map'; END IF;
  DELETE FROM public.entries e USING public.layers l WHERE e.layer_id = l.id AND l.map_id = _map_id;
  INSERT INTO public.entries (layer_id, region_type, region_code, region_name, title, data)
    SELECT r.layer_id, r.region_type, r.region_code, r.region_name, r.title, COALESCE(r.data, '{}'::jsonb)
    FROM jsonb_to_recordset(_entries) AS r(layer_id uuid, region_type text, region_code text, region_name text, title text, data jsonb);
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;
REVOKE ALL ON FUNCTION public.replace_map_entries(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_map_entries(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.replace_map_entries(uuid, jsonb) TO service_role;