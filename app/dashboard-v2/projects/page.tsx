"use client"

import { mockProjects } from "@/lib/mock-data"
import { ExternalLink, MoreVertical } from "lucide-react"
import Link from "next/link"

export default function ProjectsPage() {
  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="text-muted-foreground">All your deployed projects</p>
        </div>
        <button className="bg-foreground text-background px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90">
          Import Project
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {mockProjects.map((project) => (
          <div key={project.id} className="border border-border rounded-lg p-6 bg-card hover:border-ring transition-colors group">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="font-semibold text-lg group-hover:text-blue-500 transition-colors">{project.name}</h3>
                <p className="text-sm text-muted-foreground">{project.framework}</p>
              </div>
              <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-secondary rounded">
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  {project.status}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Branch</span>
                <span>{project.branch}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Last Deploy</span>
                <span>{project.lastDeploy}</span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-border">
              <a href={`https://${project.domain}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-blue-500 hover:text-blue-400 transition-colors">
                <ExternalLink className="w-3 h-3" />
                {project.domain}
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
