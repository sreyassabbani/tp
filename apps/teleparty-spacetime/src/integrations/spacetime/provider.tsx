import { SpacetimeDBProvider } from 'spacetimedb/react'
import { DbConnection } from '#/module_bindings'

let browserConnectionBuilder: ReturnType<typeof DbConnection.builder> | null = null

function createConnectionBuilder() {
  const dbUrl = import.meta.env.VITE_STDB_URL ?? 'ws://127.0.0.1:3010'
  const dbName = import.meta.env.VITE_STDB_DATABASE ?? 'teleparty-spacetime'

  return DbConnection.builder()
    .withUri(dbUrl)
    .withDatabaseName(dbName)
    .withConfirmedReads(false)
}

function getConnectionBuilder() {
  if (typeof window === 'undefined') {
    return createConnectionBuilder()
  }

  if (browserConnectionBuilder) {
    return browserConnectionBuilder
  }

  browserConnectionBuilder = createConnectionBuilder()

  return browserConnectionBuilder
}

export default function AppSpacetimeProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SpacetimeDBProvider connectionBuilder={getConnectionBuilder()}>
      {children}
    </SpacetimeDBProvider>
  )
}
