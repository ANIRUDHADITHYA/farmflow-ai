'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

export default function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const [phase, setPhase] = useState<'enter' | 'hold' | 'exit'>('enter')

  useEffect(() => {
    const enterTimer = setTimeout(() => setPhase('hold'), 100)
    const exitTimer = setTimeout(() => setPhase('exit'), 4300)
    const finishTimer = setTimeout(() => onFinish(), 5000)

    return () => {
      clearTimeout(enterTimer)
      clearTimeout(exitTimer)
      clearTimeout(finishTimer)
    }
  }, [onFinish])

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden transition-all duration-700 ease-in-out ${
        phase === 'exit' ? 'opacity-0 scale-105' : 'opacity-100 scale-100'
      }`}
      style={{
        background: 'linear-gradient(160deg, #061A10 0%, #0F3D2A 25%, #1B6B4A 55%, #2D9B6E 100%)',
      }}
    >
      {/* Mesh gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className={`absolute top-[15%] left-[10%] w-[400px] h-[400px] rounded-full transition-all duration-[2s] ease-out ${
            phase !== 'enter' ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
          }`}
          style={{ background: 'radial-gradient(circle, rgba(95, 212, 160, 0.15) 0%, transparent 70%)' }}
        />
        <div
          className={`absolute bottom-[10%] right-[5%] w-[500px] h-[500px] rounded-full transition-all duration-[2.5s] ease-out delay-200 ${
            phase !== 'enter' ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
          }`}
          style={{ background: 'radial-gradient(circle, rgba(232, 168, 56, 0.1) 0%, transparent 70%)' }}
        />
      </div>

      {/* Animated concentric rings */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full border border-white/[0.06] transition-all duration-[1.5s] ease-out ${
            phase !== 'enter' ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
          }`}
        />
        <div
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full border border-white/[0.04] transition-all duration-[2s] ease-out delay-150 ${
            phase !== 'enter' ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
          }`}
        />
        <div
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full border border-white/[0.02] transition-all duration-[2.5s] ease-out delay-300 ${
            phase !== 'enter' ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
          }`}
        />
      </div>

      {/* Orbiting particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className={`absolute w-1 h-1 rounded-full transition-opacity duration-1000 ${
              phase !== 'enter' ? 'opacity-100' : 'opacity-0'
            }`}
            style={{
              left: `${10 + i * 12}%`,
              top: `${15 + (i % 4) * 20}%`,
              background: i % 2 === 0 ? 'rgba(95, 212, 160, 0.4)' : 'rgba(232, 168, 56, 0.3)',
              animation: `float ${3 + i * 0.7}s ease-in-out ${i * 0.3}s infinite`,
            }}
          />
        ))}
      </div>

      {/* Icon container with glow */}
      <div
        className={`relative transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
          phase === 'enter'
            ? 'scale-50 opacity-0 translate-y-8'
            : phase === 'exit'
            ? 'scale-110 opacity-0 -translate-y-6'
            : 'scale-100 opacity-100 translate-y-0'
        }`}
      >
        {/* Outer glow */}
        <div className="absolute -inset-8 rounded-full animate-breathe"
          style={{ background: 'radial-gradient(circle, rgba(95, 212, 160, 0.2) 0%, transparent 70%)' }}
        />
        
        {/* Pulse ring */}
        <div className="absolute -inset-4">
          <div className="w-full h-full rounded-3xl border border-white/10 animate-pulse-ring" />
        </div>

        {/* Icon */}
        <div className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-[28px] overflow-hidden"
          style={{
            boxShadow: '0 8px 32px rgba(0,0,0,0.3), 0 0 64px rgba(95, 212, 160, 0.15), inset 0 1px 0 rgba(255,255,255,0.1)',
          }}
        >
          <Image
            src="/icon.png"
            alt="FarmClerk AI"
            fill
            className="object-cover"
            priority
          />
        </div>
      </div>

      {/* App name & tagline */}
      <div
        className={`mt-10 text-center transition-all duration-700 ease-out delay-200 ${
          phase === 'enter'
            ? 'opacity-0 translate-y-6'
            : phase === 'exit'
            ? 'opacity-0 -translate-y-3'
            : 'opacity-100 translate-y-0'
        }`}
      >
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
          FarmClerk
        </h1>
        <div className="flex items-center justify-center gap-2 mt-3">
          <div className="h-px w-8 bg-gradient-to-r from-transparent to-white/20" />
          <p className="text-xs text-white/40 font-semibold tracking-[0.25em] uppercase">
            Huxley&apos;s Farm
          </p>
          <div className="h-px w-8 bg-gradient-to-l from-transparent to-white/20" />
        </div>
        <p className="mt-3 text-lg font-bold text-white/50 italic tracking-wide">
          From muddy boots to tidy books.
        </p>
      </div>

      {/* Loading bar */}
      <div
        className={`mt-12 transition-all duration-500 delay-500 ${
          phase === 'enter' || phase === 'exit' ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <div className="w-32 h-1 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full rounded-full animate-shimmer"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(95, 212, 160, 0.6), transparent)',
              backgroundSize: '200% 100%',
            }}
          />
        </div>
      </div>
    </div>
  )
}
