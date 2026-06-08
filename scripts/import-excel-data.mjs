/**
 * import-excel-data.mjs
 *
 * Lee los CSV de data/processed/, limpia los datos y los prepara
 * para importar a Supabase.
 *
 * Si existen NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
 * en el entorno, realiza la importación real. De lo contrario
 * ejecuta un dry-run y muestra lo que se importaría.
 *
 * Uso:
 *   node scripts/import-excel-data.mjs            → dry-run
 *   node scripts/import-excel-data.mjs --import   → importación real
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const ROOT       = join(__dirname, '..');

const PROCESSED_DIR = join(ROOT, 'data', 'processed');
const DOCS_DIR      = join(ROOT, 'docs');

const DO_IMPORT = process.argv.includes('--import');

// ──────────────────────────────────────────────────────────
// UTILIDADES DE LIMPIEZA
// ──────────────────────────────────────────────────────────

/** Elimina $, espacios, comas de miles; devuelve número o null */
function parsePrice(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  const cleaned = String(raw).replace(/[$\s,]/g, '').replace('%', '').trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

/** Convierte "40%" → 40  o  0.4 → 40 */
function parseMargin(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  const cleaned = String(raw).replace('%', '').trim();
  const n = parseFloat(cleaned);
  if (isNaN(n)) return null;
  return n > 1 ? n : n * 100; // si ya viene como 0.4 → 40
}

/** Normaliza texto: trim, colapsa espacios internos */
function cleanText(raw) {
  if (raw === null || raw === undefined) return '';
  return String(raw).trim().replace(/\s+/g, ' ');
}

/** Normaliza nombre de síntoma para deduplicar */
function normalizeSymptomsKey(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Parsea un CSV simple (sin usar librería) respetando comillas dobles.
 * Devuelve array de arrays de strings.
 */
function parseCSVToRows(content) {
  const lines = [];
  let current = [];
  let inQuote = false;
  let cell = '';

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    const next = content[i + 1];

    if (inQuote) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuote = false;
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') {
        inQuote = true;
      } else if (ch === ',') {
        current.push(cell);
        cell = '';
      } else if (ch === '\r' && next === '\n') {
        current.push(cell);
        cell = '';
        lines.push(current);
        current = [];
        i++;
      } else if (ch === '\n') {
        current.push(cell);
        cell = '';
        lines.push(current);
        current = [];
      } else {
        cell += ch;
      }
    }
  }
  if (cell || current.length > 0) {
    current.push(cell);
    lines.push(current);
  }
  return lines;
}

/** True si una fila está completamente vacía */
function isEmptyRow(row) {
  return row.every(cell => cleanText(cell) === '');
}

/**
 * Detecta automáticamente la fila de encabezados reales.
 * Busca la primera fila que contenga ALGUNA de las palabras clave dadas.
 */
function detectHeaderRow(rows, keywords) {
  for (let i = 0; i < rows.length; i++) {
    const joined = rows[i].join(' ').toLowerCase();
    if (keywords.some(kw => joined.includes(kw))) {
      return i;
    }
  }
  return 0;
}

/** Convierte las filas en objetos usando la fila de encabezado */
function rowsToObjects(rows, headerIdx) {
  const headers = rows[headerIdx].map(h => cleanText(h).toUpperCase());
  const result  = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    if (isEmptyRow(rows[i])) continue;
    const obj = {};
    headers.forEach((h, j) => {
      obj[h] = cleanText(rows[i][j] ?? '');
    });
    result.push(obj);
  }
  return result;
}

// ──────────────────────────────────────────────────────────
// PARSERS ESPECÍFICOS POR HOJA
// ──────────────────────────────────────────────────────────

function parseAmpollas() {
  const path = join(PROCESSED_DIR, 'AMPOLLAS.csv');
  if (!existsSync(path)) { console.warn('  WARN: AMPOLLAS.csv no encontrado'); return []; }

  const content = readFileSync(path, 'utf8');
  const rows    = parseCSVToRows(content);

  // Encabezados reales en fila que contenga "proveedor" o "compuesto"
  const headerIdx = detectHeaderRow(rows, ['proveedor', 'compuesto', 'padecimientos']);
  const objects   = rowsToObjects(rows, headerIdx);

  return objects
    .filter(o => cleanText(o['COMPUESTO'] || o['COMPUESTOS']) !== '')
    .map(o => {
      const name      = cleanText(o['COMPUESTO'] || o['COMPUESTOS'] || '');
      const pvm       = parsePrice(o['PVM']);
      const pvp       = parsePrice(o['PVP']);
      const margin    = parseMargin(o['%']);
      const ml        = parsePrice(o['ML']);
      const conds     = cleanText(o['PADECIMIENTOS'] || '');

      return {
        product_type:       'ampolla',
        provider:           cleanText(o['PROVEEDOR'] || '').toLowerCase(),
        brand:              cleanText(o['MARCA'] || ''),
        name,
        compound:           name,
        category_hint:      cleanText(o['TIPO'] || ''),
        conditions_text:    conds,
        ml,
        pvm:                pvm ?? 0,
        margin_percentage:  margin ?? 40,
        pvp:                pvp ?? 0,
        quantity:           1,
        total:              0,
        active:             true,
        _raw_padecimientos: conds,
      };
    });
}

function parseDescripcion() {
  const path = join(PROCESSED_DIR, 'DESCRIPCION.csv');
  if (!existsSync(path)) { console.warn('  WARN: DESCRIPCION.csv no encontrado'); return []; }

  const content = readFileSync(path, 'utf8');
  const rows    = parseCSVToRows(content);
  const headerIdx = detectHeaderRow(rows, ['proveedor', 'compuesto', 'padecimientos', 'tipo']);
  const objects   = rowsToObjects(rows, headerIdx);

  return objects
    .filter(o => cleanText(o['COMPUESTOS'] || o['COMPUESTO'] || '') !== '')
    .map(o => {
      const name   = cleanText(o['COMPUESTOS'] || o['COMPUESTO'] || '');
      const pvp    = parsePrice(o['PVP']);
      const ml     = parsePrice(o['ML']);
      const conds  = cleanText(o['PADECIMIENTOS'] || '');

      return {
        product_type:       'ampolla',
        provider:           cleanText(o['PROVEEDOR'] || '').toLowerCase(),
        brand:              cleanText(o['MARCA'] || ''),
        name,
        compound:           name,
        category_hint:      cleanText(o['TIPO'] || ''),
        conditions_text:    conds,
        ml,
        pvm:                0,
        margin_percentage:  40,
        pvp:                pvp ?? 0,
        quantity:           1,
        total:              0,
        active:             true,
        _raw_padecimientos: conds,
        _source:            'DESCRIPCION',
      };
    });
}

function parseAccesorios() {
  const path = join(PROCESSED_DIR, 'ACCESORIOS.csv');
  if (!existsSync(path)) { console.warn('  WARN: ACCESORIOS.csv no encontrado'); return []; }

  const content = readFileSync(path, 'utf8');
  const rows    = parseCSVToRows(content);
  const headerIdx = detectHeaderRow(rows, ['descripcion', 'medida', 'pvm', 'pvp']);
  const objects   = rowsToObjects(rows, headerIdx);

  return objects
    .filter(o => cleanText(o['DESCRIPCION'] || '') !== '')
    .map(o => {
      const desc   = cleanText(o['DESCRIPCION'] || '');
      const medida = cleanText(o['MEDIDA']      || '');
      const pvm    = parsePrice(o['PVM']);
      const pvp    = parsePrice(o['PVP']);
      const margin = parseMargin(o['%']);
      const name   = medida ? `${desc} ${medida}ml` : desc;

      return {
        product_type:      'accesorio',
        provider:          '',
        brand:             '',
        name,
        compound:          '',
        category_hint:     'ACCESORIO',
        conditions_text:   '',
        ml:                parsePrice(medida),
        measure:           medida ? `${medida}ml` : '',
        pvm:               pvm ?? 0,
        margin_percentage: margin ?? 40,
        pvp:               pvp ?? 0,
        quantity:          1,
        total:             0,
        active:            true,
        _raw_padecimientos: '',
      };
    });
}

// ──────────────────────────────────────────────────────────
// EXTRACCIÓN DE SÍNTOMAS
// ──────────────────────────────────────────────────────────

function extractSymptoms(products) {
  const symptomMap = new Map(); // key normalizado → nombre original limpio

  products.forEach(p => {
    if (!p._raw_padecimientos) return;
    // Dividir por coma, punto y coma, o salto de línea
    const parts = p._raw_padecimientos
      .split(/[,;\n]/)
      .map(s => s.trim())
      .filter(s => s.length > 2 && s.length < 200);

    parts.forEach(s => {
      const key = normalizeSymptomsKey(s);
      if (!symptomMap.has(key)) {
        // Capitalizar primera letra
        const display = s.charAt(0).toUpperCase() + s.slice(1);
        symptomMap.set(key, display);
      }
    });
  });

  return Array.from(symptomMap.entries()).map(([key, name]) => ({ key, name }));
}

// ──────────────────────────────────────────────────────────
// DEDUPLICACIÓN DE PRODUCTOS
// ──────────────────────────────────────────────────────────

function deduplicateProducts(ampollas, descripcion) {
  const merged = new Map();

  // Primero AMPOLLAS (tiene PVM que DESCRIPCION no tiene)
  ampollas.forEach(p => {
    const key = normalizeSymptomsKey(p.name);
    merged.set(key, { ...p, _source: 'AMPOLLAS' });
  });

  // Luego DESCRIPCION — sobreescribe o enriquece si el PVP de DESCRIPCION
  // es distinto (precios de venta al público más recientes)
  descripcion.forEach(p => {
    const key = normalizeSymptomsKey(p.name);
    if (merged.has(key)) {
      const existing = merged.get(key);
      merged.set(key, {
        ...existing,
        pvp:    p.pvp    || existing.pvp,
        brand:  p.brand  || existing.brand,
        _source: 'AMPOLLAS+DESCRIPCION',
      });
    } else {
      merged.set(key, { ...p, _source: 'DESCRIPCION' });
    }
  });

  return Array.from(merged.values());
}

// ──────────────────────────────────────────────────────────
// IMPORTACIÓN REAL A SUPABASE
// ──────────────────────────────────────────────────────────

async function importToSupabase(allProducts, symptoms) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error('\nERROR: Faltan variables de entorno.');
    console.error('  NEXT_PUBLIC_SUPABASE_URL  →', supabaseUrl ? 'OK' : 'FALTA');
    console.error('  SUPABASE_SERVICE_ROLE_KEY →', serviceKey  ? 'OK' : 'FALTA');
    console.error('\nCrea el archivo .env.local con esas variables y ejecuta:');
    console.error('  node -r dotenv/config scripts/import-excel-data.mjs --import');
    return false;
  }

  // Importar Supabase client dinámicamente
  let createClient;
  try {
    ({ createClient } = require('@supabase/supabase-js'));
  } catch {
    console.error('ERROR: @supabase/supabase-js no instalado. Ejecuta: npm install @supabase/supabase-js');
    return false;
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // ── 1. Leer categorías existentes ──────────────────────────
  console.log('\n[1/5] Leyendo categorías desde Supabase...');
  const { data: cats, error: catsErr } = await supabase.from('categories').select('id, name');
  if (catsErr) { console.error('  ERROR:', catsErr.message); return false; }
  const categoryMap = new Map(cats.map(c => [c.name.toUpperCase(), c.id]));
  console.log(`  ${cats.length} categorías encontradas.`);

  // ── 2. Importar síntomas ───────────────────────────────────
  console.log('\n[2/5] Importando síntomas...');
  let importedSymptoms = 0, skippedSymptoms = 0;
  const symptomIdMap = new Map(); // key normalizado → id UUID

  for (const sym of symptoms) {
    const { data, error } = await supabase
      .from('symptoms')
      .upsert({ name: sym.name, active: true }, { onConflict: 'name', ignoreDuplicates: false })
      .select('id, name')
      .single();

    if (error) {
      console.warn(`  WARN síntoma "${sym.name}": ${error.message}`);
      skippedSymptoms++;
    } else {
      symptomIdMap.set(sym.key, data.id);
      importedSymptoms++;
    }
  }
  console.log(`  Síntomas importados: ${importedSymptoms} | omitidos: ${skippedSymptoms}`);

  // ── 3. Importar productos ──────────────────────────────────
  console.log('\n[3/5] Importando productos...');
  let importedProducts = 0, skippedProducts = 0;
  const productIdMap = new Map(); // nombre normalizado → id UUID

  for (const p of allProducts) {
    const catKey = (p.category_hint || '').toUpperCase();
    const catId  = categoryMap.get(catKey) ?? null;

    const record = {
      product_type:      p.product_type,
      provider:          p.provider      || null,
      brand:             p.brand         || null,
      name:              p.name,
      compound:          p.compound      || null,
      category_id:       catId,
      conditions_text:   p.conditions_text || null,
      ml:                p.ml            ?? null,
      measure:           p.measure       || null,
      pvm:               p.pvm           ?? 0,
      margin_percentage: p.margin_percentage ?? 40,
      pvp:               p.pvp           ?? 0,
      quantity:          1,
      total:             0,
      active:            true,
    };

    const { data, error } = await supabase
      .from('products')
      .upsert(record, { onConflict: 'name,product_type', ignoreDuplicates: false })
      .select('id, name')
      .single();

    if (error) {
      console.warn(`  WARN producto "${p.name}": ${error.message}`);
      skippedProducts++;
    } else {
      const key = normalizeSymptomsKey(p.name);
      productIdMap.set(key, data.id);
      importedProducts++;
    }
  }
  console.log(`  Productos importados: ${importedProducts} | omitidos: ${skippedProducts}`);

  // ── 4. Crear relaciones product_symptoms ───────────────────
  console.log('\n[4/5] Creando relaciones producto ↔ síntoma...');
  let importedRels = 0, skippedRels = 0;

  for (const p of allProducts) {
    if (!p._raw_padecimientos) continue;
    const productKey = normalizeSymptomsKey(p.name);
    const productId  = productIdMap.get(productKey);
    if (!productId) continue;

    const parts = p._raw_padecimientos
      .split(/[,;\n]/)
      .map(s => s.trim())
      .filter(s => s.length > 2 && s.length < 200);

    for (const part of parts) {
      const symKey   = normalizeSymptomsKey(part);
      const symptomId = symptomIdMap.get(symKey);
      if (!symptomId) continue;

      const { error } = await supabase
        .from('product_symptoms')
        .upsert(
          { product_id: productId, symptom_id: symptomId, recommendation_level: 'medio', active: true },
          { onConflict: 'product_id,symptom_id', ignoreDuplicates: true }
        );

      if (error) { skippedRels++; }
      else        { importedRels++; }
    }
  }
  console.log(`  Relaciones creadas: ${importedRels} | omitidas: ${skippedRels}`);

  // ── 5. Resumen ─────────────────────────────────────────────
  console.log('\n[5/5] Importación completada.');
  return true;
}

// ──────────────────────────────────────────────────────────
// GENERACIÓN DE REPORTE
// ──────────────────────────────────────────────────────────

function generateImportReport(ampollas, accesorios, allProducts, symptoms) {
  const now = new Date().toLocaleDateString('es-ES', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  let md = `# Reporte de Importación de Datos\n\n`;
  md += `**Generado:** ${now}\n\n---\n\n`;

  md += `## Resumen\n\n`;
  md += `| Conjunto | Registros |\n|----------|----------|\n`;
  md += `| Ampollas (AMPOLLAS + DESCRIPCION) | ${allProducts.filter(p => p.product_type === 'ampolla').length} |\n`;
  md += `| Accesorios | ${accesorios.length} |\n`;
  md += `| Total productos | ${allProducts.length} |\n`;
  md += `| Síntomas únicos extraídos | ${symptoms.length} |\n\n`;

  md += `## Productos por categoría\n\n`;
  const byCat = {};
  allProducts.forEach(p => {
    const k = p.category_hint || 'SIN CATEGORÍA';
    byCat[k] = (byCat[k] || 0) + 1;
  });
  Object.entries(byCat).sort((a, b) => b[1] - a[1]).forEach(([cat, cnt]) => {
    md += `- **${cat}**: ${cnt} productos\n`;
  });

  md += `\n## Primeros 20 síntomas extraídos\n\n`;
  symptoms.slice(0, 20).forEach(s => md += `- ${s.name}\n`);
  if (symptoms.length > 20) md += `- _(y ${symptoms.length - 20} más)_\n`;

  md += `\n## Datos que requieren revisión manual\n\n`;
  const needsReview = allProducts.filter(p => p.pvp === 0 || p.pvp === null);
  md += `- **${needsReview.length} productos sin PVP** — revisar precios en el Excel.\n`;
  const noCondition = allProducts.filter(p => !p._raw_padecimientos || p._raw_padecimientos === '');
  md += `- **${noCondition.length} productos sin padecimientos** — no generarán relaciones con síntomas.\n\n`;

  if (needsReview.length > 0) {
    md += `### Productos sin PVP\n\n`;
    needsReview.slice(0, 15).forEach(p => md += `- ${p.name}\n`);
    if (needsReview.length > 15) md += `- _(y ${needsReview.length - 15} más)_\n`;
    md += `\n`;
  }

  md += `---\n_Reporte generado por \`scripts/import-excel-data.mjs\`_\n`;
  return md;
}

// ──────────────────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────────────────

async function main() {
  console.log('='.repeat(70));
  console.log('  IMPORTACIÓN DE DATOS EXCEL → SUPABASE');
  console.log(DO_IMPORT ? '  MODO: IMPORTACIÓN REAL' : '  MODO: DRY-RUN (sin --import)');
  console.log('='.repeat(70));

  // ── Parsear hojas ──────────────────────────────────────────
  console.log('\n[1/4] Leyendo y limpiando CSV...');
  const ampollas    = parseAmpollas();
  const descripcion = parseDescripcion();
  const accesorios  = parseAccesorios();

  console.log(`  AMPOLLAS.csv    → ${ampollas.length} filas válidas`);
  console.log(`  DESCRIPCION.csv → ${descripcion.length} filas válidas`);
  console.log(`  ACCESORIOS.csv  → ${accesorios.length} filas válidas`);

  // ── Deduplicar ampollas ────────────────────────────────────
  console.log('\n[2/4] Deduplicando ampollas...');
  const ampollasDedup = deduplicateProducts(ampollas, descripcion);
  console.log(`  Ampollas únicas: ${ampollasDedup.length} (de ${ampollas.length + descripcion.length} filas totales)`);

  const allProducts = [...ampollasDedup, ...accesorios];
  console.log(`  Total productos preparados: ${allProducts.length}`);

  // ── Extraer síntomas ───────────────────────────────────────
  console.log('\n[3/4] Extrayendo síntomas de PADECIMIENTOS...');
  const symptoms = extractSymptoms(allProducts);
  console.log(`  Síntomas únicos encontrados: ${symptoms.length}`);

  // ── Mostrar muestra ────────────────────────────────────────
  console.log('\n── Muestra de productos (primeros 5) ──');
  allProducts.slice(0, 5).forEach((p, i) => {
    console.log(`  [${i + 1}] ${p.product_type.padEnd(10)} | PVP: $${String(p.pvp).padStart(6)} | ${p.name.substring(0, 50)}`);
  });

  console.log('\n── Muestra de síntomas (primeros 10) ──');
  symptoms.slice(0, 10).forEach((s, i) => {
    console.log(`  [${i + 1}] ${s.name}`);
  });

  // ── Generar reporte ────────────────────────────────────────
  console.log('\n[4/4] Generando reporte...');
  mkdirSync(DOCS_DIR, { recursive: true });
  const report = generateImportReport(ampollas, accesorios, allProducts, symptoms);
  const reportPath = join(DOCS_DIR, 'reporte-importacion.md');
  writeFileSync(reportPath, report, 'utf8');
  console.log(`  Reporte guardado: docs/reporte-importacion.md`);

  // ── Importación real o dry-run ─────────────────────────────
  if (DO_IMPORT) {
    console.log('\n' + '='.repeat(70));
    console.log('  INICIANDO IMPORTACIÓN A SUPABASE');
    console.log('='.repeat(70));
    const ok = await importToSupabase(allProducts, symptoms);
    if (!ok) process.exit(1);
  } else {
    console.log('\n' + '─'.repeat(70));
    console.log('  DRY-RUN completado. No se importó nada a Supabase.');
    console.log('  Para importar de verdad:');
    console.log('    1. Crea .env.local con NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY');
    console.log('    2. Ejecuta: node scripts/import-excel-data.mjs --import');
    console.log('─'.repeat(70));
  }

  console.log('\n' + '='.repeat(70));
  console.log('  FINALIZADO');
  console.log('='.repeat(70));
}

main().catch(err => {
  console.error('\nERROR FATAL:', err.message);
  console.error(err.stack);
  process.exit(1);
});
