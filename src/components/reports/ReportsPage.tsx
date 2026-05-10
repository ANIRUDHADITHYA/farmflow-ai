'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Activity, Stethoscope, Package, FileText, Calendar,
  Clock, CheckCircle2, XCircle, ClipboardList, DollarSign,
} from 'lucide-react'
import type { LedgerEntry, Reminder } from '@/types'

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
}

const typeConfig: Record<string, { icon: React.ElementType; color: string; bg: string; gradient: string }> = {
  treatment: { icon: Stethoscope, color: '#2D9B6E', bg: '#E0F5EC', gradient: 'linear-gradient(135deg, #2D9B6E, #7BC4A5)' },
  inventory: { icon: Package, color: '#1B6B4A', bg: '#E8F5EE', gradient: 'linear-gradient(135deg, #1B6B4A, #2D9B6E)' },
  invoice: { icon: DollarSign, color: '#E8A838', bg: '#FEF7E8', gradient: 'linear-gradient(135deg, #E8A838, #F0C464)' },
  reminder: { icon: Calendar, color: '#4A6B5D', bg: '#F1F4F3', gradient: 'linear-gradient(135deg, #4A6B5D, #7BC4A5)' },
}

export default function ReportsPage() {
  const [ledger, setLedger] = useState<LedgerEntry[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [ledgerRes, remindersRes] = await Promise.all([
        fetch('/api/ledger'),
        fetch('/api/reminders'),
      ])
      const [ledgerData, remindersData] = await Promise.all([
        ledgerRes.json(),
        remindersRes.json(),
      ])
      setLedger(Array.isArray(ledgerData) ? ledgerData : [])
      setReminders(Array.isArray(remindersData) ? remindersData : [])
    } catch (error) {
      console.error('Failed to load reports:', error)
    } finally {
      setLoading(false)
    }
  }

  const completeReminder = async (id: string) => {
    try {
      await fetch('/api/reminders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'completed' }),
      })
      setReminders(prev =>
        prev.map(r => (r.id === id ? { ...r, status: 'completed' as const } : r))
      )
    } catch (error) {
      console.error('Failed to update reminder:', error)
    }
  }

  const cancelReminder = async (id: string) => {
    try {
      await fetch('/api/reminders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'cancelled' }),
      })
      setReminders(prev =>
        prev.map(r => (r.id === id ? { ...r, status: 'cancelled' as const } : r))
      )
    } catch (error) {
      console.error('Failed to cancel reminder:', error)
    }
  }

  const groupedLedger = ledger.reduce<Record<string, LedgerEntry[]>>((acc, entry) => {
    const date = new Date(entry.created_at).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
    if (!acc[date]) acc[date] = []
    acc[date].push(entry)
    return acc
  }, {})

  const pendingReminders = reminders.filter(r => r.status === 'pending')
  const completedReminders = reminders.filter(r => r.status === 'completed')

  if (loading) {
    return (
      <div className="min-h-full gradient-mesh">
        <div className="max-w-lg mx-auto px-5 py-6 pb-28">
          <div className="mb-6">
            <div className="skeleton h-8 w-28 mb-2" />
            <div className="skeleton h-4 w-48" />
          </div>
          <div className="skeleton h-12 w-full rounded-2xl mb-5" />
          <div className="space-y-4">
            <div className="skeleton h-5 w-32" />
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton h-16 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full gradient-mesh">
      <div className="max-w-lg mx-auto px-5 py-6 pb-28">
        <motion.div {...fadeUp} className="mb-6">
          <h1 className="text-[28px] font-extrabold text-[#0F2419] tracking-tight">Activity</h1>
          <p className="text-sm font-semibold text-[#4A6B5D] mt-0.5">Your farm activity & reminders</p>
        </motion.div>

        <Tabs defaultValue="ledger" className="w-full">
          <TabsList className="w-full grid grid-cols-2 mb-6 rounded-2xl h-12 p-1 glass-strong">
            <TabsTrigger value="ledger" className="rounded-xl gap-2 font-bold text-sm data-[state=active]:bg-white data-[state=active]:text-[#1B6B4A] data-[state=active]:shadow-sm text-[#4A6B5D] transition-all">
              <Activity className="w-4 h-4" />
              Ledger
            </TabsTrigger>
            <TabsTrigger value="reminders" className="rounded-xl gap-2 font-bold text-sm data-[state=active]:bg-white data-[state=active]:text-[#1B6B4A] data-[state=active]:shadow-sm text-[#4A6B5D] transition-all">
              <Calendar className="w-4 h-4" />
              Reminders
              {pendingReminders.length > 0 && (
                <Badge className="text-white text-[9px] h-4 min-w-4 px-1 ml-0.5 border-0 rounded-full font-bold"
                  style={{ background: 'linear-gradient(135deg, #DC3545, #FF6B7A)' }}
                >
                  {pendingReminders.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Ledger Tab */}
          <TabsContent value="ledger">
            {ledger.length === 0 ? (
              <motion.div {...fadeUp} className="text-center py-16">
                <div className="relative w-20 h-20 mx-auto mb-4">
                  <div className="absolute inset-0 rounded-full animate-breathe" style={{ background: 'radial-gradient(circle, rgba(27,107,74,0.08) 0%, transparent 70%)' }} />
                  <div className="relative w-20 h-20 rounded-full bg-[#E8F5EE] flex items-center justify-center">
                    <Activity className="w-10 h-10 text-[#7BC4A5]" />
                  </div>
                </div>
                <h3 className="text-lg font-extrabold text-[#0F2419] mb-1">No Activity Yet</h3>
                <p className="text-sm text-[#4A6B5D] font-medium">
                  Activities appear here as you use FarmClerk AI
                </p>
              </motion.div>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedLedger).map(([date, entries]) => (
                  <motion.div key={date} {...fadeUp}>
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-[11px] font-bold text-[#8BB8A0] uppercase tracking-[0.12em]">
                        {date}
                      </span>
                      <div className="flex-1 h-px bg-[#E2E8E5]" />
                    </div>
                    <div className="space-y-2">
                      {entries.map((entry) => {
                        const config = typeConfig[entry.type] || typeConfig.inventory
                        const Icon = config.icon
                        return (
                          <div key={entry.id} className="card-interactive rounded-2xl p-3.5">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                                style={{
                                  background: config.gradient,
                                  boxShadow: `0 3px 10px ${config.color}20`,
                                }}
                              >
                                <Icon className="w-[18px] h-[18px] text-white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-[#0F2419] truncate">{entry.description}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <Badge className="text-[9px] capitalize font-bold border-0 rounded-full px-2"
                                    style={{ backgroundColor: config.bg, color: config.color }}
                                  >
                                    {entry.type}
                                  </Badge>
                                  <span className="text-[11px] text-[#8BB8A0] font-semibold" suppressHydrationWarning>
                                    {new Date(entry.created_at).toLocaleTimeString('en-US', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      hour12: true,
                                    })}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Reminders Tab */}
          <TabsContent value="reminders">
            {reminders.length === 0 ? (
              <motion.div {...fadeUp} className="text-center py-16">
                <div className="relative w-20 h-20 mx-auto mb-4">
                  <div className="absolute inset-0 rounded-full animate-breathe" style={{ background: 'radial-gradient(circle, rgba(27,107,74,0.08) 0%, transparent 70%)' }} />
                  <div className="relative w-20 h-20 rounded-full bg-[#E8F5EE] flex items-center justify-center">
                    <Calendar className="w-10 h-10 text-[#7BC4A5]" />
                  </div>
                </div>
                <h3 className="text-lg font-extrabold text-[#0F2419] mb-1">No Reminders</h3>
                <p className="text-sm text-[#4A6B5D] font-medium">
                  Ask FarmClerk AI to set reminders for you
                </p>
              </motion.div>
            ) : (
              <div className="space-y-6">
                {/* Pending */}
                {pendingReminders.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2.5 mb-3">
                      <div className="w-6 h-6 rounded-lg bg-[#FEF7E8] flex items-center justify-center">
                        <Clock className="w-3.5 h-3.5 text-[#E8A838]" />
                      </div>
                      <span className="text-[11px] font-bold text-[#4A6B5D] uppercase tracking-[0.12em]">
                        Pending ({pendingReminders.length})
                      </span>
                    </div>
                    <div className="space-y-2">
                      {pendingReminders.map((reminder) => {
                        const isOverdue = new Date(reminder.due_date) < new Date()
                        return (
                          <motion.div key={reminder.id} {...fadeUp}>
                            <div className={`card-interactive rounded-2xl p-4 ${isOverdue ? 'border-l-[3px] border-l-[#DC3545]' : ''}`}
                              style={isOverdue ? { background: 'linear-gradient(135deg, rgba(220,53,69,0.03), transparent)' } : {}}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                                  style={{
                                    background: isOverdue
                                      ? 'linear-gradient(135deg, #DC3545, #FF6B7A)'
                                      : 'linear-gradient(135deg, #E8A838, #F0C464)',
                                    boxShadow: isOverdue
                                      ? '0 3px 10px rgba(220,53,69,0.2)'
                                      : '0 3px 10px rgba(232,168,56,0.2)',
                                  }}
                                >
                                  <Clock className="w-[18px] h-[18px] text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-bold text-[#0F2419]">{reminder.title}</p>
                                  <span className={`text-xs font-bold ${isOverdue ? 'text-[#DC3545]' : 'text-[#4A6B5D]'}`}>
                                    {isOverdue ? 'Overdue: ' : 'Due: '}
                                    {new Date(reminder.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => completeReminder(reminder.id)}
                                    className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
                                    style={{
                                      background: 'linear-gradient(135deg, rgba(27,107,74,0.08), rgba(45,155,110,0.04))',
                                      color: '#1B6B4A',
                                    }}
                                  >
                                    <CheckCircle2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => cancelReminder(reminder.id)}
                                    className="w-9 h-9 rounded-xl bg-[#F8FAF9] text-[#8BB8A0] flex items-center justify-center hover:bg-[#DC3545]/8 hover:text-[#DC3545] transition-all duration-200"
                                  >
                                    <XCircle className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Completed */}
                {completedReminders.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2.5 mb-3">
                      <div className="w-6 h-6 rounded-lg bg-[#E8F5EE] flex items-center justify-center">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#7BC4A5]" />
                      </div>
                      <span className="text-[11px] font-bold text-[#8BB8A0] uppercase tracking-[0.12em]">
                        Done ({completedReminders.length})
                      </span>
                    </div>
                    <div className="space-y-2">
                      {completedReminders.map((reminder) => (
                        <div key={reminder.id} className="card-interactive rounded-2xl p-3.5 opacity-60">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-[#E8F5EE] flex items-center justify-center">
                              <CheckCircle2 className="w-4 h-4 text-[#7BC4A5]" />
                            </div>
                            <div>
                              <p className="text-sm text-[#8BB8A0] line-through font-medium">{reminder.title}</p>
                              <span className="text-[11px] text-[#8BB8A0] font-semibold">
                                {new Date(reminder.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
