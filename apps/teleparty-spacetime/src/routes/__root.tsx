import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import Footer from '../components/Footer'
import Header from '../components/Header'
import AppSpacetimeProvider from '../integrations/spacetime/provider'
import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      {
        title: 'Teleparty Clone (SpacetimeDB)',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
})

const showTanStackDevtools =
  import.meta.env.DEV && import.meta.env.VITE_ENABLE_TANSTACK_DEVTOOLS === 'true'

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <AppSpacetimeProvider>
          <div className="relative min-h-screen overflow-x-hidden">
            <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_10%_10%,rgba(20,184,166,0.2),transparent_40%),radial-gradient(circle_at_90%_0%,rgba(245,158,11,0.2),transparent_40%),linear-gradient(180deg,#f3fffc_0%,#eef8f7_45%,#f8fafc_100%)]" />
            <Header />
            {children}
            <Footer />
            {showTanStackDevtools ? (
              <TanStackDevtools
                config={{
                  position: 'bottom-right',
                }}
                plugins={[
                  {
                    name: 'TanStack Router',
                    render: <TanStackRouterDevtoolsPanel />,
                  },
                ]}
              />
            ) : null}
          </div>
        </AppSpacetimeProvider>
        <Scripts />
      </body>
    </html>
  )
}
