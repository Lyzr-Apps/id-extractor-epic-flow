'use client'

import { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Upload, FileText, Loader2, CheckCircle2, XCircle, Copy, Download, RefreshCw, ImageIcon } from 'lucide-react'
import { callAIAgent, uploadFiles } from '@/lib/aiAgent'
import type { NormalizedAgentResponse } from '@/lib/aiAgent'

// Agent ID from workflow.json
const AGENT_ID = "697c7714d36f070193f5ae9f"

// TypeScript interfaces from actual_test_response
interface ExtractedFieldValue {
  value: string
  confidence: number
}

interface ExtractedFields {
  [fieldName: string]: ExtractedFieldValue
}

interface DocumentResult {
  document_type: string
  extracted_fields: ExtractedFields
  image_quality_notes: string
  extraction_summary: string
}

interface DocumentResponse extends NormalizedAgentResponse {
  result: DocumentResult
}

// Helper function to get confidence color
function getConfidenceColor(confidence: number): string {
  if (confidence > 85) return 'text-green-600'
  if (confidence >= 60) return 'text-yellow-600'
  return 'text-red-600'
}

function getConfidenceBadgeVariant(confidence: number): "default" | "secondary" | "destructive" {
  if (confidence > 85) return 'default'
  if (confidence >= 60) return 'secondary'
  return 'destructive'
}

// Copy to clipboard utility (iframe-safe)
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    // Try modern clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }

    // Fallback: create temporary textarea
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const success = document.execCommand('copy')
    document.body.removeChild(textarea)
    return success
  } catch {
    return false
  }
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<DocumentResponse | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [copySuccess, setCopySuccess] = useState<string | null>(null)

  // Handle file selection
  const handleFileSelect = useCallback((selectedFile: File) => {
    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']
    if (!validTypes.includes(selectedFile.type)) {
      setStatusMessage('Please upload a valid image file (JPG, PNG, PDF)')
      return
    }

    // Validate file size (max 10MB)
    if (selectedFile.size > 10 * 1024 * 1024) {
      setStatusMessage('File size must be less than 10MB')
      return
    }

    setFile(selectedFile)
    setStatusMessage(null)
    setResponse(null)

    // Generate preview for images
    if (selectedFile.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string)
      }
      reader.readAsDataURL(selectedFile)
    } else {
      setImagePreview(null)
    }
  }, [])

  // Handle drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      handleFileSelect(droppedFile)
    }
  }, [handleFileSelect])

  // Handle file input change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      handleFileSelect(selectedFile)
    }
  }, [handleFileSelect])

  // Extract document details
  const handleExtract = async () => {
    if (!file) {
      setStatusMessage('Please upload a document first')
      return
    }

    setLoading(true)
    setStatusMessage('Uploading document...')
    setResponse(null)

    try {
      // Upload file first
      const uploadResult = await uploadFiles(file)

      if (!uploadResult.success || uploadResult.asset_ids.length === 0) {
        setStatusMessage(uploadResult.error || 'Failed to upload file')
        setLoading(false)
        return
      }

      setStatusMessage('Analyzing document...')

      // Call agent with uploaded file
      const result = await callAIAgent(
        'Extract all personal details from this document with confidence scores',
        AGENT_ID,
        { assets: uploadResult.asset_ids }
      )

      if (result.success) {
        setResponse(result.response as DocumentResponse)
        setStatusMessage(null)
      } else {
        setStatusMessage(result.error || 'Extraction failed')
      }
    } catch (error) {
      setStatusMessage('Network error occurred')
    } finally {
      setLoading(false)
    }
  }

  // Copy individual field
  const handleCopyField = async (fieldName: string, value: string) => {
    const success = await copyToClipboard(value)
    if (success) {
      setCopySuccess(fieldName)
      setTimeout(() => setCopySuccess(null), 2000)
    }
  }

  // Export all data
  const handleExport = async () => {
    if (!response?.result?.extracted_fields) return

    const exportData = Object.entries(response.result.extracted_fields).map(([key, data]) => ({
      field: key,
      value: data.value,
      confidence: `${data.confidence}%`
    }))

    const exportText = JSON.stringify(exportData, null, 2)
    const success = await copyToClipboard(exportText)

    if (success) {
      setCopySuccess('all')
      setTimeout(() => setCopySuccess(null), 2000)
    }
  }

  // Reset form
  const handleReset = () => {
    setFile(null)
    setImagePreview(null)
    setResponse(null)
    setStatusMessage(null)
    setCopySuccess(null)
  }

  const hasExtractedFields = response?.result?.extracted_fields &&
    Object.keys(response.result.extracted_fields).length > 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">
            Document Extraction
          </h1>
          <p className="text-slate-600 text-lg">
            Extract personal details from ID cards, utility bills, and bank statements
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Upload Panel */}
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-900">
                <Upload className="w-5 h-5" />
                Upload Document
              </CardTitle>
              <CardDescription>
                Supported formats: JPG, PNG, PDF (max 10MB)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Drag & Drop Area */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`
                  border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                  transition-all duration-200
                  ${isDragging
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-300 hover:border-slate-400 bg-white'
                  }
                `}
                onClick={() => document.getElementById('file-input')?.click()}
              >
                <input
                  id="file-input"
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,application/pdf"
                  onChange={handleInputChange}
                  className="hidden"
                />

                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-slate-700 font-medium">
                      Drop your document here or click to browse
                    </p>
                    <p className="text-sm text-slate-500 mt-1">
                      ID Cards • Utility Bills • Bank Statements
                    </p>
                  </div>
                </div>
              </div>

              {/* File Info */}
              {file && (
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <FileText className="w-5 h-5 text-slate-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-slate-900">{file.name}</p>
                        <p className="text-sm text-slate-600">
                          {(file.size / 1024).toFixed(2)} KB
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleReset}
                      disabled={loading}
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Image Preview */}
              {imagePreview && (
                <div className="rounded-lg overflow-hidden border border-slate-200">
                  <img
                    src={imagePreview}
                    alt="Document preview"
                    className="w-full h-64 object-contain bg-slate-50"
                  />
                </div>
              )}

              {/* Status Message */}
              {statusMessage && (
                <Alert>
                  <AlertDescription className="text-slate-700">
                    {statusMessage}
                  </AlertDescription>
                </Alert>
              )}

              {/* Extract Button */}
              <Button
                onClick={handleExtract}
                disabled={!file || loading}
                className="w-full"
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Analyzing Document...
                  </>
                ) : (
                  <>
                    <FileText className="w-5 h-5 mr-2" />
                    Extract Details
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Results Panel */}
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-slate-900">
                <span className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Extraction Results
                </span>
                {response && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExport}
                    disabled={!hasExtractedFields}
                  >
                    {copySuccess === 'all' ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-2" />
                        Export All
                      </>
                    )}
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!response ? (
                <div className="text-center py-12 text-slate-500">
                  <FileText className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                  <p>Upload and extract a document to see results</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Status Indicator */}
                  <div className="flex items-center gap-3">
                    {response.status === 'success' ? (
                      <>
                        <CheckCircle2 className="w-6 h-6 text-green-600" />
                        <div>
                          <p className="font-medium text-green-900">Extraction Successful</p>
                          <p className="text-sm text-green-700">{response.message}</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-6 h-6 text-red-600" />
                        <div>
                          <p className="font-medium text-red-900">Extraction Failed</p>
                          <p className="text-sm text-red-700">{response.message}</p>
                        </div>
                      </>
                    )}
                  </div>

                  <Separator />

                  {/* Document Type */}
                  <div>
                    <p className="text-sm text-slate-600 mb-2">Document Type</p>
                    <Badge variant={response.result.document_type === 'Unknown' ? 'secondary' : 'default'} className="text-base px-3 py-1">
                      {response.result.document_type}
                    </Badge>
                  </div>

                  {/* Extracted Fields Table */}
                  {hasExtractedFields ? (
                    <div>
                      <p className="text-sm text-slate-600 mb-3">Extracted Information</p>
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-50">
                              <TableHead className="text-slate-900 font-semibold">Field</TableHead>
                              <TableHead className="text-slate-900 font-semibold">Value</TableHead>
                              <TableHead className="text-slate-900 font-semibold text-right">Confidence</TableHead>
                              <TableHead className="w-12"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {Object.entries(response.result.extracted_fields).map(([fieldName, fieldData]) => (
                              <TableRow key={fieldName}>
                                <TableCell className="font-medium text-slate-900 capitalize">
                                  {fieldName.replace(/_/g, ' ')}
                                </TableCell>
                                <TableCell className="text-slate-700">
                                  {fieldData.value || '-'}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <span className={`font-semibold ${getConfidenceColor(fieldData.confidence)}`}>
                                      {fieldData.confidence}%
                                    </span>
                                    <div className="w-16">
                                      <Progress
                                        value={fieldData.confidence}
                                        className="h-2"
                                      />
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleCopyField(fieldName, fieldData.value)}
                                    disabled={!fieldData.value}
                                  >
                                    {copySuccess === fieldName ? (
                                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                                    ) : (
                                      <Copy className="w-4 h-4 text-slate-600" />
                                    )}
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Confidence Legend */}
                      <div className="flex items-center gap-4 mt-3 text-xs">
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-full bg-green-600"></div>
                          <span className="text-slate-600">High (&gt;85%)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-full bg-yellow-600"></div>
                          <span className="text-slate-600">Medium (60-85%)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-full bg-red-600"></div>
                          <span className="text-slate-600">Low (&lt;60%)</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <Alert>
                      <AlertDescription className="text-slate-700">
                        No fields were extracted from this document.
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Image Quality Notes */}
                  {response.result.image_quality_notes && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-sm font-medium text-blue-900 mb-1">Image Quality Notes</p>
                      <p className="text-sm text-blue-800">{response.result.image_quality_notes}</p>
                    </div>
                  )}

                  {/* Extraction Summary */}
                  {response.result.extraction_summary && (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                      <p className="text-sm font-medium text-slate-900 mb-1">Summary</p>
                      <p className="text-sm text-slate-700">{response.result.extraction_summary}</p>
                    </div>
                  )}

                  {/* Metadata */}
                  {response.metadata && (
                    <div className="text-xs text-slate-500 pt-2 border-t">
                      <p>Processed by {response.metadata.agent_name}</p>
                      {response.metadata.timestamp && (
                        <p>At {new Date(response.metadata.timestamp).toLocaleString()}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
