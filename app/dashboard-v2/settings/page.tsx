"use client"

import { mockTeamMembers } from "@/lib/mock-data"
import { useState } from "react"
import { Trash2, Plus } from "lucide-react"

export default function SettingsPage() {
  const [tab, setTab] = useState('general')

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your team and account</p>
      </div>

      <div className="flex gap-4 border-b border-border">
        {['general', 'team', 'billing', 'security'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="space-y-6">
        {tab === 'general' && (
          <>
            <div className="border border-border rounded-lg p-6 bg-card">
              <h2 className="font-semibold mb-4">Team Name</h2>
              <input type="text" defaultValue="My Team" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm mb-4" />
              <button className="bg-foreground text-background px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90">Save</button>
            </div>
          </>
        )}

        {tab === 'team' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Team Members</h2>
              <button className="flex items-center gap-2 bg-foreground text-background px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90">
                <Plus className="w-4 h-4" /> Add Member
              </button>
            </div>
            <div className="border border-border rounded-lg bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50 border-b border-border">
                  <tr>
                    <th className="px-6 py-4 text-left font-medium">Name</th>
                    <th className="px-6 py-4 text-left font-medium">Email</th>
                    <th className="px-6 py-4 text-left font-medium">Role</th>
                    <th className="px-6 py-4 text-left font-medium">Joined</th>
                    <th className="px-6 py-4 text-left"></th>
                  </tr>
                </thead>
                <tbody>
                  {mockTeamMembers.map((member) => (
                    <tr key={member.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                      <td className="px-6 py-4">{member.name}</td>
                      <td className="px-6 py-4 text-muted-foreground">{member.email}</td>
                      <td className="px-6 py-4"><span className="px-2 py-1 rounded bg-blue-500/20 text-blue-600 text-xs font-medium">{member.role}</span></td>
                      <td className="px-6 py-4 text-muted-foreground">{member.joined}</td>
                      <td className="px-6 py-4">
                        <button className="p-1 hover:bg-secondary rounded transition-colors">
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'billing' && (
          <div className="border border-border rounded-lg p-6 bg-card">
            <h2 className="font-semibold mb-4">Billing Plan</h2>
            <div className="space-y-4">
              <div><span className="text-muted-foreground text-sm">Current Plan:</span> <span className="font-semibold">Pro ($20/month)</span></div>
              <div><span className="text-muted-foreground text-sm">Next Billing Date:</span> <span className="font-semibold">February 15, 2025</span></div>
              <button className="bg-foreground text-background px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90">Upgrade to Enterprise</button>
            </div>
          </div>
        )}

        {tab === 'security' && (
          <div className="border border-border rounded-lg p-6 bg-card">
            <h2 className="font-semibold mb-4">Security</h2>
            <div className="space-y-4">
              <button className="w-full text-left px-4 py-3 rounded-lg border border-border hover:bg-secondary/50 transition-colors">
                <div className="font-medium text-sm">Change Password</div>
                <p className="text-xs text-muted-foreground mt-1">Update your password</p>
              </button>
              <button className="w-full text-left px-4 py-3 rounded-lg border border-border hover:bg-secondary/50 transition-colors">
                <div className="font-medium text-sm">Two-Factor Authentication</div>
                <p className="text-xs text-muted-foreground mt-1">Disabled - Enable for extra security</p>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
