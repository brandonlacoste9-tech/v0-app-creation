"use client"

import { useState, useCallback } from "react"
import { X, Link, Copy, Check, Twitter, Code2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface ShareDialogProps {
  open: boolean
  onClose: () => void
  code: string
  title: string
}

export function ShareDialog({ open, onClose, code, title }: ShareDialogProps) {
  const [copied, setCopied] = useState<"link" | "code" | null>(null)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  const handleCopyCode = useCallback(async () => {
    await navigator.clipboard.writeText(code)
    setCopied("code")
    setTimeout(() => setCopied(null), 2000)
  }, [code])

  const handleCopyLink = useCallback(async () => {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setCopied("link")
    setTimeout(() => setCopied(null), 2000)
  }, [shareUrl])

  const generateShareLink = useCallback(async () => {
    if (shareUrl) return
    setIsGenerating(true)
    
    // For demo purposes, we'll create a data URL encoded snippet
    // In production, this would call an API to store the code
    try {
      const encodedCode = btoa(encodeURIComponent(code))
      const baseUrl = typeof window !== "undefined" ? window.location.origin : ""
      const url = `${baseUrl}/share?code=${encodedCode.slice(0, 100)}&t=${encodeURIComponent(title.slice(0, 30))}`
      setShareUrl(url)
    } catch {
      // Fallback - just use current URL
      setShareUrl(window.location.href)
    }
    setIsGenerating(false)
  }, [code, title, shareUrl])

  const handleTwitterShare = useCallback(() => {
    const text = `Check out this component: "${title}"`
    const url = shareUrl ?? window.location.href
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      "_blank"
    )
  }, [title, shareUrl])

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md">
        <div className="bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="text-foreground font-semibold">Share Component</h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="p-5 space-y-4">
            {/* Title preview */}
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <div className="w-10 h-10 bg-background border border-border rounded-lg flex items-center justify-center">
                <Code2 className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground truncate">{title}</div>
                <div className="text-xs text-muted-foreground">{code.split("\n").length} lines</div>
              </div>
            </div>

            {/* Share options */}
            <div className="space-y-2">
              {/* Copy code */}
              <button
                onClick={handleCopyCode}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent transition-colors"
              >
                {copied === "code" ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4 text-muted-foreground" />
                )}
                <div className="flex-1 text-left">
                  <div className="text-sm font-medium text-foreground">Copy code</div>
                  <div className="text-xs text-muted-foreground">Copy the component code to clipboard</div>
                </div>
              </button>

              {/* Generate link */}
              <button
                onClick={generateShareLink}
                disabled={isGenerating}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent transition-colors disabled:opacity-50"
              >
                <Link className="w-4 h-4 text-muted-foreground" />
                <div className="flex-1 text-left">
                  <div className="text-sm font-medium text-foreground">
                    {isGenerating ? "Generating..." : shareUrl ? "Link ready" : "Generate link"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {shareUrl ? "Click to copy the share link" : "Create a shareable link"}
                  </div>
                </div>
                {shareUrl && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleCopyLink()
                    }}
                    className="p-1.5 rounded-md hover:bg-background transition-colors"
                  >
                    {copied === "link" ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                )}
              </button>

              {/* Twitter */}
              <button
                onClick={handleTwitterShare}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent transition-colors"
              >
                <Twitter className="w-4 h-4 text-muted-foreground" />
                <div className="flex-1 text-left">
                  <div className="text-sm font-medium text-foreground">Share on Twitter</div>
                  <div className="text-xs text-muted-foreground">Post to your timeline</div>
                </div>
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-border bg-muted/30">
            <button
              onClick={onClose}
              className="w-full py-2 text-sm font-medium bg-foreground text-background rounded-lg hover:opacity-90 transition-opacity"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
