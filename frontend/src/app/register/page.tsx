'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function RegisterPage() {
  const router = useRouter()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
      const response = await fetch(`${apiBase}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, displayName }),
      })

      if (response.ok) {
        const data = await response.json()
        localStorage.setItem('pitwall_token', data.token)
        localStorage.setItem('pitwall_user', JSON.stringify({ email: data.email, displayName: data.displayName }))
        router.push('/')
      } else {
        const data = await response.json()
        setError(data.message || 'Registration failed. Please try again.')
      }
    } catch {
      setError('Unable to connect to server. Please try again later.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-md mx-auto mt-12">
      <h1 className="text-2xl font-bold text-pitwall-text text-center mb-8">Create your Pitwall account</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="displayName" className="block text-sm font-medium text-pitwall-text-muted mb-1">
            Display Name
          </label>
          <input
            id="displayName"
            type="text"
            required
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            className="w-full px-4 py-2.5 bg-pitwall-surface border border-pitwall-border rounded-lg text-pitwall-text placeholder-pitwall-text-muted focus:outline-none focus:border-pitwall-accent transition-colors"
            placeholder="Your name"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-pitwall-text-muted mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full px-4 py-2.5 bg-pitwall-surface border border-pitwall-border rounded-lg text-pitwall-text placeholder-pitwall-text-muted focus:outline-none focus:border-pitwall-accent transition-colors"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-pitwall-text-muted mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full px-4 py-2.5 bg-pitwall-surface border border-pitwall-border rounded-lg text-pitwall-text placeholder-pitwall-text-muted focus:outline-none focus:border-pitwall-accent transition-colors"
            placeholder="At least 8 characters"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-2.5 bg-pitwall-accent text-white font-medium rounded-lg hover:bg-pitwall-accent/90 transition-colors disabled:opacity-50"
        >
          {isSubmitting ? 'Creating account...' : 'Create Account'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-pitwall-text-muted">
        Already have an account?{' '}
        <Link href="/login" className="text-pitwall-accent hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
