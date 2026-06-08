-- ============================================================
-- SOFTWARESAMPOLLAS — Row Level Security (RLS)
-- Ejecutar DESPUÉS de schema.sql
-- ============================================================

-- ============================================================
-- FUNCIÓN AUXILIAR: verificar si el usuario es admin
-- ============================================================
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   users_profiles
    WHERE  user_id = auth.uid()
      AND  role    = 'admin'
      AND  active  = TRUE
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ============================================================
-- ACTIVAR RLS EN TODAS LAS TABLAS
-- ============================================================
ALTER TABLE users_profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories              ENABLE ROW LEVEL SECURITY;
ALTER TABLE products                ENABLE ROW LEVEL SECURITY;
ALTER TABLE symptoms                ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_symptoms        ENABLE ROW LEVEL SECURITY;
ALTER TABLE serum_types             ENABLE ROW LEVEL SECURITY;
ALTER TABLE serum_products          ENABLE ROW LEVEL SECURITY;
ALTER TABLE calculation_parameters  ENABLE ROW LEVEL SECURITY;
ALTER TABLE calculations            ENABLE ROW LEVEL SECURITY;
ALTER TABLE calculation_items       ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- users_profiles
-- ============================================================
-- Cada usuario puede leer su propio perfil
CREATE POLICY "users_profiles: leer propio"
  ON users_profiles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admin puede leer todos los perfiles
CREATE POLICY "users_profiles: admin lee todo"
  ON users_profiles FOR SELECT
  TO authenticated
  USING (is_admin());

-- Admin puede crear perfiles
CREATE POLICY "users_profiles: admin crea"
  ON users_profiles FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- Admin puede actualizar perfiles
CREATE POLICY "users_profiles: admin actualiza"
  ON users_profiles FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());


-- ============================================================
-- categories
-- ============================================================
-- Cualquier usuario autenticado puede leer categorías activas
CREATE POLICY "categories: usuarios leen activas"
  ON categories FOR SELECT
  TO authenticated
  USING (active = TRUE);

-- Admin puede leer todas (incluidas inactivas)
CREATE POLICY "categories: admin lee todo"
  ON categories FOR SELECT
  TO authenticated
  USING (is_admin());

-- Solo admin puede crear/editar/desactivar categorías
CREATE POLICY "categories: admin gestiona"
  ON categories FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());


-- ============================================================
-- products
-- ============================================================
-- Usuarios autenticados pueden leer productos activos
CREATE POLICY "products: usuarios leen activos"
  ON products FOR SELECT
  TO authenticated
  USING (active = TRUE);

-- Admin puede leer todos (incluidos inactivos)
CREATE POLICY "products: admin lee todo"
  ON products FOR SELECT
  TO authenticated
  USING (is_admin());

-- Solo admin puede crear, editar o desactivar productos
CREATE POLICY "products: admin gestiona"
  ON products FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());


-- ============================================================
-- symptoms
-- ============================================================
-- Usuarios autenticados pueden leer síntomas activos
CREATE POLICY "symptoms: usuarios leen activos"
  ON symptoms FOR SELECT
  TO authenticated
  USING (active = TRUE);

-- Admin puede leer todos
CREATE POLICY "symptoms: admin lee todo"
  ON symptoms FOR SELECT
  TO authenticated
  USING (is_admin());

-- Solo admin puede gestionar síntomas
CREATE POLICY "symptoms: admin gestiona"
  ON symptoms FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());


-- ============================================================
-- product_symptoms
-- ============================================================
-- Usuarios autenticados pueden leer relaciones activas
CREATE POLICY "product_symptoms: usuarios leen activos"
  ON product_symptoms FOR SELECT
  TO authenticated
  USING (active = TRUE);

-- Admin puede leer todas
CREATE POLICY "product_symptoms: admin lee todo"
  ON product_symptoms FOR SELECT
  TO authenticated
  USING (is_admin());

-- Solo admin puede gestionar relaciones
CREATE POLICY "product_symptoms: admin gestiona"
  ON product_symptoms FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());


-- ============================================================
-- serum_types
-- ============================================================
-- Usuarios autenticados pueden leer tipos de suero activos
CREATE POLICY "serum_types: usuarios leen activos"
  ON serum_types FOR SELECT
  TO authenticated
  USING (active = TRUE);

-- Admin puede leer todos
CREATE POLICY "serum_types: admin lee todo"
  ON serum_types FOR SELECT
  TO authenticated
  USING (is_admin());

-- Solo admin puede gestionar tipos de suero
CREATE POLICY "serum_types: admin gestiona"
  ON serum_types FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());


-- ============================================================
-- serum_products
-- ============================================================
-- Usuarios autenticados pueden leer composición de sueros
CREATE POLICY "serum_products: usuarios leen"
  ON serum_products FOR SELECT
  TO authenticated
  USING (TRUE);

-- Solo admin puede gestionar
CREATE POLICY "serum_products: admin gestiona"
  ON serum_products FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());


-- ============================================================
-- calculation_parameters
-- ============================================================
-- Usuarios autenticados pueden leer parámetros activos
CREATE POLICY "calculation_parameters: usuarios leen activos"
  ON calculation_parameters FOR SELECT
  TO authenticated
  USING (active = TRUE);

-- Admin puede leer todos
CREATE POLICY "calculation_parameters: admin lee todo"
  ON calculation_parameters FOR SELECT
  TO authenticated
  USING (is_admin());

-- Solo admin puede gestionar parámetros
CREATE POLICY "calculation_parameters: admin gestiona"
  ON calculation_parameters FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());


-- ============================================================
-- calculations
-- ============================================================
-- Usuarios pueden leer sus propios cálculos
CREATE POLICY "calculations: leer propios"
  ON calculations FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

-- Admin puede leer todos los cálculos
CREATE POLICY "calculations: admin lee todo"
  ON calculations FOR SELECT
  TO authenticated
  USING (is_admin());

-- Usuarios autenticados pueden crear cálculos
CREATE POLICY "calculations: usuarios crean"
  ON calculations FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Usuarios pueden actualizar sus propios cálculos
CREATE POLICY "calculations: actualizar propios"
  ON calculations FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Admin puede gestionar todos
CREATE POLICY "calculations: admin gestiona"
  ON calculations FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());


-- ============================================================
-- calculation_items
-- ============================================================
-- Usuarios pueden leer ítems de sus propios cálculos
CREATE POLICY "calculation_items: leer propios"
  ON calculation_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM calculations c
      WHERE  c.id         = calculation_items.calculation_id
        AND  c.created_by = auth.uid()
    )
  );

-- Admin puede leer todos
CREATE POLICY "calculation_items: admin lee todo"
  ON calculation_items FOR SELECT
  TO authenticated
  USING (is_admin());

-- Usuarios pueden insertar ítems en sus propios cálculos
CREATE POLICY "calculation_items: usuarios insertan"
  ON calculation_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM calculations c
      WHERE  c.id         = calculation_items.calculation_id
        AND  c.created_by = auth.uid()
    )
  );

-- Admin puede gestionar todos los ítems
CREATE POLICY "calculation_items: admin gestiona"
  ON calculation_items FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());
