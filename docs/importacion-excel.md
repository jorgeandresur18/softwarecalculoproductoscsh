# Documentación de Importación del Excel

Explica cómo se limpian, procesan e importan los datos del archivo
`data/CaLCULO DE SUEROS OK.xlsx` hacia Supabase.

---

## 1. Hojas que se importan

| Hoja | ¿Se importa? | Tabla destino | Descripción |
|------|-------------|---------------|-------------|
| `AMPOLLAS` | Sí | `products` | Ampollas con PVM, margen y PVP |
| `DESCRIPCION` | Sí | `products` | Versión alternativa de ampollas (solo PVP) |
| `ACCESORIOS` | Sí | `products` | Accesorios IV (catéteres, soluciones, etc.) |
| `CALCULAR PRECIO SUERO` | No | — | Solo tabla de cálculo manual, sin datos a importar |

---

## 2. Estructura del Excel y problema de filas decorativas

Cada hoja tiene **filas decorativas** (títulos, instrucciones) antes de los encabezados reales.

| Hoja | Filas decorativas | Fila de encabezados reales |
|------|------------------|---------------------------|
| `AMPOLLAS` | Filas 1–4 | **Fila 5** |
| `ACCESORIOS` | Filas 1–2 | **Fila 3** |
| `DESCRIPCION` | Filas 1–3 | **Fila 4** |

El script `scripts/import-excel-data.mjs` detecta automáticamente la fila de encabezados
buscando palabras clave como `proveedor`, `descripcion`, `compuesto`, `padecimientos`, `pvp`.

---

## 3. Cómo se importan las ampollas

### Fuentes
- **AMPOLLAS.csv**: contiene `PROVEEDOR`, `MARCA`, `TIPO`, `COMPUESTO`, `PADECIMIENTOS`, `ML`, `PVM`, `%`, `PVP`
- **DESCRIPCION.csv**: contiene `PROVEEDOR`, `MARCA`, `TIPO`, `COMPUESTOS`, `PADECIMIENTOS`, `ML`, `PVP`

### Proceso de limpieza

1. Se saltan las filas vacías y las filas decorativas.
2. Se detecta automáticamente la fila de encabezados.
3. Cada celda se limpia:
   - **Precios**: se elimina `$`, comas y espacios → `$4.43` → `4.43`
   - **Porcentajes**: se elimina `%` → `40%` → `40`
   - **Textos**: se recortan espacios al inicio y al final
4. Se filtran filas donde `COMPUESTO` o `COMPUESTOS` esté vacío.

### Deduplicación

Como el mismo producto puede aparecer en ambas hojas (`AMPOLLAS` y `DESCRIPCION`),
el script unifica por nombre normalizado:

- Primero se toman todos los datos de `AMPOLLAS` (tiene PVM).
- Luego se enriquecen con datos de `DESCRIPCION` (puede tener PVP más actualizado).
- Si el mismo nombre aparece en ambas, se conserva el PVP de `DESCRIPCION`.

### Mapeo de columnas al esquema

| Columna Excel | Campo en `products` |
|--------------|---------------------|
| `PROVEEDOR` | `provider` |
| `MARCA` | `brand` |
| `TIPO` | `category_id` (busca en tabla `categories`) |
| `COMPUESTO` / `COMPUESTOS` | `name` y `compound` |
| `PADECIMIENTOS` | `conditions_text` |
| `ML` | `ml` |
| `PVM` | `pvm` |
| `%` | `margin_percentage` |
| `PVP` | `pvp` |
| _(fijo)_ | `product_type = 'ampolla'` |

---

## 4. Cómo se importan los accesorios

### Fuente
- **ACCESORIOS.csv**: contiene `DESCRIPCION`, `MEDIDA`, `PVM`, `%`, `PVP`, `CANTIDAD`, `TOTAL`

### Proceso de limpieza

1. Se saltan las filas decorativas (filas 1–2).
2. Se detecta la fila de encabezados (fila 3).
3. Se filtran filas donde `DESCRIPCION` esté vacío.
4. El nombre se construye como `DESCRIPCION + MEDIDA + "ml"` cuando `MEDIDA` tiene valor.
   Ejemplo: `SOLUCION SALINA` + `250` → nombre `SOLUCION SALINA 250ml`

### Mapeo al esquema

| Columna Excel | Campo en `products` |
|--------------|---------------------|
| `DESCRIPCION` | parte de `name` |
| `MEDIDA` | `measure` y parte de `name` |
| `PVM` | `pvm` |
| `%` | `margin_percentage` |
| `PVP` | `pvp` |
| _(fijo)_ | `product_type = 'accesorio'` |
| _(fijo)_ | `category_id → 'ACCESORIO'` |

---

## 5. Cómo se crean los síntomas desde PADECIMIENTOS

La columna `PADECIMIENTOS` contiene texto libre con uno o más padecimientos separados por coma.

**Ejemplos de valores en el Excel:**
```
Osteoporosis, trastornos del crecimiento
Calcificacion, calambres, palpitaciones cardiacas
síndrome fatiga crónica
alergias de todo tipo
```

### Proceso de extracción

1. Se toma el texto completo de `PADECIMIENTOS`.
2. Se divide por `,` o `;` o salto de línea.
3. Cada parte resultante se recorta y se verifica que tenga entre 3 y 200 caracteres.
4. Se normaliza para deduplicar (sin tildes, minúsculas, sin puntuación especial).
5. Se guarda en la tabla `symptoms` con `name` = texto original limpio, capitalizado.

**Ejemplo de síntomas generados:**
- `Osteoporosis`
- `Trastornos del crecimiento`
- `Calcificacion`
- `Calambres`
- `Palpitaciones cardiacas`
- `Síndrome fatiga crónica`
- `Alergias de todo tipo`

### Relaciones product_symptoms

Por cada síntoma de un producto, se crea un registro en `product_symptoms`:
- `product_id` → UUID del producto importado
- `symptom_id` → UUID del síntoma importado
- `recommendation_level` → `'medio'` por defecto
- `active` → `true`

La deduplicación usa `ON CONFLICT (product_id, symptom_id) DO NOTHING`,
por lo que es seguro re-ejecutar el script.

---

## 6. Datos que deben revisarse manualmente

### 6.1 Productos sin PVP
Algunos registros en el Excel tienen el precio en blanco o con formato inválido.
Después de la importación, busca en Supabase:

```sql
SELECT name, product_type, pvp
FROM   products
WHERE  pvp = 0
ORDER  BY name;
```

Actualiza los precios directamente en Supabase o en el Excel antes de reimportar.

### 6.2 Productos sin padecimientos
Los accesorios y algunos productos no tienen `PADECIMIENTOS`.
No generarán relaciones con síntomas. Esto es esperado para accesorios.

### 6.3 Síntomas con texto largo o mal formado
Si `PADECIMIENTOS` tiene textos muy largos que en realidad son descripciones y no síntomas,
aparecerán como síntomas en la base de datos. Revisarlos con:

```sql
SELECT name, length(name) AS len
FROM   symptoms
WHERE  length(name) > 80
ORDER  BY len DESC;
```

### 6.4 Categorías sin mapear
Si el campo `TIPO` en el Excel tiene un valor que no existe en la tabla `categories`,
el producto se importará con `category_id = NULL`.
Verificar con:

```sql
SELECT name, compound, category_id
FROM   products
WHERE  category_id IS NULL
  AND  product_type = 'ampolla';
```

---

## 7. Cómo corregir el Excel si hay errores

### Error: precios con formato de texto
**Síntoma**: el campo `pvp` importa como `0` aunque el Excel tiene valor.
**Causa**: el precio tiene `$`, espacios, o es texto `"$4,50"`.
**Solución**: en Excel, seleccionar la columna PVP → Format Cells → Number → sin símbolo de moneda → guardar → re-ejecutar `node scripts/analyze-excel.mjs` y luego el import.

### Error: filas con datos en columnas equivocadas
**Síntoma**: el nombre importado es `"EN LA COLUMNA CANTIDAD..."` u otro texto decorativo.
**Causa**: el script no detectó correctamente la fila de encabezados.
**Solución**: eliminar o mover las filas decorativas al inicio de la hoja en el Excel
para que los encabezados reales estén en la fila 1. Luego re-ejecutar los scripts.

### Error: síntomas duplicados con tilde/sin tilde
**Síntoma**: `Calcificacion` y `Calcificación` aparecen como dos síntomas distintos.
**Causa**: el Excel tiene inconsistencia de acentuación.
**Solución**: corregir en la tabla `symptoms` directamente, o en el Excel antes de reimportar:

```sql
-- Unificar síntomas duplicados manualmente
UPDATE symptoms SET name = 'Calcificación' WHERE name = 'Calcificacion';
-- Eliminar el duplicado si quedó
DELETE FROM symptoms WHERE name = 'Calcificacion';
```

### Reimportar desde cero
Si necesitas empezar de cero con los datos:

```sql
-- ¡CUIDADO! Esto borra todos los datos importados
TRUNCATE product_symptoms, products, symptoms RESTART IDENTITY CASCADE;
```

Luego vuelve a ejecutar:

```bash
node --env-file=.env.local scripts/import-excel-data.mjs --import
```

---

## 8. Verificación post-importación

Ejecuta estas queries en el SQL Editor de Supabase para verificar:

```sql
-- Conteo general
SELECT
  (SELECT COUNT(*) FROM products WHERE product_type = 'ampolla')   AS ampollas,
  (SELECT COUNT(*) FROM products WHERE product_type = 'accesorio') AS accesorios,
  (SELECT COUNT(*) FROM symptoms)                                   AS sintomas,
  (SELECT COUNT(*) FROM product_symptoms)                          AS relaciones;

-- Ampollas con más síntomas relacionados
SELECT p.name, COUNT(ps.symptom_id) AS num_sintomas
FROM   products p
JOIN   product_symptoms ps ON ps.product_id = p.id
GROUP  BY p.name
ORDER  BY num_sintomas DESC
LIMIT  10;

-- Síntomas más comunes
SELECT s.name, COUNT(ps.product_id) AS num_productos
FROM   symptoms s
JOIN   product_symptoms ps ON ps.symptom_id = s.id
GROUP  BY s.name
ORDER  BY num_productos DESC
LIMIT  10;
```

---

_Documentación generada para el proyecto SoftwareAmpollas_
