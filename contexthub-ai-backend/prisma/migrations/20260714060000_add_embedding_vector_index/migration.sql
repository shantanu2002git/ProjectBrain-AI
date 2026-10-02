ALTER TABLE "embeddings"
ALTER COLUMN "embedding" TYPE vector(1536);

CREATE INDEX IF NOT EXISTS "embeddings_project_id_idx" ON "embeddings"("project_id");

CREATE INDEX IF NOT EXISTS "embeddings_embedding_cosine_idx"
ON "embeddings"
USING ivfflat ("embedding" vector_cosine_ops)
WITH (lists = 100)
WHERE "embedding" IS NOT NULL;
