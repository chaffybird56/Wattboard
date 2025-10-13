'use client'

import { useState, useRef } from 'react'
import { Upload, FileText, CheckCircle, AlertCircle, X } from 'lucide-react'

interface CsvImportProps {
  siteId: number | null
  onImportComplete?: () => void
}

export function CsvImport({ siteId, onImportComplete }: CsvImportProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [uploadMessage, setUploadMessage] = useState('')
  const [previewData, setPreviewData] = useState<any[]>([])
  const [selectedSite, setSelectedSite] = useState<number | null>(siteId)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const files = Array.from(e.dataTransfer.files)
    const csvFile = files.find(file => file.type === 'text/csv' || file.name.endsWith('.csv'))
    
    if (csvFile) {
      handleFileSelect(csvFile)
    }
  }

  const handleFileSelect = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const csv = e.target?.result as string
      const lines = csv.split('\n')
      const headers = lines[0].split(',')
      
      // Preview first 10 rows
      const preview = lines.slice(1, 11).map(line => {
        const values = line.split(',')
        return headers.reduce((obj, header, index) => {
          obj[header.trim()] = values[index]?.trim() || ''
          return obj
        }, {} as any)
      }).filter(row => Object.values(row).some(val => val !== ''))
      
      setPreviewData(preview)
    }
    reader.readAsText(file)
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleUpload = async () => {
    if (!fileInputRef.current?.files?.[0]) return
    
    const file = fileInputRef.current.files[0]
    setIsUploading(true)
    setUploadStatus('idle')
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      if (selectedSite) {
        formData.append('site_id', selectedSite.toString())
      }
      
      const response = await fetch('/api/import/csv', {
        method: 'POST',
        body: formData
      })
      
      const result = await response.json()
      
      if (response.ok) {
        setUploadStatus('success')
        setUploadMessage(`Successfully imported ${result.imported_rows} rows to Site ID: ${result.site_id}`)
        onImportComplete?.()
        
        // Auto-close after 3 seconds
        setTimeout(() => {
          setIsOpen(false)
          setUploadStatus('idle')
          setPreviewData([])
        }, 3000)
      } else {
        setUploadStatus('error')
        setUploadMessage(result.error || 'Upload failed')
      }
    } catch (error) {
      setUploadStatus('error')
      setUploadMessage('Upload failed: ' + (error as Error).message)
    } finally {
      setIsUploading(false)
    }
  }

  const downloadTemplate = () => {
    const csvContent = `timestamp,device_name,key,value,unit
2025-01-15T00:00:00Z,Main Meter,power,1200.5,W
2025-01-15T00:01:00Z,Main Meter,power,1180.2,W
2025-01-15T00:02:00Z,Main Meter,power,1225.8,W
2025-01-15T00:03:00Z,Main Meter,power,1195.3,W
2025-01-15T00:04:00Z,Main Meter,power,1210.7,W`

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'wattboard_template.csv'
    link.click()
    window.URL.revokeObjectURL(url)
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center space-x-2 px-4 py-2 bg-card border border-card-border rounded-lg hover:border-accent/50 transition-colors"
      >
        <Upload className="h-4 w-4" />
        <span className="text-sm font-medium">Import CSV</span>
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card border border-card-border rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-text">Import CSV Data</h3>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 text-muted hover:text-text transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Upload Area */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragging
              ? 'border-accent bg-accent/10'
              : 'border-card-border hover:border-accent/50'
          }`}
        >
          <Upload className="h-12 w-12 mx-auto mb-4 text-muted" />
          <p className="text-text mb-2">Drag and drop your CSV file here</p>
          <p className="text-sm text-muted mb-4">or</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileInputChange}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn-primary"
          >
            Choose File
          </button>
          <div className="mt-4">
            <button
              onClick={downloadTemplate}
              className="text-sm text-accent hover:text-accent/80 transition-colors"
            >
              Download sample CSV template
            </button>
          </div>
        </div>

        {/* Preview Data */}
        {previewData.length > 0 && (
          <div className="mt-6">
            <h4 className="font-medium text-text mb-3">Preview (first 10 rows)</h4>
            <div className="border border-card-border rounded-lg overflow-hidden">
              <div className="max-h-40 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-card-border">
                    <tr>
                      {Object.keys(previewData[0] || {}).map(header => (
                        <th key={header} className="px-3 py-2 text-left text-muted">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((row, index) => (
                      <tr key={index} className="border-t border-card-border">
                        {Object.values(row).map((value, i) => (
                          <td key={i} className="px-3 py-2 text-text">
                            {String(value)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Site Selection */}
        <div className="mt-6">
          <label className="block text-sm font-medium text-text mb-2">
            Target Site
          </label>
          <select
            value={selectedSite || ''}
            onChange={(e) => setSelectedSite(Number(e.target.value) || null)}
            className="input w-full"
          >
            <option value="">Select a site...</option>
            <option value="1">Home</option>
            <option value="2">Lab</option>
          </select>
        </div>

        {/* Upload Status */}
        {uploadStatus !== 'idle' && (
          <div className={`mt-4 p-3 rounded-lg flex items-center space-x-2 ${
            uploadStatus === 'success' 
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}>
            {uploadStatus === 'success' ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <span className="text-sm">{uploadMessage}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end space-x-3 mt-6">
          <button
            onClick={() => setIsOpen(false)}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!previewData.length || isUploading || !selectedSite}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? 'Uploading...' : 'Import Data'}
          </button>
        </div>
      </div>
    </div>
  )
}
