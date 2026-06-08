# Análisis del Excel: CaLCULO DE SUEROS OK.xlsx

**Fecha de análisis:** 5 de junio de 2026

---

## 1. Hojas Encontradas

Total: **4 hojas**

| # | Nombre de hoja | Filas de datos | Columnas detectadas |
|---|----------------|---------------|---------------------|
| 1 | CALCULAR PRECIO SUERO | 999 | 1 |
| 2 | ACCESORIOS | 998 | 1 |
| 3 | AMPOLLAS | 1032 | 1 |
| 4 | DESCRIPCION | 1011 | 0 |

## 2. Columnas Encontradas por Hoja

### Hoja: "CALCULAR PRECIO SUERO"

- **LCULO DE SUERO OK** ✓

_✓ = columna con palabra clave relevante_

### Hoja: "ACCESORIOS"

- **EN LA COLUMNA CANTIDAD PONER ELNUMERO DE ASESORIOS** ✓

_✓ = columna con palabra clave relevante_

### Hoja: "AMPOLLAS"

- **cobalto**

_✓ = columna con palabra clave relevante_

### Hoja: "DESCRIPCION"

_Sin columnas detectadas (hoja vacía o sin encabezados en fila 1)._


## 3. Datos Útiles Identificados

### Productos / Nombres
- _No detectado automáticamente — revisar manualmente._

### Tipos de Suero
- `LCULO DE SUERO OK` — hoja: **CALCULAR PRECIO SUERO**

### Precios de Venta
- _No detectado automáticamente — revisar manualmente._

### Costos
- _No detectado automáticamente — revisar manualmente._

### Cantidades / Volúmenes
- `EN LA COLUMNA CANTIDAD PONER ELNUMERO DE ASESORIOS` — hoja: **ACCESORIOS**

### Unidades de Medida
- _No detectado automáticamente — revisar manualmente._

### Síntomas
- _No detectado automáticamente — revisar manualmente._

### Indicaciones / Usos
- _No detectado automáticamente — revisar manualmente._

### Parámetros de Cálculo
- _No detectado automáticamente — revisar manualmente._

### Márgenes / Utilidades
- _No detectado automáticamente — revisar manualmente._

### Insumos / Componentes
- _No detectado automáticamente — revisar manualmente._

### Observaciones / Notas
- _No detectado automáticamente — revisar manualmente._

## 4. Posibles Tablas para Supabase

### `products`
```sql
CREATE TABLE products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku         TEXT UNIQUE,
  name        TEXT NOT NULL,
  description TEXT,
  category    TEXT,
  unit        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### `serum_types`
```sql
CREATE TABLE serum_types (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### `serum_components`
```sql
CREATE TABLE serum_components (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  serum_type_id UUID REFERENCES serum_types(id) ON DELETE CASCADE,
  product_id    UUID REFERENCES products(id),
  quantity      NUMERIC,
  unit          TEXT,
  notes         TEXT
);
```

### `pricing`
```sql
CREATE TABLE pricing (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  serum_type_id  UUID REFERENCES serum_types(id) ON DELETE CASCADE,
  cost           NUMERIC,
  sale_price     NUMERIC,
  margin_percent NUMERIC GENERATED ALWAYS AS
                   (ROUND(((sale_price - cost) / NULLIF(sale_price,0)) * 100, 2)) STORED,
  valid_from     DATE DEFAULT CURRENT_DATE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
```

### `symptoms_catalog`
```sql
CREATE TABLE symptoms_catalog (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  category   TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `serum_symptoms` (relación N:M)
```sql
CREATE TABLE serum_symptoms (
  serum_type_id UUID REFERENCES serum_types(id) ON DELETE CASCADE,
  symptom_id    UUID REFERENCES symptoms_catalog(id) ON DELETE CASCADE,
  PRIMARY KEY (serum_type_id, symptom_id)
);
```

## 5. Campos que Faltan

| Campo necesario | ¿En el Excel? | Acción |
|----------------|--------------|--------|
| Síntomas del paciente | No detectado ✗ | Crear `symptoms_catalog` |
| Relación síntoma → suero | Probablemente no ✗ | Definir con criterio clínico |
| Contraindicaciones | Probablemente no ✗ | Agregar columna al catálogo |
| Indicaciones clínicas | No detectado ✗ | Verificar y estructurar |
| Composición detallada | No detectado ✗ | Mapear a `serum_components` |
| Dosis recomendada | Posiblemente ✓ | Verificar unidades |
| SKU / código de producto | No detectado ✗ | Agregar identificador único |
| Proveedor / marca | No detectado ✗ | Agregar para gestión de compras |
| Tiempo de administración | No detectado ✗ | Necesario para el protocolo |
| Vía de administración | No detectado ✗ | IV, IM, SC, etc. |

## 6. Recomendaciones para Limpiar el Excel

1. **Encabezados en fila 1**: Asegurar que la primera fila de cada hoja tenga los nombres de columna. Sin filas decorativas arriba.
2. **Eliminar celdas combinadas (merge)**: Las celdas unidas corrompen la lectura tabular. Convertirlas a valores repetidos.
3. **Eliminar filas/columnas vacías** entre datos.
4. **Convertir fórmulas a valores** en columnas de precio y costo antes de exportar.
5. **Unificar unidades**: `ml`, `ML`, `Ml` → usar siempre `ml`. Ídem para mg, cc.
6. **Precios como números puros**: Sin `$`, `S/.`, puntos de miles. Solo el número.
7. **Una tabla por hoja**: Cada hoja = una sola estructura de tabla.
8. **Nombres de hoja sin espacios ni caracteres especiales**: Facilita la automatización.
9. **Agregar columna ID** en cada hoja como número correlativo único.

## 7. Propuesta de Importación a Supabase

### Flujo de importación

1. Limpiar el Excel (punto 6)
2. Ejecutar `node scripts/analyze-excel.mjs` para regenerar los CSVs limpios
3. Crear las tablas en Supabase (SQL del punto 4)
4. Importar CSVs desde el panel de Supabase (Table Editor → Import CSV) o con un script seed
5. Verificar integridad de las foreign keys
6. Completar los datos faltantes (síntomas, indicaciones) manualmente

### Orden de importación
`products` → `serum_types` → `symptoms_catalog` → `pricing` → `serum_components` → `serum_symptoms`

## 8. Qué Datos Parecen Productos

- No detectados automáticamente.
- Revisar columnas con nombres de sueros, vitaminas, minerales o insumos.
- Nota: si cada **hoja** representa un suero, el nombre de la hoja es el producto principal.

## 9. Qué Datos Parecen Tipos de Suero

- Columna `LCULO DE SUERO OK` en hoja **CALCULAR PRECIO SUERO**

## 10. Qué Datos Parecen Parámetros de Cálculo

- No detectados automáticamente.
- Los parámetros (dosis/kg, volumen base, concentración) pueden estar como fórmulas Excel.
- Revisar manualmente las celdas con fórmulas para extraer la lógica de cálculo.

## 11. Qué Datos Sirven para Precios

- No detectados automáticamente.
- Buscar columnas numéricas que representen precio de venta, costo de compra o margen.

## 12. Qué Datos Faltan para Recomendar Ampollas según Síntomas

Para un motor de recomendación funcional se necesita:

| Dato | Estado | Fuente sugerida |
|------|--------|-----------------|
| Catálogo de síntomas | ✗ Falta | Crear manualmente con criterio clínico |
| Mapa síntoma → suero recomendado | ✗ Falta | Definir con el equipo médico |
| Composición de cada suero | ✗ Falta | Completar desde el Excel |
| Contraindicaciones | ✗ Falta | Agregar manualmente |
| Precios actualizados | ✗ Falta | Extraer del Excel y mantener |
| Tiempo y vía de administración | ✗ Falta | Protocolo clínico |

### Conclusión

El Excel contiene principalmente **datos de costos y cálculo de precios** de sueros/ampollas.
Para el sistema de recomendación será necesario:

1. Construir el catálogo de síntomas desde cero (con criterio clínico).
2. Definir la relación síntoma ↔ suero recomendado.
3. Completar la composición detallada de cada suero.
4. Agregar contraindicaciones y restricciones.

---

_Reporte generado automáticamente por `scripts/analyze-excel.mjs`_
