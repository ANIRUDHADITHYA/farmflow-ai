'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, MessageCircle, PawPrint, Warehouse, ClipboardList } from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/animals', label: 'Animals', icon: PawPrint },
  { href: '/', label: 'Chat', icon: MessageCircle, isCenter: true },
  { href: '/inventory', label: 'Stock', icon: Warehouse },
  { href: '/reports', label: 'Activity', icon: ClipboardList },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 pb-[env(safe-area-inset-bottom)]">
      {/* Gradient fade above nav */}
      <div className="absolute bottom-full left-0 right-0 h-8 bg-gradient-to-t from-[#F8FAF9] to-transparent pointer-events-none" />
      
      <div className="mx-3 mb-2">
        <div className="max-w-lg mx-auto glass-strong rounded-[22px] shadow-[0_4px_24px_rgba(0,0,0,0.06),0_1px_4px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-around px-1 h-[72px]">
            {navItems.map(({ href, label, icon: Icon, isCenter }) => {
              const isActive = pathname === href

              if (isCenter) {
                return (
                  <Link
                    key={href}
                    href={href}
                    className="flex flex-col items-center justify-center -mt-5"
                  >
                    <div className="relative">
                      {/* Outer glow */}
                      <div className={`absolute -inset-1.5 rounded-full transition-all duration-500 ${
                        isActive 
                          ? 'bg-[#1B6B4A]/20 scale-100' 
                          : 'bg-transparent scale-75'
                      }`} />
                      <div className={`relative w-[52px] h-[52px] rounded-full flex items-center justify-center transition-all duration-300 ${
                        isActive
                          ? 'shadow-[0_4px_20px_rgba(27,107,74,0.35)]'
                          : 'shadow-[0_2px_12px_rgba(27,107,74,0.2)]'
                      }`}
                        style={{
                          background: 'linear-gradient(135deg, #1B6B4A 0%, #2D9B6E 100%)',
                        }}
                      >
                        <Icon className="w-[22px] h-[22px] text-white stroke-[2.2]" />
                      </div>
                    </div>
                    <span className={`text-[10px] mt-1.5 font-bold transition-colors duration-300 ${
                      isActive ? 'text-[#1B6B4A]' : 'text-[#4A6B5D]'
                    }`}>
                      {label}
                    </span>
                  </Link>
                )
              }

              return (
                <Link
                  key={href}
                  href={href}
                  className="relative flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-2xl transition-all duration-300 min-w-[56px] group"
                >
                  <div className={`relative w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                    isActive
                      ? 'bg-[#1B6B4A]/[0.08]'
                      : 'bg-transparent group-hover:bg-[#1B6B4A]/[0.04]'
                  }`}>
                    {/* Active dot indicator */}
                    {isActive && (
                      <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#1B6B4A] animate-scale-in" />
                    )}
                    <Icon className={`w-[20px] h-[20px] transition-all duration-300 ${
                      isActive
                        ? 'text-[#1B6B4A] stroke-[2.4]'
                        : 'text-[#8BB8A0] stroke-[1.8] group-hover:text-[#4A6B5D]'
                    }`} />
                  </div>
                  <span className={`text-[10px] transition-all duration-300 ${
                    isActive
                      ? 'font-bold text-[#1B6B4A]'
                      : 'font-medium text-[#8BB8A0] group-hover:text-[#4A6B5D]'
                  }`}>
                    {label}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </nav>
  )
}
