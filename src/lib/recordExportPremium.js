import { RECORD_EXPORT_FORMATS, exportRecordDocument as legacyExport } from './recordExport.js'

const encoder = new TextEncoder()

function text(value) {
  if (value === null || value === undefined) return ''
  if (Array.isArray(value)) return value.map((item) => text(item)).filter(Boolean).join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function xml(value) {
  return text(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function safeFileName(value) {
  return text(value || 'hi5central-export')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120) || 'hi5central-export'
}

function theme() {
  const shell = document.querySelector('.app-shell')
  const styles = shell ? getComputedStyle(shell) : getComputedStyle(document.documentElement)
  const raw = styles.getPropertyValue('--accent-rgb').trim() || '244, 177, 61'
  const rgb = raw.split(',').map((part) => Math.max(0, Math.min(255, Number(part.trim()) || 0))).slice(0, 3)
  while (rgb.length < 3) rgb.push(0)
  return {
    rgb,
    accentHex: rgb.map((value) => value.toString(16).padStart(2, '0')).join('').toUpperCase(),
    host: window.location.hostname,
  }
}

function normaliseSections(model) {
  return (Array.isArray(model.sections) ? model.sections : []).map((section, index) => ({
    title: section.title || `Section ${index + 1}`,
    type: section.type || (section.columns ? 'table' : 'fields'),
    columns: Array.isArray(section.columns) ? section.columns.map(text) : [],
    rows: Array.isArray(section.rows) ? section.rows.map((row) => Array.isArray(row) ? row.map(text) : [text(row)]) : [],
  }))
}

function saveBlob(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function crc32(bytes) {
  let crc = 0xFFFFFFFF
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xEDB88320 : 0)
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function u16(value) {
  const bytes = new Uint8Array(2)
  new DataView(bytes.buffer).setUint16(0, value, true)
  return bytes
}

function u32(value) {
  const bytes = new Uint8Array(4)
  new DataView(bytes.buffer).setUint32(0, value >>> 0, true)
  return bytes
}

function concat(parts) {
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let offset = 0
  for (const part of parts) {
    output.set(part, offset)
    offset += part.length
  }
  return output
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear())
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    day: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  }
}

function zipStore(files) {
  const localParts = []
  const centralParts = []
  let localOffset = 0
  const stamp = dosDateTime()

  for (const file of files) {
    const name = encoder.encode(file.name)
    const data = file.data instanceof Uint8Array ? file.data : encoder.encode(String(file.data ?? ''))
    const crc = crc32(data)
    const local = concat([
      u32(0x04034B50), u16(20), u16(0x0800), u16(0), u16(stamp.time), u16(stamp.day),
      u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), name, data,
    ])
    localParts.push(local)
    centralParts.push(concat([
      u32(0x02014B50), u16(20), u16(20), u16(0x0800), u16(0), u16(stamp.time), u16(stamp.day),
      u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0),
      u32(0), u32(localOffset), name,
    ]))
    localOffset += local.length
  }

  const central = concat(centralParts)
  return concat([...localParts, central, concat([
    u32(0x06054B50), u16(0), u16(0), u16(files.length), u16(files.length),
    u32(central.length), u32(localOffset), u16(0),
  ])])
}

function docxRun(value, options = {}) {
  const props = [
    options.bold ? '<w:b/>' : '',
    options.color ? `<w:color w:val="${options.color}"/>` : '',
    options.size ? `<w:sz w:val="${options.size}"/>` : '',
  ].join('')
  return `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ''}<w:t xml:space="preserve">${xml(value)}</w:t></w:r>`
}

function docxParagraph(value, options = {}) {
  const pPr = [
    options.before || options.after ? `<w:spacing w:before="${options.before || 0}" w:after="${options.after || 0}"/>` : '',
    options.borderBottom ? `<w:pBdr><w:bottom w:val="single" w:sz="${options.borderSize || 16}" w:space="7" w:color="${options.borderBottom}"/></w:pBdr>` : '',
    options.shading ? `<w:shd w:fill="${options.shading}"/>` : '',
  ].join('')
  return `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ''}${docxRun(value, options)}</w:p>`
}

function docxTable(columns, rows, accentHex, fields = false) {
  const width = Math.floor(9000 / Math.max(1, columns.length))
  const grid = columns.map(() => `<w:gridCol w:w="${width}"/>`).join('')
  const header = `<w:tr>${columns.map((column) => `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/><w:shd w:fill="${accentHex}"/><w:tcMar><w:top w:w="90" w:type="dxa"/><w:bottom w:w="90" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tcMar></w:tcPr><w:p>${docxRun(column, { bold: true, color: 'FFFFFF', size: 19 })}</w:p></w:tc>`).join('')}</w:tr>`
  const body = rows.map((row, rowIndex) => `<w:tr>${columns.map((_, index) => {
    const shade = fields && index === 0 ? 'F2F5F9' : rowIndex % 2 ? 'FAFBFD' : 'FFFFFF'
    return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/><w:shd w:fill="${shade}"/><w:tcMar><w:top w:w="82" w:type="dxa"/><w:bottom w:w="82" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tcMar></w:tcPr><w:p>${docxRun(row[index] ?? '', { bold: fields && index === 0, color: fields && index === 0 ? '20314D' : '344054', size: 18 })}</w:p></w:tc>`
  }).join('')}</w:tr>`).join('')
  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="D8E1EE"/><w:left w:val="single" w:sz="4" w:color="D8E1EE"/><w:bottom w:val="single" w:sz="4" w:color="D8E1EE"/><w:right w:val="single" w:sz="4" w:color="D8E1EE"/><w:insideH w:val="single" w:sz="4" w:color="E5EAF1"/><w:insideV w:val="single" w:sz="4" w:color="E5EAF1"/></w:tblBorders></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${header}${body}</w:tbl>`
}

function buildPremiumDocx(model) {
  const { accentHex, host } = theme()
  const sections = normaliseSections(model)
  const generated = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())
  const body = [
    `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/></w:tblPr><w:tblGrid><w:gridCol w:w="9000"/></w:tblGrid><w:tr><w:tc><w:tcPr><w:shd w:fill="10213F"/><w:tcMar><w:top w:w="180" w:type="dxa"/><w:bottom w:w="180" w:type="dxa"/><w:left w:w="220" w:type="dxa"/><w:right w:w="220" w:type="dxa"/></w:tcMar></w:tcPr><w:p>${docxRun('Hi5Central', { bold: true, color: 'FFFFFF', size: 28 })}${docxRun('   SERVICE MANAGEMENT EXPORT', { bold: true, color: accentHex, size: 18 })}</w:p></w:tc></w:tr></w:tbl>`,
    docxParagraph(model.title || 'Hi5Central export', { bold: true, color: '10213F', size: 36, before: 260, after: 80 }),
    docxParagraph(model.subtitle || 'Service management data export', { color: '667085', size: 20, after: 80 }),
    docxParagraph(`Generated ${generated} · ${host}`, { color: '8A94A6', size: 17, borderBottom: accentHex, borderSize: 18, after: 180 }),
  ]

  for (const section of sections) {
    body.push(docxParagraph(section.title, { bold: true, color: '10213F', size: 25, before: 180, after: 80, shading: 'F6F8FB', borderBottom: accentHex, borderSize: 10 }))
    if (section.type === 'fields') body.push(docxTable(['Field', 'Value'], section.rows, accentHex, true))
    else body.push(docxTable(section.columns.length ? section.columns : ['Value'], section.rows, accentHex, false))
  }
  body.push(docxParagraph('Hi5Central · Service management export', { color: '8A94A6', size: 16, before: 220 }))

  const created = new Date().toISOString()
  const files = [
    { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>` },
    { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>` },
    { name: 'word/_rels/document.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>` },
    { name: 'word/document.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1000" w:right="1000" w:bottom="1000" w:left="1000"/></w:sectPr></w:body></w:document>` },
    { name: 'docProps/core.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(model.title)}</dc:title><dc:creator>Hi5Central</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${created}</dcterms:created></cp:coreProperties>` },
    { name: 'docProps/app.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Hi5Central</Application></Properties>` },
  ]
  return new Blob([zipStore(files)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
}

function ascii(value) {
  return text(value).normalize('NFKD').replace(/[^\x20-\x7E]/g, '?')
}

function pdfEscape(value) {
  return ascii(value).replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)')
}

function wrapPdf(value, max = 82) {
  const words = ascii(value).split(/\s+/).filter(Boolean)
  const lines = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length > max && current) {
      lines.push(current)
      current = word
    } else current = next
  }
  if (current) lines.push(current)
  return lines.length ? lines : ['']
}

function flattenPdf(model) {
  const items = []
  for (const section of normaliseSections(model)) {
    items.push({ kind: 'section', text: section.title })
    if (section.type === 'fields') {
      for (const row of section.rows) items.push({ kind: 'field', label: row[0], text: row[1] })
    } else {
      if (section.columns.length) items.push({ kind: 'header', text: section.columns.join('   •   ') })
      for (const row of section.rows) items.push({ kind: 'row', text: row.join('   |   ') })
    }
  }
  return items
}

function pdfPage(model, items, pageNumber, pageCount, rgb, host) {
  const [r, g, b] = rgb.map((value) => (value / 255).toFixed(3))
  const tr = rgb.map((value) => ((240 + value * .06) / 255).toFixed(3))
  const generated = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())
  const commands = [
    'q 0.063 0.129 0.247 rg 0 782 595 60 re f Q',
    `q ${r} ${g} ${b} rg 0 778 595 4 re f Q`,
    'BT /F2 11 Tf 1 1 1 rg 40 820 Td (Hi5Central) Tj ET',
    `BT /F2 18 Tf 1 1 1 rg 40 797 Td (${pdfEscape(model.title || 'Service management export')}) Tj ET`,
    `BT /F1 8 Tf 0.80 0.84 0.90 rg 385 818 Td (${pdfEscape(host)}) Tj ET`,
    `BT /F1 8 Tf 0.80 0.84 0.90 rg 385 803 Td (${pdfEscape(`Generated ${generated}`)}) Tj ET`,
  ]
  if (model.subtitle) commands.push(`BT /F1 9 Tf 0.34 0.40 0.50 rg 40 760 Td (${pdfEscape(model.subtitle)}) Tj ET`)
  let y = model.subtitle ? 732 : 748

  for (const item of items) {
    if (y < 62) break
    if (item.kind === 'section') {
      y -= 6
      commands.push(`q ${tr[0]} ${tr[1]} ${tr[2]} rg 36 ${y - 4} 523 25 re f Q`)
      commands.push(`q ${r} ${g} ${b} rg 36 ${y - 4} 4 25 re f Q`)
      commands.push(`BT /F2 11 Tf 0.063 0.129 0.247 rg 49 ${y + 5} Td (${pdfEscape(item.text)}) Tj ET`)
      y -= 31
      continue
    }
    if (item.kind === 'header') {
      commands.push(`q ${r} ${g} ${b} rg 40 ${y - 5} 515 22 re f Q`)
      commands.push(`BT /F2 8 Tf 1 1 1 rg 47 ${y + 2} Td (${pdfEscape(item.text)}) Tj ET`)
      y -= 27
      continue
    }
    if (item.kind === 'field') {
      commands.push(`BT /F2 7 Tf ${r} ${g} ${b} rg 44 ${y} Td (${pdfEscape(String(item.label).toUpperCase())}) Tj ET`)
      y -= 12
      for (const line of wrapPdf(item.text, 88)) {
        commands.push(`BT /F1 9 Tf 0.12 0.18 0.28 rg 44 ${y} Td (${pdfEscape(line)}) Tj ET`)
        y -= 13
      }
      commands.push('q 0.88 0.90 0.94 RG 44 ' + `${y + 5} 506 0 re S Q`)
      y -= 5
      continue
    }
    const lines = wrapPdf(item.text, 104)
    commands.push(`q 0.93 0.95 0.98 rg 40 ${y - (lines.length * 12) - 3} 515 ${(lines.length * 12) + 10} re f Q`)
    for (const line of lines) {
      commands.push(`BT /F1 8 Tf 0.18 0.23 0.32 rg 47 ${y} Td (${pdfEscape(line)}) Tj ET`)
      y -= 12
    }
    y -= 7
  }

  commands.push(`q ${r} ${g} ${b} rg 40 38 515 1.5 re f Q`)
  commands.push(`BT /F1 8 Tf 0.42 0.47 0.55 rg 40 22 Td (${pdfEscape(`Hi5Central service management export · Page ${pageNumber} of ${pageCount}`)}) Tj ET`)
  return commands.join('\n')
}

function buildPremiumPdf(model) {
  const { rgb, host } = theme()
  const all = flattenPdf(model)
  const pages = []
  const budget = 30
  for (let index = 0; index < all.length; index += budget) pages.push(all.slice(index, index + budget))
  if (!pages.length) pages.push([{ kind: 'row', text: 'No data.' }])

  const objects = []
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>'
  objects[2] = `<< /Type /Pages /Kids [${pages.map((_, index) => `${5 + index * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'
  pages.forEach((page, index) => {
    const pageObject = 5 + index * 2
    const contentObject = pageObject + 1
    const content = pdfPage(model, page, index + 1, pages.length, rgb, host)
    objects[pageObject] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObject} 0 R >>`
    objects[contentObject] = `<< /Length ${encoder.encode(content).length} >>\nstream\n${content}\nendstream`
  })

  const chunks = ['%PDF-1.4\n%Hi5Central Premium Export\n']
  const offsets = [0]
  let byteOffset = encoder.encode(chunks[0]).length
  for (let index = 1; index < objects.length; index += 1) {
    offsets[index] = byteOffset
    const chunk = `${index} 0 obj\n${objects[index]}\nendobj\n`
    chunks.push(chunk)
    byteOffset += encoder.encode(chunk).length
  }
  const xrefOffset = byteOffset
  let xref = `xref\n0 ${objects.length}\n0000000000 65535 f \n`
  for (let index = 1; index < objects.length; index += 1) xref += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`
  xref += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  chunks.push(xref)
  return new Blob(chunks, { type: 'application/pdf' })
}

export { RECORD_EXPORT_FORMATS }

export async function exportRecordDocument(model, format, baseName) {
  const safeBase = safeFileName(baseName || model.title)
  if (format === 'pdf') {
    saveBlob(buildPremiumPdf(model), `${safeBase}.pdf`)
    return
  }
  if (format === 'docx') {
    saveBlob(buildPremiumDocx(model), `${safeBase}.docx`)
    return
  }
  return legacyExport(model, format, baseName)
}
