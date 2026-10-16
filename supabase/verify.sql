-- Read-only checks after migrations/202610150001_online.sql.
-- Run in Supabase SQL Editor as postgres. No password, token, question or personal
-- information is returned. Every passed value in the first result should be true.
-- Exposed schemas and Storage must also be checked as described in README.md.
WITH required_tables(name) AS (
  VALUES ('schema_version'),('workspaces'),('users'),('auth_sessions'),
    ('login_limits'),('classes'),('students'),('packs'),('weeks'),
    ('week_sets'),('plays'),('attempts'),('awards'),('redemptions'),
    ('audit'),('media')
), tables AS (
  SELECT c.oid,c.relname,c.relrowsecurity,c.relacl,c.relowner
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='bao_an' AND c.relkind IN ('r','p')
), api_roles AS (
  SELECT oid,rolname FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role')
), checks AS (
  SELECT 'schema_version_1' AS check_name,
    (SELECT count(*)=1 AND min(version)=1 FROM bao_an.schema_version) AS passed
  UNION ALL
  SELECT 'all_16_required_tables_exist',NOT EXISTS(
    SELECT 1 FROM required_tables r LEFT JOIN tables t ON t.relname=r.name WHERE t.oid IS NULL)
  UNION ALL
  SELECT 'all_project_tables_have_rls',NOT EXISTS(SELECT 1 FROM tables WHERE NOT relrowsecurity)
  UNION ALL
  SELECT 'supabase_api_roles_exist',(SELECT count(*)=3 FROM api_roles)
  UNION ALL
  SELECT 'api_roles_cannot_use_or_create_schema',NOT EXISTS(
    SELECT 1 FROM api_roles WHERE has_schema_privilege(oid,'bao_an','USAGE,CREATE'))
  UNION ALL
  SELECT 'api_roles_have_no_table_or_column_access',NOT EXISTS(
    SELECT 1 FROM api_roles r CROSS JOIN tables t
    WHERE has_table_privilege(r.oid,t.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      OR has_any_column_privilege(r.oid,t.oid,'SELECT,INSERT,UPDATE,REFERENCES'))
  UNION ALL
  SELECT 'api_roles_have_no_sequence_access',NOT EXISTS(
    SELECT 1 FROM api_roles r CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='bao_an' AND c.relkind='S' AND has_sequence_privilege(r.oid,c.oid,'USAGE,SELECT,UPDATE'))
  UNION ALL
  SELECT 'api_roles_have_no_function_access',NOT EXISTS(
    SELECT 1 FROM api_roles r CROSS JOIN pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='bao_an' AND has_function_privilege(r.oid,p.oid,'EXECUTE'))
  UNION ALL
  SELECT 'public_has_no_schema_access',NOT EXISTS(
    SELECT 1 FROM pg_namespace n CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a
    WHERE n.nspname='bao_an' AND a.grantee=0)
  UNION ALL
  SELECT 'public_has_no_table_access',NOT EXISTS(
    SELECT 1 FROM tables t CROSS JOIN LATERAL aclexplode(coalesce(t.relacl,acldefault('r',t.relowner))) a
    WHERE a.grantee=0)
  UNION ALL
  SELECT 'public_has_no_sequence_access',NOT EXISTS(
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('s',c.relowner))) a
    WHERE n.nspname='bao_an' AND c.relkind='S' AND a.grantee=0)
  UNION ALL
  SELECT 'public_has_no_function_access',NOT EXISTS(
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
    WHERE n.nspname='bao_an' AND a.grantee=0)
  UNION ALL
  SELECT 'all_foreign_keys_and_checks_validated',NOT EXISTS(
    SELECT 1 FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace
    WHERE n.nspname='bao_an' AND c.contype IN ('f','c') AND NOT c.convalidated)
)
SELECT check_name,passed FROM checks ORDER BY check_name;

-- A new project has zero in every row below. schema_version intentionally has
-- one metadata row. Existing installations retain their real row counts.
SELECT 'workspaces' AS table_name,count(*) AS row_count FROM bao_an.workspaces
UNION ALL SELECT 'users',count(*) FROM bao_an.users
UNION ALL SELECT 'classes',count(*) FROM bao_an.classes
UNION ALL SELECT 'students',count(*) FROM bao_an.students
UNION ALL SELECT 'weeks',count(*) FROM bao_an.weeks
UNION ALL SELECT 'question_pack_versions',count(*) FROM bao_an.packs
UNION ALL SELECT 'media_metadata',count(*) FROM bao_an.media
UNION ALL SELECT 'plays',count(*) FROM bao_an.plays
UNION ALL SELECT 'attempts',count(*) FROM bao_an.attempts
UNION ALL SELECT 'star_awards',count(*) FROM bao_an.awards
UNION ALL SELECT 'redemptions',count(*) FROM bao_an.redemptions
ORDER BY table_name;
