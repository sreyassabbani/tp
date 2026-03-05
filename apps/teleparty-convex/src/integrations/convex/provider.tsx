import { ConvexProvider, ConvexReactClient } from 'convex/react'

const convexUrl = import.meta.env.VITE_CONVEX_URL

if (!convexUrl) {
  throw new Error('VITE_CONVEX_URL is required. Run `pnpm convex:dev` first.')
}

const convexClient = new ConvexReactClient(convexUrl)

export default function AppConvexProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return <ConvexProvider client={convexClient}>{children}</ConvexProvider>
}
