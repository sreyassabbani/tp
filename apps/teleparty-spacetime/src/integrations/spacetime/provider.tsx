import { SpacetimeDBProvider } from 'spacetimedb/react'
import { DbConnection } from '#/module_bindings'

const tokenStorageKey = 'tp-spacetime-token-v1'

let browserConnectionBuilder: ReturnType<typeof DbConnection.builder> | null = null

function createConnectionBuilder(token: string) {
  const dbUrl = import.meta.env.VITE_STDB_URL ?? 'ws://127.0.0.1:3010'
  const dbName = import.meta.env.VITE_STDB_DATABASE ?? 'teleparty-spacetime'

  return DbConnection.builder()
    .withUri(dbUrl)
    .withDatabaseName(dbName)
    .withToken(token)
    .withConfirmedReads(false)
    .onConnect((_connection, _identity, authToken) => {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(tokenStorageKey, authToken)
      }
    })
}

function getConnectionBuilder() {
  if (typeof window === 'undefined') {
    return createConnectionBuilder('')
  }

  if (browserConnectionBuilder) {
    return browserConnectionBuilder
  }

  browserConnectionBuilder = createConnectionBuilder(
    window.localStorage.getItem(tokenStorageKey) ?? '',
  )

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
