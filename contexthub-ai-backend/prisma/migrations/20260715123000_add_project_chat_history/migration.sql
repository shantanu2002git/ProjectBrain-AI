CREATE TABLE IF NOT EXISTS "chat_sessions" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "persona" TEXT NOT NULL DEFAULT 'developer',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "chat_messages" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "persona" TEXT,
    "citations" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- Keep chat history project-scoped only. These columns may exist locally from a previous prototype migration.
ALTER TABLE "chat_sessions" DROP COLUMN IF EXISTS "user_id";
ALTER TABLE "chat_messages" DROP COLUMN IF EXISTS "user_id";

CREATE INDEX IF NOT EXISTS "chat_sessions_project_id_updated_at_idx" ON "chat_sessions"("project_id", "updated_at");
CREATE INDEX IF NOT EXISTS "chat_messages_session_id_created_at_idx" ON "chat_messages"("session_id", "created_at");
CREATE INDEX IF NOT EXISTS "chat_messages_project_id_created_at_idx" ON "chat_messages"("project_id", "created_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chat_sessions_project_id_fkey'
  ) THEN
    ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chat_messages_session_id_fkey'
  ) THEN
    ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chat_messages_project_id_fkey'
  ) THEN
    ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
