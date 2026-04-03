"use client"

import { Bell, ChevronDown } from "lucide-react"

export function DashboardTopbar() {
  return (
    <div className="h-16 border-b border-border bg-background flex items-center justify-between px-6">
      <div>
        <h1 className="font-semibold text-sm">Team</h1>
        <p className="text-xs text-muted-foreground">Manage your deployments</p>
      </div>
      <div className="flex items-center gap-4">
        <button className="relative hover:bg-secondary p-2 rounded-lg transition-colors">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>
        <button className="flex items-center gap-2 hover:bg-secondary px-3 py-1.5 rounded-lg text-sm transition-colors">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-500"></div>
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
