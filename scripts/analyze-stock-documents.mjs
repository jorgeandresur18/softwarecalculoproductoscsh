/**
 * analyze-stock-documents.mjs
 *
 * Lee los PDFs de data/stock/, extrae texto, identifica productos,
 * los compara con la tabla products en Supabase y genera docs/analisis-stock.md.
 *
 * Uso:  node scripts/analyze-stock-documents.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const ROOT       = join(__dirname, '..');
const DOCS_DIR   = join(ROOT, 'docs');
const STOCK_DIR  = join(ROOT, 'data', 'stock');

// ── Documentos a procesar ─────────────────────────────────────────────────────

const DOCS = [
  {
    file:  'AA AMPOLLAS IV STOCK ESENCIAL.pdf',
    type:  'ampolla_iv',
    label: 'Ampollas IV Ortomoleculares (Stock Esencial)',
  },
  {
    file:  'STOCK AMPOLLAS QUIMICAS.pdf',
    type:  'ampolla_quimica',
    label: 'Ampollas Químicas',
  },
  {
    file:  'AA esencial GOTEROS HOMEOPATICOS stock.docx.pdf',
    type:  'gotero_homeop',
    label: 'Goteros Homeopáticos (Stock Esencial)',
  },
  {
    file:  'AA ESENCIAL capsulas, frascos y otros.docx.pdf',
    type:  'capsula_frasco',
    label: 'Cápsulas, Frascos y Otros',
  },
  {
    file:  'AA esencial Pharmahom goteros stock.docx.pdf',
    type:  'gotero_pharmahom',
    label: 'Goteros Pharmahom (Stock Esencial)',
  },
  {
    file:  'por enfermedad homeopatia medicamentos.pdf',
    type:  'por_enfermedad',
    label: 'Por Enfermedad — Homeopatía y Medicamentos',
  },
];

// ── Helpers de normalización y texto ─────────────────────────────────────────

function norm(str) {
  return String(str ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanLine(line) {
  return line.replace(/\s{2,}/g, ' ').trim();
}

function looksLikeHeader(line) {
  const l = norm(line);
  const headers = ['producto', 'descripcion', 'nombre', 'item', 'articulo',
    'cantidad', 'presentacion', 'prioridad', 'dosis', 'marca', 'precio',
    'codigo', 'code', 'indicacion'];
  // Una línea es cabecera si tiene 3 o más palabras de esta lista
  const hits = headers.filter(h => l.includes(h));
  return hits.length >= 2;
}

// ── Detectores de campos ──────────────────────────────────────────────────────

const PRIORITY_RE   = /\b(?:prioridad|clase|class|grupo|priority)[\s:\-]*([ABC])\b|\b([ABC])\b(?=\s|$)/i;
const QTY_RE        = /(\d+(?:[.,]\d+)?)\s*(ml|mL|mg|mcg|µg|ug|UI|IU|g\b|gr\b|mEq|amp(?:olla)?s?|frascos?|capsulas?|tabletas?|unidades?)/i;
const PRICE_RE      = /\$\s*(\d+(?:[.,]\d{1,2})?)/;
const PRESENTATION_RE = /\b\d+\s*(?:ml|mg|g|mcg)\b.*?(?:x|\*)\s*\d+|\b\d+\s*x\s*\d+\s*(?:ml|mg|g|mcg)\b/i;
const DOSE_RE       = /\b(?:dosis|posolog[íi]a|administrar?|aplicar?)\b.{0,80}/i;
const INCOMPAT_RE   = /\b(?:incompatible|no\s+mezclar|contraindicad|evitar|precauci[oó]n|advertencia|interacci[oó]n)\b.{0,100}/i;
const INDICATION_RE = /\b(?:indicad[oa]|para\b|uso[s]?:|terapia|tratamiento|beneficio|efecto|funci[oó]n|aplicaci[oó]n)\b.{0,100}/i;

// ── Table-section helpers ─────────────────────────────────────────────────────

// Table header: line containing NOMBRE + MARCA or NOMBRE + PRESENTACIÓN
const TABLE_HEADER_RE         = /\bNOMBRE\b.{0,30}\bMARCA\b|\bNOMBRE\b.{0,30}\bPRESENTACI[OÓ]N\b/i;
// Page separator: "-- 1 of 8 --", "-- 2 de 5 --"
const PAGE_SEP_RE             = /^--\s*\d+\s*(?:de|of)\s*\d+\s*--$/i;
// Clear presentation cell: starts with container word + digit
const CLEARLY_PRESENTATION_RE = /^(?:Frasco|Ampolla|Vial|Gotero|Spray|Cápsula|Tableta|Comprimido)\s+(?:de\s+)?[\d(]/i;
// Clear dosage cell: starts with dosage verb or abbreviation
const CLEARLY_DOSAGE_RE       = /^(?:Diluir|Disolver|Aplicar?|Administrar?|Pasar?\b|Oral:|V[íi]a\b)/i;
// Dosage continuation: starts with quantity+unit or tilde
const DOSAGE_CONT_RE          = /^~\d|^\d+\s*mL\s+(?:en|SS)\b|^\d+\s*(?:veces?|vez|min\b|h\b)\b/i;
// Pure alias in parens: "(ALA)", "(ASPRO)", "(DMSO Plus)"
const ALIAS_RE                = /^\([A-Za-záéíóúñü][A-Za-záéíóúñü\s\-+]*\)$/;
// Partial name + alias: "Lipoico (ALA)", "Sulfonil Metano (MSM)"
const NAME_WITH_ALIAS_RE      = /^[A-Za-záéíóúñü][A-Za-záéíóúñü\s\-+]*\s\([A-Za-záéíóúñü][A-Za-záéíóúñü\s\-+]*\)$/;

// Palabras que sugieren que una línea es un nombre de producto farmacéutico
const PHARMA_WORDS = [
  'vitamina', 'vitamin', 'ampolla', 'soluci[oó]n', 'extract', 'complejo', 'complex',
  'fosfato', 'cloruro', 'sulfato', 'glucosa', '[aá]cido', 'calcio', 'magnesio',
  'potasio', 'sodio', 'zinc', 'hierro', 'cobre', 'selenio', 'glutathione',
  'taurina', 'carnitina', 'coenzima', 'biotina', 'riboflavina', 'niacinamida',
  'piridoxina', 'tiamina', 'cianocobalamina', 'ascorbic', 'colecalciferol',
  'tocoferol', 'menadiona', 'homeopat', 'homotoxicol', 'Bach', 'Pascoe',
  'HEEL', 'Reckeweg', 'Pharmahom', 'LHA', 'Advancell', 'Procaine', 'Procaína',
  'ringer', 'hartmann', 'dextros', 'lactato', 'fisiologica', 'fisiol[oó]gic',
  'dimethyl', 'DMSO', 'H2O2', 'peróxido', 'peroxido', 'ozon', 'suero',
  'gotero', 'frasco', 'ampol', 'sérum', 'serum',
];
const PHARMA_RE = new RegExp(PHARMA_WORDS.join('|'), 'i');

function isProductCandidate(line) {
  const l = line.trim();
  if (l.length < 3 || l.length > 150) return false;

  // All-caps con al menos 4 caracteres alfabéticos seguidos
  if (/^[A-ZÁÉÍÓÚÑÜ0-9\s\-\/\(\)\.,\+%]+$/.test(l) && /[A-ZÁÉÍÓÚÑÜ]{4,}/.test(l)) return true;

  // Contiene término farmacéutico conocido
  if (PHARMA_RE.test(l)) return true;

  return false;
}

function extractPriority(text) {
  const m = text.match(PRIORITY_RE);
  if (!m) return null;
  return (m[1] || m[2] || '').toUpperCase() || null;
}

function extractQuantity(text) {
  const m = text.match(QTY_RE);
  return m ? m[0] : null;
}

function extractPrice(text) {
  const m = text.match(PRICE_RE);
  return m ? parseFloat(m[1].replace(',', '.')) : null;
}

// ── Comparación con productos existentes ──────────────────────────────────────

function compareWithProducts(name, existing) {
  const nA = norm(name);
  if (!nA) return null;

  let best = null;

  for (const prod of existing) {
    const nB = norm(prod.name);
    if (!nB) continue;

    let score = 0;
    let matchType = '';

    if (nA === nB) {
      score = 1; matchType = 'exacta';
    } else if (nB.includes(nA) && nA.length > 5) {
      score = 0.92; matchType = 'contenida';
    } else if (nA.includes(nB) && nB.length > 5) {
      score = 0.88; matchType = 'contiene';
    } else {
      const wordsA = nA.split(/\s+/).filter(w => w.length >= 4);
      const wordsB = nB.split(/\s+/).filter(w => w.length >= 4);
      if (wordsA.length && wordsB.length) {
        const common = wordsA.filter(w => wordsB.includes(w));
        score = common.length / Math.max(wordsA.length, wordsB.length);
        matchType = 'parcial';
      }
    }

    if (score >= 0.5 && (!best || score > best.score)) {
      best = { product: prod, score, matchType };
    }
  }

  return best;
}

// ── Parseo de líneas de un documento ─────────────────────────────────────────

function parseLines(lines) {
  const entries = [];
  let current = null;
  let inTableSection = false;

  function startEntry(name) {
    return {
      name,
      priority:                   extractPriority(name),
      quantity:                   extractQuantity(name),
      price:                      extractPrice(name),
      presentation:               null,
      brand:                      null,
      dosage:                     null,
      synergy:                    null,
      incompatibilities_detected: null,
      indications_detected:       null,
      indications:                [],
      incompatibilities:          [],
      contextLines:               [],
    };
  }

  for (const rawLine of lines) {
    const line = cleanLine(rawLine);
    if (!line) continue;

    // Skip page separators ("-- 1 of 8 --")
    if (PAGE_SEP_RE.test(line)) continue;

    // Detect table column header → enter table mode
    if (TABLE_HEADER_RE.test(line)) {
      inTableSection = true;
      if (current) { entries.push(current); current = null; }
      continue;
    }

    // Skip header-like lines (document titles, column name rows)
    if (looksLikeHeader(line)) continue;

    // ── Table-section: intercept clear non-NOMBRE column cells ───────────────
    if (inTableSection && current) {

      // PRESENTACIÓN cell: "Frasco 20 mL", "Ampolla 10ml", "(50 mg/mL)"
      if (CLEARLY_PRESENTATION_RE.test(line)) {
        current.presentation = current.presentation
          ? current.presentation + ' ' + line
          : line;
        if (!current.quantity) {
          const q = extractQuantity(line);
          if (q) current.quantity = q;
        }
        continue;
      }

      // DOSIFICACIÓN cell: "Diluir…", "Aplicar…", continuation lines
      if (CLEARLY_DOSAGE_RE.test(line) || DOSAGE_CONT_RE.test(line)) {
        current.dosage = current.dosage
          ? current.dosage + ' ' + line
          : line;
        continue;
      }

      // Pure product alias: "(ALA)", "(ASPRO)", "(DMSO Plus)"
      if (ALIAS_RE.test(line.trim())) {
        current.name += ' ' + line;
        continue;
      }

      // Partial name + alias: "Lipoico (ALA)", "Sulfonil Metano (MSM)"
      if (NAME_WITH_ALIAS_RE.test(line.trim())) {
        current.name += ' ' + line;
        continue;
      }

      // SINERGIA / INHIBIDOR cell: comma-separated list with pharma words
      if (PHARMA_RE.test(line) && /,/.test(line)) {
        current.synergy = current.synergy
          ? current.synergy + ' ' + line
          : line;
        continue;
      }
    }

    // ── Candidate detection (noise gate applied at parse time) ───────────────
    const { isNoise } = isLikelyNoise(line);
    const isCandidate = isProductCandidate(line);

    if (isCandidate && !isNoise) {
      if (current) entries.push(current);
      current = startEntry(line);
    } else if (current) {
      current.contextLines.push(line);

      if (!current.priority) {
        const p = extractPriority(line);
        if (p) current.priority = p;
      }
      if (!current.quantity) {
        const q = extractQuantity(line);
        if (q) current.quantity = q;
      }
      if (!current.price) {
        const pr = extractPrice(line);
        if (pr) current.price = pr;
      }
      if (!current.presentation && PRESENTATION_RE.test(line)) {
        current.presentation = line.match(PRESENTATION_RE)?.[0] ?? null;
      }

      if (inTableSection) {
        // Assign metadata by content pattern
        if (INCOMPAT_RE.test(line)) {
          current.incompatibilities_detected = current.incompatibilities_detected
            ? current.incompatibilities_detected + '; ' + line
            : line;
          const m = line.match(INCOMPAT_RE);
          if (m) current.incompatibilities.push(m[0].trim());
        } else if (INDICATION_RE.test(line)) {
          current.indications_detected = current.indications_detected
            ? current.indications_detected + ' ' + line
            : line;
          const m = line.match(INDICATION_RE);
          if (m && !current.indications.includes(m[0].trim())) {
            current.indications.push(m[0].trim());
          }
        } else if (!current.presentation && !current.dosage
                   && !current.synergy && !current.incompatibilities_detected
                   && !PHARMA_RE.test(line)
                   && line.split(/\s+/).length <= 2
                   && /^[A-ZÁÉÍÓÚÑÜ]/.test(line)) {
          // Short capitalized non-pharma text before other metadata → likely brand
          current.brand = current.brand
            ? current.brand + ' ' + line
            : line;
        }
      } else {
        // Non-table: existing context line logic
        const doseM = line.match(DOSE_RE);
        if (doseM) current.indications.push(doseM[0].trim());

        const indicM = line.match(INDICATION_RE);
        if (indicM && !current.indications.includes(indicM[0].trim())) {
          current.indications.push(indicM[0].trim());
        }
        const incompat = line.match(INCOMPAT_RE);
        if (incompat) current.incompatibilities.push(incompat[0].trim());
      }
    }
  }

  if (current) entries.push(current);
  return entries;
}

// ── Carga de productos desde Supabase ────────────────────────────────────────

async function loadExistingProducts() {
  let url = '', key = '';

  try {
    const env = readFileSync(join(ROOT, '.env.local'), 'utf-8');
    for (const line of env.split('\n')) {
      const eq = line.indexOf('=');
      if (eq < 0) continue;
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim();
      if (k === 'NEXT_PUBLIC_SUPABASE_URL')  url = v;
      if (k === 'SUPABASE_SERVICE_ROLE_KEY') key = v;
    }
  } catch {
    return { products: [], error: 'No se pudo leer .env.local' };
  }

  if (!url || !key) return { products: [], error: 'Variables de entorno faltantes' };

  try {
    const res = await fetch(
      `${url}/rest/v1/products?select=id,name,product_type,brand,provider,pvp&limit=500`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const products = await res.json();
    return { products, error: null };
  } catch (err) {
    return { products: [], error: err.message };
  }
}

// ── Render de una entrada en Markdown ────────────────────────────────────────

function renderEntry(entry, match) {
  const lines = [];

  let matchBadge;
  if (!match) {
    matchBadge = '❓ **Posible producto nuevo** — no encontrado en BD';
  } else if (match.score >= 0.9) {
    matchBadge = `✅ BD: **${match.product.name}** (${match.product.product_type}) — ${match.matchType}`;
  } else if (match.score >= 0.65) {
    matchBadge = `🔶 BD posible: **${match.product.name}** (${match.product.product_type}) — score ${Math.round(match.score * 100)}%`;
  } else {
    matchBadge = `🔸 BD parcial: **${match.product.name}** — score ${Math.round(match.score * 100)}%`;
  }

  lines.push(`#### ${entry.name}`);
  lines.push(`- ${matchBadge}`);
  if (entry.priority)                      lines.push(`- **Prioridad:** ${entry.priority}`);
  if (entry.quantity || entry.presentation) lines.push(`- **Presentación/Cantidad:** ${[entry.quantity, entry.presentation].filter(Boolean).join(' — ')}`);
  if (entry.price)                          lines.push(`- **Precio detectado:** $${entry.price.toFixed(2)}`);
  if (entry.indications.length)             lines.push(`- **Indicaciones:** ${entry.indications.slice(0, 2).join('; ')}`);
  if (entry.incompatibilities.length)       lines.push(`- **Advertencias:** ${entry.incompatibilities[0]}`);

  return lines.join('\n');
}

// ── Noise Detection ───────────────────────────────────────────────────────────
// Marks entries that are almost certainly NOT real product names:
// generic container words, sentence fragments, clinical instructions,
// header fragments, or pure measurements.

const NOISE_GENERIC_SET = new Set([
  // Container/form words (solo, sin nombre de producto)
  'ampolla', 'ampollas', 'frasco', 'frascos', 'gotero', 'goteros',
  'vial', 'viales', 'spray', 'capsula', 'capsulas', 'tableta', 'tabletas',
  'comprimido', 'comprimidos', 'unidad', 'unidades',
  // Descriptor genérico
  'complex', 'complejo', 'componentes',
  // Términos clínico-administrativos nunca usados como nombres de producto
  'dosis', 'indicaciones', 'indicacion', 'incompatibilidades', 'incompatibilidad',
  'sinergia', 'inhibidor', 'contraindicado', 'advertencia', 'precaucion',
  // Términos de tabla / documento
  'proveedor', 'presentacion', 'composicion', 'nombre', 'marca', 'descripcion',
  'resumen', 'producto', 'productos', 'tipo', 'categoria',
  // Sustancias genéricas (solo la palabra, sin presentación)
  'agua', 'plasma', 'marino', 'salina', 'solucion',
  // Otros fragmentos de texto
  'nada', 'mezclar', 'natural', 'general', 'control', 'vitamina',
]);

// Ends with /  ,  ;  or a hanging conjunction/preposition
const NOISE_ENDS_RE = /(?:\s*\/|\s+[yY]\b|\s+de\b|\s+con\b|\s+[oO]\b|\s+e\b|[,;])$/;

// Starts with preposition or conjunction (sentence fragment)
const NOISE_STARTS_RE = /^(?:de |y |en |con |del |al |o |la |el |los |las |un |una |por |para |que |su |sus |a (?!her\b|min\b|cin\b))/i;

// Just a number + unit, e.g. "10ml", "200 mg/mL", "400μg"
const NOISE_PURE_UNIT_RE = /^[\d,.]+\s*(?:ml|mg|mcg|µg|μg|ug|g\b|gr\b|UI|IU|mEq|%)\s*(?:\/[\d\s,.]*(?:ml|mg|mcg))?$/i;

// Pure presentation without product name, e.g. "Frasco 10mL", "Gotero 60ml"
const NOISE_PRESENTATION_RE = /^(?:\(?\s*(?:frasco|gotero|ampolla|vial|spray)\s+(?:de\s+)?[\d,.]+\s*(?:ml|mg|g|mcg|mL)?\s*\)?|[\d,.]+\s*(?:ml|mg|g|mcg)\s*(?:x\s*\d+)?\s*(?:frascos?|ampollas?|viales?)?)$/i;

// Clinical or dosage instruction starting the string
const NOISE_CLINICAL_RE = /^(?:\d+\s*[-–]\s*\d+\s+(?:ampollas?|ml|mg)|\d+\s+ampolla\s|diluir\b|administrar?\b|aplicar?\b|pasarlo?\s|no\s+(?:mezclar|usar|pasar|es\s+para)|nunca\s|continuar\s+con\s|suspender\s|aporta\s|la\s+mayor[íi]a\s|sensible)/i;

// Header, table title or document title fragment
const NOISE_HEADER_RE = /\b(?:sinergia\s+inhibidor|dosificaci[oó]n\s+sinergia|composici[oó]n\s+present|indicaciones?\s*\(resumen\)|incompatibilidades|funciones\s+principales|compuestos\s+clave|stock\s+esencial\s+(?:de\s+)?ampollas|cl[íi]nica\s+ser\s+humano|proveedor\s+(?:rocab|saeda)|stock\s+de\s+emergencia\s+ampollas)\b/i;

function isLikelyNoise(name) {
  const trimmed = name.trim();
  const normalized = norm(trimmed);
  const words = normalized.split(/\s+/).filter(Boolean);

  // 1. Single generic word
  if (words.length === 1 && NOISE_GENERIC_SET.has(words[0])) {
    return { isNoise: true, reason: `Palabra genérica: "${trimmed}"` };
  }

  // 2. Ends with separator or hanging conjunction
  if (NOISE_ENDS_RE.test(trimmed)) {
    return { isNoise: true, reason: 'Termina incompleto (/, ,, ;, conjunción)' };
  }

  // 3. Starts with preposition or conjunction
  if (NOISE_STARTS_RE.test(trimmed)) {
    return { isNoise: true, reason: 'Inicia con preposición o conjunción' };
  }

  // 4. Header or document title
  if (NOISE_HEADER_RE.test(trimmed)) {
    return { isNoise: true, reason: 'Fragmento de encabezado o título' };
  }

  // 5. Clinical or dosage instruction
  if (NOISE_CLINICAL_RE.test(trimmed)) {
    return { isNoise: true, reason: 'Instrucción clínica o de dosificación' };
  }

  // 6. Pure measurement / unit
  if (NOISE_PURE_UNIT_RE.test(trimmed)) {
    return { isNoise: true, reason: 'Solo medida o unidad' };
  }

  // 7. Pure presentation (container + measurement only)
  if (NOISE_PRESENTATION_RE.test(trimmed)) {
    return { isNoise: true, reason: 'Solo presentación sin nombre de producto' };
  }

  return { isNoise: false, reason: null };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!existsSync(DOCS_DIR)) mkdirSync(DOCS_DIR, { recursive: true });

  console.log('\n🔍 Cargando productos existentes desde Supabase…');
  const { products: existing, error: supaErr } = await loadExistingProducts();
  if (supaErr) {
    console.warn(`   ⚠  ${supaErr}`);
  } else {
    console.log(`   ✓ ${existing.length} productos cargados`);
  }

  const report   = [];
  const allNew   = [];       // entradas sin coincidencia en BD
  const allMatch = [];       // entradas con coincidencia
  const docStats = [];

  // ── Encabezado del reporte ────────────────────────────────────────────────
  const now = new Date().toLocaleString('es-EC');
  report.push('# Análisis de documentos de stock');
  report.push('');
  report.push(`**Generado:** ${now}  `);
  report.push(`**Productos en BD:** ${existing.length}  `);
  report.push(`**Fuentes analizadas:** ${DOCS.length}`);
  report.push('');
  report.push('---');
  report.push('');
  report.push('## Índice');
  report.push('');
  for (const d of DOCS) {
    report.push(`- [${d.label}](#${d.type})`);
  }
  report.push('- [Posibles productos nuevos](#nuevos)');
  report.push('- [Propuesta de tablas Supabase](#propuesta-sql)');
  report.push('');
  report.push('---');
  report.push('');

  // ── Procesar cada documento ───────────────────────────────────────────────
  for (const doc of DOCS) {
    const filePath = join(STOCK_DIR, doc.file);
    console.log(`\n📄 ${doc.file}`);

    let lines   = [];
    let numPages = 0;
    let rawText  = '';
    let readErr  = null;

    try {
      const buf    = readFileSync(filePath);
      const parser = new PDFParse({ data: buf });
      const data   = await parser.getText();
      rawText   = data.text ?? '';
      numPages  = data.numpages ?? data.pages?.length ?? 0;
      lines     = rawText.split('\n').map(l => l.trim()).filter(Boolean);
      console.log(`   ${numPages} págs · ${lines.length} líneas · ${rawText.length} chars`);
    } catch (err) {
      readErr = err.message;
      console.error(`   ❌ ${err.message}`);
    }

    report.push(`## ${doc.label} {#${doc.type}}`);
    report.push('');

    if (readErr) {
      report.push(`> ❌ Error al leer el archivo: \`${readErr}\``);
      report.push('');
      report.push('---');
      report.push('');
      docStats.push({ label: doc.label, pages: 0, entries: 0, error: readErr });
      continue;
    }

    report.push(`**Páginas:** ${numPages} | **Líneas extraídas:** ${lines.length}`);
    report.push('');

    // Parsear entradas
    const entries = parseLines(lines);
    console.log(`   → ${entries.length} entradas detectadas`);

    // Comparar con BD
    const withMatch = [];
    const withoutMatch = [];

    for (const entry of entries) {
      const match = existing.length ? compareWithProducts(entry.name, existing) : null;
      if (match && match.score >= 0.65) {
        withMatch.push({ entry, match });
        allMatch.push({ entry, match, source: doc.label, sourceType: doc.type });
      } else {
        withoutMatch.push({ entry, match });
        allNew.push({ entry, match, source: doc.label, sourceType: doc.type });
      }
    }

    docStats.push({ label: doc.label, pages: numPages, entries: entries.length, error: null });

    if (entries.length === 0) {
      report.push('> ⚠️ El parser automático no detectó entradas estructuradas.');
      report.push('> Esto puede deberse al formato del PDF (tablas, columnas múltiples, fuente no estándar).');
      report.push('> Se muestra el texto extraído para revisión manual.');
      report.push('');
    } else {
      // Agrupar por prioridad
      const groups = { A: [], B: [], C: [], sin: [] };
      for (const item of [...withMatch, ...withoutMatch]) {
        const p = item.entry.priority;
        if (p === 'A') groups.A.push(item);
        else if (p === 'B') groups.B.push(item);
        else if (p === 'C') groups.C.push(item);
        else groups.sin.push(item);
      }

      const order = [['A', 'Prioridad A'], ['B', 'Prioridad B'], ['C', 'Prioridad C'], ['sin', 'Sin prioridad asignada']];
      for (const [key, label] of order) {
        if (groups[key].length === 0) continue;
        report.push(`### ${label} (${groups[key].length})`);
        report.push('');
        for (const { entry, match } of groups[key]) {
          report.push(renderEntry(entry, match));
          report.push('');
        }
      }
    }

    // Texto raw expandible
    report.push('<details>');
    report.push(`<summary>📋 Texto completo extraído del PDF (${lines.length} líneas)</summary>`);
    report.push('');
    report.push('```');
    const preview = lines.slice(0, 120);
    report.push(preview.join('\n'));
    if (lines.length > 120) report.push(`\n…(${lines.length - 120} líneas más)`);
    report.push('```');
    report.push('</details>');
    report.push('');
    report.push('---');
    report.push('');
  }

  // ── Posibles productos nuevos ─────────────────────────────────────────────
  report.push('## Posibles productos nuevos {#nuevos}');
  report.push('');
  report.push(`> Entradas en los PDFs **sin coincidencia clara** en la tabla \`products\`.  `);
  report.push('> Revisar manualmente antes de agregar a la BD.');
  report.push('');

  if (allNew.length === 0) {
    report.push('*No se detectaron productos nuevos, o no hubo entradas parseables para comparar.*');
  } else {
    // Agrupar por documento fuente
    const bySource = {};
    for (const item of allNew) {
      if (!bySource[item.source]) bySource[item.source] = [];
      bySource[item.source].push(item);
    }

    for (const [src, items] of Object.entries(bySource)) {
      report.push(`### ${src} (${items.length})`);
      report.push('');
      report.push('| Nombre detectado | Prioridad | Cantidad | Parcial en BD |');
      report.push('|---|:---:|---|---|');
      for (const { entry, match } of items) {
        const partial = match
          ? `${match.product.name} (${Math.round(match.score * 100)}%)`
          : '—';
        report.push(`| ${entry.name} | ${entry.priority ?? '—'} | ${entry.quantity ?? '—'} | ${partial} |`);
      }
      report.push('');
    }
  }

  report.push('---');
  report.push('');

  // ── Propuesta SQL ─────────────────────────────────────────────────────────
  report.push('## Propuesta de tablas Supabase {#propuesta-sql}');
  report.push('');
  report.push('### Contexto');
  report.push('');
  report.push('Los PDFs de stock contienen información que la BD actual no almacena:');
  report.push('');
  report.push('| Información en PDF | Tabla actual | Estado |');
  report.push('|---|---|---|');
  report.push('| Cantidades en stock | — | ❌ No existe |');
  report.push('| Prioridad A/B/C | — | ❌ No existe |');
  report.push('| Indicaciones clínicas | `products.conditions_text` | ⚠️ Parcial |');
  report.push('| Incompatibilidades | — | ❌ No existe |');
  report.push('| Dosis / preparación | — | ❌ No existe |');
  report.push('| Movimientos de inventario | — | ❌ No existe |');
  report.push('');
  report.push('### Tablas propuestas');
  report.push('');

  report.push('#### 1. `product_stock_recommendations`');
  report.push('');
  report.push('Almacena la recomendación de stock mínimo y prioridad por producto, importada de los PDFs.');
  report.push('**Crear primero** — no depende de ninguna tabla nueva.');
  report.push('');
  report.push('```sql');
  report.push(`CREATE TABLE product_stock_recommendations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id            UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name_source   TEXT        NOT NULL,  -- nombre tal como aparece en el PDF
  source_document       TEXT        NOT NULL,  -- nombre del archivo PDF
  priority_class        CHAR(1)     CHECK (priority_class IN ('A','B','C')),
  suggested_quantity    NUMERIC,
  suggested_unit        TEXT,                  -- 'ml','mg','unidad','frasco'
  suggested_presentation TEXT,                -- ej: '10ml x 5 ampollas'
  notes                 TEXT,
  verified              BOOLEAN     DEFAULT false,  -- admin confirmó la coincidencia
  created_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ON product_stock_recommendations (product_id);
CREATE INDEX ON product_stock_recommendations (priority_class);
CREATE INDEX ON product_stock_recommendations (verified);`);
  report.push('```');
  report.push('');

  report.push('#### 2. `product_clinical_notes`');
  report.push('');
  report.push('Almacena indicaciones, incompatibilidades, dosis y advertencias clínicas por producto.');
  report.push('**Crear segundo** — complementa `products` sin modificarlo.');
  report.push('');
  report.push('```sql');
  report.push(`CREATE TABLE product_clinical_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  note_type   TEXT        NOT NULL CHECK (note_type IN (
                'indicacion',
                'contraindicacion',
                'incompatibilidad',
                'dosis',
                'advertencia',
                'preparacion',
                'observacion'
              )),
  content     TEXT        NOT NULL,
  source      TEXT,        -- archivo PDF de origen
  active      BOOLEAN     DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ON product_clinical_notes (product_id);
CREATE INDEX ON product_clinical_notes (note_type);`);
  report.push('```');
  report.push('');

  report.push('#### 3. `inventory_items`');
  report.push('');
  report.push('Stock físico actual por producto. Requiere decisión sobre productos nuevos vs existentes.');
  report.push('**Crear tercero**, después de verificar coincidencias en `product_stock_recommendations`.');
  report.push('');
  report.push('```sql');
  report.push(`CREATE TABLE inventory_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name_ref  TEXT        NOT NULL,     -- nombre de referencia
  sku               TEXT,
  current_quantity  NUMERIC     DEFAULT 0,
  min_quantity      NUMERIC     DEFAULT 0,    -- punto de reorden
  max_quantity      NUMERIC,
  unit              TEXT,                     -- 'ml','mg','unidad','frasco'
  location          TEXT,                     -- ubicación en almacén
  priority_class    CHAR(1)     CHECK (priority_class IN ('A','B','C')),
  notes             TEXT,
  active            BOOLEAN     DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ON inventory_items (product_id);
CREATE INDEX ON inventory_items (priority_class);`);
  report.push('```');
  report.push('');

  report.push('#### 4. `inventory_movements`');
  report.push('');
  report.push('Registro de entradas, salidas y ajustes. Depende de `inventory_items`.');
  report.push('**Crear cuarto**, cuando empiece el control de stock.');
  report.push('');
  report.push('```sql');
  report.push(`CREATE TABLE inventory_movements (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id     UUID        NOT NULL REFERENCES inventory_items(id),
  movement_type         TEXT        NOT NULL CHECK (
                          movement_type IN ('entrada','salida','ajuste','merma')
                        ),
  quantity              NUMERIC     NOT NULL,
  previous_quantity     NUMERIC,              -- snapshot previo al movimiento
  reason                TEXT,
  reference_number      TEXT,                 -- factura, lote, OC
  created_by            UUID REFERENCES auth.users(id),
  created_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ON inventory_movements (inventory_item_id);
CREATE INDEX ON inventory_movements (created_at);`);
  report.push('```');
  report.push('');

  report.push('### RLS sugerido para tablas nuevas');
  report.push('');
  report.push('```sql');
  report.push(`-- Solo usuarios autenticados y activos pueden leer
-- Solo admin puede insertar/actualizar/eliminar
-- (aplicar el mismo patrón de rls.sql existente)

ALTER TABLE product_stock_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_clinical_notes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items               ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements           ENABLE ROW LEVEL SECURITY;`);
  report.push('```');
  report.push('');

  report.push('### Orden de trabajo recomendado antes del módulo Calcular Suero');
  report.push('');
  report.push('```');
  report.push('1. Corregir PVP = 0 en productos existentes (auditoría ya detectada)');
  report.push('2. Crear product_stock_recommendations y cargar datos de PDFs');
  report.push('3. Crear product_clinical_notes y cargar indicaciones / incompatibilidades');
  report.push('4. Crear inventory_items con stock inicial');
  report.push('5. Recién entonces construir el módulo de Cálculo (que bloqueará PVP = 0)');
  report.push('```');
  report.push('');
  report.push('---');
  report.push('');

  // ── Resumen final ─────────────────────────────────────────────────────────
  report.push('## Resumen ejecutivo');
  report.push('');
  report.push('| Documento | Páginas | Entradas detectadas |');
  report.push('|---|:---:|:---:|');
  for (const s of docStats) {
    const err = s.error ? ` ❌` : '';
    report.push(`| ${s.label}${err} | ${s.pages} | ${s.entries} |`);
  }

  const totalEntries = docStats.reduce((a, s) => a + s.entries, 0);
  report.push('');
  report.push(`| Métrica | Valor |`);
  report.push(`|---|---|`);
  report.push(`| Total entradas detectadas | ${totalEntries} |`);
  report.push(`| Con coincidencia en BD (score ≥ 65%) | ${allMatch.length} |`);
  report.push(`| Sin coincidencia / posibles nuevos | ${allNew.length} |`);
  report.push(`| Productos en BD consultados | ${existing.length} |`);
  report.push('');
  report.push('> **Nota:** El parser automático funciona mejor con PDFs de texto plano.');
  report.push('> PDFs generados desde tablas complejas o con columnas múltiples pueden');
  report.push('> producir menos entradas detectadas. En ese caso, revisar la sección');
  report.push('> "Texto completo extraído" dentro de cada categoría.');
  report.push('');

  // Escribir reporte
  const outPath = join(DOCS_DIR, 'analisis-stock.md');
  writeFileSync(outPath, report.join('\n'), 'utf-8');

  // ── JSON de candidatos para el módulo de revisión ─────────────────────────
  function candidateStatus(match) {
    if (!match)              return 'nueva';
    if (match.score >= 0.9)  return 'exacta';
    if (match.score >= 0.65) return 'posible';
    return 'revisar';
  }

  const candidates = [];
  for (const { entry, match, source, sourceType } of [...allMatch, ...allNew]) {
    const { isNoise, reason } = isLikelyNoise(entry.name);
    candidates.push({
      name:                       entry.name,
      source_label:               source,
      source_type:                sourceType ?? null,
      priority:                   entry.priority ?? null,
      quantity:                   entry.quantity ?? null,
      presentation:               entry.presentation ?? null,
      brand:                      entry.brand ?? null,
      dosage:                     entry.dosage ?? null,
      synergy:                    entry.synergy ?? null,
      incompatibilities_detected: entry.incompatibilities_detected ?? null,
      indications_detected:       entry.indications_detected ?? null,
      price:                      entry.price ?? null,
      indications:                entry.indications,
      incompatibilities:          entry.incompatibilities,
      matched_product_name:       match?.product?.name ?? null,
      matched_product_type:       match?.product?.product_type ?? null,
      matched_product_id:         match?.product?.id ?? null,
      match_score:                match ? Math.round(match.score * 100) : null,
      match_type:                 match?.matchType ?? null,
      status:                     candidateStatus(match),
      isLikelyNoise:              isNoise,
      noiseReason:                reason,
    });
  }

  const noiseCount  = candidates.filter(c => c.isLikelyNoise).length;
  const usefulCount = candidates.length - noiseCount;

  const jsonOut = {
    generated_at:     new Date().toISOString(),
    products_in_db:   existing.length,
    total_candidates: candidates.length,
    useful_count:     usefulCount,
    noise_count:      noiseCount,
    candidates,
  };

  const jsonPath = join(ROOT, 'data', 'processed', 'stock-candidates.json');
  writeFileSync(jsonPath, JSON.stringify(jsonOut, null, 2), 'utf-8');
  console.log(`📊  JSON: data/processed/stock-candidates.json (${candidates.length} candidatos)`);

  // ── Resumen en consola ────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log('✅  Análisis completado');
  console.log(`📄  Reporte: docs/analisis-stock.md`);
  console.log('─'.repeat(60));
  console.log(`Documentos procesados : ${DOCS.length}`);
  console.log(`Entradas detectadas   : ${totalEntries}`);
  console.log(`Con coincidencia BD   : ${allMatch.length}`);
  console.log(`Posibles nuevos       : ${allNew.length}`);
  console.log('─'.repeat(60));
  console.log(`Útiles (no ruido)     : ${usefulCount}`);
  console.log(`Posible ruido         : ${noiseCount}`);
  console.log('═'.repeat(60));
}

main().catch(err => {
  console.error('\n❌ Error fatal:', err.message);
  process.exit(1);
});
