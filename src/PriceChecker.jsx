import { useState, useCallback } from 'react'
import { parseSAPExcel, parseSFCCXml, runChecks, fmtPrice, exportXLSX, exportCSV } from './utils.js'
import styles from './PriceChecker.module.css'

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue} style={{ color }}>{value}</div>
      {sub && <div className={styles.statSub}>{sub}</div>}
    </div>
  )
}

function MatchCard({ label, value, color }) {
  return (
    <div className={styles.matchCard}>
      <div className={styles.matchLabel}>{label}</div>
      <div className={styles.matchValue} style={{ color }}>{value}</div>
    </div>
  )
}

function UploadZone({ title, loaded, fileName, count, hint, accept, onChange }) {
  return (
    <div>
      <div className={styles.uploadTitle}>{title}</div>
      <label className={`${styles.uploadCard} ${loaded ? styles.uploadCardLoaded : ''}`}>
        <input type="file" accept={accept} onChange={onChange} style={{ display: 'none' }} />
        <span className={styles.uploadIcon} style={{ opacity: loaded ? 1 : 0.15 }}>
          {accept.includes('xlsx') ? '📊' : '🗂️'}
        </span>
        <div>
          <div className={styles.uploadName} style={{ color: loaded ? '#4CAF7A' : '#444' }}>
            {loaded ? fileName : 'Déposer ou cliquer pour charger'}
          </div>
          <div className={styles.uploadHint} style={{ color: loaded ? '#4CAF7A88' : '#282828' }}>
            {loaded ? count : hint}
          </div>
        </div>
      </label>
    </div>
  )
}

function ExportMenu({ rows, label }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={styles.exportWrap}>
      <button className={styles.exportBtn} onClick={() => setOpen((o) => !o)}>
        ↓ Exporter <span className={styles.exportCount}>({rows.length})</span>
        <span className={styles.exportCaret}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className={styles.exportMenu}>
          {[
            { ext: 'XLSX', icon: '📊', fn: () => { exportXLSX(rows, label); setOpen(false) } },
            { ext: 'CSV',  icon: '📄', fn: () => { exportCSV(rows,  label); setOpen(false) } },
          ].map(({ ext, icon, fn }) => (
            <button key={ext} className={styles.exportMenuItem} onClick={fn}>
              {icon} {ext}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Tag({ children, bg, color }) {
  return <span className={styles.tag} style={{ background: bg, color }}>{children}</span>
}

// ─── Match color helper ───────────────────────────────────────────────────────
const matchColor = (d) =>
  !d ? '#555' : d === 'SKU↔SKU' ? '#5ab0f0' : d === 'Generic↔Generic' ? '#a07de0' : '#C9A97A'

// ─── Main component ───────────────────────────────────────────────────────────
export default function PriceChecker() {
  const [sapData,      setSapData]      = useState(null)
  const [sfccData,     setSfccData]     = useState(null)
  const [sapFileName,  setSapFileName]  = useState('')
  const [sfccFileName, setSfccFileName] = useState('')
  const [results,      setResults]      = useState(null)
  const [filter,       setFilter]       = useState('all')
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  const [search,       setSearch]       = useState('')

  const handleSAPFile = useCallback((e) => {
    const file = e.target.files[0]; if (!file) return
    setSapFileName(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => {
      try { setSapData(parseSAPExcel(ev.target.result)); setError('') }
      catch (err) { setError('Erreur SAP : ' + err.message) }
    }
    reader.readAsArrayBuffer(file)
  }, [])

  const handleSFCCFile = useCallback((e) => {
    const file = e.target.files[0]; if (!file) return
    setSfccFileName(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => {
      try { setSfccData(parseSFCCXml(ev.target.result)); setError('') }
      catch (err) { setError('Erreur SFCC : ' + err.message) }
    }
    reader.readAsText(file)
  }, [])

  const handleAnalyze = () => {
    if (!sapData || !sfccData) { setError('Veuillez charger les deux fichiers.'); return }
    setLoading(true)
    setTimeout(() => {
      try { setResults(runChecks(sapData, sfccData)); setFilter('all'); setSearch(''); setError('') }
      catch (err) { setError('Erreur analyse : ' + err.message) }
      setLoading(false)
    }, 80)
  }

  const handleReset = () => {
    setResults(null); setSapData(null); setSfccData(null)
    setSapFileName(''); setSfccFileName('')
  }

  const stats = results ? {
    total:    results.length,
    covered:  results.filter((r) => r.check1).length,
    missing:  results.filter((r) => !r.check1).length,
    aligned:  results.filter((r) => r.check2 === true).length,
    mismatch: results.filter((r) => r.check2 === false).length,
    na:       results.filter((r) => r.check1 && r.check2 === null).length,
    skuSku:   results.filter((r) => r.matchDetail === 'SKU↔SKU').length,
    skuGen:   results.filter((r) => r.matchDetail === 'SKU↔Generic').length,
    genSku:   results.filter((r) => r.matchDetail === 'Generic↔SKU').length,
    genGen:   results.filter((r) => r.matchDetail === 'Generic↔Generic').length,
  } : null

  const displayed = (results ?? []).filter((r) => {
    const pass =
      filter === 'all'         ? true :
      filter === 'check1_fail' ? !r.check1 :
      filter === 'check2_fail' ? (r.check1 && r.check2 === false) :
      filter === 'ok'          ? (r.check1 && r.check2 === true) :
      filter === 'na'          ? (r.check1 && r.check2 === null) : true
    const q = search.trim().toLowerCase()
    return pass && (!q || r.skuId.toLowerCase().includes(q) || r.genericId.toLowerCase().includes(q))
  })

  const filterLabel =
    filter === 'all'         ? 'tout' :
    filter === 'check1_fail' ? 'manquant' :
    filter === 'check2_fail' ? 'ecart' :
    filter === 'ok'          ? 'aligne' : 'na'

  return (
    <div className={styles.root}>
      {/* Header */}
      <header className={styles.header}>
        <div>
          <div className={styles.headerSub}>Chloé · Digital Operations</div>
          <h1 className={styles.headerTitle}>
            Price Consistency Check{' '}
            <span className={styles.headerAccent}>SAP ↔ SFCC</span>
          </h1>
        </div>
        {results && (
          <div className={styles.headerActions}>
            <button className={styles.resetBtn} onClick={handleReset}>← Reset</button>
            <ExportMenu rows={results} label="complet" />
          </div>
        )}
      </header>

      <main className={styles.main}>

        {/* ── UPLOAD VIEW ── */}
        {!results && (
          <div className={styles.uploadView}>
            <div className={styles.uploadGrid}>
              <UploadZone
                title="① Fichier SAP (.xlsx)"
                loaded={!!sapData}
                fileName={sapFileName}
                count={`${sapData?.length ?? 0} SKUs chargés`}
                hint="Col A: SAP SKU · Col B: Generic · Col C: Prix Generic · Col D: Prix SKU"
                accept=".xlsx,.xls"
                onChange={handleSAPFile}
              />
              <UploadZone
                title="② Price Book SFCC (.xml)"
                loaded={!!sfccData}
                fileName={sfccFileName}
                count={`${sfccData ? Object.keys(sfccData).length : 0} entrées prix`}
                hint="Demandware pricebook XML — <price-table>"
                accept=".xml"
                onChange={handleSFCCFile}
              />
            </div>

            {sfccData && (
              <div className={styles.logicBox}>
                <div className={styles.logicTitle}>Logique Check 2 — aligné si l'une des 4 combinaisons matche</div>
                {[
                  { label: 'SFCC@SKU = SAP Prix SKU',         color: '#5ab0f0' },
                  { label: 'SFCC@SKU = SAP Prix Generic',     color: '#C9A97A' },
                  { label: 'SFCC@Generic = SAP Prix SKU',     color: '#C9A97A' },
                  { label: 'SFCC@Generic = SAP Prix Generic', color: '#a07de0' },
                ].map((x) => (
                  <div key={x.label} className={styles.logicRow}>
                    <span className={styles.logicDot} style={{ background: x.color }} />
                    {x.label}
                  </div>
                ))}
              </div>
            )}

            {error && <div className={styles.errorBox}>{error}</div>}

            <div className={styles.analyzeWrap}>
              <button className={styles.analyzeBtn} onClick={handleAnalyze} disabled={!sapData || !sfccData || loading}>
                {loading ? 'Analyse en cours…' : 'Lancer l\'analyse'}
              </button>
            </div>
          </div>
        )}

        {/* ── RESULTS VIEW ── */}
        {results && stats && (
          <>
            {/* KPI row 1 */}
            <div className={styles.statsGrid}>
              <StatCard label="Total SKUs SAP" value={stats.total}    color="#F0EBE0" sub="base de référence" />
              <StatCard label="Couverts SFCC"  value={stats.covered}  color="#4CAF7A" sub={`${((stats.covered / stats.total) * 100).toFixed(1)}%`} />
              <StatCard label="Manquants"      value={stats.missing}  color="#E05252" sub="check 1 ✗" />
              <StatCard label="Prix alignés"   value={stats.aligned}  color="#4CAF7A" sub="check 2 ✓" />
              <StatCard label="Écarts réels"   value={stats.mismatch} color="#E09A52" sub="check 2 ✗" />
            </div>

            {/* KPI row 2 — match breakdown */}
            <div className={styles.matchGrid}>
              <MatchCard label="SKU↔SKU"         value={stats.skuSku}  color="#5ab0f0" />
              <MatchCard label="SKU↔Generic"     value={stats.skuGen}  color="#C9A97A" />
              <MatchCard label="Generic↔SKU"     value={stats.genSku}  color="#C9A97A" />
              <MatchCard label="Generic↔Generic" value={stats.genGen}  color="#a07de0" />
            </div>

            {/* Progress bar */}
            <div className={styles.progressBar}>
              <div style={{ flex: stats.aligned,  background: '#4CAF7A' }} />
              <div style={{ flex: stats.mismatch, background: '#E09A52' }} />
              <div style={{ flex: stats.missing,  background: '#E05252' }} />
              <div style={{ flex: stats.na,       background: '#2a2a2a' }} />
            </div>

            {/* Filters + Search + Export */}
            <div className={styles.toolbar}>
              <div className={styles.filters}>
                {[
                  { key: 'all',         label: `Tout — ${results.length}` },
                  { key: 'check1_fail', label: `Manquant — ${stats.missing}` },
                  { key: 'check2_fail', label: `Écart réel — ${stats.mismatch}` },
                  { key: 'ok',          label: `Aligné — ${stats.aligned}` },
                  { key: 'na',          label: `N/A — ${stats.na}` },
                ].map((f) => (
                  <button
                    key={f.key}
                    className={`${styles.filterBtn} ${filter === f.key ? styles.filterBtnActive : ''}`}
                    onClick={() => setFilter(f.key)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <input
                className={styles.searchInput}
                placeholder="Rechercher SKU / Generic…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className={styles.toolbarRight}>
                <span className={styles.rowCount}>{displayed.length} ligne(s)</span>
                <ExportMenu rows={displayed} label={filterLabel} />
              </div>
            </div>

            {/* Table */}
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    {['SAP SKU', 'Generic', 'SAP Prix Generic', 'SAP Prix SKU',
                      'SFCC @ SKU', 'SFCC @ Generic', 'Check 1', 'Check 2', 'Match', 'Δ'].map((h) => (
                      <th key={h} className={styles.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((row, i) => (
                    <tr key={i} className={styles.tr}>
                      <td className={`${styles.td} ${styles.tdSku}`}>{row.skuId}</td>
                      <td className={`${styles.td} ${styles.tdGeneric}`}>{row.genericId || '—'}</td>
                      <td className={`${styles.td} ${styles.tdPrice}`} style={{ color: '#777' }}>{fmtPrice(row.priceGeneric) || '—'}</td>
                      <td className={`${styles.td} ${styles.tdPrice}`} style={{ color: '#999' }}>{fmtPrice(row.priceSku) || '—'}</td>
                      <td className={`${styles.td} ${styles.tdPrice}`} style={{ color: row.sfccAtSku !== null ? '#5ab0f0' : '#1e1e1e' }}>
                        {row.sfccAtSku !== null ? fmtPrice(row.sfccAtSku) : '—'}
                      </td>
                      <td className={`${styles.td} ${styles.tdPrice}`} style={{ color: row.sfccAtGeneric !== null ? '#a07de0' : '#1e1e1e' }}>
                        {row.sfccAtGeneric !== null ? fmtPrice(row.sfccAtGeneric) : '—'}
                      </td>
                      <td className={styles.td}>
                        {row.check1
                          ? <Tag bg="#0a1e0f" color="#4CAF7A">✓ OK</Tag>
                          : <Tag bg="#1e0a0a" color="#E05252">✗ Manquant</Tag>}
                      </td>
                      <td className={styles.td}>
                        {row.check2 === null
                          ? <span className={styles.naText}>N/A</span>
                          : row.check2
                          ? <Tag bg="#0a1e0f" color="#4CAF7A">✓ Aligné</Tag>
                          : <Tag bg="#1e1200" color="#E09A52">✗ Écart</Tag>}
                      </td>
                      <td className={styles.td}>
                        {row.matchDetail
                          ? <Tag
                              bg="#0f0f0f"
                              color={matchColor(row.matchDetail)}
                              style={{ border: `1px solid ${matchColor(row.matchDetail)}33` }}
                            >
                              {row.matchDetail}
                            </Tag>
                          : <span className={styles.naText}>—</span>}
                      </td>
                      <td className={`${styles.td} ${styles.tdPrice}`} style={{
                        color: row.delta === null ? '#1e1e1e' : row.delta > 0 ? '#E09A52' : '#5ab0f0'
                      }}>
                        {row.delta !== null
                          ? (row.delta > 0 ? `+${row.delta.toFixed(2)}` : row.delta.toFixed(2))
                          : '—'}
                      </td>
                    </tr>
                  ))}
                  {displayed.length === 0 && (
                    <tr>
                      <td colSpan={10} className={styles.emptyRow}>Aucun résultat</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className={styles.footer}>
              <span>Aligné = match sur l'une des 4 combinaisons · N/A = couvert SFCC mais prix SAP absent</span>
              <span>
                <span style={{ color: '#5ab0f0' }}>■</span> SKU↔SKU ·{' '}
                <span style={{ color: '#C9A97A' }}>■</span> Cross-level ·{' '}
                <span style={{ color: '#a07de0' }}>■</span> Generic↔Generic
              </span>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
