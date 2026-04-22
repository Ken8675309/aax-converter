import { useState, useEffect, useCallback } from 'react'

function FileNode({ node, selectedFile, onSelect, depth = 0 }) {
  const [expanded, setExpanded] = useState(depth < 2)

  if (node.type === 'dir') {
    return (
      <div>
        <div
          className="file-item"
          style={{ paddingLeft: `${12 + depth * 12}px` }}
          onClick={() => setExpanded((e) => !e)}
        >
          <span style={{ fontSize: 10, color: 'var(--ex-gold2)', width: 12, flexShrink: 0 }}>
            {expanded ? '▾' : '▸'}
          </span>
          <span style={{ color: node.isConverted ? 'var(--ex-green2)' : 'var(--ex-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {node.name}
          </span>
        </div>
        {expanded && node.children.map((child, i) => (
          <FileNode key={i} node={child} selectedFile={selectedFile} onSelect={onSelect} depth={depth + 1} />
        ))}
      </div>
    )
  }

  const isSelected = selectedFile === node.path
  return (
    <div
      className={`file-item${isSelected ? ' active' : ''}`}
      style={{ paddingLeft: `${12 + depth * 12}px` }}
      onClick={() => onSelect(node.path)}
      title={node.path}
    >
      <span style={{ flexShrink: 0 }}>🔒</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{node.name}</span>
    </div>
  )
}

export default function FileBrowser({ selectedFile, onSelect }) {
  const [rootDir, setRootDir] = useState('')
  const [tree, setTree] = useState([])
  const [keyCount, setKeyCount] = useState(0)
  const [exorcisedCount, setExorcisedCount] = useState(0)

  const countAax = (nodes) => {
    let c = 0
    for (const n of nodes) {
      if (n.type === 'dir') c += countAax(n.children || [])
      else c++
    }
    return c
  }

  const refresh = useCallback(async (dir) => {
    if (!dir) return
    const t = await window.api.filesTree(dir)
    setTree(t)
  }, [])

  useEffect(() => {
    refresh(rootDir)
  }, [rootDir, refresh])

  useEffect(() => {
    Promise.all([window.api.keysList(), window.api.historyList()]).then(([keys, hist]) => {
      setKeyCount(keys.length)
      setExorcisedCount(hist.filter((h) => h.status === 'success').length)
    }).catch(() => {})
  }, [])

  const pickFolder = async () => {
    const dir = await window.api.filesPickFolder()
    if (dir) { setRootDir(dir); refresh(dir) }
  }

  const pickFile = async () => {
    const file = await window.api.filesPickFile()
    if (file) onSelect(file)
  }

  const possessedCount = countAax(tree)

  return (
    <aside className="ex-sidebar">
      <div style={{ paddingTop: 4 }}>
        <div className="sidebar-title">📁 Possessed Files</div>

        {rootDir && (
          <div
            className="file-item"
            title={rootDir}
            style={{ fontSize: 10, borderBottom: '1px solid rgba(61,46,0,0.3)', marginBottom: 4, paddingBottom: 6 }}
            onClick={pickFolder}
          >
            <span style={{ flexShrink: 0 }}>📂</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{rootDir.split('/').pop() || rootDir}</span>
          </div>
        )}

        <div style={{ overflowY: 'auto', maxHeight: 280 }}>
          {tree.length === 0 && rootDir && (
            <p style={{ fontSize: 10, color: 'var(--ex-muted)', padding: '8px 12px', fontStyle: 'italic' }}>
              No .aax files found
            </p>
          )}
          {tree.length === 0 && !rootDir && (
            <p style={{ fontSize: 10, color: 'var(--ex-muted)', padding: '8px 12px', fontStyle: 'italic' }}>
              Summon a folder to begin
            </p>
          )}
          {tree.map((node, i) => (
            <FileNode key={i} node={node} selectedFile={selectedFile} onSelect={onSelect} />
          ))}
        </div>
      </div>

      <button className="browse-btn" onClick={pickFolder}>
        Choose Folder
      </button>
      <button className="browse-btn" style={{ marginTop: 0 }} onClick={pickFile}>
        Summon File
      </button>

      <div className="soul-stats">
        <div className="sidebar-title" style={{ padding: '0 0 6px', border: 'none' }}>Soul Ledger</div>
        <div className="soul-row">
          <span>Keys stored</span><span className="soul-val">{keyCount}</span>
        </div>
        <div className="soul-row">
          <span>Exorcised</span><span className="soul-val">{exorcisedCount}</span>
        </div>
        <div className="soul-row">
          <span>Possessed</span><span className="soul-val">{possessedCount}</span>
        </div>
      </div>
    </aside>
  )
}
