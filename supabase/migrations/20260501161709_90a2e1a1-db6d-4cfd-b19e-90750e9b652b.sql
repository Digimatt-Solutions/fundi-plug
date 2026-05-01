DO $$
DECLARE
  admin_ids uuid[];
BEGIN
  SELECT array_agg(user_id) INTO admin_ids FROM public.user_roles WHERE role = 'admin';
  IF admin_ids IS NOT NULL THEN
    DELETE FROM public.activity_logs WHERE user_id = ANY(admin_ids);
    DELETE FROM public.user_roles WHERE user_id = ANY(admin_ids);
    DELETE FROM public.profiles WHERE id = ANY(admin_ids);
    DELETE FROM auth.users WHERE id = ANY(admin_ids);
  END IF;
END $$;