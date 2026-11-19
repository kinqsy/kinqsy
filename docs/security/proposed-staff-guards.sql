-- PROPOSAL. Tested on PostgreSQL16 with synthetic schema; not applied to production.
-- Replaces functions only; does not assign/revoke any real staff.
BEGIN;
CREATE OR REPLACE FUNCTION public.is_platform_owner()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT coalesce(auth.uid() = '4923abc5-5c86-48c2-904b-a267c2e21703'::uuid, false);
$function$;

CREATE OR REPLACE FUNCTION public.staff_assign(p_user uuid, p_role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $function$
DECLARE defaults text[];
BEGIN
  IF auth.uid() IS NULL OR public.is_platform_owner() IS NOT TRUE THEN
    RAISE EXCEPTION 'owner only' USING ERRCODE = '42501';
  END IF;
  IF p_user IS NULL THEN RAISE EXCEPTION 'user required' USING ERRCODE = '22023'; END IF;
  IF p_user = auth.uid() THEN RAISE EXCEPTION 'cannot change owner' USING ERRCODE = '42501'; END IF;
  IF p_role IS NULL OR p_role NOT IN ('admin','moderator','curator') THEN
    RAISE EXCEPTION 'invalid role' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.staff_members(user_id, role, status)
  VALUES (p_user, p_role, 'active')
  ON CONFLICT (user_id) DO UPDATE SET role = excluded.role, status = 'active', updated_at = now();
  DELETE FROM public.staff_permissions WHERE user_id = p_user;
  defaults := CASE p_role
    WHEN 'admin' THEN ARRAY['reports.read','reports.update','reports.escalate','feedback.read','feedback.update','quotes.read','quotes.update','users.read','content.hide','content.delete','audit.read']
    WHEN 'moderator' THEN ARRAY['reports.read','reports.update','reports.escalate']
    WHEN 'curator' THEN ARRAY['feedback.read','feedback.update','quotes.read','quotes.update']
    ELSE ARRAY[]::text[] END;
  INSERT INTO public.staff_permissions(user_id, permission)
  SELECT p_user, x FROM unnest(defaults) AS x;
  PERFORM public.admin_audit_write('staff.assign', p_user::text, jsonb_build_object('role', p_role));
END;
$function$;

CREATE OR REPLACE FUNCTION public.staff_revoke(p_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $function$
DECLARE old_status text;
BEGIN
  IF auth.uid() IS NULL OR public.is_platform_owner() IS NOT TRUE THEN
    RAISE EXCEPTION 'owner only' USING ERRCODE = '42501';
  END IF;
  IF p_user IS NULL THEN RAISE EXCEPTION 'user required' USING ERRCODE = '22023'; END IF;
  IF p_user = auth.uid() THEN RAISE EXCEPTION 'cannot revoke owner' USING ERRCODE = '42501'; END IF;
  SELECT m.status INTO old_status FROM public.staff_members m WHERE m.user_id = p_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not staff' USING ERRCODE = '22023'; END IF;
  IF old_status = 'revoked' THEN RETURN; END IF;
  UPDATE public.staff_members SET status = 'revoked', updated_at = now() WHERE user_id = p_user;
  PERFORM public.admin_audit_write('staff.revoke', p_user::text, '{}'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.staff_set_perm(p_user uuid, p_perm text, p_on boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $function$
DECLARE member_status text; changed integer;
BEGIN
  IF auth.uid() IS NULL OR public.is_platform_owner() IS NOT TRUE THEN
    RAISE EXCEPTION 'owner only' USING ERRCODE = '42501';
  END IF;
  IF p_user IS NULL OR p_on IS NULL THEN RAISE EXCEPTION 'user and switch required' USING ERRCODE = '22023'; END IF;
  IF p_user = auth.uid() THEN RAISE EXCEPTION 'cannot change owner' USING ERRCODE = '42501'; END IF;
  IF p_perm IS NULL OR p_perm NOT IN (
    'reports.read','reports.update','reports.escalate','feedback.read','feedback.update',
    'quotes.read','quotes.update','users.read','content.hide','content.delete',
    'staff.manage','staff.manage_moderators','audit.read','settings.read'
  ) THEN RAISE EXCEPTION 'invalid permission' USING ERRCODE = '22023'; END IF;
  SELECT m.status INTO member_status FROM public.staff_members m WHERE m.user_id = p_user FOR UPDATE;
  IF NOT FOUND OR member_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'not active staff' USING ERRCODE = '22023';
  END IF;
  IF p_on THEN
    INSERT INTO public.staff_permissions(user_id, permission) VALUES(p_user, p_perm) ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.staff_permissions WHERE user_id = p_user AND permission = p_perm;
  END IF;
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed > 0 THEN
    PERFORM public.admin_audit_write('staff.perm', p_user::text, jsonb_build_object('perm', p_perm, 'on', p_on));
  END IF;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.is_platform_owner(), public.staff_assign(uuid,text),
  public.staff_revoke(uuid), public.staff_set_perm(uuid,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_owner(), public.staff_assign(uuid,text),
  public.staff_revoke(uuid), public.staff_set_perm(uuid,text,boolean) TO authenticated;
COMMIT;

SELECT p.proname AS function_name, p.proconfig AS settings,
  pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
  pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('is_platform_owner','staff_assign','staff_revoke','staff_set_perm')
  AND p.prokind = 'f'
ORDER BY p.proname;

