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
  const styles = getComputedStyle(document.documentElement)
  const raw = styles.getPropertyValue('--accent-rgb').trim() || '244, 177, 61'
  const rgb = raw.split(',').map((part) => Math.max(0, Math.min(255, Number(part.trim()) || 0))).slice(0, 3)
  while (rgb.length < 3) rgb.push(0)
  const accentHex = rgb.map((value) => value.toString(16).padStart(2, '0')).join('').toUpperCase()
  return {
    rgb,
    accentHex,
    brand: document.documentElement.dataset.workspaceBrand || 'Hi5Central',
    host: window.location.hostname,
  }
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
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const output = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    output.set(part, offset)
    offset += part.length
  }
  return output
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear())
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2)
  const day = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  return { time, day }
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

    const central = concat([
      u32(0x02014B50), u16(20), u16(20), u16(0x0800), u16(0), u16(stamp.time), u16(stamp.day),
      u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0),
      u32(0), u32(localOffset), name,
    ])
    centralParts.push(central)
    localOffset += local.length
  }

  const central = concat(centralParts)
  const end = concat([
    u32(0x06054B50), u16(0), u16(0), u16(files.length), u16(files.length),
    u32(central.length), u32(localOffset), u16(0),
  ])
  return concat([...localParts, central, end])
}

function normaliseSections(documentModel) {
  const sections = Array.isArray(documentModel.sections) ? documentModel.sections : []
  return sections.map((section, index) => ({
    title: section.title || `Section ${index + 1}`,
    type: section.type || (section.columns ? 'table' : 'fields'),
    columns: Array.isArray(section.columns) ? section.columns.map(text) : [],
    rows: Array.isArray(section.rows) ? section.rows.map((row) => Array.isArray(row) ? row.map(text) : [text(row)]) : [],
  }))
}

function csvCell(value) {
  const valueText = text(value)
  return /[",\r\n]/.test(valueText) ? `"${valueText.replaceAll('"', '""')}"` : valueText
}

function buildCsv(documentModel) {
  const lines = []
  const sections = normaliseSections(documentModel)
  lines.push([documentModel.title || 'Hi5Central export'].map(csvCell).join(','))
  if (documentModel.subtitle) lines.push([documentModel.subtitle].map(csvCell).join(','))
  lines.push([])
  for (const section of sections) {
    lines.push([section.title].map(csvCell).join(','))
    if (section.type === 'fields') {
      lines.push('Field,Value')
      for (const row of section.rows) lines.push([row[0], row[1]].map(csvCell).join(','))
    } else {
      if (section.columns.length) lines.push(section.columns.map(csvCell).join(','))
      for (const row of section.rows) lines.push(row.map(csvCell).join(','))
    }
    lines.push([])
  }
  return `\uFEFF${lines.join('\r\n')}`
}

function columnName(index) {
  let value = index + 1
  let name = ''
  while (value > 0) {
    const remainder = (value - 1) % 26
    name = String.fromCharCode(65 + remainder) + name
    value = Math.floor((value - 1) / 26)
  }
  return name
}

function sheetName(value, used) {
  let name = text(value || 'Sheet').replace(/[\\/*?:\[\]]/g, ' ').trim().slice(0, 31) || 'Sheet'
  const base = name
  let index = 2
  while (used.has(name)) {
    const suffix = ` ${index}`
    name = `${base.slice(0, 31 - suffix.length)}${suffix}`
    index += 1
  }
  used.add(name)
  return name
}

function xlsxCell(ref, value, style = 0) {
  return `<c r="${ref}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${xml(value)}</t></is></c>`
}

function xlsxSheetXml(documentModel, section) {
  const rows = []
  const maxCols = Math.max(2, section.columns.length || 2, ...section.rows.map((row) => row.length))
  let rowIndex = 1
  rows.push(`<row r="${rowIndex}" ht="25" customHeight="1">${xlsxCell(`A${rowIndex}`, documentModel.title || 'Hi5Central export', 2)}</row>`)
  rowIndex += 1
  rows.push(`<row r="${rowIndex}">${xlsxCell(`A${rowIndex}`, section.title, 3)}</row>`)
  rowIndex += 1
  if (documentModel.subtitle) {
    rows.push(`<row r="${rowIndex}">${xlsxCell(`A${rowIndex}`, documentModel.subtitle, 4)}</row>`)
    rowIndex += 1
  }
  rowIndex += 1

  if (section.type === 'fields') {
    rows.push(`<row r="${rowIndex}">${xlsxCell(`A${rowIndex}`, 'Field', 1)}${xlsxCell(`B${rowIndex}`, 'Value', 1)}</row>`)
    rowIndex += 1
    for (const row of section.rows) {
      rows.push(`<row r="${rowIndex}">${xlsxCell(`A${rowIndex}`, row[0], 5)}${xlsxCell(`B${rowIndex}`, row[1], 0)}</row>`)
      rowIndex += 1
    }
  } else {
    if (section.columns.length) {
      rows.push(`<row r="${rowIndex}">${section.columns.map((value, col) => xlsxCell(`${columnName(col)}${rowIndex}`, value, 1)).join('')}</row>`)
      rowIndex += 1
    }
    for (const row of section.rows) {
      rows.push(`<row r="${rowIndex}">${row.map((value, col) => xlsxCell(`${columnName(col)}${rowIndex}`, value, 0)).join('')}</row>`)
      rowIndex += 1
    }
  }

  const columns = Array.from({ length: maxCols }, (_, index) => `<col min="${index + 1}" max="${index + 1}" width="${index === 0 ? 22 : 26}" customWidth="1"/>`).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${columns}</cols><sheetData>${rows.join('')}</sheetData></worksheet>`
}

function buildXlsx(documentModel) {
  const { accentHex } = theme()
  const sections = normaliseSections(documentModel)
  const safeSections = sections.length ? sections : [{ title: 'Export', type: 'fields', rows: [['Status', 'No data']] }]
  const used = new Set()
  const names = safeSections.map((section) => sheetName(section.title, used))
  const files = []

  files.push({ name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${safeSections.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>` })
  files.push({ name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>` })
  files.push({ name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((name, index) => `<sheet name="${xml(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('')}</sheets></workbook>` })
  files.push({ name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${safeSections.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('')}<Relationship Id="rId${safeSections.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` })
  files.push({ name: 'xl/styles.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="5"><font><sz val="10"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="Aptos"/></font><font><b/><color rgb="FF${accentHex}"/><sz val="16"/><name val="Aptos Display"/></font><font><b/><color rgb="FF1B2C47"/><sz val="11"/><name val="Aptos"/></font><font><i/><color rgb="FF667085"/><sz val="9"/><name val="Aptos"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF${accentHex}"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF5F8FC"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border/><border><left style="thin"><color rgb="FFD7E0EA"/></left><right style="thin"><color rgb="FFD7E0EA"/></right><top style="thin"><color rgb="FFD7E0EA"/></top><bottom style="thin"><color rgb="FFD7E0EA"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs></styleSheet>` })
  safeSections.forEach((section, index) => files.push({ name: `xl/worksheets/sheet${index + 1}.xml`, data: xlsxSheetXml(documentModel, section) }))
  const created = new Date().toISOString()
  files.push({ name: 'docProps/core.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(documentModel.title)}</dc:title><dc:creator>Hi5Central</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${created}</dcterms:created></cp:coreProperties>` })
  files.push({ name: 'docProps/app.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Hi5Central</Application></Properties>` })
  return zipStore(files)
}

function docxParagraph(value, style = '') {
  const styleXml = style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ''
  return `<w:p>${styleXml}<w:r><w:t xml:space="preserve">${xml(value)}</w:t></w:r></w:p>`
}

function docxTable(columns, rows, accentHex) {
  const width = Math.floor(9000 / Math.max(1, columns.length))
  const grid = columns.map(() => `<w:gridCol w:w="${width}"/>`).join('')
  const header = `<w:tr>${columns.map((column) => `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/><w:shd w:fill="${accentHex}"/></w:tcPr><w:p><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/></w:rPr><w:t>${xml(column)}</w:t></w:r></w:p></w:tc>`).join('')}</w:tr>`
  const body = rows.map((row) => `<w:tr>${columns.map((_, index) => `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/></w:tcPr><w:p><w:r><w:t xml:space="preserve">${xml(row[index] ?? '')}</w:t></w:r></w:p></w:tc>`).join('')}</w:tr>`).join('')
  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="D7E0EA"/><w:left w:val="single" w:sz="4" w:color="D7E0EA"/><w:bottom w:val="single" w:sz="4" w:color="D7E0EA"/><w:right w:val="single" w:sz="4" w:color="D7E0EA"/><w:insideH w:val="single" w:sz="4" w:color="D7E0EA"/><w:insideV w:val="single" w:sz="4" w:color="D7E0EA"/></w:tblBorders></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${header}${body}</w:tbl>`
}

function buildDocx(documentModel) {
  const { accentHex, host } = theme()
  const sections = normaliseSections(documentModel)
  const body = [
    docxParagraph(documentModel.title || 'Hi5Central export', 'Title'),
    docxParagraph(documentModel.subtitle || `Exported from ${host}`, 'Subtitle'),
  ]
  for (const section of sections) {
    body.push(docxParagraph(section.title, 'Heading1'))
    if (section.type === 'fields') body.push(docxTable(['Field', 'Value'], section.rows, accentHex))
    else body.push(docxTable(section.columns.length ? section.columns : ['Value'], section.rows, accentHex))
    body.push(docxParagraph(''))
  }
  const created = new Date().toISOString()
  const files = [
    { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>` },
    { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>` },
    { name: 'word/_rels/document.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>` },
    { name: 'word/styles.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos"/><w:sz w:val="20"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:color w:val="${accentHex}"/><w:sz w:val="34"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:rPr><w:color w:val="667085"/><w:sz w:val="18"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="Heading 1"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:color w:val="1B2C47"/><w:sz w:val="26"/></w:rPr></w:style></w:styles>` },
    { name: 'word/document.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>` },
    { name: 'docProps/core.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(documentModel.title)}</dc:title><dc:creator>Hi5Central</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${created}</dcterms:created></cp:coreProperties>` },
    { name: 'docProps/app.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Hi5Central</Application></Properties>` },
  ]
  return zipStore(files)
}

function ascii(value) {
  return text(value).normalize('NFKD').replace(/[^\x20-\x7E]/g, '?')
}

function pdfEscape(value) {
  return ascii(value).replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)')
}

function wrapPdf(value, max = 86) {
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

function pdfContentPage(documentModel, lines, pageNumber, pageCount, rgb) {
  const [r, g, b] = rgb.map((value) => (value / 255).toFixed(3))
  const commands = [`q ${r} ${g} ${b} rg 0 790 595 52 re f Q`, 'BT', '/F2 18 Tf', '1 1 1 rg', `42 812 Td (${pdfEscape(documentModel.title || 'Hi5Central export')}) Tj`, 'ET']
  let y = 765
  for (const item of lines) {
    if (item.kind === 'heading') {
      y -= 7
      commands.push('BT', '/F2 12 Tf', `${r} ${g} ${b} rg`, `42 ${y} Td (${pdfEscape(item.text)}) Tj`, 'ET')
      y -= 20
      continue
    }
    const font = item.kind === 'label' ? '/F2 9 Tf' : '/F1 9 Tf'
    const colour = item.kind === 'label' ? '0.10 0.18 0.30 rg' : '0.22 0.28 0.38 rg'
    for (const wrapped of wrapPdf(item.text, item.kind === 'table' ? 95 : 86)) {
      commands.push('BT', font, colour, `42 ${y} Td (${pdfEscape(wrapped)}) Tj`, 'ET')
      y -= 14
    }
  }
  commands.push('BT', '/F1 8 Tf', '0.45 0.49 0.56 rg', `42 24 Td (Generated by Hi5Central - Page ${pageNumber} of ${pageCount}) Tj`, 'ET')
  return commands.join('\n')
}

function buildPdf(documentModel) {
  const { rgb } = theme()
  const flat = []
  for (const section of normaliseSections(documentModel)) {
    flat.push({ kind: 'heading', text: section.title })
    if (section.type === 'fields') {
      for (const row of section.rows) {
        flat.push({ kind: 'label', text: row[0] })
        flat.push({ kind: 'value', text: row[1] })
      }
    } else {
      if (section.columns.length) flat.push({ kind: 'label', text: section.columns.join(' | ') })
      for (const row of section.rows) flat.push({ kind: 'table', text: row.join(' | ') })
    }
  }
  const pageSize = 42
  const pages = []
  for (let i = 0; i < flat.length; i += pageSize) pages.push(flat.slice(i, i + pageSize))
  if (!pages.length) pages.push([{ kind: 'value', text: 'No data.' }])

  const objects = []
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>'
  const pageRefs = pages.map((_, index) => `${5 + index * 2} 0 R`)
  objects[2] = `<< /Type /Pages /Kids [${pageRefs.join(' ')}] /Count ${pages.length} >>`
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'
  pages.forEach((page, index) => {
    const pageObject = 5 + index * 2
    const contentObject = pageObject + 1
    const content = pdfContentPage(documentModel, page, index + 1, pages.length, rgb)
    objects[pageObject] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObject} 0 R >>`
    objects[contentObject] = `<< /Length ${encoder.encode(content).length} >>\nstream\n${content}\nendstream`
  })

  const chunks = ['%PDF-1.4\n%Hi5Central\n']
  const offsets = [0]
  let byteOffset = encoder.encode(chunks[0]).length
  for (let i = 1; i < objects.length; i += 1) {
    offsets[i] = byteOffset
    const chunk = `${i} 0 obj\n${objects[i]}\nendobj\n`
    chunks.push(chunk)
    byteOffset += encoder.encode(chunk).length
  }
  const xrefOffset = byteOffset
  let xref = `xref\n0 ${objects.length}\n0000000000 65535 f \n`
  for (let i = 1; i < objects.length; i += 1) xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  xref += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  chunks.push(xref)
  return new Blob(chunks, { type: 'application/pdf' })
}

export const RECORD_EXPORT_FORMATS = [
  { id: 'pdf', label: 'PDF', description: 'Styled document' },
  { id: 'xlsx', label: 'XLSX', description: 'Excel workbook' },
  { id: 'csv', label: 'CSV', description: 'Comma-separated data' },
  { id: 'docx', label: 'DOCX', description: 'Word document' },
]

export async function exportRecordDocument(documentModel, format, baseName) {
  const safeBase = safeFileName(baseName || documentModel.title)
  if (format === 'csv') {
    saveBlob(new Blob([buildCsv(documentModel)], { type: 'text/csv;charset=utf-8' }), `${safeBase}.csv`)
    return
  }
  if (format === 'xlsx') {
    saveBlob(new Blob([buildXlsx(documentModel)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${safeBase}.xlsx`)
    return
  }
  if (format === 'docx') {
    saveBlob(new Blob([buildDocx(documentModel)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), `${safeBase}.docx`)
    return
  }
  if (format === 'pdf') {
    saveBlob(buildPdf(documentModel), `${safeBase}.pdf`)
    return
  }
  throw new Error(`Unsupported export format: ${format}`)
}
