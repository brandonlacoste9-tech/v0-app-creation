import { mockDomains } from "@/lib/mock-data"
import { Plus, Trash2, CheckCircle, Clock } from "lucide-react"

export default function DomainsPage() {
  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Domains</h1>
          <p className="text-muted-foreground">Manage your custom domains</p>
        </div>
        <button className="flex items-center gap-2 bg-foreground text-background px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90">
          <Plus className="w-4 h-4" /> Add Domain
        </button>
      </div>

      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 border-b border-border">
              <tr>
                <th className="px-6 py-4 text-left font-medium">Domain</th>
                <th className="px-6 py-4 text-left font-medium">Status</th>
                <th className="px-6 py-4 text-left font-medium">SSL Certificate</th>
                <th className="px-6 py-4 text-left font-medium">Added</th>
                <th className="px-6 py-4 text-left"></th>
              </tr>
            </thead>
            <tbody>
              {mockDomains.map((domain) => (
                <tr key={domain.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="px-6 py-4 font-mono">{domain.domain}</td>
                  <td className="px-6 py-4">
                    <span className="flex items-center gap-2 text-xs px-2 py-1 rounded bg-green-500/20 text-green-600 w-fit">
                      <CheckCircle className="w-3 h-3" /> {domain.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">{domain.ssl}</td>
                  <td className="px-6 py-4 text-muted-foreground">{domain.addedDate}</td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-1 hover:bg-secondary rounded transition-colors">
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
