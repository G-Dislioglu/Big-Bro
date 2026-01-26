import React, { useEffect, useRef } from 'react'

// Ambient Background Component
export function AmbientBackground() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const orbs = [
      { id: 'orb-1', class: 'orb-cyan', size: 400, x: 20, y: 20 },
      { id: 'orb-2', class: 'orb-purple', size: 300, x: 70, y: 60 },
      { id: 'orb-3', class: 'orb-blue', size: 350, x: 40, y: 80 }
    ]

    const container = containerRef.current
    if (!container) return

    // Create orbs
    orbs.forEach(orb => {
      const element = document.createElement('div')
      element.id = orb.id
      element.className = `ambient-orb ${orb.class}`
      element.style.width = `${orb.size}px`
      element.style.height = `${orb.size}px`
      element.style.left = `${orb.x}%`
      element.style.top = `${orb.y}%`
      element.style.transform = 'translate(-50%, -50%)'
      container.appendChild(element)
    })

    // Animate orbs
    const animateOrb = (element: HTMLElement, delay: number) => {
      const animate = () => {
        const time = Date.now() / 1000
        const x = Math.sin(time + delay) * 20
        const y = Math.cos(time * 0.7 + delay) * 15
        element.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`
        requestAnimationFrame(animate)
      }
      animate()
    }

    orbs.forEach((orb, index) => {
      const element = document.getElementById(orb.id)
      if (element) {
        animateOrb(element, index * 2)
      }
    })

    return () => {
      orbs.forEach(orb => {
        const element = document.getElementById(orb.id)
        if (element && element.parentNode === container) {
          container.removeChild(element)
        }
      })
    }
  }, [])

  return <div ref={containerRef} className="fixed inset-0 pointer-events-none z-0" />
}

// Glass Card Component
interface GlassCardProps {
  children: React.ReactNode
  variant?: 'base' | 'cyan' | 'purple' | 'blue'
  glow?: boolean
  className?: string
}

export function GlassCard({ children, variant = 'base', glow = false, className = '' }: GlassCardProps) {
  const variantClasses = {
    base: 'glass-base',
    cyan: 'glass-cyan',
    purple: 'glass-purple',
    blue: 'glass-blue'
  }

  return (
    <div className={`glass-card ${variantClasses[variant]} ${glow ? 'breathe-cyan' : ''} ${className}`}>
      {children}
    </div>
  )
}

// Glass Button Component
interface GlassButtonProps {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'base' | 'cyan' | 'purple' | 'blue'
  disabled?: false
  className?: string
}

export function GlassButton({ children, onClick, variant = 'base', disabled = false, className = '' }: GlassButtonProps) {
  const variantClasses = {
    base: '',
    cyan: 'glass-cyan',
    purple: 'glass-purple',
    blue: 'glass-blue'
  }

  return (
    <button 
      className={`glass-button ${variantClasses[variant]} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

// Glass Input Component
interface GlassInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: 'text' | 'textarea'
  rows?: number
  className?: string
}

export function GlassInput({ 
  value, 
  onChange, 
  placeholder = '', 
  type = 'text',
  rows = 3,
  className = '' 
}: GlassInputProps) {
  if (type === 'textarea') {
    return (
      <textarea
        className={`glass-input glass-text-primary w-full ${className}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
      />
    )
  }

  return (
    <input
      type="text"
      className={`glass-input glass-text-primary w-full ${className}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  )
}

// Gradient Divider Component
export function GradientDivider() {
  return <div className="gradient-divider" />
}

// Loading Pulse Component
export function LoadingPulse({ text = 'Loading...' }: { text?: string }) {
  return <p className="glass-text-secondary loading-pulse">{text}</p>
}

// Status Badge Component
interface StatusBadgeProps {
  status: string
  type: 'layer' | 'status' | 'value'
}

export function StatusBadge({ status, type }: StatusBadgeProps) {
  const baseClasses = 'text-xs px-2 py-1 rounded-full font-medium'
  
  if (type === 'layer') {
    const layerColors = {
      rational: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
      spekulativ: 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
      meta: 'bg-green-500/20 text-green-300 border border-green-500/30'
    }
    return (
      <span className={`${baseClasses} ${layerColors[status.toLowerCase() as keyof typeof layerColors] || 'glass-bg-secondary'}`}>
        {status}
      </span>
    )
  }

  if (type === 'status') {
    const statusColors = {
      draft: 'bg-gray-500/20 text-gray-300 border border-gray-500/30',
      tested: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30',
      validated: 'bg-green-500/20 text-green-300 border border-green-500/30',
      killed: 'bg-red-500/20 text-red-300 border border-red-500/30'
    }
    return (
      <span className={`${baseClasses} ${statusColors[status.toLowerCase() as keyof typeof statusColors] || 'glass-bg-secondary'}`}>
        {status}
      </span>
    )
  }

  if (type === 'value') {
    return (
      <span className={`${baseClasses} bg-cyan-500/20 text-cyan-300 border border-cyan-500/30`}>
        {status}%
      </span>
    )
  }

  return <span className={baseClasses}>{status}</span>
}
