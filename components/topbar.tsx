"use client"

import { Share2, MoreHorizontal, Sparkles, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface TopbarProps {
  projectTitle: string | null
  onRename: (title: string) => void
  hasContent: boolean
}

export function Topbar({ projectTitle, onRename, hasContent }: TopbarProps) {
  return (
    <header className="flex items-center justify-between h-12 px-4 border-b border-border bg-background shrink-0">
      {/* Left: breadcrumb / title */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
          <Sparkles className="w-3.5 h-3.5 text-foreground" />
          <span className="text-foreground font-medium text-sm">
            {projectTitle ?? "New chat"}
          </span>
          {projectTitle && (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
            </>
          )}
        </div>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2">
        {hasContent && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground hover:text-foreground text-xs h-7"
          >
            <Share2 className="w-3.5 h-3.5" />
            Share
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="w-7 h-7 text-muted-foreground hover:text-foreground"
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40 bg-popover border-border text-foreground">
            <DropdownMenuItem
              className="text-xs cursor-pointer focus:bg-accent"
              onClick={() => {
                const title = prompt("Rename chat:", projectTitle ?? "")
                if (title) onRename(title)
              }}
            >
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem className="text-xs cursor-pointer focus:bg-accent">
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem className="text-xs text-destructive cursor-pointer focus:bg-accent focus:text-destructive">
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
