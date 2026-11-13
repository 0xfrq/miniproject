-- These records are authorized by the Next.js backend, not Supabase Auth.
-- Supabase may automatically grant new public tables to its Data API roles.
-- Revoke those grants before bootstrap can insert accounts or school data.
DO $$
DECLARE
  object_name text;
  api_role text;
BEGIN
  FOREACH object_name IN ARRAY ARRAY[
    'schema_migrations', 'legacy_imports', 'users', 'sessions', 'login_attempts',
    'site_settings', 'public_records', 'materials', 'assessments', 'questions',
    'grading', 'books', 'book_chunks', 'ai_conversations', 'ai_messages'
  ] LOOP
    EXECUTE format('REVOKE ALL ON TABLE %I.%I FROM PUBLIC', current_schema(), object_name);
    FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
        EXECUTE format('REVOKE ALL ON TABLE %I.%I FROM %I', current_schema(), object_name, api_role);
      END IF;
    END LOOP;
  END LOOP;

  FOREACH object_name IN ARRAY ARRAY[
    'public_records_position_seq', 'materials_position_seq',
    'assessments_position_seq', 'questions_position_seq',
    'grading_position_seq', 'ai_messages_id_seq'
  ] LOOP
    EXECUTE format('REVOKE ALL ON SEQUENCE %I.%I FROM PUBLIC', current_schema(), object_name);
    FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
        EXECUTE format('REVOKE ALL ON SEQUENCE %I.%I FROM %I', current_schema(), object_name, api_role);
      END IF;
    END LOOP;
  END LOOP;
END;
$$;
