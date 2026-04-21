drop extension if exists "pg_net";

drop trigger if exists "update_community_blogs_updated_at" on "public"."community_blogs";

drop trigger if exists "update_community_posts_updated_at" on "public"."community_posts";

drop policy "Admins can manage blogs" on "public"."community_blogs";

drop policy "Anyone authenticated can view blogs" on "public"."community_blogs";

drop policy "Admins can manage all comments" on "public"."community_comments";

drop policy "Anyone authenticated can view comments" on "public"."community_comments";

drop policy "Users can create comments" on "public"."community_comments";

drop policy "Users can delete own comments" on "public"."community_comments";

drop policy "Anyone authenticated can view likes" on "public"."community_likes";

drop policy "Users can add likes" on "public"."community_likes";

drop policy "Users can remove own likes" on "public"."community_likes";

drop policy "Admins can manage all posts" on "public"."community_posts";

drop policy "Anyone authenticated can view posts" on "public"."community_posts";

drop policy "Users can create posts" on "public"."community_posts";

drop policy "Users can delete own posts" on "public"."community_posts";

drop policy "Users can update likes_count on any post" on "public"."community_posts";

drop policy "Users can update own posts" on "public"."community_posts";

revoke delete on table "public"."community_blogs" from "anon";

revoke insert on table "public"."community_blogs" from "anon";

revoke references on table "public"."community_blogs" from "anon";

revoke select on table "public"."community_blogs" from "anon";

revoke trigger on table "public"."community_blogs" from "anon";

revoke truncate on table "public"."community_blogs" from "anon";

revoke update on table "public"."community_blogs" from "anon";

revoke delete on table "public"."community_blogs" from "authenticated";

revoke insert on table "public"."community_blogs" from "authenticated";

revoke references on table "public"."community_blogs" from "authenticated";

revoke select on table "public"."community_blogs" from "authenticated";

revoke trigger on table "public"."community_blogs" from "authenticated";

revoke truncate on table "public"."community_blogs" from "authenticated";

revoke update on table "public"."community_blogs" from "authenticated";

revoke delete on table "public"."community_blogs" from "service_role";

revoke insert on table "public"."community_blogs" from "service_role";

revoke references on table "public"."community_blogs" from "service_role";

revoke select on table "public"."community_blogs" from "service_role";

revoke trigger on table "public"."community_blogs" from "service_role";

revoke truncate on table "public"."community_blogs" from "service_role";

revoke update on table "public"."community_blogs" from "service_role";

revoke delete on table "public"."community_comments" from "anon";

revoke insert on table "public"."community_comments" from "anon";

revoke references on table "public"."community_comments" from "anon";

revoke select on table "public"."community_comments" from "anon";

revoke trigger on table "public"."community_comments" from "anon";

revoke truncate on table "public"."community_comments" from "anon";

revoke update on table "public"."community_comments" from "anon";

revoke delete on table "public"."community_comments" from "authenticated";

revoke insert on table "public"."community_comments" from "authenticated";

revoke references on table "public"."community_comments" from "authenticated";

revoke select on table "public"."community_comments" from "authenticated";

revoke trigger on table "public"."community_comments" from "authenticated";

revoke truncate on table "public"."community_comments" from "authenticated";

revoke update on table "public"."community_comments" from "authenticated";

revoke delete on table "public"."community_comments" from "service_role";

revoke insert on table "public"."community_comments" from "service_role";

revoke references on table "public"."community_comments" from "service_role";

revoke select on table "public"."community_comments" from "service_role";

revoke trigger on table "public"."community_comments" from "service_role";

revoke truncate on table "public"."community_comments" from "service_role";

revoke update on table "public"."community_comments" from "service_role";

revoke delete on table "public"."community_likes" from "anon";

revoke insert on table "public"."community_likes" from "anon";

revoke references on table "public"."community_likes" from "anon";

revoke select on table "public"."community_likes" from "anon";

revoke trigger on table "public"."community_likes" from "anon";

revoke truncate on table "public"."community_likes" from "anon";

revoke update on table "public"."community_likes" from "anon";

revoke delete on table "public"."community_likes" from "authenticated";

revoke insert on table "public"."community_likes" from "authenticated";

revoke references on table "public"."community_likes" from "authenticated";

revoke select on table "public"."community_likes" from "authenticated";

revoke trigger on table "public"."community_likes" from "authenticated";

revoke truncate on table "public"."community_likes" from "authenticated";

revoke update on table "public"."community_likes" from "authenticated";

revoke delete on table "public"."community_likes" from "service_role";

revoke insert on table "public"."community_likes" from "service_role";

revoke references on table "public"."community_likes" from "service_role";

revoke select on table "public"."community_likes" from "service_role";

revoke trigger on table "public"."community_likes" from "service_role";

revoke truncate on table "public"."community_likes" from "service_role";

revoke update on table "public"."community_likes" from "service_role";

revoke delete on table "public"."community_posts" from "anon";

revoke insert on table "public"."community_posts" from "anon";

revoke references on table "public"."community_posts" from "anon";

revoke select on table "public"."community_posts" from "anon";

revoke trigger on table "public"."community_posts" from "anon";

revoke truncate on table "public"."community_posts" from "anon";

revoke update on table "public"."community_posts" from "anon";

revoke delete on table "public"."community_posts" from "authenticated";

revoke insert on table "public"."community_posts" from "authenticated";

revoke references on table "public"."community_posts" from "authenticated";

revoke select on table "public"."community_posts" from "authenticated";

revoke trigger on table "public"."community_posts" from "authenticated";

revoke truncate on table "public"."community_posts" from "authenticated";

revoke update on table "public"."community_posts" from "authenticated";

revoke delete on table "public"."community_posts" from "service_role";

revoke insert on table "public"."community_posts" from "service_role";

revoke references on table "public"."community_posts" from "service_role";

revoke select on table "public"."community_posts" from "service_role";

revoke trigger on table "public"."community_posts" from "service_role";

revoke truncate on table "public"."community_posts" from "service_role";

revoke update on table "public"."community_posts" from "service_role";

alter table "public"."community_blogs" drop constraint "community_blogs_author_id_fkey";

alter table "public"."community_comments" drop constraint "community_comments_author_id_fkey";

alter table "public"."community_comments" drop constraint "community_comments_post_id_fkey";

alter table "public"."community_likes" drop constraint "community_likes_post_id_fkey";

alter table "public"."community_likes" drop constraint "community_likes_post_id_user_id_key";

alter table "public"."community_likes" drop constraint "community_likes_user_id_fkey";

alter table "public"."community_posts" drop constraint "community_posts_author_id_fkey";

alter table "public"."community_posts" drop constraint "community_posts_post_type_check";

alter table "public"."community_blogs" drop constraint "community_blogs_pkey";

alter table "public"."community_comments" drop constraint "community_comments_pkey";

alter table "public"."community_likes" drop constraint "community_likes_pkey";

alter table "public"."community_posts" drop constraint "community_posts_pkey";

drop index if exists "public"."community_blogs_pkey";

drop index if exists "public"."community_comments_pkey";

drop index if exists "public"."community_likes_pkey";

drop index if exists "public"."community_likes_post_id_user_id_key";

drop index if exists "public"."community_posts_pkey";

drop index if exists "public"."idx_community_comments_post_id";

drop index if exists "public"."idx_community_likes_post_id";

drop index if exists "public"."idx_community_posts_created_at";

drop table "public"."community_blogs";

drop table "public"."community_comments";

drop table "public"."community_likes";

drop table "public"."community_posts";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;

drop policy "Anyone can view community images" on "storage"."objects";

drop policy "Authenticated users can upload community images" on "storage"."objects";

drop policy "Users can delete own community images" on "storage"."objects";


