CREATE OR REPLACE FUNCTION public.enforce_text_length()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  j jsonb := to_jsonb(NEW);
  v text;
BEGIN
  IF TG_TABLE_NAME = 'messages' THEN
    v := j->>'content';
    IF v IS NOT NULL AND length(v) > 4000 THEN
      RAISE EXCEPTION 'Message too long (max 4000 chars)';
    END IF;
  ELSIF TG_TABLE_NAME = 'community_posts' THEN
    v := j->>'content';
    IF v IS NOT NULL AND length(v) > 8000 THEN
      RAISE EXCEPTION 'Post too long (max 8000 chars)';
    END IF;
  ELSIF TG_TABLE_NAME = 'community_comments' THEN
    v := j->>'content';
    IF v IS NOT NULL AND length(v) > 4000 THEN
      RAISE EXCEPTION 'Comment too long (max 4000 chars)';
    END IF;
  ELSIF TG_TABLE_NAME = 'complaints' THEN
    v := j->>'message';
    IF v IS NOT NULL AND length(v) > 4000 THEN
      RAISE EXCEPTION 'Complaint too long (max 4000 chars)';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;