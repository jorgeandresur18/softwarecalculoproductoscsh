import PDFDocument from 'pdfkit';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getCurrentUser } from '@/lib/auth';
import type { Product, Symptom } from '@/types/database';

// ── Constants ─────────────────────────────────────────────────────────────────
const LONG_NAME_THRESHOLD = 50;
const LM = 50;           // left margin
const W  = 495;          // usable width (A4 595 - 50*2)
const ROW_H    = 16;
const HDR_H    = 18;
const BOTTOM_SAFE = 70; // space reserved for bottom margin + safety

// ── Types ─────────────────────────────────────────────────────────────────────
type AuditProduct = Pick<
  Product,
  'id' | 'product_type' | 'provider' | 'brand' | 'name' |
  'compound' | 'conditions_text' | 'ml' | 'pvp' | 'active'
>;
type AuditSymptom = Pick<Symptom, 'id' | 'name' | 'category' | 'active'>;

const TYPE_LABEL: Record<string, string> = {
  ampolla:   'Ampolla',
  accesorio: 'Accesorio',
  solucion:  'Solucion',
  insumo:    'Insumo',
  otro:      'Otro',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function trunc(str: string | null | undefined, max: number): string {
  if (!str) return '-';
  if (str.length <= max) return str;
  return str.slice(0, max - 2) + '..';
}

function needsBreak(doc: PDFKit.PDFDocument, height: number): boolean {
  return doc.y + height > doc.page.height - BOTTOM_SAFE;
}

function drawHeader(
  doc: PDFKit.PDFDocument,
  cols: string[],
  widths: number[],
): void {
  const y = doc.y;
  const total = widths.reduce((a, b) => a + b, 0);

  doc.rect(LM, y, total, HDR_H).fill('#f3f4f6');

  doc.fontSize(7).fillColor('#6b7280').font('Helvetica-Bold');
  let cx = LM;
  for (let i = 0; i < cols.length; i++) {
    doc.text(cols[i].toUpperCase(), cx + 3, y + 5, {
      width: widths[i] - 6,
      lineBreak: false,
      ellipsis: true,
    });
    cx += widths[i];
  }

  doc.y = y + HDR_H;
  doc.x = LM;
}

function drawRow(
  doc: PDFKit.PDFDocument,
  values: string[],
  widths: number[],
  rowIndex: number,
): void {
  const y = doc.y;
  const total = widths.reduce((a, b) => a + b, 0);

  if (rowIndex % 2 === 1) {
    doc.rect(LM, y, total, ROW_H).fill('#f9fafb');
  }
  doc.rect(LM, y, total, ROW_H).stroke('#e5e7eb');

  doc.fontSize(8).fillColor('#374151').font('Helvetica');
  let cx = LM;
  for (let i = 0; i < values.length; i++) {
    doc.text(values[i] || '-', cx + 3, y + 4, {
      width: widths[i] - 6,
      lineBreak: false,
      ellipsis: true,
    });
    cx += widths[i];
  }

  doc.y = y + ROW_H;
  doc.x = LM;
}

function renderSection(
  doc: PDFKit.PDFDocument,
  title: string,
  cols: string[],
  widths: number[],
  rows: string[][],
): void {
  // Ensure enough space for title + count label + header + at least one row
  if (needsBreak(doc, 14 + 12 + HDR_H + ROW_H + 8)) {
    doc.addPage();
  }

  // Always start flush to the left margin
  doc.x = LM;

  doc.fontSize(11).fillColor('#1f2937').font('Helvetica-Bold')
    .text(title, LM, doc.y, { width: W });
  doc.moveDown(0.25);
  doc.x = LM;

  if (rows.length === 0) {
    doc.fontSize(9).fillColor('#047857').font('Helvetica')
      .text('Sin problemas en esta seccion', LM + 10, doc.y, { width: W - 10 });
    doc.moveDown(1);
    doc.x = LM;
    return;
  }

  doc.fontSize(9).fillColor('#b91c1c').font('Helvetica')
    .text(
      `${rows.length} ${rows.length === 1 ? 'registro' : 'registros'} con problema`,
      LM + 10, doc.y, { width: W - 10 },
    );
  doc.moveDown(0.35);
  doc.x = LM;

  drawHeader(doc, cols, widths);

  for (let r = 0; r < rows.length; r++) {
    if (needsBreak(doc, ROW_H + 4)) {
      doc.addPage();
      drawHeader(doc, cols, widths); // repeat column headers on new page
    }
    drawRow(doc, rows[r], widths, r);
  }

  doc.moveDown(1.2);
  doc.x = LM;
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return new Response('No autorizado', { status: 401 });
  }

  const [
    { data: products, error: prodError },
    { data: symptoms, error: sympError },
  ] = await Promise.all([
    supabaseAdmin
      .from('products')
      .select('id, product_type, provider, brand, name, compound, conditions_text, ml, pvp, active')
      .order('name', { ascending: true }),
    supabaseAdmin
      .from('symptoms')
      .select('id, name, category, active')
      .order('name', { ascending: true }),
  ]);

  if (prodError || sympError) {
    return new Response(
      JSON.stringify({ error: prodError?.message ?? sympError?.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const prods = (products ?? []) as AuditProduct[];
  const symps = (symptoms ?? []) as AuditSymptom[];

  // ── Same checks as the page ──────────────────────────────────────
  const sinPvp = prods.filter(p => !p.pvp || p.pvp === 0);
  const sinMl  = prods.filter(p => p.ml === null || p.ml === undefined);
  const sinProveedor = prods.filter(p => !p.provider || p.provider.trim() === '');
  const sinMarca     = prods.filter(p => !p.brand    || p.brand.trim()    === '');
  const nombreLargo  = prods.filter(p => p.name.length > LONG_NAME_THRESHOLD);
  const pareceCompuesto = prods.filter(
    p =>
      p.name.startsWith('(') ||
      (p.name.length > LONG_NAME_THRESHOLD && p.name.includes('(') && !p.compound),
  );
  const accesorioSinPrecio = prods.filter(
    p => p.product_type === 'accesorio' && (!p.pvp || p.pvp === 0),
  );
  const ampollaSinConditions = prods.filter(
    p =>
      p.product_type === 'ampolla' &&
      (!p.conditions_text || p.conditions_text.trim() === ''),
  );
  const sintomasSospechosos = symps.filter(
    s =>
      s.name.toLowerCase().replace(/\s+/g, '') === 'envejecimientoprematuro' ||
      s.name.toLowerCase().startsWith('ampollas pascoe'),
  );

  const totalIssues =
    sinPvp.length + sinMl.length + sinProveedor.length + sinMarca.length +
    nombreLargo.length + pareceCompuesto.length + accesorioSinPrecio.length +
    ampollaSinConditions.length + sintomasSospechosos.length;

  // ── Build PDF ────────────────────────────────────────────────────
  const doc = new PDFDocument({ margin: LM, size: 'A4' });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  const done = new Promise<void>((resolve, reject) => {
    doc.on('end', resolve);
    doc.on('error', reject);
  });

  const now = new Date();
  const dateStr = now.toLocaleString('es-EC', {
    year:   'numeric',
    month:  '2-digit',
    day:    '2-digit',
    hour:   '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  // ── Cover / title area ───────────────────────────────────────────
  doc
    .fontSize(22)
    .fillColor('#1f2937')
    .font('Helvetica-Bold')
    .text('Auditoria de datos', LM, LM, { width: W });

  doc
    .fontSize(10)
    .fillColor('#6b7280')
    .font('Helvetica')
    .text('Sistema Interno — SoftwareAmpollas', LM, LM + 30, { width: W });

  doc.moveDown(0.6);

  doc
    .fontSize(9)
    .fillColor('#374151')
    .font('Helvetica')
    .text(
      `Generado el ${dateStr}   |   ${prods.length} productos   |   ${symps.length} sintomas   |   ${totalIssues} problemas detectados`,
      { width: W },
    );

  doc.moveDown(0.5);

  // Divider
  const divY = doc.y;
  doc
    .moveTo(LM, divY)
    .lineTo(LM + W, divY)
    .strokeColor('#d1d5db')
    .lineWidth(0.5)
    .stroke();

  doc.moveDown(1);

  // ── Section 1 ────────────────────────────────────────────────────
  renderSection(
    doc,
    '1. Productos sin PVP o con PVP = 0',
    ['Tipo', 'Nombre', 'Marca', 'PVP'],
    [65, 240, 125, 65],
    sinPvp.map(p => [
      TYPE_LABEL[p.product_type] ?? p.product_type,
      trunc(p.name, 56),
      trunc(p.brand, 28),
      String(p.pvp ?? 'null'),
    ]),
  );

  // ── Section 2 ────────────────────────────────────────────────────
  renderSection(
    doc,
    '2. Productos sin ML',
    ['Tipo', 'Nombre', 'Marca', 'ML'],
    [65, 240, 125, 65],
    sinMl.map(p => [
      TYPE_LABEL[p.product_type] ?? p.product_type,
      trunc(p.name, 56),
      trunc(p.brand, 28),
      String(p.ml ?? 'null'),
    ]),
  );

  // ── Section 3 ────────────────────────────────────────────────────
  renderSection(
    doc,
    '3. Productos sin proveedor',
    ['Tipo', 'Nombre', 'Marca', 'Proveedor'],
    [65, 215, 125, 90],
    sinProveedor.map(p => [
      TYPE_LABEL[p.product_type] ?? p.product_type,
      trunc(p.name, 50),
      trunc(p.brand, 28),
      trunc(p.provider, 20),
    ]),
  );

  // ── Section 4 ────────────────────────────────────────────────────
  renderSection(
    doc,
    '4. Productos sin marca',
    ['Tipo', 'Nombre', 'Proveedor', 'Marca'],
    [65, 215, 125, 90],
    sinMarca.map(p => [
      TYPE_LABEL[p.product_type] ?? p.product_type,
      trunc(p.name, 50),
      trunc(p.provider, 28),
      trunc(p.brand, 20) || 'vacio',
    ]),
  );

  // ── Section 5 ────────────────────────────────────────────────────
  renderSection(
    doc,
    `5. Productos con nombre muy largo (> ${LONG_NAME_THRESHOLD} caracteres)`,
    ['Tipo', 'Nombre', 'Chars', 'Compuesto'],
    [65, 215, 50, 165],
    nombreLargo.map(p => [
      TYPE_LABEL[p.product_type] ?? p.product_type,
      trunc(p.name, 50),
      String(p.name.length),
      trunc(p.compound, 38),
    ]),
  );

  // ── Section 6 ────────────────────────────────────────────────────
  renderSection(
    doc,
    '6. Nombres que parecen compuestos',
    ['Tipo', 'Nombre', 'Compuesto separado'],
    [65, 265, 165],
    pareceCompuesto.map(p => [
      TYPE_LABEL[p.product_type] ?? p.product_type,
      trunc(p.name, 62),
      trunc(p.compound, 38),
    ]),
  );

  // ── Section 7 ────────────────────────────────────────────────────
  renderSection(
    doc,
    '7. Accesorios sin precio',
    ['Nombre', 'Marca', 'Proveedor', 'PVP'],
    [215, 120, 120, 40],
    accesorioSinPrecio.map(p => [
      trunc(p.name, 50),
      trunc(p.brand, 28),
      trunc(p.provider, 28),
      String(p.pvp ?? 'null'),
    ]),
  );

  // ── Section 8 ────────────────────────────────────────────────────
  renderSection(
    doc,
    '8. Ampollas sin conditions_text',
    ['Nombre', 'Marca', 'Compuesto', 'conditions_text'],
    [185, 100, 135, 75],
    ampollaSinConditions.map(p => [
      trunc(p.name, 44),
      trunc(p.brand, 22),
      trunc(p.compound, 32),
      p.conditions_text ? trunc(p.conditions_text, 18) : 'vacio',
    ]),
  );

  // ── Section 9 ────────────────────────────────────────────────────
  renderSection(
    doc,
    '9. Sintomas sospechosos',
    ['Nombre', 'Categoria', 'Activo'],
    [290, 140, 65],
    sintomasSospechosos.map(s => [
      trunc(s.name, 68),
      trunc(s.category, 32),
      s.active ? 'Activo' : 'Inactivo',
    ]),
  );

  doc.end();
  await done;

  const buffer = Buffer.concat(chunks);

  return new Response(buffer, {
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': 'attachment; filename="auditoria-datos-sueros.pdf"',
      'Content-Length':      String(buffer.length),
    },
  });
}
