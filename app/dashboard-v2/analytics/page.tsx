export default function AnalyticsPage() {
  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Analytics</h1>
        <p className="text-muted-foreground">Performance metrics for all deployments</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="border border-border rounded-lg p-6 bg-card">
          <h2 className="font-semibold mb-4">Requests Over Time</h2>
          <div className="h-40 bg-secondary/50 rounded flex items-center justify-center text-muted-foreground text-sm">
            Chart placeholder - 40K requests last 7 days
          </div>
        </div>

        <div className="border border-border rounded-lg p-6 bg-card">
          <h2 className="font-semibold mb-4">Bandwidth Usage</h2>
          <div className="h-40 bg-secondary/50 rounded flex items-center justify-center text-muted-foreground text-sm">
            Chart placeholder - 2.4TB total
          </div>
        </div>
      </div>

      <div className="border border-border rounded-lg p-6 bg-card">
        <h2 className="font-semibold mb-4">Top Pages</h2>
        <table className="w-full text-sm">
          <thead className="border-b border-border">
            <tr>
              <th className="text-left py-2 font-medium">Path</th>
              <th className="text-right py-2 font-medium">Requests</th>
              <th className="text-right py-2 font-medium">Avg Response Time</th>
            </tr>
          </thead>
          <tbody>
            {[
              { path: '/', requests: '15,234', time: '120ms' },
              { path: '/dashboard', requests: '8,942', time: '145ms' },
              { path: '/projects', requests: '6,521', time: '98ms' },
              { path: '/api/deployments', requests: '4,123', time: '205ms' },
            ].map((item) => (
              <tr key={item.path} className="border-t border-border/50">
                <td className="py-3">{item.path}</td>
                <td className="text-right text-muted-foreground">{item.requests}</td>
                <td className="text-right text-muted-foreground">{item.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
