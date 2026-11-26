// Маленький писатель .xlsx без внешних библиотек: ячейки с любым оформлением, фигуры и настоящие диаграммы Excel
const esc = (s) => String(s ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const NS = 'http://schemas.openxmlformats.org';
const REL = `${NS}/officeDocument/2006/relationships`;
const FONT = 'Segoe UI';
const EMU = 9525; // в одном пикселе
export const colName = (i) => (i >= 26 ? colName(Math.floor(i / 26) - 1) : '') + String.fromCharCode(65 + (i % 26));
// дата «2026-11-26» → число дней, как хранит Excel
export const serial = (k) => { const [y, m, d] = k.split('-').map(Number); return (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000; };

// Лист-холст: колонки заданы в пикселях, всё остальное ставится по номерам колонки и строки (с нуля)
export function canvas(name, widths, bg, rowPx = 20) {
  const cells = new Map(), heights = new Map();
  const s = { name, widths, bg, rowPx, cells, heights, merges: [], shapes: [], charts: [] };
  const key = (c, r) => r * 1000 + c;
  // оформление накапливается: фон блока, потом поверх него текст
  s.paint = (c, r, w, h, st) => { for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) { const e = cells.get(key(x, y)) ?? { st: { fill: bg } }; Object.assign(e.st, st); cells.set(key(x, y), e); } };
  s.put = (c, r, w, v, st = {}, h = 1) => { s.paint(c, r, w, h, st); cells.get(key(c, r)).v = v; if (w > 1 || h > 1) s.merges.push(`${colName(c)}${r + 1}:${colName(c + w - 1)}${r + h}`); };
  s.height = (r, px) => heights.set(r, px);
  s.h = (r) => heights.get(r) ?? rowPx;
  // точка внутри листа: пиксели от левого верхнего угла ячейки, лишнее переносится в соседние
  s.point = (c, r, dx = 0, dy = 0) => {
    while (dx >= widths[Math.min(c, widths.length - 1)]) dx -= widths[Math.min(c++, widths.length - 1)];
    while (dy >= s.h(r)) dy -= s.h(r++);
    return [c, Math.max(0, dx), r, Math.max(0, dy)];
  };
  s.shape = (from, to, o) => s.shapes.push({ from: s.point(...from), to: s.point(...to), ...o });
  // chart: { type: 'doughnut' | 'column' | 'line', cats, series: [{ name, values, color, colors }], labels, fmt }
  s.chart = (c, r, w, h, chart) => s.charts.push({ ...chart, from: [c, 0, r, 0], to: [c + w, 0, r + h, 0] });
  return s;
}

// стили собираются по мере использования
function styleBook() {
  const list = (first) => { const all = [...first], at = new Map(first.map((x, i) => [x, i])); return { all, id: (x) => { if (!at.has(x)) { at.set(x, all.length); all.push(x); } return at.get(x); } }; };
  const fonts = list(['<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>']);
  const fills = list(['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>']);
  const borders = list(['<border><left/><right/><top/><bottom/><diagonal/></border>']);
  const fmts = new Map(), xfs = list(['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>']);
  const side = (tag, v) => (v ? `<${tag} style="${v[1] ?? 'thin'}"><color rgb="FF${v[0]}"/></${tag}>` : `<${tag}/>`);
  const id = (st) => {
    const font = fonts.id(`<font>${st.b ? '<b/>' : ''}${st.strike ? '<strike/>' : ''}<sz val="${st.sz ?? 10}"/><color rgb="FF${st.color ?? '14161C'}"/><name val="${FONT}"/><family val="2"/></font>`);
    const fill = st.fill ? fills.id(`<fill><patternFill patternType="solid"><fgColor rgb="FF${st.fill}"/><bgColor indexed="64"/></patternFill></fill>`) : 0;
    const border = borders.id(`<border>${side('left', st.bl)}${side('right', st.br)}${side('top', st.bt)}${side('bottom', st.bb)}<diagonal/></border>`);
    let num = 0;
    if (st.fmt) { if (!fmts.has(st.fmt)) fmts.set(st.fmt, 164 + fmts.size); num = fmts.get(st.fmt); }
    const align = `<alignment vertical="${st.valign ?? 'center'}"${st.align || st.indent ? ` horizontal="${st.align ?? 'left'}"` : ''}${st.indent ? ` indent="${st.indent}"` : ''}${st.wrap ? ' wrapText="1"' : ''}${st.shrink ? ' shrinkToFit="1"' : ''}/>`;
    return xfs.id(`<xf numFmtId="${num}" fontId="${font}" fillId="${fill}" borderId="${border}" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">${align}</xf>`);
  };
  const xml = () => {
    const block = (tag, l) => `<${tag} count="${l.length}">${l.join('')}</${tag}>`;
    return `${XML}<styleSheet xmlns="${NS}/spreadsheetml/2006/main">${block('numFmts', [...fmts].map(([f, i]) => `<numFmt numFmtId="${i}" formatCode="${esc(f)}"/>`))}${block('fonts', fonts.all)}${block('fills', fills.all)}${block('borders', borders.all)}<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>${block('cellXfs', xfs.all)}<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  };
  return { id, xml };
}

function sheetXml(sh, book, hasDrawing, first) {
  const base = sh.bg ? book.id({ fill: sh.bg }) : 0;
  const col = (min, max, px) => `<col min="${min}" max="${max}" width="${(px / 7).toFixed(3)}" style="${base}" customWidth="1"/>`;
  const cols = sh.widths.map((px, i) => col(i + 1, i + 1, px)).join('') + col(sh.widths.length + 1, 16384, 64);
  const byRow = new Map();
  for (const [k, e] of sh.cells) { const r = Math.floor(k / 1000); if (!byRow.has(r)) byRow.set(r, []); byRow.get(r).push([k % 1000, e]); }
  const rows = [...new Set([...byRow.keys(), ...sh.heights.keys()])].sort((a, b) => a - b).map((r) => {
    const cells = (byRow.get(r) ?? []).sort((a, b) => a[0] - b[0]).map(([c, e]) => {
      const s = book.id(e.st), ref = colName(c) + (r + 1), v = e.v;
      if (v == null || v === '') return `<c r="${ref}" s="${s}"/>`;
      if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}" s="${s}"><v>${v}</v></c>`;
      return `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
    }).join('');
    return `<row r="${r + 1}" ht="${sh.h(r) * 0.75}" customHeight="1">${cells}</row>`;
  }).join('');
  const pane = sh.freeze ? `<pane ySplit="${sh.freeze}" topLeftCell="A${sh.freeze + 1}" activePane="bottomLeft" state="frozen"/>` : '';
  return `${XML}<worksheet xmlns="${NS}/spreadsheetml/2006/main" xmlns:r="${REL}"><sheetPr><tabColor rgb="FFC99A2E"/><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0" showGridLines="0"${first ? ' tabSelected="1"' : ''}>${pane}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="${sh.rowPx * 0.75}" customHeight="1"/><cols>${cols}</cols><sheetData>${rows}</sheetData>${sh.filter ? `<autoFilter ref="${sh.filter}"/>` : ''}${sh.merges.length ? `<mergeCells count="${sh.merges.length}">${sh.merges.map((m) => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : ''}<pageMargins left="0.2" right="0.2" top="0.3" bottom="0.3" header="0.1" footer="0.1"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="${sh.onePage ? 1 : 0}"/>${hasDrawing ? '<drawing r:id="rId1"/>' : ''}</worksheet>`;
}

const fill = (c) => `<a:solidFill><a:srgbClr val="${c}"/></a:solidFill>`;
const noLine = '<a:ln><a:noFill/></a:ln>';
const textProps = (sz, color, b = false) => `<c:txPr><a:bodyPr rot="0" vert="horz"/><a:p><a:pPr><a:defRPr sz="${sz}" b="${b ? 1 : 0}">${fill(color)}<a:latin typeface="${FONT}"/></a:defRPr></a:pPr><a:endParaRPr lang="ru-RU"/></a:p></c:txPr>`;

// ref(колонка) → адрес столбца данных этой диаграммы на скрытом листе
function chartXml(ch, ref) {
  const n = ch.cats.length;
  const cats = `<c:cat><c:strRef><c:f>${ref(0)}</c:f><c:strCache><c:ptCount val="${n}"/>${ch.cats.map((v, i) => `<c:pt idx="${i}"><c:v>${esc(v)}</c:v></c:pt>`).join('')}</c:strCache></c:strRef></c:cat>`;
  const round = ch.type === 'doughnut', line = ch.type === 'line';
  const labels = (pos) => (ch.labels ? `<c:dLbls><c:numFmt formatCode="${esc(ch.fmt ?? '#,##0;-#,##0;;')}" sourceLinked="0"/><c:spPr><a:noFill/>${noLine}</c:spPr>${textProps(800, '14161C', true)}${pos ? `<c:dLblPos val="${pos}"/>` : ''}<c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbls>` : '');
  const ser = ch.series.map((s, k) => {
    const points = (s.colors ?? []).map((c, i) => (round ? `<c:dPt><c:idx val="${i}"/><c:bubble3D val="0"/><c:spPr>${fill(c)}<a:ln w="19050">${fill('FFFFFF')}</a:ln></c:spPr></c:dPt>`
      : line ? `<c:dPt><c:idx val="${i}"/><c:marker><c:symbol val="circle"/><c:size val="8"/><c:spPr>${fill('FFFFFF')}<a:ln w="28575">${fill(c)}</a:ln></c:spPr></c:marker><c:bubble3D val="0"/></c:dPt>`
        : `<c:dPt><c:idx val="${i}"/><c:invertIfNegative val="0"/><c:bubble3D val="0"/><c:spPr>${fill(c)}</c:spPr></c:dPt>`)).join('');
    const look = line ? `<c:spPr><a:ln w="38100" cap="rnd">${fill(s.color)}</a:ln></c:spPr><c:marker><c:symbol val="circle"/><c:size val="8"/><c:spPr>${fill('FFFFFF')}<a:ln w="28575">${fill(s.color)}</a:ln></c:spPr></c:marker>` : round ? '' : `<c:spPr>${fill(s.color)}</c:spPr><c:invertIfNegative val="0"/>`;
    const vals = `<c:val><c:numRef><c:f>${ref(k + 1)}</c:f><c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${n}"/>${s.values.map((v, i) => `<c:pt idx="${i}"><c:v>${Number(v) || 0}</c:v></c:pt>`).join('')}</c:numCache></c:numRef></c:val>`;
    return `<c:ser><c:idx val="${k}"/><c:order val="${k}"/><c:tx><c:v>${esc(s.name)}</c:v></c:tx>${look}${points}${round ? '' : labels(line ? 't' : 'outEnd')}${cats}${vals}${line ? '<c:smooth val="0"/>' : ''}</c:ser>`;
  }).join('');
  const ids = '<c:axId val="1001"/><c:axId val="1002"/>';
  const plot = round ? `<c:doughnutChart><c:varyColors val="1"/>${ser}<c:firstSliceAng val="0"/><c:holeSize val="64"/></c:doughnutChart>`
    : line ? `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${ser}<c:marker val="1"/>${ids}</c:lineChart>`
      : `<c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:varyColors val="0"/>${ser}<c:gapWidth val="${ch.gap ?? 70}"/><c:overlap val="-8"/>${ids}</c:barChart>`;
  const small = textProps(850, '7C8191');
  const axes = round ? '' : `<c:catAx><c:axId val="1001"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="low"/><c:spPr><a:ln w="9525">${fill('C9CCD6')}</a:ln></c:spPr>${small}<c:crossAx val="1002"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx><c:valAx><c:axId val="1002"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:majorGridlines><c:spPr><a:ln w="6350">${fill('E8E9EE')}</a:ln></c:spPr></c:majorGridlines><c:numFmt formatCode="#,##0" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:spPr>${noLine}</c:spPr>${small}<c:crossAx val="1001"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx>`;
  const legend = !round && ch.series.length > 1 ? `<c:legend><c:legendPos val="b"/><c:overlay val="0"/>${textProps(900, '555B6B')}</c:legend>` : '';
  const layout = round ? '<c:layout><c:manualLayout><c:layoutTarget val="inner"/><c:xMode val="edge"/><c:yMode val="edge"/><c:x val="0.02"/><c:y val="0.02"/><c:w val="0.96"/><c:h val="0.96"/></c:manualLayout></c:layout>' : '<c:layout/>';
  return `${XML}<c:chartSpace xmlns:c="${NS}/drawingml/2006/chart" xmlns:a="${NS}/drawingml/2006/main" xmlns:r="${REL}"><c:roundedCorners val="0"/><c:chart><c:autoTitleDeleted val="1"/><c:plotArea>${layout}${plot}${axes}<c:spPr><a:noFill/>${noLine}</c:spPr></c:plotArea>${legend}<c:plotVisOnly val="0"/><c:dispBlanksAs val="gap"/></c:chart><c:spPr><a:noFill/>${noLine}</c:spPr></c:chartSpace>`;
}

const mark = (tag, [c, dx, r, dy]) => `<xdr:${tag}><xdr:col>${c}</xdr:col><xdr:colOff>${Math.round(dx * EMU)}</xdr:colOff><xdr:row>${r}</xdr:row><xdr:rowOff>${Math.round(dy * EMU)}</xdr:rowOff></xdr:${tag}>`;
const anchor = (x, body) => `<xdr:twoCellAnchor editAs="oneCell">${mark('from', x.from)}${mark('to', x.to)}${body}<xdr:clientData/></xdr:twoCellAnchor>`;
const frame = (id, rid) => `<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${id}" name="Диаграмма ${id}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="${NS}/drawingml/2006/chart"><c:chart xmlns:c="${NS}/drawingml/2006/chart" r:id="${rid}"/></a:graphicData></a:graphic></xdr:graphicFrame>`;
// прямоугольник: заливка (color), градиент к нему (from) и/или подпись (lines: [{ text, sz, color, b }])
const shapeXml = (id, o) => {
  const paint = !o.color ? '<a:noFill/>' : o.grad ? `<a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:srgbClr val="${o.color}"><a:alpha val="75000"/></a:srgbClr></a:gs><a:gs pos="100000"><a:srgbClr val="${o.color}"/></a:gs></a:gsLst><a:lin ang="0" scaled="1"/></a:gradFill>` : fill(o.color);
  const text = (o.lines ?? [{ text: '' }]).map((l) => `<a:p><a:pPr algn="${o.align ?? 'ctr'}"/><a:r><a:rPr lang="ru-RU" sz="${l.sz ?? 800}" b="${l.b ? 1 : 0}">${fill(l.color ?? '14161C')}<a:latin typeface="${FONT}"/></a:rPr><a:t>${esc(l.text)}</a:t></a:r></a:p>`).join('');
  return `<xdr:sp macro="" textlink=""><xdr:nvSpPr><xdr:cNvPr id="${id}" name="Фигура ${id}"/><xdr:cNvSpPr/></xdr:nvSpPr><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${paint}${noLine}</xdr:spPr><xdr:txBody><a:bodyPr wrap="none" lIns="45720" tIns="0" rIns="45720" bIns="0" anchor="ctr" vertOverflow="overflow" horzOverflow="overflow"/><a:lstStyle/>${text}</xdr:txBody></xdr:sp>`;
};

// zip без сжатия
const CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function zip(files) {
  const enc = new TextEncoder(), out = [], dir = [];
  let off = 0;
  const bytes = (...f) => { const b = []; for (const [v, n] of f) for (let i = 0; i < n; i++) b.push((v >>> (8 * i)) & 255); return new Uint8Array(b); };
  const d = new Date(), time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  for (const [name, text] of files) {
    const n = enc.encode(name), data = enc.encode(text), crc = crc32(data);
    const meta = [[20, 2], [0x800, 2], [0, 2], [time, 2], [date, 2], [crc, 4], [data.length, 4], [data.length, 4], [n.length, 2], [0, 2]];
    out.push(bytes([0x04034b50, 4], ...meta), n, data);
    dir.push(bytes([0x02014b50, 4], [20, 2], ...meta, [0, 2], [0, 2], [0, 2], [0, 4], [off, 4]), n);
    off += 30 + n.length + data.length;
  }
  const size = dir.reduce((s, x) => s + x.length, 0);
  const parts = [...out, ...dir, bytes([0x06054b50, 4], [0, 2], [0, 2], [files.length, 2], [files.length, 2], [size, 4], [off, 4], [0, 2])];
  const all = new Uint8Array(parts.reduce((s, x) => s + x.length, 0));
  let p = 0; for (const x of parts) { all.set(x, p); p += x.length; }
  return all;
}

const rels = (list) => `${XML}<Relationships xmlns="${NS}/package/2006/relationships">${list.map(([type, target], i) => `<Relationship Id="rId${i + 1}" Type="${REL}/${type}" Target="${target}"/>`).join('')}</Relationships>`;

// числа диаграмм лежат на скрытом листе: по блоку колонок на диаграмму
function dataSheet(sheets) {
  const data = canvas('Данные', [], null);
  let col = 0;
  for (const sh of sheets) for (const ch of sh.charts) {
    const at = col;
    data.put(at, 0, 1, `${sh.name}: диаграмма`);
    ch.series.forEach((s, k) => data.put(at + k + 1, 0, 1, s.name));
    ch.cats.forEach((v, i) => { data.put(at, i + 1, 1, v); ch.series.forEach((s, k) => data.put(at + k + 1, i + 1, 1, s.values[i])); });
    ch.ref = (k) => `'Данные'!$${colName(at + k)}$2:$${colName(at + k)}$${ch.cats.length + 1}`;
    col += ch.series.length + 2;
  }
  data.widths = Array.from({ length: col }, () => 90);
  return data;
}

// sheets: холсты из canvas() → байты файла
export function buildXlsx(sheets) {
  const files = [], types = [], book = styleBook();
  const CT = 'application/vnd.openxmlformats-officedocument.';
  const add = (path, text, type) => { files.push([path, text]); if (type) types.push(`<Override PartName="/${path}" ContentType="${CT}${type}+xml"/>`); };
  const data = dataSheet(sheets);
  const all = data.widths.length ? [...sheets, data] : sheets;
  let chartNo = 0, drawNo = 0;
  all.forEach((sh, i) => {
    const drawn = sh.charts.length + sh.shapes.length > 0;
    add(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(sh, book, drawn, i === 0), 'spreadsheetml.worksheet');
    if (!drawn) return;
    const d = ++drawNo, targets = [], parts = [];
    let id = 1;
    add(`xl/worksheets/_rels/sheet${i + 1}.xml.rels`, rels([['drawing', `../drawings/drawing${d}.xml`]]));
    for (const ch of sh.charts) { const k = ++chartNo; add(`xl/charts/chart${k}.xml`, chartXml(ch, ch.ref), 'drawingml.chart'); targets.push(['chart', `../charts/chart${k}.xml`]); parts.push(anchor(ch, frame(++id, `rId${targets.length}`))); }
    // фигуры после диаграмм: подпись в центре кольца должна лежать сверху
    for (const o of sh.shapes) parts.push(anchor(o, shapeXml(++id, o)));
    add(`xl/drawings/drawing${d}.xml`, `${XML}<xdr:wsDr xmlns:xdr="${NS}/drawingml/2006/spreadsheetDrawing" xmlns:a="${NS}/drawingml/2006/main" xmlns:r="${REL}">${parts.join('')}</xdr:wsDr>`, 'drawing');
    if (targets.length) add(`xl/drawings/_rels/drawing${d}.xml.rels`, rels(targets));
  });
  const filters = all.map((s, i) => (s.filter ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${esc(s.name)}'!${s.filter.replace(/([A-Z]+)(\d+)/g, '$$$1$$$2')}</definedName>` : '')).join('');
  add('xl/workbook.xml', `${XML}<workbook xmlns="${NS}/spreadsheetml/2006/main" xmlns:r="${REL}"><bookViews><workbookView tabRatio="800"/></bookViews><sheets>${all.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}"${s === data ? ' state="hidden"' : ''} r:id="rId${i + 1}"/>`).join('')}</sheets>${filters ? `<definedNames>${filters}</definedNames>` : ''}</workbook>`, 'spreadsheetml.sheet.main');
  add('xl/styles.xml', book.xml(), 'spreadsheetml.styles');
  add('xl/_rels/workbook.xml.rels', rels([...all.map((_, i) => ['worksheet', `worksheets/sheet${i + 1}.xml`]), ['styles', 'styles.xml']]));
  add('_rels/.rels', rels([['officeDocument', 'xl/workbook.xml']]));
  files.unshift(['[Content_Types].xml', `${XML}<Types xmlns="${NS}/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${types.join('')}</Types>`]);
  return zip(files);
}
