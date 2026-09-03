CREATE SCHEMA IF NOT EXISTS app;
GRANT USAGE ON SCHEMA app TO anon, authenticated, service_role;

ALTER FUNCTION public.has_role(uuid, public.app_role) SET SCHEMA app;
ALTER FUNCTION public.item_is_public(uuid) SET SCHEMA app;
ALTER FUNCTION public.owns_item(uuid, uuid) SET SCHEMA app;
ALTER FUNCTION public.can_view_claim(uuid, uuid) SET SCHEMA app;
ALTER FUNCTION public.owns_claim(uuid, uuid) SET SCHEMA app;
ALTER FUNCTION public.handle_new_user() SET SCHEMA app;

ALTER FUNCTION app.has_role(uuid, public.app_role) SET search_path = app, public;
ALTER FUNCTION app.item_is_public(uuid) SET search_path = app, public;
ALTER FUNCTION app.owns_item(uuid, uuid) SET search_path = app, public;
ALTER FUNCTION app.can_view_claim(uuid, uuid) SET search_path = app, public;
ALTER FUNCTION app.owns_claim(uuid, uuid) SET search_path = app, public;
ALTER FUNCTION app.handle_new_user() SET search_path = app, public;