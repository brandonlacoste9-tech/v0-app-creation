import { mockDeployments } from "@/lib/mock-data"
import { CheckCircle, AlertCircle, Clock } from "lucide-react"

function getStatusBadge(status: string) {
  if (status === 'Ready') return <span className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-green-500/20 text-green-600"><CheckCircle className="w-3 h-3" /> Ready</span>
  if (status === 'Error') return <span className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-red-500/20 text-red-600"><AlertCircle className="w-3 h-3" /> Error</span>
  return <span className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-yellow-500/20 text-yellow-600"><Clock className="w-3 h-3" /> Building</span>
}

export default function DeploymentsPage() {
  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Deployments</h1>
        <p className="text-muted-foreground">All deployments across your projects</p>
      </div>

      <div className="flex gap-4 mb-6">
        <input type="text" placeholder="Search deployments..." className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm" />
        <select className="px-3 py-2 rounded-lg border border-border bg-background text-sm">
          <option>All Projects</option>
          <option>vercel-clone</option>
          <option>dashboard-ui</option>
        </select>
        <select className="px-3 py-2 rounded-lg border border-border bg-background text-sm">
          <option>All Status</option>
          <option>Ready</option>
          <option>Error</option>
        </select>
      </div>

      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 border-b border-border">
              <tr>
                <th className="px-6 py-4 text-left font-medium">Project</th>
                <th className="px-6 py-4 text-left font-medium">Branch</th>
                <th className="px-6 py-4 text-left font-medium">Commit</th>
                <th className="px-6 py-4 text-left font-medium">Status</th>
                <th className="px-6 py-4 text-left font-medium">Author</th>
                <th className="px-6 py-4 text-left font-medium">Time</th>
                <th className="px-6 py-4 text-left font-medium">Duration</th>
              </tr>
            </thead>
            <tbody>
              {mockDeployments.map((deploy, idx) => (
                <tr key={deploy.id} className={`border-b border-border/50 hover:bg-secondary/30 transition-colors ${idx === mockDeployments.length - 1 ? 'border-b-0' : ''}`}>
                  <td className="px-6 py-4">{deploy.project}</td>
                  <td className="px-6 py-4">{deploy.branch}</td>
                  <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{deploy.commit}</td>
                  <td className="px-6 py-4">{getStatusBadge(deploy.status)}</td>
                  <td className="px-6 py-4 text-muted-foreground">{deploy.author}</td>
                  <td className="px-6 py-4 text-muted-foreground">{deploy.time}</td>
                  <td className="px-6 py-4 text-muted-foreground">{deploy.duration}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
