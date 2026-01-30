'use client'

import { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Upload, FileText, Loader2, CheckCircle, XCircle, Copy, Download,
  RefreshCw, ImageIcon, AlertTriangle, CheckCircle2, Edit,
  Shield, ShieldCheck, ShieldAlert
} from 'lucide-react'
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

interface ValidationResult {
  status: "PASS" | "FAIL" | "PARTIAL"
  details: string
  expiration_date?: string
  confidence?: number
  is_expired?: boolean
}

interface AIGeneratedCheck {
  status: "PASS" | "FAIL"
  is_ai_generated: boolean
  confidence: number
  details: string
  indicators_found: string[]
}

interface ValidationResults {
  name_match: ValidationResult
  address_match: ValidationResult
  id_format_valid: ValidationResult
  document_expired: ValidationResult
  ai_generated_check: AIGeneratedCheck
}

interface DocumentResult {
  document_type: string
  extracted_fields: ExtractedFields
  validation_results: ValidationResults
  clarity_score: number
  real_time_feedback: string[]
  routing_decision: "PASS" | "MINOR_ISSUES" | "MANUAL_REVIEW"
  routing_details: string
  image_quality_notes: string
  extraction_summary: string
}

interface DocumentResponse extends NormalizedAgentResponse {
  result: DocumentResult
}

interface ApplicationFormData {
  name: string
  address: string
  dateOfBirth: string
}

// Helper function to get confidence color
function getConfidenceColor(confidence: number): string {
  if (confidence > 85) return 'text-green-600'
  if (confidence >= 60) return 'text-yellow-600'
  return 'text-red-600'
}

// Helper function to get clarity score color
function getClarityScoreColor(score: number): string {
  if (score >= 85) return 'bg-green-600'
  if (score >= 60) return 'bg-yellow-600'
  return 'bg-red-600'
}

// Helper function to get clarity score text color
function getClarityScoreTextColor(score: number): string {
  if (score >= 85) return 'text-green-600'
  if (score >= 60) return 'text-yellow-600'
  return 'text-red-600'
}

// Helper function to get routing decision styling
function getRoutingDecisionStyle(decision: string): { bgColor: string; textColor: string; borderColor: string; icon: any } {
  switch (decision) {
    case 'PASS':
      return {
        bgColor: 'bg-green-50',
        textColor: 'text-green-900',
        borderColor: 'border-green-200',
        icon: CheckCircle
      }
    case 'MINOR_ISSUES':
      return {
        bgColor: 'bg-yellow-50',
        textColor: 'text-yellow-900',
        borderColor: 'border-yellow-200',
        icon: AlertTriangle
      }
    case 'MANUAL_REVIEW':
      return {
        bgColor: 'bg-red-50',
        textColor: 'text-red-900',
        borderColor: 'border-red-200',
        icon: XCircle
      }
    default:
      return {
        bgColor: 'bg-slate-50',
        textColor: 'text-slate-900',
        borderColor: 'border-slate-200',
        icon: AlertTriangle
      }
  }
}

// Helper function to get validation status styling
function getValidationStatusStyle(status: string): { icon: any; color: string } {
  switch (status) {
    case 'PASS':
      return { icon: CheckCircle, color: 'text-green-600' }
    case 'FAIL':
      return { icon: XCircle, color: 'text-red-600' }
    case 'PARTIAL':
      return { icon: AlertTriangle, color: 'text-yellow-600' }
    default:
      return { icon: AlertTriangle, color: 'text-slate-600' }
  }
}

// Helper function to get feedback alert styling
function getFeedbackAlertStyle(feedback: string): { bgColor: string; borderColor: string; textColor: string } {
  const lowerFeedback = feedback.toLowerCase()

  // Success/pass patterns - including AI authenticity verified
  if (lowerFeedback.includes('ready to submit') ||
      lowerFeedback.includes('matches') ||
      lowerFeedback.includes('valid') ||
      lowerFeedback.includes('excellent') ||
      lowerFeedback.includes('authenticity verified') ||
      lowerFeedback.includes('genuine')) {
    return {
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      textColor: 'text-green-800'
    }
  }

  // Warning patterns - including AI generation warnings
  if (lowerFeedback.includes('mismatch') ||
      lowerFeedback.includes('confirm') ||
      lowerFeedback.includes('please') ||
      lowerFeedback.includes('barcode') ||
      lowerFeedback.includes('manual review required') ||
      lowerFeedback.includes('signs of')) {
    return {
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      textColor: 'text-yellow-800'
    }
  }

  // Error patterns - including AI detection failures
  if (lowerFeedback.includes('failed') ||
      lowerFeedback.includes('error') ||
      lowerFeedback.includes('expired') ||
      lowerFeedback.includes('ai generation indicators') ||
      lowerFeedback.includes('digital manipulation')) {
    return {
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      textColor: 'text-red-800'
    }
  }

  // Default info
  return {
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-800'
  }
}

// Helper function to get AI confidence bar color
function getAIConfidenceColor(confidence: number): string {
  if (confidence >= 85) return 'bg-green-600'
  if (confidence >= 60) return 'bg-yellow-600'
  return 'bg-red-600'
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
  // Application form data state
  const [formData, setFormData] = useState<ApplicationFormData>({
    name: 'James Michael Thompson',
    address: '123 Main Street, Apt 4B, Springfield, IL 62701',
    dateOfBirth: '1985-03-15'
  })
  const [isEditingForm, setIsEditingForm] = useState(false)

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

  // Extract document details with cross-reference validation
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

      setStatusMessage('Analyzing document and validating against application data...')

      // Build message with application form data for cross-reference validation
      const message = `Analyze this document and validate against application form data:

Application Form Data:
- Name: ${formData.name}
- Address: ${formData.address}
- Date of Birth: ${formData.dateOfBirth}

Extract all details, perform cross-reference validation, calculate clarity score, and provide routing decision with real-time feedback.`

      // Call agent with uploaded file and application data
      const result = await callAIAgent(
        message,
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
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">
            Document Validation System
          </h1>
          <p className="text-slate-600 text-lg">
            AI-powered document extraction with cross-reference validation and automated routing
          </p>
        </div>

        {/* Application Form Data Section */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-slate-900">
                  <FileText className="w-5 h-5" />
                  Application Form Data
                </CardTitle>
                <CardDescription>
                  This data will be used for cross-reference validation
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditingForm(!isEditingForm)}
              >
                <Edit className="w-4 h-4 mr-2" />
                {isEditingForm ? 'Save' : 'Edit'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="name" className="text-slate-700">Full Name</Label>
                {isEditingForm ? (
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="mt-1"
                  />
                ) : (
                  <p className="mt-1 text-slate-900 font-medium">{formData.name}</p>
                )}
              </div>
              <div>
                <Label htmlFor="address" className="text-slate-700">Address</Label>
                {isEditingForm ? (
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                    className="mt-1"
                  />
                ) : (
                  <p className="mt-1 text-slate-900 font-medium">{formData.address}</p>
                )}
              </div>
              <div>
                <Label htmlFor="dob" className="text-slate-700">Date of Birth</Label>
                {isEditingForm ? (
                  <Input
                    id="dob"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                    className="mt-1"
                  />
                ) : (
                  <p className="mt-1 text-slate-900 font-medium">{formData.dateOfBirth}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

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
                      Driver License • Passport • National ID
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
                    Validating Document...
                  </>
                ) : (
                  <>
                    <FileText className="w-5 h-5 mr-2" />
                    Validate Document
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
                  Validation Results
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
                  <p>Upload and validate a document to see results</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Clarity Score Display */}
                  {response.result.clarity_score !== undefined && (
                    <div className="bg-white border border-slate-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-medium text-slate-700">Document Clarity Score</p>
                        <span className={`text-2xl font-bold ${getClarityScoreTextColor(response.result.clarity_score)}`}>
                          {response.result.clarity_score}%
                        </span>
                      </div>
                      <Progress
                        value={response.result.clarity_score}
                        className="h-3"
                      />
                      <div className="flex items-center justify-between mt-2 text-xs text-slate-600">
                        <span>Low Quality</span>
                        <span>High Quality</span>
                      </div>
                      <div className="flex items-center gap-4 mt-3 text-xs">
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-full bg-green-600"></div>
                          <span className="text-slate-600">Excellent (≥85%)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-full bg-yellow-600"></div>
                          <span className="text-slate-600">Fair (60-84%)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-full bg-red-600"></div>
                          <span className="text-slate-600">Poor (&lt;60%)</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* AI Authenticity Check Card */}
                  {response.result.validation_results?.ai_generated_check && (
                    <div
                      className={`
                        border-2 rounded-lg p-5 shadow-sm
                        ${response.result.validation_results.ai_generated_check.status === 'PASS'
                          ? 'bg-green-50 border-green-300'
                          : 'bg-red-50 border-red-300'
                        }
                      `}
                    >
                      <div className="flex items-start gap-3 mb-4">
                        {response.result.validation_results.ai_generated_check.status === 'PASS' ? (
                          <ShieldCheck className="w-7 h-7 text-green-600 mt-0.5" />
                        ) : (
                          <ShieldAlert className="w-7 h-7 text-red-600 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-slate-900 mb-1">
                            AI Authenticity Check
                          </p>
                          <div className="flex items-center gap-2 mb-2">
                            <Badge
                              variant={response.result.validation_results.ai_generated_check.status === 'PASS' ? 'default' : 'destructive'}
                              className="text-sm font-semibold"
                            >
                              {response.result.validation_results.ai_generated_check.is_ai_generated ? 'AI GENERATED' : 'AUTHENTIC'}
                            </Badge>
                            <span className={`text-lg font-bold ${
                              response.result.validation_results.ai_generated_check.status === 'PASS'
                                ? 'text-green-700'
                                : 'text-red-700'
                            }`}>
                              Confidence: {response.result.validation_results.ai_generated_check.confidence}%
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Confidence Progress Bar */}
                      <div className="mb-4">
                        <Progress
                          value={response.result.validation_results.ai_generated_check.confidence}
                          className={`h-3 ${getAIConfidenceColor(response.result.validation_results.ai_generated_check.confidence)}`}
                        />
                        <div className="flex items-center justify-between mt-1 text-xs text-slate-600">
                          <span>Low Confidence</span>
                          <span>High Confidence</span>
                        </div>
                      </div>

                      {/* Details */}
                      <p className={`text-sm mb-3 ${
                        response.result.validation_results.ai_generated_check.status === 'PASS'
                          ? 'text-green-800'
                          : 'text-red-800'
                      }`}>
                        {response.result.validation_results.ai_generated_check.details}
                      </p>

                      {/* Indicators Found (if any) */}
                      {response.result.validation_results.ai_generated_check.indicators_found &&
                       response.result.validation_results.ai_generated_check.indicators_found.length > 0 && (
                        <div className="bg-white/50 border border-red-200 rounded-lg p-3">
                          <div className="flex items-start gap-2 mb-2">
                            <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5" />
                            <p className="text-sm font-semibold text-red-900">Indicators Detected:</p>
                          </div>
                          <ul className="space-y-1 ml-6">
                            {response.result.validation_results.ai_generated_check.indicators_found.map((indicator, idx) => (
                              <li key={idx} className="text-sm text-red-800 list-disc">
                                {indicator}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Routing Decision Card */}
                  {response.result.routing_decision && (
                    <div>
                      {(() => {
                        const style = getRoutingDecisionStyle(response.result.routing_decision)
                        const Icon = style.icon
                        const aiCheck = response.result.validation_results?.ai_generated_check
                        const isAIRelatedIssue = aiCheck && aiCheck.status === 'FAIL'

                        return (
                          <div className={`${style.bgColor} ${style.borderColor} border-2 rounded-lg p-5`}>
                            <div className="flex items-start gap-3 mb-3">
                              <Icon className={`w-6 h-6 ${style.textColor} mt-0.5`} />
                              <div className="flex-1">
                                <p className={`text-lg font-bold ${style.textColor} mb-1`}>
                                  {response.result.routing_decision === 'PASS' && 'Document Validated - Auto-Approved'}
                                  {response.result.routing_decision === 'MINOR_ISSUES' && 'Minor Issues Detected - Review Guidance'}
                                  {response.result.routing_decision === 'MANUAL_REVIEW' && 'Flagged for Manual Compliance Review'}
                                </p>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge
                                    variant={
                                      response.result.routing_decision === 'PASS' ? 'default' :
                                      response.result.routing_decision === 'MINOR_ISSUES' ? 'secondary' :
                                      'destructive'
                                    }
                                    className="text-xs"
                                  >
                                    {response.result.routing_decision.replace('_', ' ')}
                                  </Badge>
                                  {isAIRelatedIssue && (
                                    <Badge variant="destructive" className="text-xs flex items-center gap-1">
                                      <ShieldAlert className="w-3 h-3" />
                                      AI Detection Alert
                                    </Badge>
                                  )}
                                  {aiCheck && aiCheck.status === 'PASS' && response.result.routing_decision === 'PASS' && (
                                    <Badge variant="default" className="text-xs flex items-center gap-1 bg-green-600">
                                      <ShieldCheck className="w-3 h-3" />
                                      AI Verified
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                            {response.result.routing_details && (
                              <p className={`text-sm ${style.textColor} ml-9`}>
                                {response.result.routing_details}
                              </p>
                            )}
                          </div>
                        )
                      })()}
                    </div>
                  )}

                  {/* Real-Time Feedback Panel */}
                  {response.result.real_time_feedback && response.result.real_time_feedback.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-slate-900 mb-3">Real-Time Feedback</p>
                      <div className="space-y-2">
                        {response.result.real_time_feedback.map((feedback, index) => {
                          const style = getFeedbackAlertStyle(feedback)
                          return (
                            <div
                              key={index}
                              className={`${style.bgColor} ${style.borderColor} border rounded-lg p-3`}
                            >
                              <p className={`text-sm ${style.textColor}`}>{feedback}</p>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  <Separator />

                  {/* Validation Results Grid */}
                  {response.result.validation_results && (
                    <div>
                      <p className="text-sm font-semibold text-slate-900 mb-3">Validation Checks</p>
                      <div className="grid grid-cols-2 gap-3">
                        {Object.entries(response.result.validation_results).map(([key, validation]) => {
                          // Skip ai_generated_check as it has its own prominent card above
                          if (key === 'ai_generated_check') return null

                          const style = getValidationStatusStyle(validation.status)
                          const Icon = style.icon
                          return (
                            <div
                              key={key}
                              className="bg-white border border-slate-200 rounded-lg p-3"
                            >
                              <div className="flex items-start gap-2 mb-2">
                                <Icon className={`w-5 h-5 ${style.color} mt-0.5`} />
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-slate-900 capitalize">
                                    {key.replace(/_/g, ' ')}
                                  </p>
                                  <Badge
                                    variant={
                                      validation.status === 'PASS' ? 'default' :
                                      validation.status === 'PARTIAL' ? 'secondary' :
                                      'destructive'
                                    }
                                    className="text-xs mt-1"
                                  >
                                    {validation.status}
                                  </Badge>
                                </div>
                              </div>
                              <p className="text-xs text-slate-600 ml-7">
                                {validation.details}
                              </p>
                              {validation.expiration_date && (
                                <p className="text-xs text-slate-500 ml-7 mt-1">
                                  Expires: {validation.expiration_date}
                                </p>
                              )}
                              {validation.confidence !== undefined && (
                                <p className="text-xs text-slate-500 ml-7 mt-1">
                                  Confidence: {validation.confidence}%
                                </p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  <Separator />

                  {/* Document Type */}
                  <div>
                    <p className="text-sm text-slate-600 mb-2">Document Type</p>
                    <Badge variant={response.result.document_type === 'Unknown' ? 'secondary' : 'default'} className="text-base px-3 py-1">
                      {response.result.document_type}
                    </Badge>
                  </div>

                  {/* Extracted Fields Table */}
                  {hasExtractedFields && (
                    <div>
                      <p className="text-sm font-semibold text-slate-900 mb-3">Extracted Information</p>
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
                    </div>
                  )}

                  {/* Image Quality Notes */}
                  {response.result.image_quality_notes && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-sm font-medium text-blue-900 mb-1">Image Quality Assessment</p>
                      <p className="text-sm text-blue-800">{response.result.image_quality_notes}</p>
                    </div>
                  )}

                  {/* Extraction Summary */}
                  {response.result.extraction_summary && (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                      <p className="text-sm font-medium text-slate-900 mb-1">Extraction Summary</p>
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
