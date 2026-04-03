"use client"

import Link from "next/link"
import { LayoutDashboard, FolderOpen, Zap, Globe, BarChart3, Settings, Menu } from "lucide-react"
import { useState } from "react"

const navItems = [
  { href: '/dashboard-v2', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard-v2/projects', label: 'Projects', icon: FolderOpen },
  { href: '/dashboard-v2/deployments', label: 'Deployments', icon: Zap },
  { href: '/dashboard-v2/domains', label: 'Domains', icon: Globe },
  { href: '/dashboard-v2/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard-v2/settings', label: 'Settings', icon: Settings },
]

export function DashboardSidebar() {
  const [open, setOpen] = useState(true)

  return (
    <div className={`${open ? 'w-64' : 'w-20'} border-r border-border bg-card transition-all duration-300`}>
      <div className="flex items-center justify-between h-16 px-4 border-b border-border">
        {open && <span className="font-bold text-lg">AdgenXai</span>}
        <button onClick={() => setOpen(!open)} className="hover:bg-secondary p-1 rounded">
          <Menu className="w-4 h-4" />
        </button>
      </div>
      <nav className="space-y-2 p-4">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-secondary text-sm transition-colors"
          >
            <Icon className="w-4 h-4 shrink-0" />
            {open && <span>{label}</span>}
          </Link>
        ))}
      </nav>
    </div>
  )
}
