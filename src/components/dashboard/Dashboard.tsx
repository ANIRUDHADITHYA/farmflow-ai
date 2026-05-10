'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import Image from 'next/image'
import {
  AlertTriangle, Calendar, Package,
  DollarSign, Clock, TrendingUp, Stethoscope,
  PawPrint, MessageCircle, Warehouse, Sun, Moon, Sunset,
  ArrowUpRight, ChevronRight,
} from 'lucide-react'
import type { InventoryItem, Reminder, Treatment, LedgerEntry, Invoice, DashboardStats } from '@/types'

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
}

const stagger = {
  animate: { transition: { staggerChildren: 0.08 } },
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [lowStock, setLowStock] = useState<InventoryItem[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [treatments, setTreatments] = useState<Treatment[]>([])
  const [ledger, setLedger] = useState<LedgerEntry[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    try {
      const res = await fetch('/api/dashboard')
      const data = await res.json()
      setStats(data.stats)
      setLowStock(data.lowStock || [])
      setReminders(data.reminders || [])
      setTreatments(data.treatments || [])
      setLedger(data.ledger || [])
      setInvoices(data.invoices || [])
    } catch (error) {
      console.error('Dashboard load error:', error)
    } finally {
      setLoading(false)
    }
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return { text: 'Good Morning', icon: Sun, color: '#E8A838' }
    if (hour < 17) return { text: 'Good Afternoon', icon: Sunset, color: '#E8A838' }
    return { text: 'Good Evening', icon: Moon, color: '#7BC4A5' }
  }

  if (loading) {
    return (
      <div className="min-h-full gradient-mesh">
        <div className="max-w-lg mx-auto px-5 py-6 pb-28">
          {/* Skeleton header */}
          <div className="mb-8">
            <div className="skeleton h-4 w-32 mb-3" />
            <div className="skeleton h-8 w-56" />
          </div>
          {/* Skeleton quick actions */}
          <div className="grid grid-cols-4 gap-3 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className="skeleton w-14 h-14 rounded-2xl" />
                <div className="skeleton h-3 w-10" />
              </div>
            ))}
          </div>
          {/* Skeleton stat cards */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton h-24 rounded-2xl" />
            ))}
          </div>
          {/* Skeleton sections */}
          <div className="skeleton h-6 w-36 mb-3" />
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="skeleton h-16 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  const greeting = getGreeting()
  const GreetingIcon = greeting.icon

  return (
    <div className="min-h-full gradient-mesh relative">
      <div className="max-w-lg mx-auto px-5 py-6 pb-28">
        
        {/* Greeting Header */}
        <motion.div {...fadeUp} className="mb-8">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${greeting.color}15` }}>
              <GreetingIcon className="w-4 h-4" style={{ color: greeting.color }} />
            </div>
            <span className="text-sm font-semibold text-[#4A6B5D]">{greeting.text}</span>
          </div>
          <h1 className="text-[28px] font-extrabold text-[#0F2419] tracking-tight leading-tight">
            Huxley&apos;s Farm
          </h1>
        </motion.div>

        {/* Quick Actions — Premium pill design */}
        <motion.div {...fadeUp} transition={{ delay: 0.05 }} className="mb-8">
          <div className="grid grid-cols-4 gap-3">
            {[
              { href: '/', icon: MessageCircle, label: 'AI Chat', gradient: 'linear-gradient(135deg, #1B6B4A, #2D9B6E)', shadow: 'rgba(27,107,74,0.25)' },
              { href: '/animals', icon: PawPrint, label: 'Animals', gradient: 'linear-gradient(135deg, #E8A838, #F0C464)', shadow: 'rgba(232,168,56,0.25)' },
              { href: '/inventory', icon: Warehouse, label: 'Stock', gradient: 'linear-gradient(135deg, #2D9B6E, #7BC4A5)', shadow: 'rgba(45,155,110,0.25)' },
              { href: '/reports', icon: TrendingUp, label: 'Reports', gradient: 'linear-gradient(135deg, #4A6B5D, #7BC4A5)', shadow: 'rgba(74,107,93,0.25)' },
            ].map((item) => (
              <Link key={item.href} href={item.href} className="flex flex-col items-center gap-2.5 group">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:scale-105 group-active:scale-95"
                  style={{
                    background: item.gradient,
                    boxShadow: `0 4px 16px ${item.shadow}`,
                  }}
                >
                  <item.icon className="w-5 h-5 text-white stroke-[2.2]" />
                </div>
                <span className="text-[11px] font-bold text-[#0F2419]">{item.label}</span>
              </Link>
            ))}
          </div>
        </motion.div>

        {/* Summary Stats — Gradient accent cards */}
        <motion.div
          variants={stagger}
          initial="initial"
          animate="animate"
          className="grid grid-cols-2 gap-3 mb-8"
        >
          {[
            {
              icon: PawPrint,
              value: stats?.totalAnimals || 0,
              label: 'Animals',
              accent: '#1B6B4A',
              bg: 'linear-gradient(135deg, rgba(27,107,74,0.06), rgba(45,155,110,0.04))',
              iconBg: '#E8F5EE',
            },
            {
              icon: Stethoscope,
              value: stats?.todayTreatments || 0,
              label: 'Treatments',
              accent: '#E8A838',
              bg: 'linear-gradient(135deg, rgba(232,168,56,0.06), rgba(240,196,100,0.04))',
              iconBg: '#FEF7E8',
            },
            {
              icon: Clock,
              value: stats?.pendingReminders || 0,
              label: 'Reminders',
              accent: '#2D9B6E',
              bg: 'linear-gradient(135deg, rgba(45,155,110,0.06), rgba(123,196,165,0.04))',
              iconBg: '#E0F5EC',
            },
            {
              icon: DollarSign,
              value: `$${(stats?.totalExpenses || 0).toLocaleString()}`,
              label: 'Expenses',
              accent: '#4A6B5D',
              bg: 'linear-gradient(135deg, rgba(74,107,93,0.06), rgba(139,184,160,0.04))',
              iconBg: '#F1F4F3',
            },
          ].map((stat, i) => (
            <motion.div key={stat.label} variants={fadeUp}>
              <div
                className="card-interactive rounded-2xl p-4"
                style={{ background: stat.bg }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: stat.iconBg }}>
                    <stat.icon className="w-[18px] h-[18px]" style={{ color: stat.accent }} />
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-[#8BB8A0]" />
                </div>
                <div className="text-2xl font-extrabold text-[#0F2419] tracking-tight">{stat.value}</div>
                <p className="text-xs font-semibold text-[#4A6B5D] mt-0.5">{stat.label}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Alerts Section */}
        {lowStock.length > 0 && (
          <motion.div {...fadeUp} transition={{ delay: 0.2 }} className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#DC3545]/10 flex items-center justify-center">
                  <AlertTriangle className="w-3.5 h-3.5 text-[#DC3545]" />
                </div>
                <h2 className="text-sm font-bold text-[#0F2419]">Low Stock Alerts</h2>
              </div>
              <Badge className="bg-[#DC3545]/10 text-[#DC3545] border-0 text-[10px] font-bold rounded-full px-2">
                {lowStock.length}
              </Badge>
            </div>
            <div className="card-elevated rounded-2xl overflow-hidden">
              {lowStock.map((item, index) => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between px-4 py-3.5 transition-colors hover:bg-[#F8FAF9] ${
                    index !== lowStock.length - 1 ? 'border-b border-[#E2E8E5]' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#DC3545]/8 flex items-center justify-center">
                      <Package className="w-4 h-4 text-[#DC3545]" />
                    </div>
                    <span className="text-sm font-semibold text-[#0F2419]">{item.item_name}</span>
                  </div>
                  <Badge className="bg-[#DC3545]/8 text-[#DC3545] border-0 text-[10px] font-bold rounded-full px-2.5 py-1">
                    {item.quantity} {item.unit}
                  </Badge>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Upcoming Reminders */}
        {reminders.length > 0 && (
          <motion.div {...fadeUp} transition={{ delay: 0.25 }} className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#1B6B4A]/10 flex items-center justify-center">
                  <Calendar className="w-3.5 h-3.5 text-[#1B6B4A]" />
                </div>
                <h2 className="text-sm font-bold text-[#0F2419]">Upcoming Reminders</h2>
              </div>
              <Link href="/reports" className="text-[11px] font-bold text-[#1B6B4A] flex items-center gap-0.5">
                View all <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="card-elevated rounded-2xl overflow-hidden">
              {reminders.slice(0, 3).map((reminder, index) => (
                <div
                  key={reminder.id}
                  className={`flex items-center justify-between px-4 py-3.5 transition-colors hover:bg-[#F8FAF9] ${
                    index !== Math.min(reminders.length, 3) - 1 ? 'border-b border-[#E2E8E5]' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#E8F5EE] flex items-center justify-center">
                      <Clock className="w-4 h-4 text-[#1B6B4A]" />
                    </div>
                    <span className="text-sm font-semibold text-[#0F2419]">{reminder.title}</span>
                  </div>
                  <span className="text-xs font-bold text-[#4A6B5D] bg-[#F1F4F3] px-2.5 py-1 rounded-full">
                    {new Date(reminder.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Recent Treatments */}
        {treatments.length > 0 && (
          <motion.div {...fadeUp} transition={{ delay: 0.3 }} className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#2D9B6E]/10 flex items-center justify-center">
                  <Stethoscope className="w-3.5 h-3.5 text-[#2D9B6E]" />
                </div>
                <h2 className="text-sm font-bold text-[#0F2419]">Recent Treatments</h2>
              </div>
              <Link href="/reports" className="text-[11px] font-bold text-[#1B6B4A] flex items-center gap-0.5">
                View all <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="card-elevated rounded-2xl overflow-hidden">
              {treatments.slice(0, 3).map((t, index) => (
                <div
                  key={t.id}
                  className={`flex items-center justify-between px-4 py-3.5 transition-colors hover:bg-[#F8FAF9] ${
                    index !== Math.min(treatments.length, 3) - 1 ? 'border-b border-[#E2E8E5]' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#E0F5EC] flex items-center justify-center">
                      <Stethoscope className="w-4 h-4 text-[#2D9B6E]" />
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-[#0F2419]">{t.medicine}</span>
                      {t.withdrawal_hours && (
                        <p className="text-[11px] text-[#E8A838] font-bold flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {t.withdrawal_hours}h withdrawal
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs font-bold text-[#4A6B5D] bg-[#F1F4F3] px-2.5 py-1 rounded-full">
                    {new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Recent Activity */}
        {ledger.length > 0 && (
          <motion.div {...fadeUp} transition={{ delay: 0.35 }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#4A6B5D]/10 flex items-center justify-center">
                  <TrendingUp className="w-3.5 h-3.5 text-[#4A6B5D]" />
                </div>
                <h2 className="text-sm font-bold text-[#0F2419]">Recent Activity</h2>
              </div>
              <Link href="/reports" className="text-[11px] font-bold text-[#1B6B4A] flex items-center gap-0.5">
                View all <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="space-y-2">
              {ledger.slice(0, 5).map((entry) => {
                const iconMap: Record<string, { icon: React.ElementType; bg: string; color: string }> = {
                  treatment: { icon: Stethoscope, bg: '#E0F5EC', color: '#2D9B6E' },
                  inventory: { icon: Package, bg: '#E8F5EE', color: '#1B6B4A' },
                  invoice: { icon: DollarSign, bg: '#FEF7E8', color: '#E8A838' },
                  reminder: { icon: Calendar, bg: '#F1F4F3', color: '#4A6B5D' },
                }
                const config = iconMap[entry.type] || { icon: TrendingUp, bg: '#F1F4F3', color: '#4A6B5D' }
                const EntryIcon = config.icon
                return (
                  <div key={entry.id} className="card-interactive rounded-2xl p-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: config.bg }}>
                        <EntryIcon className="w-4 h-4" style={{ color: config.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#0F2419] truncate">{entry.description}</p>
                        <p className="text-[11px] text-[#8BB8A0] font-medium" suppressHydrationWarning>
                          {new Date(entry.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <Badge className="border-0 text-[9px] font-bold rounded-full px-2 py-0.5 capitalize" style={{ backgroundColor: config.bg, color: config.color }}>
                        {entry.type}
                      </Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}

        {/* Empty State */}
        {!lowStock.length && !reminders.length && !treatments.length && !ledger.length && (
          <motion.div {...fadeUp} transition={{ delay: 0.2 }} className="text-center py-16">
            <div className="relative w-24 h-24 mx-auto mb-5">
              <div className="absolute inset-0 rounded-3xl animate-breathe"
                style={{ background: 'radial-gradient(circle, rgba(27,107,74,0.1) 0%, transparent 70%)' }}
              />
              <div className="relative w-24 h-24 rounded-3xl overflow-hidden shadow-lg"
                style={{ boxShadow: '0 8px 32px rgba(27,107,74,0.15)' }}
              >
                <Image src="/icon.png" alt="FarmClerk AI" width={96} height={96} className="object-cover" />
              </div>
            </div>
            <h3 className="text-xl font-extrabold text-[#0F2419] mb-2">Welcome to FarmClerk!</h3>
            <p className="text-sm text-[#4A6B5D] max-w-[260px] mx-auto leading-relaxed">
              Start by chatting with the AI assistant to log treatments, track stock, and manage your farm.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2.5 mt-6 px-7 py-3.5 rounded-2xl font-bold text-sm text-white transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: 'linear-gradient(135deg, #1B6B4A 0%, #2D9B6E 100%)',
                boxShadow: '0 4px 20px rgba(27,107,74,0.3)',
              }}
            >
              <MessageCircle className="w-4 h-4" />
              Start Chatting
            </Link>
          </motion.div>
        )}
      </div>
    </div>
  )
}
