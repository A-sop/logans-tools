-- Particle-flow locate-by-path (Dept1 2026-11-16).
-- Convention: ingest_source / mouth = particle-flow OR ingest_meta ? 'document_class'
-- data_path lives in ingest_meta.data_path (preferred) or ingest_meta.store_path.

CREATE INDEX IF NOT EXISTS idx_tasks_particle_data_path
  ON tasks ((ingest_meta->>'data_path'))
  WHERE ingest_meta ? 'document_class';

CREATE INDEX IF NOT EXISTS idx_tasks_particle_store_path
  ON tasks ((ingest_meta->>'store_path'))
  WHERE ingest_meta ? 'document_class';

COMMENT ON INDEX idx_tasks_particle_data_path IS
  'Dept1 particle-flow: locate Neon task by data_path in ingest_meta';
