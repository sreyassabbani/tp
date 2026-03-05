import { SpacetimeDBProvider } from 'spacetimedb/react'
import { DbConnection } from '#/module_bindings'

const tokenStorageKey = 'tp-spacetime-token-v1'

let connectionBuilder: ReturnType<typeof DbConnection.builder> | null = null

function getConnectionBuilder() {
  if (connectionBuilder) {
    return connectionBuilder
  }

  const dbUrl = import.meta.env.VITE_STDB_URL ?? 'ws://127.0.0.1:3010'
  const dbName = import.meta.env.VITE_STDB_DATABASE ?? 'teleparty-spacetime'

  const token =
    typeof window === 'undefined'
      ? ''
      : window.localStorage.getItem(tokenStorageKey) ?? ''

  connectionBuilder = DbConnection.builder()
    .withUri(dbUrl)
    .withDatabaseName(dbName)
    .withToken(token)
    .withConfirmedReads(false)
    .onConnect((_connection, _identity, authToken) => {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(tokenStorageKey, authToken)
      }
    })

  return connectionBuilder
}

export default function AppSpacetimeProvider({
  children,
}: {
  children: React.ReactNode
}) {
  if (typeof window === 'undefined') {
    return <>{children}</>
  }

  return (
    <SpacetimeDBProvider connectionBuilder={getConnectionBuilder()}>
      {children}
    </SpacetimeDBProvider>
  )
}
