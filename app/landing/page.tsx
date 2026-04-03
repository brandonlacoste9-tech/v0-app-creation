"use client"

import Link from "next/link"

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="font-bold text-lg">Vercel</span>
          <nav className="flex items-center gap-6">
            <Link href="/sign-in" className="text-sm hover:text-muted-foreground">Sign in</Link>
            <Link href="/sign-up" className="text-sm bg-foreground text-background px-4 py-2 rounded-lg font-medium hover:opacity-90">Start Free</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-24 text-center space-y-12">
        <div className="space-y-6">
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight">Deploy faster with Vercel</h1>
          <p className="text-xl text-muted-foreground">The platform for frontend developers. Combine git push deploys, serverless functions, and edge middleware on one platform.</p>
        </div>

        <div className="flex items-center justify-center gap-4">
          <Link href="/sign-up" className="bg-foreground text-background px-6 py-3 rounded-lg font-medium hover:opacity-90">Start Deploying Free</Link>
          <Link href="/sign-in" className="bg-secondary text-secondary-foreground px-6 py-3 rounded-lg font-medium hover:bg-accent">Sign In</Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-12">
          {[
            { title: "Git Integration", desc: "Push to deploy instantly" },
            { title: "Serverless Functions", desc: "Scale without managing servers" },
            { title: "Real-time Analytics", desc: "Monitor your deployments" },
          ].map((f) => (
            <div key={f.title} className="border border-border rounded-lg p-6 text-left">
              <h3 className="font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
