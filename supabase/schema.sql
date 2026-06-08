-- ============================================================
-- SOFTWARESAMPOLLAS — Esquema de base de datos
-- Supabase PostgreSQL
-- ============================================================

-- ============================================================
-- EXTENSIONES
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ============================================================
-- FUNCIÓN: updated_at automático
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- A. USERS_PROFILES
-- Perfil extendido de usuarios del sistema (admin / staff)
-- ============================================================
CREATE TABLE IF NOT EXISTS users_profiles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT,
  role        TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_users_profiles_user_id ON users_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_users_profiles_role    ON users_profiles(role);


-- ============================================================
-- B. CATEGORIES
-- Clasificación de productos (ampolla, accesorio, etc.)
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- C. PRODUCTS
-- Ampollas, accesorios, soluciones e insumos
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type        TEXT NOT NULL DEFAULT 'ampolla'
                        CHECK (product_type IN ('ampolla','accesorio','solucion','insumo','otro')),
  provider            TEXT,
  brand               TEXT,
  name                TEXT NOT NULL,
  compound            TEXT,
  description         TEXT,
  category_id         UUID REFERENCES categories(id) ON DELETE SET NULL,
  conditions_text     TEXT,
  ml                  NUMERIC,
  measure             TEXT,
  pvm                 NUMERIC NOT NULL DEFAULT 0,
  margin_percentage   NUMERIC NOT NULL DEFAULT 0,
  pvp                 NUMERIC NOT NULL DEFAULT 0,
  quantity            NUMERIC NOT NULL DEFAULT 1,
  total               NUMERIC NOT NULL DEFAULT 0,
  indications         TEXT,
  observations        TEXT,
  active              BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_type     ON products(product_type);
CREATE INDEX IF NOT EXISTS idx_products_active   ON products(active);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_name     ON products USING gin(to_tsvector('spanish', name));

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- D. SYMPTOMS
-- Catálogo de síntomas / padecimientos normalizados
-- ============================================================
CREATE TABLE IF NOT EXISTS symptoms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  category    TEXT,
  description TEXT,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_symptoms_active ON symptoms(active);
CREATE INDEX IF NOT EXISTS idx_symptoms_name
  ON symptoms USING gin(to_tsvector('spanish', name));


-- ============================================================
-- E. PRODUCT_SYMPTOMS
-- Relación N:M entre productos y síntomas
-- ============================================================
CREATE TABLE IF NOT EXISTS product_symptoms (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id           UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  symptom_id           UUID NOT NULL REFERENCES symptoms(id) ON DELETE CASCADE,
  recommendation_level TEXT NOT NULL DEFAULT 'medio'
                          CHECK (recommendation_level IN ('alto','medio','bajo')),
  reason               TEXT,
  active               BOOLEAN NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, symptom_id)
);

CREATE INDEX IF NOT EXISTS idx_product_symptoms_product ON product_symptoms(product_id);
CREATE INDEX IF NOT EXISTS idx_product_symptoms_symptom ON product_symptoms(symptom_id);


-- ============================================================
-- F. SERUM_TYPES
-- Tipos de suero terapéutico
-- ============================================================
CREATE TABLE IF NOT EXISTS serum_types (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL UNIQUE,
  objective       TEXT,
  description     TEXT,
  base_cost       NUMERIC NOT NULL DEFAULT 0,
  default_margin  NUMERIC NOT NULL DEFAULT 0,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_serum_types_updated_at
  BEFORE UPDATE ON serum_types
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- G. SERUM_PRODUCTS
-- Productos predeterminados que componen cada tipo de suero
-- ============================================================
CREATE TABLE IF NOT EXISTS serum_products (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  serum_type_id    UUID NOT NULL REFERENCES serum_types(id) ON DELETE CASCADE,
  product_id       UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  default_quantity NUMERIC NOT NULL DEFAULT 1,
  required         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (serum_type_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_serum_products_serum   ON serum_products(serum_type_id);
CREATE INDEX IF NOT EXISTS idx_serum_products_product ON serum_products(product_id);


-- ============================================================
-- H. CALCULATION_PARAMETERS
-- Parámetros editables de cálculo (margen global, etc.)
-- ============================================================
CREATE TABLE IF NOT EXISTS calculation_parameters (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  key         TEXT NOT NULL UNIQUE,
  value       NUMERIC NOT NULL DEFAULT 0,
  type        TEXT,
  description TEXT,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_calculation_parameters_updated_at
  BEFORE UPDATE ON calculation_parameters
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Parámetros iniciales
INSERT INTO calculation_parameters (name, key, value, type, description)
VALUES
  ('Margen por defecto',         'default_margin',          40,   'porcentaje', 'Margen de ganancia porcentual aplicado por defecto'),
  ('Costo servicio enfermero',   'nurse_service_cost',      10,   'monto',      'Costo fijo del servicio de enfermería'),
  ('IVA',                        'iva_percentage',           0,   'porcentaje', 'Porcentaje de IVA aplicado (0 si no aplica)')
ON CONFLICT (key) DO NOTHING;


-- ============================================================
-- I. CALCULATIONS
-- Cálculos de sueros realizados (historial)
-- ============================================================
CREATE TABLE IF NOT EXISTS calculations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_reference   TEXT,
  patient_city        TEXT,
  symptoms_text       TEXT,
  serum_type_id       UUID REFERENCES serum_types(id) ON DELETE SET NULL,
  subtotal_products   NUMERIC NOT NULL DEFAULT 0,
  additional_costs    NUMERIC NOT NULL DEFAULT 0,
  margin_amount       NUMERIC NOT NULL DEFAULT 0,
  discount_amount     NUMERIC NOT NULL DEFAULT 0,
  final_price         NUMERIC NOT NULL DEFAULT 0,
  observations        TEXT,
  created_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calculations_created_by ON calculations(created_by);
CREATE INDEX IF NOT EXISTS idx_calculations_serum_type ON calculations(serum_type_id);
CREATE INDEX IF NOT EXISTS idx_calculations_created_at ON calculations(created_at DESC);


-- ============================================================
-- J. CALCULATION_ITEMS
-- Productos incluidos en cada cálculo (snapshot de precio)
-- ============================================================
CREATE TABLE IF NOT EXISTS calculation_items (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calculation_id        UUID NOT NULL REFERENCES calculations(id) ON DELETE CASCADE,
  product_id            UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name_snapshot TEXT NOT NULL,
  quantity              NUMERIC NOT NULL DEFAULT 1,
  unit_price            NUMERIC NOT NULL DEFAULT 0,
  total_price           NUMERIC NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calculation_items_calc    ON calculation_items(calculation_id);
CREATE INDEX IF NOT EXISTS idx_calculation_items_product ON calculation_items(product_id);


-- ============================================================
-- DATOS INICIALES — Categorías
-- ============================================================
INSERT INTO categories (name, description)
VALUES
  ('MINERAL',              'Minerales individuales en vial'),
  ('MINERALES COMBINADOS', 'Combinaciones de minerales en vial'),
  ('AMINO',                'Aminoácidos individuales en vial'),
  ('SUST COMBINADO',       'Sustancias combinadas / fórmulas compuestas'),
  ('SOLUCION',             'Soluciones base (salina, ringer, etc.)'),
  ('ACCESORIO',            'Accesorios para aplicación IV'),
  ('VITAMINA',             'Vitaminas inyectables'),
  ('OTRO',                 'Otros productos')
ON CONFLICT (name) DO NOTHING;
