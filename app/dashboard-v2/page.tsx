import { mockDeployments } from "@/lib/mock-data"
import { CheckCircle, AlertCircle, Clock } from "lucide-react"

const stats = [
  { label: 'Total Deployments', value: '487', change: '+12%' },
  { label: 'Active Projects', value: '23', change: '+2' },
  { label: 'Bandwidth Used', value: '2.4 TB', change: '+340 GB' },
  { label: 'Build Minutes', value: '1,240', change: '+156' },
]

function getStatusIcon(status: string) {
  if (status === 'Ready') return <CheckCircle className="w-4 h-4 text-green-500" />
  if (status === 'Error') return <AlertCircle className="w-4 h-4 text-red-500" />
  return <Clock className="w-4 h-4 text-yellow-500" />
}

export default function DashboardPage() {
  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here's what's happening with your projects.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="border border-border rounded-lg p-6 bg-card">
            <p className="text-sm text-muted-foreground mb-2">{stat.label}</p>
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-bold">{stat.value}</span>
              <span className="text-xs text-green-500">{stat.change}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-semibold">Recent Deployments</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-border bg-secondary/50 text-sm">
              <tr>
                <th className="px-6 py-3 text-left font-medium">Project</th>
                <th className="px-6 py-3 text-left font-medium">Commit</th>
                <th className="px-6 py-3 text-left font-medium">Status</th>
                <th className="px-6 py-3 text-left font-medium">Time</th>
                <th className="px-6 py-3 text-left font-medium">Duration</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {mockDeployments.slice(0, 5).map((deploy) => (
                <tr key={deploy.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="px-6 py-4">{deploy.project}</td>
                  <td className="px-6 py-4 font-mono text-xs">{deploy.commit}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(deploy.status)}
                      <span>{deploy.status}</span>
                    </div>
                  </td>
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
