import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

const EXCEL_PATH = join(ROOT, 'data', 'CaLCULO DE SUEROS OK.xlsx');
const PROCESSED_DIR = join(ROOT, 'data', 'processed');
const DOCS_DIR = join(ROOT, 'docs');

const KEYWORD_CATEGORIES = {
  products:          ['producto', 'nombre', 'descripcion', 'descripción', 'item', 'articulo', 'artículo'],
  serumTypes:        ['suero', 'tipo', 'categoria', 'categoría', 'mix', 'mezcla', 'solucion', 'solución'],
  prices:            ['precio', 'pvp', 'venta', 'tarifa', 'valor venta'],
  costs:             ['costo', 'costo unitario', 'precio costo', 'precio compra', 'compra'],
  quantities:        ['cantidad', 'volumen', 'ml', 'mg', 'dosis', 'cc', 'litro'],
  units:             ['unidad', 'presentacion', 'presentación', 'medida'],
  symptoms:          ['sintoma', 'síntoma', 'problema', 'condicion', 'condición', 'patologia', 'patología'],
  indications:       ['indicacion', 'indicación', 'uso', 'aplicacion', 'aplicación', 'para que', 'para qué'],
  calculationParams: ['parametro', 'parámetro', 'calculo', 'cálculo', 'formula', 'fórmula', 'factor'],
  margins:           ['margen', 'utilidad', 'ganancia', 'rentabilidad'],
  inputs:            ['insumo', 'componente', 'ingrediente', 'vitamina', 'mineral', 'electrolito', 'aditivo'],
  observations:      ['observacion', 'observación', 'nota', 'comentario', 'descripcion'],
};

function normalize(str) {
  return str
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function matchesCategory(colName, keywords) {
  const col = normalize(colName);
  return keywords.some(kw => col.includes(normalize(kw)));
}

function analyzeSheet(sheetName, worksheet) {
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

  if (jsonData.length === 0) {
    return { sheetName, rows: 0, columns: [], firstRows: [], categorizedCols: {} };
  }

  const headers = (jsonData[0] || []).map(h => (h === null || h === undefined ? '' : String(h)));
  const dataRows = jsonData.slice(1);
  const firstRows = jsonData.slice(0, Math.min(6, jsonData.length));

  const categorizedCols = {};
  Object.entries(KEYWORD_CATEGORIES).forEach(([cat, keywords]) => {
    categorizedCols[cat] = headers
      .map((h, i) => ({ name: h, index: i }))
      .filter(col => col.name && matchesCategory(col.name, keywords));
  });

  return { sheetName, rows: dataRows.length, columns: headers, firstRows, categorizedCols, allData: jsonData };
}

function printFirstRows(firstRows) {
  firstRows.forEach((row, i) => {
    const cells = row.slice(0, 10).map(c => String(c ?? '').substring(0, 20).padEnd(20));
    const suffix = row.length > 10 ? ' ...' : '';
    if (i === 0) {
      console.log(`  [ENCABEZADOS] ${cells.join(' | ')}${suffix}`);
    } else {
      console.log(`  [Fila ${String(i).padStart(2)}]    ${cells.join(' | ')}${suffix}`);
    }
  });
}

function collectAllCategorized(allAnalyses) {
  const result = {};
  Object.keys(KEYWORD_CATEGORIES).forEach(cat => { result[cat] = []; });

  allAnalyses.forEach(sheet => {
    Object.entries(sheet.categorizedCols).forEach(([cat, cols]) => {
      cols.forEach(col => {
        if (!result[cat].find(c => c.col === col.name && c.sheet === sheet.sheetName)) {
          result[cat].push({ col: col.name, sheet: sheet.sheetName });
        }
      });
    });
  });
  return result;
}

function generateReport(sheetNames, allAnalyses, allCats) {
  const now = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });

  let md = `# Análisis del Excel: CaLCULO DE SUEROS OK.xlsx\n\n`;
  md += `**Fecha de análisis:** ${now}\n\n---\n\n`;

  // 1. Hojas
  md += `## 1. Hojas Encontradas\n\nTotal: **${sheetNames.length} hojas**\n\n`;
  md += `| # | Nombre de hoja | Filas de datos | Columnas detectadas |\n`;
  md += `|---|----------------|---------------|---------------------|\n`;
  allAnalyses.forEach((s, i) => {
    md += `| ${i + 1} | ${s.sheetName} | ${s.rows} | ${s.columns.filter(Boolean).length} |\n`;
  });
  md += `\n`;

  // 2. Columnas por hoja
  md += `## 2. Columnas Encontradas por Hoja\n\n`;
  allAnalyses.forEach(s => {
    md += `### Hoja: "${s.sheetName}"\n\n`;
    const nonEmpty = s.columns.filter(Boolean);
    if (nonEmpty.length === 0) {
      md += `_Sin columnas detectadas (hoja vacía o sin encabezados en fila 1)._\n\n`;
    } else {
      nonEmpty.forEach(col => {
        const relevant = Object.values(s.categorizedCols).some(arr => arr.find(c => c.name === col));
        md += `- **${col}**${relevant ? ' ✓' : ''}\n`;
      });
      md += `\n_✓ = columna con palabra clave relevante_\n`;
    }
    md += `\n`;
  });

  // 3. Datos útiles
  md += `## 3. Datos Útiles Identificados\n\n`;

  const catLabels = {
    products:          'Productos / Nombres',
    serumTypes:        'Tipos de Suero',
    prices:            'Precios de Venta',
    costs:             'Costos',
    quantities:        'Cantidades / Volúmenes',
    units:             'Unidades de Medida',
    symptoms:          'Síntomas',
    indications:       'Indicaciones / Usos',
    calculationParams: 'Parámetros de Cálculo',
    margins:           'Márgenes / Utilidades',
    inputs:            'Insumos / Componentes',
    observations:      'Observaciones / Notas',
  };

  Object.entries(catLabels).forEach(([cat, label]) => {
    md += `### ${label}\n`;
    if (allCats[cat] && allCats[cat].length > 0) {
      allCats[cat].forEach(c => md += `- \`${c.col}\` — hoja: **${c.sheet}**\n`);
    } else {
      md += `- _No detectado automáticamente — revisar manualmente._\n`;
    }
    md += `\n`;
  });

  // 4. Posibles tablas Supabase
  md += `## 4. Posibles Tablas para Supabase\n\n`;

  md += `### \`products\`\n\`\`\`sql\nCREATE TABLE products (\n  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  sku         TEXT UNIQUE,\n  name        TEXT NOT NULL,\n  description TEXT,\n  category    TEXT,\n  unit        TEXT,\n  created_at  TIMESTAMPTZ DEFAULT NOW()\n);\n\`\`\`\n\n`;

  md += `### \`serum_types\`\n\`\`\`sql\nCREATE TABLE serum_types (\n  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  name        TEXT NOT NULL,\n  description TEXT,\n  created_at  TIMESTAMPTZ DEFAULT NOW()\n);\n\`\`\`\n\n`;

  md += `### \`serum_components\`\n\`\`\`sql\nCREATE TABLE serum_components (\n  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  serum_type_id UUID REFERENCES serum_types(id) ON DELETE CASCADE,\n  product_id    UUID REFERENCES products(id),\n  quantity      NUMERIC,\n  unit          TEXT,\n  notes         TEXT\n);\n\`\`\`\n\n`;

  md += `### \`pricing\`\n\`\`\`sql\nCREATE TABLE pricing (\n  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  serum_type_id  UUID REFERENCES serum_types(id) ON DELETE CASCADE,\n  cost           NUMERIC,\n  sale_price     NUMERIC,\n  margin_percent NUMERIC GENERATED ALWAYS AS\n                   (ROUND(((sale_price - cost) / NULLIF(sale_price,0)) * 100, 2)) STORED,\n  valid_from     DATE DEFAULT CURRENT_DATE,\n  created_at     TIMESTAMPTZ DEFAULT NOW()\n);\n\`\`\`\n\n`;

  md += `### \`symptoms_catalog\`\n\`\`\`sql\nCREATE TABLE symptoms_catalog (\n  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  name       TEXT NOT NULL UNIQUE,\n  category   TEXT,\n  created_at TIMESTAMPTZ DEFAULT NOW()\n);\n\`\`\`\n\n`;

  md += `### \`serum_symptoms\` (relación N:M)\n\`\`\`sql\nCREATE TABLE serum_symptoms (\n  serum_type_id UUID REFERENCES serum_types(id) ON DELETE CASCADE,\n  symptom_id    UUID REFERENCES symptoms_catalog(id) ON DELETE CASCADE,\n  PRIMARY KEY (serum_type_id, symptom_id)\n);\n\`\`\`\n\n`;

  // 5. Campos que faltan
  md += `## 5. Campos que Faltan\n\n`;
  md += `| Campo necesario | ¿En el Excel? | Acción |\n`;
  md += `|----------------|--------------|--------|\n`;
  md += `| Síntomas del paciente | ${allCats.symptoms.length > 0 ? 'Posiblemente ✓' : 'No detectado ✗'} | Crear \`symptoms_catalog\` |\n`;
  md += `| Relación síntoma → suero | Probablemente no ✗ | Definir con criterio clínico |\n`;
  md += `| Contraindicaciones | Probablemente no ✗ | Agregar columna al catálogo |\n`;
  md += `| Indicaciones clínicas | ${allCats.indications.length > 0 ? 'Posiblemente ✓' : 'No detectado ✗'} | Verificar y estructurar |\n`;
  md += `| Composición detallada | ${allCats.inputs.length > 0 ? 'Posiblemente ✓' : 'No detectado ✗'} | Mapear a \`serum_components\` |\n`;
  md += `| Dosis recomendada | ${allCats.quantities.length > 0 ? 'Posiblemente ✓' : 'No detectado ✗'} | Verificar unidades |\n`;
  md += `| SKU / código de producto | No detectado ✗ | Agregar identificador único |\n`;
  md += `| Proveedor / marca | No detectado ✗ | Agregar para gestión de compras |\n`;
  md += `| Tiempo de administración | No detectado ✗ | Necesario para el protocolo |\n`;
  md += `| Vía de administración | No detectado ✗ | IV, IM, SC, etc. |\n\n`;

  // 6. Recomendaciones limpieza
  md += `## 6. Recomendaciones para Limpiar el Excel\n\n`;
  md += `1. **Encabezados en fila 1**: Asegurar que la primera fila de cada hoja tenga los nombres de columna. Sin filas decorativas arriba.\n`;
  md += `2. **Eliminar celdas combinadas (merge)**: Las celdas unidas corrompen la lectura tabular. Convertirlas a valores repetidos.\n`;
  md += `3. **Eliminar filas/columnas vacías** entre datos.\n`;
  md += `4. **Convertir fórmulas a valores** en columnas de precio y costo antes de exportar.\n`;
  md += `5. **Unificar unidades**: \`ml\`, \`ML\`, \`Ml\` → usar siempre \`ml\`. Ídem para mg, cc.\n`;
  md += `6. **Precios como números puros**: Sin \`$\`, \`S/.\`, puntos de miles. Solo el número.\n`;
  md += `7. **Una tabla por hoja**: Cada hoja = una sola estructura de tabla.\n`;
  md += `8. **Nombres de hoja sin espacios ni caracteres especiales**: Facilita la automatización.\n`;
  md += `9. **Agregar columna ID** en cada hoja como número correlativo único.\n\n`;

  // 7. Propuesta importación
  md += `## 7. Propuesta de Importación a Supabase\n\n`;
  md += `### Flujo de importación\n\n`;
  md += `1. Limpiar el Excel (punto 6)\n`;
  md += `2. Ejecutar \`node scripts/analyze-excel.mjs\` para regenerar los CSVs limpios\n`;
  md += `3. Crear las tablas en Supabase (SQL del punto 4)\n`;
  md += `4. Importar CSVs desde el panel de Supabase (Table Editor → Import CSV) o con un script seed\n`;
  md += `5. Verificar integridad de las foreign keys\n`;
  md += `6. Completar los datos faltantes (síntomas, indicaciones) manualmente\n\n`;
  md += `### Orden de importación\n`;
  md += `\`products\` → \`serum_types\` → \`symptoms_catalog\` → \`pricing\` → \`serum_components\` → \`serum_symptoms\`\n\n`;

  // 8. Qué datos parecen productos
  md += `## 8. Qué Datos Parecen Productos\n\n`;
  if (allCats.products.length > 0) {
    allCats.products.forEach(c => md += `- Columna \`${c.col}\` en hoja **${c.sheet}**\n`);
  } else {
    md += `- No detectados automáticamente.\n`;
    md += `- Revisar columnas con nombres de sueros, vitaminas, minerales o insumos.\n`;
    md += `- Nota: si cada **hoja** representa un suero, el nombre de la hoja es el producto principal.\n`;
  }
  md += `\n`;

  // 9. Tipos de suero
  md += `## 9. Qué Datos Parecen Tipos de Suero\n\n`;
  if (allCats.serumTypes.length > 0) {
    allCats.serumTypes.forEach(c => md += `- Columna \`${c.col}\` en hoja **${c.sheet}**\n`);
  } else {
    md += `- No detectados automáticamente.\n`;
    md += `- **Hipótesis**: cada hoja del Excel podría representar un tipo de suero distinto.\n`;
    md += `  Los nombres de hojas encontrados serían los tipos:\n`;
    sheetNames.forEach(n => md += `  - \`${n}\`\n`);
  }
  md += `\n`;

  // 10. Parámetros de cálculo
  md += `## 10. Qué Datos Parecen Parámetros de Cálculo\n\n`;
  if (allCats.calculationParams.length > 0) {
    allCats.calculationParams.forEach(c => md += `- Columna \`${c.col}\` en hoja **${c.sheet}**\n`);
  } else {
    md += `- No detectados automáticamente.\n`;
    md += `- Los parámetros (dosis/kg, volumen base, concentración) pueden estar como fórmulas Excel.\n`;
    md += `- Revisar manualmente las celdas con fórmulas para extraer la lógica de cálculo.\n`;
  }
  md += `\n`;

  // 11. Datos para precios
  md += `## 11. Qué Datos Sirven para Precios\n\n`;
  const priceRelated = [...allCats.prices, ...allCats.costs, ...allCats.margins];
  if (priceRelated.length > 0) {
    priceRelated.forEach(c => md += `- Columna \`${c.col}\` en hoja **${c.sheet}**\n`);
  } else {
    md += `- No detectados automáticamente.\n`;
    md += `- Buscar columnas numéricas que representen precio de venta, costo de compra o margen.\n`;
  }
  md += `\n`;

  // 12. Datos que faltan para recomendación
  md += `## 12. Qué Datos Faltan para Recomendar Ampollas según Síntomas\n\n`;
  md += `Para un motor de recomendación funcional se necesita:\n\n`;
  md += `| Dato | Estado | Fuente sugerida |\n`;
  md += `|------|--------|-----------------|\n`;
  md += `| Catálogo de síntomas | ✗ Falta | Crear manualmente con criterio clínico |\n`;
  md += `| Mapa síntoma → suero recomendado | ✗ Falta | Definir con el equipo médico |\n`;
  md += `| Composición de cada suero | ${allCats.inputs.length > 0 ? '~ Parcial' : '✗ Falta'} | Completar desde el Excel |\n`;
  md += `| Contraindicaciones | ✗ Falta | Agregar manualmente |\n`;
  md += `| Precios actualizados | ${priceRelated.length > 0 ? '~ Parcial' : '✗ Falta'} | Extraer del Excel y mantener |\n`;
  md += `| Tiempo y vía de administración | ✗ Falta | Protocolo clínico |\n\n`;

  md += `### Conclusión\n\n`;
  md += `El Excel contiene principalmente **datos de costos y cálculo de precios** de sueros/ampollas.\n`;
  md += `Para el sistema de recomendación será necesario:\n\n`;
  md += `1. Construir el catálogo de síntomas desde cero (con criterio clínico).\n`;
  md += `2. Definir la relación síntoma ↔ suero recomendado.\n`;
  md += `3. Completar la composición detallada de cada suero.\n`;
  md += `4. Agregar contraindicaciones y restricciones.\n\n`;
  md += `---\n\n_Reporte generado automáticamente por \`scripts/analyze-excel.mjs\`_\n`;

  return md;
}

async function main() {
  console.log('='.repeat(70));
  console.log('  ANÁLISIS DEL EXCEL: CaLCULO DE SUEROS OK.xlsx');
  console.log('='.repeat(70));

  if (!existsSync(EXCEL_PATH)) {
    console.error(`\nERROR: No se encontró el archivo:\n  ${EXCEL_PATH}`);
    console.error('Verifica que el archivo exista en la carpeta data/');
    process.exit(1);
  }

  console.log(`\nArchivo: ${EXCEL_PATH}`);

  const workbook = XLSX.readFile(EXCEL_PATH);
  const sheetNames = workbook.SheetNames;

  console.log(`\nHojas encontradas (${sheetNames.length}):`);
  sheetNames.forEach((name, i) => console.log(`  ${i + 1}. ${name}`));

  mkdirSync(PROCESSED_DIR, { recursive: true });
  mkdirSync(DOCS_DIR, { recursive: true });

  const allAnalyses = [];

  for (const sheetName of sheetNames) {
    console.log('\n' + '─'.repeat(70));
    console.log(`  HOJA: "${sheetName}"`);
    console.log('─'.repeat(70));

    const worksheet = workbook.Sheets[sheetName];
    const analysis = analyzeSheet(sheetName, worksheet);
    allAnalyses.push(analysis);

    console.log(`Filas de datos : ${analysis.rows}`);
    console.log(`Columnas (${analysis.columns.filter(Boolean).length}): ${analysis.columns.filter(Boolean).join(' | ')}`);

    const relevantAll = Object.values(analysis.categorizedCols).flat().map(c => c.name);
    const unique = [...new Set(relevantAll)].filter(Boolean);
    if (unique.length > 0) {
      console.log(`Relevantes     : ${unique.join(', ')}`);
    }

    if (analysis.firstRows.length > 0) {
      console.log('\nPrimeras filas:');
      printFirstRows(analysis.firstRows);
    }

    const csv = XLSX.utils.sheet_to_csv(worksheet);
    const safeName = sheetName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const csvPath = join(PROCESSED_DIR, `${safeName}.csv`);
    writeFileSync(csvPath, csv, 'utf8');
    console.log(`\nCSV guardado: data/processed/${safeName}.csv`);
  }

  const allCats = collectAllCategorized(allAnalyses);
  const report = generateReport(sheetNames, allAnalyses, allCats);
  const reportPath = join(DOCS_DIR, 'analisis-excel.md');
  writeFileSync(reportPath, report, 'utf8');

  console.log('\n' + '='.repeat(70));
  console.log('  RESULTADO FINAL');
  console.log('='.repeat(70));
  console.log(`Hojas analizadas : ${sheetNames.length}`);
  console.log(`CSVs generados   : data/processed/  (${sheetNames.length} archivos)`);
  console.log(`Reporte creado   : docs/analisis-excel.md`);
  console.log('='.repeat(70));
}

main().catch(err => {
  console.error('\nERROR FATAL:', err.message);
  process.exit(1);
});
