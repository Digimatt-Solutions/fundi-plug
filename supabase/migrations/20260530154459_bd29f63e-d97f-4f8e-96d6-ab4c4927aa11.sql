
REVOKE EXECUTE ON FUNCTION public.get_my_worker_profile() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_worker_profiles() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_get_worker_profile(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_business_profile() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_business_profiles() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_get_business_profile(uuid) FROM PUBLIC, anon;
