import { AuthProvider } from '@/lib/auth-context'
import SchedulerInit from '@/components/SchedulerInit'
import './globals.css'

export const metadata = {
  title: 'Episode Tracker',
  description: 'Track your favorite TV shows and episodes',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <SchedulerInit />
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
