import * as XLSX from 'xlsx'

// ─── SAP Excel Parser ─────────────────────────────────────────────────────────
// Expected columns: A=SAP SKU | B=Generic ID | C=SAP Prix Generic | D=SAP Prix SKU
export function parseSAPExcel(arrayBuffer) {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 })
  if (!rows.length) throw new Error('Fichier SAP vide.')
  const data = []
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    if (!r || (!r[0] && !r[1])) continue
    const skuId        = String(r[0] ?? '').trim()
    const genericId    = String(r[1] ?? '').trim()
    const priceGeneric = parseFloat(String(r[2] ?? '').replace(',', '.')) || null
    const priceSku     = parseFloat(String(r[3] ?? '').replace(',', '.')) || null
    if (skuId) data.push({ skuId, genericId, priceGeneric, priceSku })
  }
  return data
}

// ─── SFCC XML Parser ──────────────────────────────────────────────────────────
// Parses standard Demandware pricebook: <price-table product-id="..."><amount>...</amount>
export function parseSFCCXml(xmlText) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlText, 'text/xml')
  const prices = {}
  doc.querySelectorAll('price-table').forEach((table) => {
    const productId = (table.getAttribute('product-id') || '').trim()
    const amountEl  = table.querySelector('amount')
    if (!productId || !amountEl) return
    const price = parseFloat(amountEl.textContent.trim().replace(',', '.'))
    if (!isNaN(price)) prices[productId] = price
  })
  return prices
}

// ─── Check engine ─────────────────────────────────────────────────────────────
const EPS = 0.01
const eq  = (a, b) => a !== null && b !== null && Math.abs(a - b) < EPS

export function runChecks(sapData, sfccPrices) {
  return sapData.map((row) => {
    const sfccAtSku     = sfccPrices[row.skuId]    ?? null
    const sfccAtGeneric = sfccPrices[row.genericId] ?? null

    // Check 1 — price exists in SFCC at any level
    const check1 = sfccAtSku !== null || sfccAtGeneric !== null

    // Check 2 — aligned if ANY of the 4 cross-level combinations match:
    //   SFCC@SKU = SAP Prix SKU
    //   SFCC@SKU = SAP Prix Generic
    //   SFCC@Generic = SAP Prix SKU
    //   SFCC@Generic = SAP Prix Generic
    let check2 = null
    let matchDetail = null

    if (check1) {
      const hasSap = row.priceSku !== null || row.priceGeneric !== null
      if (hasSap) {
        if      (eq(sfccAtSku,     row.priceSku))     { check2 = true;  matchDetail = 'SKU↔SKU' }
        else if (eq(sfccAtSku,     row.priceGeneric)) { check2 = true;  matchDetail = 'SKU↔Generic' }
        else if (eq(sfccAtGeneric, row.priceSku))     { check2 = true;  matchDetail = 'Generic↔SKU' }
        else if (eq(sfccAtGeneric, row.priceGeneric)) { check2 = true;  matchDetail = 'Generic↔Generic' }
        else                                           { check2 = false }
      }
    }

    let delta = null
    if (check2 === false) {
      const sapRef   = row.priceSku ?? row.priceGeneric
      const sfccBest = sfccAtSku ?? sfccAtGeneric
      delta = sfccBest !== null && sapRef !== null ? sfccBest - sapRef : null
    }

    return { ...row, sfccAtSku, sfccAtGeneric, check1, check2, matchDetail, delta }
  })
}

// ─── Export helpers ───────────────────────────────────────────────────────────
export const fmtPrice = (v) =>
  v !== null && v !== undefined ? Number(v).toFixed(2) : ''

function toExportRows(rows) {
  return rows.map((r) => ({
    'SAP SKU':              r.skuId,
    'Generic ID':           r.genericId,
    'SAP Prix Generic':     r.priceGeneric  !== null ? r.priceGeneric  : '',
    'SAP Prix SKU':         r.priceSku      !== null ? r.priceSku      : '',
    'SFCC Prix @ SKU':      r.sfccAtSku     !== null ? r.sfccAtSku     : '',
    'SFCC Prix @ Generic':  r.sfccAtGeneric !== null ? r.sfccAtGeneric : '',
    'Match niveau':         r.matchDetail   ?? '',
    'Check 1 Couverture':   r.check1        ? 'OK' : 'MANQUANT',
    'Check 2 Alignement':   r.check2 === null ? 'N/A' : r.check2 ? 'OK' : 'ECART',
    'Delta SFCC-SAP':       r.delta !== null ? r.delta.toFixed(2) : '',
  }))
}

export function exportXLSX(rows, label) {
  const data = toExportRows(rows)
  const ws   = XLSX.utils.json_to_sheet(data)
  ws['!cols'] = Object.keys(data[0]).map(() => ({ wch: 22 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Price Check')
  XLSX.writeFile(wb, `chloe_price_check_${label}_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

export function exportCSV(rows, label) {
  const data    = toExportRows(rows)
  const headers = Object.keys(data[0])
  const escape  = (v) => `"${String(v).replace(/"/g, '""')}"`
  const lines   = [headers.map(escape).join(',')]
  data.forEach((r) => lines.push(headers.map((h) => escape(r[h])).join(',')))
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement('a'), {
    href: url,
    download: `chloe_price_check_${label}_${new Date().toISOString().slice(0, 10)}.csv`,
  })
  a.click()
  URL.revokeObjectURL(url)
}
