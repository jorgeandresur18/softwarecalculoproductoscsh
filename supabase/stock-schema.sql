-- ============================================================
-- SOFTWARESAMPOLLAS — Schema de revisión de stock e inventario
-- Ejecutar DESPUÉS de schema.sql y rls.sql
-- ============================================================


-- ============================================================
-- 1. STOCK_CANDIDATES
-- Candidatos detectados automáticamente desde PDFs de stock.
-- El admin los revisa y los vincula o descarta manualmente.
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_candidates (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_detected           TEXT        NOT NULL,
  source_label            TEXT        NOT NULL,   -- nombre legible del documento
  source_type             TEXT        NOT NULL,   -- ampolla_iv | ampolla_quimica | etc.
  priority_class          CHAR(1)     CHECK (priority_class IN ('A','B','C')),
  quantity_detected       TEXT,
  presentation_detected   TEXT,
  price_detected          NUMERIC,
  indications_text        TEXT,
  incompatibilities_text  TEXT,

  -- Coincidencia automática (resultado del parser)
  auto_matched_product_id UUID        REFERENCES products(id) ON DELETE SET NULL,
  auto_match_score        NUMERIC,               -- 0-100
  auto_match_type         TEXT,                  -- exacta | contenida | parcial

  -- Decisión del admin
  status                  TEXT        NOT NULL DEFAULT 'pendiente'
                            CHECK (status IN ('pendiente','aprobado','ignorado','vinculado')),
  linked_product_id       UUID        REFERENCES products(id) ON DELETE SET NULL,
  admin_notes             TEXT,
  reviewed_by             UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at             TIMESTAMPTZ,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_candidates_status         ON stock_candidates(status);
CREATE INDEX IF NOT EXISTS idx_stock_candidates_priority       ON stock_candidates(priority_class);
CREATE INDEX IF NOT EXISTS idx_stock_candidates_linked_product ON stock_candidates(linked_product_id);
CREATE INDEX IF NOT EXISTS idx_stock_candidates_auto_match     ON stock_candidates(auto_matched_product_id);


-- ============================================================
-- 2. PRODUCT_STOCK_RECOMMENDATIONS
-- Recomendaciones de stock mínimo y prioridad por producto.
-- Se llena después de que el admin aprueba un stock_candidate.
-- No depende de ninguna tabla nueva — solo de products.
-- ============================================================
CREATE TABLE IF NOT EXISTS product_stock_recommendations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id            UUID        REFERENCES products(id) ON DELETE SET NULL,
  product_name_source   TEXT        NOT NULL,    -- nombre tal como aparece en PDF
  source_document       TEXT        NOT NULL,    -- nombre del archivo PDF
  priority_class        CHAR(1)     CHECK (priority_class IN ('A','B','C')),
  suggested_quantity    NUMERIC,
  suggested_unit        TEXT,                    -- ml | mg | unidad | frasco
  suggested_presentation TEXT,                  -- ej: 10ml x 5 ampollas
  notes                 TEXT,
  verified              BOOLEAN     NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_psr_product_id     ON product_stock_recommendations(product_id);
CREATE INDEX IF NOT EXISTS idx_psr_priority       ON product_stock_recommendations(priority_class);
CREATE INDEX IF NOT EXISTS idx_psr_verified       ON product_stock_recommendations(verified);


-- ============================================================
-- 3. PRODUCT_CLINICAL_NOTES
-- Indicaciones, incompatibilidades, dosis y advertencias.
-- Complementa products sin modificarlo.
-- ============================================================
CREATE TABLE IF NOT EXISTS product_clinical_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  note_type   TEXT        NOT NULL
                CHECK (note_type IN (
                  'indicacion',
                  'contraindicacion',
                  'incompatibilidad',
                  'dosis',
                  'advertencia',
                  'preparacion',
                  'observacion'
                )),
  content     TEXT        NOT NULL,
  source      TEXT,                              -- archivo PDF de origen
  active      BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pcn_product_id ON product_clinical_notes(product_id);
CREATE INDEX IF NOT EXISTS idx_pcn_note_type  ON product_clinical_notes(note_type);
CREATE INDEX IF NOT EXISTS idx_pcn_active     ON product_clinical_notes(active);


-- ============================================================
-- 4. INVENTORY_ITEMS
-- Stock físico actual por producto.
-- Crear después de verificar coincidencias en stock_candidates.
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        UUID        REFERENCES products(id) ON DELETE SET NULL,
  product_name_ref  TEXT        NOT NULL,        -- nombre de referencia
  sku               TEXT,
  current_quantity  NUMERIC     NOT NULL DEFAULT 0,
  min_quantity      NUMERIC     NOT NULL DEFAULT 0,  -- punto de reorden
  max_quantity      NUMERIC,
  unit              TEXT,                        -- ml | mg | unidad | frasco
  location          TEXT,                        -- ubicación en almacén
  priority_class    CHAR(1)     CHECK (priority_class IN ('A','B','C')),
  notes             TEXT,
  active            BOOLEAN     NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_inventory_items_updated_at
  BEFORE UPDATE ON inventory_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_inv_items_product_id    ON inventory_items(product_id);
CREATE INDEX IF NOT EXISTS idx_inv_items_priority      ON inventory_items(priority_class);
CREATE INDEX IF NOT EXISTS idx_inv_items_active        ON inventory_items(active);
CREATE INDEX IF NOT EXISTS idx_inv_items_low_stock     ON inventory_items(current_quantity, min_quantity);


-- ============================================================
-- 5. INVENTORY_MOVEMENTS
-- Registro de entradas, salidas y ajustes de inventario.
-- Depende de inventory_items — crear al último.
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_movements (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id UUID        NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  movement_type     TEXT        NOT NULL
                      CHECK (movement_type IN ('entrada','salida','ajuste','merma')),
  quantity          NUMERIC     NOT NULL,
  previous_quantity NUMERIC,                     -- snapshot antes del movimiento
  reason            TEXT,
  reference_number  TEXT,                        -- factura, lote, OC
  created_by        UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inv_movements_item       ON inventory_movements(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_inv_movements_type       ON inventory_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_inv_movements_created_at ON inventory_movements(created_at DESC);


-- ============================================================
-- RLS — aplicar el mismo patrón de rls.sql
-- ============================================================
ALTER TABLE stock_candidates                ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_stock_recommendations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_clinical_notes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements             ENABLE ROW LEVEL SECURITY;

-- Ejemplo de política (replicar el patrón de rls.sql para cada tabla):
-- Solo usuarios autenticados activos pueden leer.
-- Solo admin puede insertar, actualizar y eliminar.
--
-- CREATE POLICY "stock_candidates_select" ON stock_candidates
--   FOR SELECT TO authenticated
--   USING (
--     EXISTS (
--       SELECT 1 FROM users_profiles
--       WHERE user_id = auth.uid() AND active = true
--     )
--   );
--
-- CREATE POLICY "stock_candidates_admin" ON stock_candidates
--   FOR ALL TO authenticated
--   USING (
--     EXISTS (
--       SELECT 1 FROM users_profiles
--       WHERE user_id = auth.uid() AND role = 'admin' AND active = true
--     )
--   );
--
-- (Repetir para product_stock_recommendations, product_clinical_notes,
--  inventory_items e inventory_movements)


-- ============================================================
-- ORDEN DE IMPLEMENTACIÓN RECOMENDADO
-- ============================================================
-- 1. Crear tablas con este script
-- 2. Aplicar políticas RLS (descomentar o adaptar el bloque anterior)
-- 3. Cargar stock_candidates desde el JSON generado por el script
-- 4. Admin revisa candidatos en /stock-review y aprueba / vincula
-- 5. Migrar candidatos aprobados a product_stock_recommendations
-- 6. Configurar inventory_items con stock inicial
-- 7. Recién entonces construir el módulo Calcular Suero
-- ============================================================
