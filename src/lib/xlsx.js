// Маленький писатель .xlsx с настоящими диаграммами Excel, без внешних библиотек
const esc = (s) => String(s ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const NS = 'http://schemas.openxmlformats.org';
const REL = `${NS}/officeDocument/2006/relationships`;
export const colName = (i) => (i >= 26 ? colName(Math.floor(i / 26) - 1) : '') + String.fromCharCode(65 + (i % 26));
// дата «2026-11-26» → число дней, как хранит Excel
export const serial = (k) => { const [y, m, d] = k.split('-').map(Number); return (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000; };
export const PALETTE = ['C9992E', '2F2A24', 'E8C877', '8A6212', 'D9694C', '3E9B6C', '9A948C', '5B7DB1', 'B65C8E', '6FA8A0'];

// стили ячеек: порядок совпадает с cellXfs
const STYLES = ['', 'title', 'head', 'money', 'pct', 'date', 'muted', 'big', 'text', 'int', 'bold', 'moneyBold'];
const styles = () => `${XML}<styleSheet xmlns="${NS}/spreadsheetml/2006/main">
<numFmts count="3"><numFmt numFmtId="164" formatCode="#,##0.00\\ &quot;₴&quot;;[Red]\\-#,##0.00\\ &quot;₴&quot;"/><numFmt numFmtId="165" formatCode="0%"/><numFmt numFmtId="166" formatCode="dd.mm.yyyy"/></numFmts>
<fonts count="6"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="18"/><color rgb="FF8A6212"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><color rgb="FFF3DC9A"/><name val="Calibri"/><family val="2"/></font><font><sz val="10"/><color rgb="FF77716A"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="16"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF17140F"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="hair"><color rgb="FFD8CFBD"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="12">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="166" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left"/></xf>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="164" fontId="4" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>
<xf numFmtId="1" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="0" fontId="5" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="164" fontId="5" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

function cell(v, r, c) {
  if (v == null || v === '') return '';
  const o = typeof v === 'object' ? v : { v };
  const s = STYLES.indexOf(o.s ?? (typeof o.v === 'number' ? 'money' : ''));
  const ref = colName(c) + (r + 1);
  if (o.f) return `<c r="${ref}" s="${s}"><f>${esc(o.f)}</f><v>${o.v ?? 0}</v></c>`;
  if (o.v == null || o.v === '') return `<c r="${ref}" s="${s}"/>`;
  if (typeof o.v === 'number') return `<c r="${ref}" s="${s}"><v>${o.v}</v></c>`;
  return `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${esc(o.v)}</t></is></c>`;
}

function sheetXml(sh, hasDrawing, first) {
  const cols = sh.cols.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('');
  const rows = sh.rows.map((row, r) => `<row r="${r + 1}">${(row ?? []).map((v, c) => cell(v, r, c)).join('')}</row>`).join('');
  const pane = sh.freeze ? `<pane ySplit="${sh.freeze}" topLeftCell="A${sh.freeze + 1}" activePane="bottomLeft" state="frozen"/>` : '';
  return `${XML}<worksheet xmlns="${NS}/spreadsheetml/2006/main" xmlns:r="${REL}"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0" showGridLines="0"${first ? ' tabSelected="1"' : ''}>${pane}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${cols}</cols><sheetData>${rows}</sheetData>${sh.filter ? `<autoFilter ref="${sh.filter}"/>` : ''}<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>${hasDrawing ? '<drawing r:id="rId1"/>' : ''}</worksheet>`;
}

const sheetRef = (name, c, r1, r2) => `'${name.replace(/'/g, "''")}'!$${colName(c)}$${r1 + 1}:$${colName(c)}$${r2 + 1}`;
const tx = (text, size, color = '2F2A24', bold = true) => `<c:tx><c:rich><a:bodyPr/><a:p><a:pPr><a:defRPr sz="${size}" b="${bold ? 1 : 0}"/></a:pPr><a:r><a:rPr lang="ru-RU" sz="${size}" b="${bold ? 1 : 0}"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill></a:rPr><a:t>${esc(text)}</a:t></a:r></a:p></c:rich></c:tx>`;
const fill = (c) => `<a:solidFill><a:srgbClr val="${c}"/></a:solidFill>`;

// chart: { type: 'doughnut' | 'column' | 'bar' | 'line', title, from: [строка], to, cat: колонка, series: [{ name, col, color }], at: [колонка, строка, ширина, высота] }
function chartXml(sh, ch) {
  const val = (r, c) => { const v = sh.rows[r]?.[c]; return typeof v === 'object' && v ? v.v : v; };
  const idx = Array.from({ length: ch.to - ch.from + 1 }, (_, i) => ch.from + i);
  const cats = `<c:cat><c:strRef><c:f>${esc(sheetRef(sh.name, ch.cat, ch.from, ch.to))}</c:f><c:strCache><c:ptCount val="${idx.length}"/>${idx.map((r, i) => `<c:pt idx="${i}"><c:v>${esc(val(r, ch.cat))}</c:v></c:pt>`).join('')}</c:strCache></c:strRef></c:cat>`;
  const round = ch.type === 'doughnut';
  const ser = ch.series.map((s, n) => {
    const color = s.color ?? PALETTE[n % PALETTE.length];
    const look = round ? idx.map((_, i) => `<c:dPt><c:idx val="${i}"/><c:bubble3D val="0"/><c:spPr>${fill(PALETTE[i % PALETTE.length])}<a:ln w="19050">${fill('FFFFFF')}</a:ln></c:spPr></c:dPt>`).join('') : '';
    const sp = ch.type === 'line' ? `<c:spPr><a:ln w="34925" cap="rnd">${fill(color)}</a:ln></c:spPr><c:marker><c:symbol val="circle"/><c:size val="7"/><c:spPr>${fill(color)}</c:spPr></c:marker>` : round ? '' : `<c:spPr>${fill(color)}</c:spPr><c:invertIfNegative val="0"/>`;
    return `<c:ser><c:idx val="${n}"/><c:order val="${n}"/><c:tx><c:v>${esc(s.name)}</c:v></c:tx>${sp}${look}${round ? `<c:dLbls><c:numFmt formatCode="0%" sourceLinked="0"/><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr><c:txPr><a:bodyPr/><a:p><a:pPr><a:defRPr sz="900" b="1">${fill('FFFFFF')}</a:defRPr></a:pPr><a:endParaRPr lang="ru-RU"/></a:p></c:txPr><c:showLegendKey val="0"/><c:showVal val="0"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="1"/><c:showBubbleSize val="0"/></c:dLbls>` : ''}${cats}<c:val><c:numRef><c:f>${esc(sheetRef(sh.name, s.col, ch.from, ch.to))}</c:f><c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${idx.length}"/>${idx.map((r, i) => `<c:pt idx="${i}"><c:v>${Number(val(r, s.col)) || 0}</c:v></c:pt>`).join('')}</c:numCache></c:numRef></c:val>${ch.type === 'line' ? '<c:smooth val="0"/>' : ''}</c:ser>`;
  }).join('');
  const ids = '<c:axId val="1001"/><c:axId val="1002"/>';
  const plot = round ? `<c:doughnutChart><c:varyColors val="1"/>${ser}<c:firstSliceAng val="0"/><c:holeSize val="55"/></c:doughnutChart>`
    : ch.type === 'line' ? `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${ser}<c:marker val="1"/>${ids}</c:lineChart>`
      : `<c:barChart><c:barDir val="${ch.type === 'bar' ? 'bar' : 'col'}"/><c:grouping val="clustered"/><c:varyColors val="0"/>${ser}<c:gapWidth val="60"/>${ids}</c:barChart>`;
  const small = `<c:txPr><a:bodyPr/><a:p><a:pPr><a:defRPr sz="900">${fill('55504A')}</a:defRPr></a:pPr><a:endParaRPr lang="ru-RU"/></a:p></c:txPr>`;
  const flip = ch.type === 'bar';
  const axes = round ? '' : `<c:catAx><c:axId val="1001"/><c:scaling><c:orientation val="${flip ? 'maxMin' : 'minMax'}"/></c:scaling><c:delete val="0"/><c:axPos val="${flip ? 'l' : 'b'}"/><c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="low"/><c:spPr><a:ln w="9525">${fill('BFB6A6')}</a:ln></c:spPr>${small}<c:crossAx val="1002"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx><c:valAx><c:axId val="1002"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="${flip ? 'b' : 'l'}"/><c:majorGridlines><c:spPr><a:ln w="6350">${fill('E7E0D2')}</a:ln></c:spPr></c:majorGridlines><c:numFmt formatCode="#,##0" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:spPr><a:ln><a:noFill/></a:ln></c:spPr>${small}<c:crossAx val="1001"/><c:crosses val="${flip ? 'max' : 'autoZero'}"/><c:crossBetween val="between"/></c:valAx>`;
  const legend = round || ch.series.length > 1 ? `<c:legend><c:legendPos val="${round ? 'r' : 'b'}"/><c:overlay val="0"/>${small}</c:legend>` : '';
  return `${XML}<c:chartSpace xmlns:c="${NS}/drawingml/2006/chart" xmlns:a="${NS}/drawingml/2006/main" xmlns:r="${REL}"><c:roundedCorners val="0"/><c:chart><c:title>${tx(ch.title, 1300)}<c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/><c:plotArea><c:layout/>${plot}${axes}</c:plotArea>${legend}<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart><c:spPr>${fill('FFFFFF')}<a:ln w="9525">${fill('E2D8C3')}</a:ln></c:spPr></c:chartSpace>`;
}

const anchor = ([col, row, w, h], n) => `<xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>${col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>${col + w}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row + h}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${n + 2}" name="Диаграмма ${n + 1}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="${NS}/drawingml/2006/chart"><c:chart xmlns:c="${NS}/drawingml/2006/chart" r:id="rId${n + 1}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`;

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

// sheets: [{ name, cols, rows, freeze?, filter?, charts? }] → байты файла
export function buildXlsx(sheets) {
  const files = [], types = [];
  const CT = 'application/vnd.openxmlformats-officedocument.';
  const add = (path, text, type) => { files.push([path, text]); if (type) types.push(`<Override PartName="/${path}" ContentType="${CT}${type}+xml"/>`); };
  let chartNo = 0, drawNo = 0;
  sheets.forEach((sh, i) => {
    const charts = sh.charts ?? [];
    add(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(sh, charts.length > 0, i === 0), 'spreadsheetml.worksheet');
    if (!charts.length) return;
    const d = ++drawNo, targets = [];
    add(`xl/worksheets/_rels/sheet${i + 1}.xml.rels`, rels([['drawing', `../drawings/drawing${d}.xml`]]));
    for (const ch of charts) { const k = ++chartNo; add(`xl/charts/chart${k}.xml`, chartXml(sh, ch), 'drawingml.chart'); targets.push(['chart', `../charts/chart${k}.xml`]); }
    add(`xl/drawings/drawing${d}.xml`, `${XML}<xdr:wsDr xmlns:xdr="${NS}/drawingml/2006/spreadsheetDrawing" xmlns:a="${NS}/drawingml/2006/main" xmlns:r="${REL}">${charts.map((ch, n) => anchor(ch.at, n)).join('')}</xdr:wsDr>`, 'drawing');
    add(`xl/drawings/_rels/drawing${d}.xml.rels`, rels(targets));
  });
  const filters = sheets.map((s, i) => (s.filter ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${esc(s.name)}'!${s.filter.replace(/([A-Z]+)(\d+)/g, '$$$1$$$2')}</definedName>` : '')).join('');
  add('xl/workbook.xml', `${XML}<workbook xmlns="${NS}/spreadsheetml/2006/main" xmlns:r="${REL}"><bookViews><workbookView/></bookViews><sheets>${sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>${filters ? `<definedNames>${filters}</definedNames>` : ''}</workbook>`, 'spreadsheetml.sheet.main');
  add('xl/styles.xml', styles(), 'spreadsheetml.styles');
  add('xl/_rels/workbook.xml.rels', rels([...sheets.map((_, i) => ['worksheet', `worksheets/sheet${i + 1}.xml`]), ['styles', 'styles.xml']]));
  add('_rels/.rels', rels([['officeDocument', 'xl/workbook.xml']]));
  files.unshift(['[Content_Types].xml', `${XML}<Types xmlns="${NS}/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${types.join('')}</Types>`]);
  return zip(files);
}
