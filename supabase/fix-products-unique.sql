-- ============================================================
-- fix-products-unique.sql
-- Agrega restricción única (name, product_type) a la tabla products
-- para habilitar upsert por ON CONFLICT en el script de importación.
--
-- Ejecutar en Supabase SQL Editor UNA SOLA VEZ, después de schema.sql
-- ============================================================

ALTER TABLE products
  ADD CONSTRAINT products_name_type_unique UNIQUE (name, product_type);
