CREATE OR REPLACE FUNCTION app.csv_list(_v text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT coalesce(array(
    SELECT btrim(x) FROM unnest(string_to_array(coalesce(_v,''), ',')) AS x
    WHERE btrim(x) <> ''
  ), ARRAY[]::text[])
$$;

REVOKE EXECUTE ON FUNCTION app.csv_list(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION app.csv_list(text) TO authenticated, service_role;