import { Link } from '@tanstack/react-router'
import { Badge } from '#/components/ui/badge'

export default function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-3 no-underline">
          <div className="size-8 rounded-xl bg-[linear-gradient(135deg,#14b8a6,#f59e0b)]" />
          <div>
            <p className="m-0 text-sm font-semibold tracking-tight text-foreground">
              Teleparty Clone Lab
            </p>
            <p className="m-0 text-xs text-muted-foreground">SpacetimeDB Version</p>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="hidden sm:inline-flex">
            TanStack Start + shadcn
          </Badge>
          <a
            href="https://spacetimedb.com/docs"
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            Spacetime Docs
          </a>
        </div>
      </div>
    </header>
  )
}
