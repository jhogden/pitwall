'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Home, Calendar, Settings, Menu, X, Flag } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/calendar', label: 'Calendar', icon: Calendar },
  { href: '/series', label: 'Series', icon: Flag },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export default function Navigation() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <nav className="sticky top-0 z-50 bg-pitwall-surface/95 backdrop-blur-md border-b border-pitwall-border">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <span className="font-mono font-bold text-lg tracking-widest bg-gradient-to-r from-pitwall-accent to-indigo-400 bg-clip-text text-transparent">
              PITWALL
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`
                  relative flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors
                  ${isActive(href)
                    ? 'text-pitwall-accent'
                    : 'text-pitwall-text-muted hover:text-pitwall-text hover:bg-pitwall-surface-2'
                  }
                `}
              >
                <Icon size={16} />
                {label}
                {isActive(href) && (
                  <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-pitwall-accent rounded-full" />
                )}
              </Link>
            ))}
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 text-pitwall-text-muted hover:text-pitwall-text rounded-md transition-colors"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-pitwall-border bg-pitwall-surface">
          <div className="px-4 py-2 space-y-1">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-md transition-colors
                  ${isActive(href)
                    ? 'text-pitwall-accent bg-pitwall-accent/10'
                    : 'text-pitwall-text-muted hover:text-pitwall-text hover:bg-pitwall-surface-2'
                  }
                `}
              >
                <Icon size={18} />
                {label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  )
}
