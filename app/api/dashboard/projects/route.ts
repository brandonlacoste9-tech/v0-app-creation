import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

export async function GET() {
  try {
    const projects = await sql`
      SELECT 
        p.id,
        p.title as name,
        p.description,
        p.created_at,
        p.updated_at,
        u.name as owner_name,
        COUNT(m.id) as message_count
      FROM projects p
      LEFT JOIN users u ON u.id = p.user_id
      LEFT JOIN messages m ON m.project_id = p.id
      GROUP BY p.id, u.name
      ORDER BY p.updated_at DESC
    `

    const formattedProjects = projects.map((p: any) => ({
      id: p.id,
      name: p.name || 'Untitled Project',
      framework: 'Next.js',
      lastDeploy: getRelativeTime(new Date(p.updated_at)),
      status: 'Ready',
      branch: 'main',
      domain: `${(p.name || 'project').toLowerCase().replace(/\s+/g, '-')}.adgenxai.app`,
      messageCount: Number(p.message_count || 0),
    }))

    return NextResponse.json({ projects: formattedProjects })
  } catch (error) {
    console.error('Projects API error:', error)
    return NextResponse.json({ projects: [] })
  }
}

function getRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return `${diffDays}d ago`
}
