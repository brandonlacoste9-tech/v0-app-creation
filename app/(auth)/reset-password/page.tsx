"use client"

import { useState, FormEvent } from "react"
import Link from "next/link"
import { CheckCircle } from "lucide-react"

type Step = "request" | "confirm" | "done"

export default function ResetPasswordPage() {
  const [step, setStep] = useState<Step>("request")
  const [email, setEmail] = useState("")
  const [token, setToken] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleRequest(e: FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    const res = await fetch("/api/auth/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error ?? "Failed"); return }
    // In dev the token is returned directly so we can prefill
    if (data.resetToken) setToken(data.resetToken)
    setStep("confirm")
  }

  async function handleConfirm(e: FormEvent) {
    e.preventDefault()
    setError("")
    if (password.length < 8) { setError("Password must be at least 8 characters"); return }
    setLoading(true)
    const res = await fetch("/api/auth/reset?action=confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error ?? "Failed"); return }
    setStep("done")
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="mb-8">
        <span className="text-foreground font-semibold text-xl tracking-tight">adgenai</span>
      </div>

      <div className="w-full max-w-sm">
        {step === "done" ? (
          <div className="text-center space-y-4">
            <CheckCircle className="w-10 h-10 mx-auto text-foreground" />
            <h1 className="text-2xl font-semibold text-foreground">Password updated</h1>
            <p className="text-sm text-muted-foreground">Your password has been reset successfully.</p>
            <Link
              href="/login"
              className="inline-block mt-2 w-full h-9 bg-foreground text-background text-sm font-medium rounded-md hover:opacity-90 transition-opacity text-center leading-9"
            >
              Sign in
            </Link>
          </div>
        ) : step === "request" ? (
          <>
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-semibold text-foreground">Reset password</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Enter your email and we&apos;ll send a reset link.
              </p>
            </div>
            <form onSubmit={handleRequest} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground transition-colors"
                />
              </div>
              {error && <p className="text-xs text-red-500 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">{error}</p>}
              <button type="submit" disabled={loading} className="w-full h-9 bg-foreground text-background text-sm font-medium rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity">
                {loading ? "Sending..." : "Send reset link"}
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-semibold text-foreground">Set new password</h1>
              <p className="mt-1 text-sm text-muted-foreground">Enter your reset token and new password.</p>
            </div>
            <form onSubmit={handleConfirm} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5" htmlFor="token">
                  Reset token
                </label>
                <input
                  id="token"
                  type="text"
                  required
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Paste reset token"
                  className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground font-mono transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5" htmlFor="newpass">
                  New password
                </label>
                <input
                  id="newpass"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground transition-colors"
                />
              </div>
              {error && <p className="text-xs text-red-500 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">{error}</p>}
              <button type="submit" disabled={loading} className="w-full h-9 bg-foreground text-background text-sm font-medium rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity">
                {loading ? "Updating..." : "Update password"}
              </button>
            </form>
          </>
        )}

        <div className="mt-6 text-center">
          <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
