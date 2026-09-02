CREATE OR REPLACE FUNCTION app.fellowship_of(_gender text, _marital text, _bracket text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN _bracket = '50 and Above' THEN 'Elders Fellowship'
    WHEN _bracket IN ('0-12','13-17') THEN NULL
    WHEN _marital = 'Married' AND _gender = 'Male' THEN 'Men''s Fellowship'
    WHEN _marital IN ('Married','Widowed') AND _gender = 'Female' THEN 'Good Women Fellowship'
    WHEN _marital IS DISTINCT FROM 'Married' THEN 'Youth Fellowship'
    ELSE NULL END
$$;
REVOKE ALL ON FUNCTION app.fellowship_of(text, text, text) FROM PUBLIC;