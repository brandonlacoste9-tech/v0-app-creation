import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

async function seed() {
  console.log('Seeding demo data...')

  // Create demo user
  const demoUserId = 'demo-user-001'
  await sql`
    INSERT INTO users (id, email, name, plan_id)
    VALUES (${demoUserId}, 'demo@adgenxai.com', 'Demo User', 'pro')
    ON CONFLICT (id) DO UPDATE SET name = 'Demo User'
  `
  console.log('Created demo user')

  // Create demo projects
  const projects = [
    { id: 'proj-001', title: 'E-commerce Dashboard', description: 'A modern e-commerce admin panel' },
    { id: 'proj-002', title: 'SaaS Landing Page', description: 'Beautiful landing page for a SaaS product' },
    { id: 'proj-003', title: 'Portfolio Site', description: 'Personal portfolio website' },
    { id: 'proj-004', title: 'Blog Platform', description: 'Full-featured blog with CMS' },
    { id: 'proj-005', title: 'Chat Application', description: 'Real-time chat with AI integration' },
  ]

  for (const project of projects) {
    await sql`
      INSERT INTO projects (id, user_id, title, description)
      VALUES (${project.id}, ${demoUserId}, ${project.title}, ${project.description})
      ON CONFLICT (id) DO UPDATE SET title = ${project.title}
    `
  }
  console.log('Created demo projects')

  // Create demo messages for each project
  const messages = [
    { role: 'user', content: 'Build me a modern dashboard with charts' },
    { role: 'assistant', content: 'I\'ll create a dashboard with responsive charts using Recharts...' },
    { role: 'user', content: 'Add a dark mode toggle' },
    { role: 'assistant', content: 'Adding dark mode support with next-themes...' },
  ]

  for (const project of projects) {
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i]
      await sql`
        INSERT INTO messages (id, project_id, role, content)
        VALUES (${project.id + '-msg-' + i}, ${project.id}, ${msg.role}, ${msg.content})
        ON CONFLICT (id) DO NOTHING
      `
    }
  }
  console.log('Created demo messages')

  // Set usage for demo user
  const currentMonth = new Date().toISOString().slice(0, 7)
  await sql`
    INSERT INTO usage (user_id, month, generations_used)
    VALUES (${demoUserId}, ${currentMonth}, 42)
    ON CONFLICT (user_id, month) DO UPDATE SET generations_used = 42
  `
  console.log('Set demo usage')

  console.log('Demo data seeded successfully!')
}

seed().catch(console.error)
