'use client'

import { useState, useEffect } from 'react'

const AVAILABLE_SERIES = [
  { slug: 'f1', name: 'Formula 1', color: '#E10600' },
  { slug: 'wec', name: 'WEC', color: '#00548F' },
  { slug: 'imsa', name: 'IMSA', color: '#DA291C' },
]

interface Preferences {
  followedSeries: string[]
  emailNotifications: boolean
  browserNotifications: boolean
}

const DEFAULT_PREFERENCES: Preferences = {
  followedSeries: ['f1', 'wec'],
  emailNotifications: true,
  browserNotifications: false,
}

export default function SettingsPage() {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('pitwall_preferences')
    if (stored) {
      setPreferences(JSON.parse(stored))
    }
  }, [])

  const toggleSeries = (slug: string) => {
    setPreferences(prev => ({
      ...prev,
      followedSeries: prev.followedSeries.includes(slug)
        ? prev.followedSeries.filter(s => s !== slug)
        : [...prev.followedSeries, slug],
    }))
    setSaved(false)
  }

  const toggleNotification = (key: 'emailNotifications' | 'browserNotifications') => {
    setPreferences(prev => ({ ...prev, [key]: !prev[key] }))
    setSaved(false)
  }

  const savePreferences = () => {
    localStorage.setItem('pitwall_preferences', JSON.stringify(preferences))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-pitwall-text mb-6">Settings</h1>

      <div className="bg-pitwall-surface rounded-lg border border-pitwall-border p-4 mb-4">
        <p className="text-sm text-pitwall-text-muted">
          Sign in to save preferences across devices. Preferences are currently saved to this browser only.
        </p>
      </div>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-pitwall-text mb-4">Followed Series</h2>
        <p className="text-sm text-pitwall-text-muted mb-4">
          Select the series you want to follow. Your feed and calendar will prioritize these.
        </p>
        <div className="space-y-2">
          {AVAILABLE_SERIES.map(series => (
            <button
              key={series.slug}
              onClick={() => toggleSeries(series.slug)}
              className={`flex items-center gap-3 w-full p-3 rounded-lg border transition-all text-left ${
                preferences.followedSeries.includes(series.slug)
                  ? 'border-pitwall-accent/50 bg-pitwall-surface-2'
                  : 'border-pitwall-border bg-pitwall-surface hover:bg-pitwall-surface-2'
              }`}
            >
              <div
                className="w-4 h-4 rounded border-2 flex items-center justify-center"
                style={{
                  borderColor: preferences.followedSeries.includes(series.slug) ? series.color : '#2a2a3a',
                  backgroundColor: preferences.followedSeries.includes(series.slug) ? series.color : 'transparent',
                }}
              >
                {preferences.followedSeries.includes(series.slug) && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: series.color }}
              />
              <span className="text-pitwall-text font-medium">{series.name}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-pitwall-text mb-4">Notifications</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-pitwall-surface rounded-lg border border-pitwall-border">
            <div>
              <p className="text-pitwall-text font-medium">Email notifications</p>
              <p className="text-sm text-pitwall-text-muted">Receive reminders before race events</p>
            </div>
            <button
              onClick={() => toggleNotification('emailNotifications')}
              className={`w-11 h-6 rounded-full transition-colors relative ${
                preferences.emailNotifications ? 'bg-pitwall-accent' : 'bg-pitwall-border'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                  preferences.emailNotifications ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between p-3 bg-pitwall-surface rounded-lg border border-pitwall-border">
            <div>
              <p className="text-pitwall-text font-medium">Browser notifications</p>
              <p className="text-sm text-pitwall-text-muted">Get notified when sessions go live</p>
            </div>
            <button
              onClick={() => toggleNotification('browserNotifications')}
              className={`w-11 h-6 rounded-full transition-colors relative ${
                preferences.browserNotifications ? 'bg-pitwall-accent' : 'bg-pitwall-border'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                  preferences.browserNotifications ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </div>
        </div>
      </section>

      <button
        onClick={savePreferences}
        className="px-6 py-2.5 bg-pitwall-accent text-white font-medium rounded-lg hover:bg-pitwall-accent/90 transition-colors"
      >
        {saved ? 'Saved!' : 'Save Preferences'}
      </button>
    </div>
  )
}
