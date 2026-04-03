export const mockProjects = [
  { id: '1', name: 'vercel-clone', framework: 'Next.js', lastDeploy: '2 hours ago', status: 'Ready', branch: 'main', domain: 'vercel-clone.vercel.app' },
  { id: '2', name: 'dashboard-ui', framework: 'React', lastDeploy: '1 day ago', status: 'Ready', branch: 'main', domain: 'dashboard-ui.vercel.app' },
  { id: '3', name: 'api-server', framework: 'Node.js', lastDeploy: '3 days ago', status: 'Ready', branch: 'main', domain: 'api-server.vercel.app' },
]

export const mockDeployments = [
  { id: '1', project: 'vercel-clone', branch: 'main', commit: '8Jfpic', status: 'Ready', time: '2h ago', duration: '5m 24s', author: 'MaxLeiter' },
  { id: '2', project: 'vercel-clone', branch: 'main', commit: 'BCoTK', status: 'Ready', time: '5h ago', duration: '3m 15s', author: 'aryamankha' },
  { id: '3', project: 'dashboard-ui', branch: 'dev', commit: 'l3V9pK', status: 'Error', time: '1d ago', duration: '2m 1s', author: 'aryamankha' },
  { id: '4', project: 'api-server', branch: 'main', commit: '3mokhG', status: 'Ready', time: '2d ago', duration: '4m 46s', author: 'IdoPesok' },
]

export const mockDomains = [
  { id: '1', domain: 'example.com', status: 'Verified', ssl: 'Valid', addedDate: '2024-01-15' },
  { id: '2', domain: 'api.example.com', status: 'Pending', ssl: 'Pending', addedDate: '2024-01-20' },
  { id: '3', domain: 'app.example.com', status: 'Verified', ssl: 'Valid', addedDate: '2024-01-10' },
]

export const mockTeamMembers = [
  { id: '1', name: 'Max Leiter', email: 'max@example.com', role: 'Owner', joined: '2024-01-01' },
  { id: '2', name: 'Aryamankha', email: 'aryamankha@example.com', role: 'Admin', joined: '2024-01-05' },
  { id: '3', name: 'Ido Pesok', email: 'ido@example.com', role: 'Member', joined: '2024-01-10' },
]
