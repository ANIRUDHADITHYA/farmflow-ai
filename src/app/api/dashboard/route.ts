import { NextResponse } from 'next/server'
import { getDashboardStats, getLowStockItems, getReminders, getTreatments, getLedgerEntries, getInvoices } from '@/services/database'

export async function GET() {
  try {
    const [stats, lowStock, reminders, treatments, ledger, invoices] = await Promise.all([
      getDashboardStats(),
      getLowStockItems(10),
      getReminders('pending'),
      getTreatments(5),
      getLedgerEntries(10),
      getInvoices(5),
    ])

    return NextResponse.json({
      stats,
      lowStock,
      reminders: reminders.slice(0, 5),
      treatments,
      ledger,
      invoices,
    })
  } catch (error) {
    console.error('Dashboard API error:', error)
    return NextResponse.json({ error: 'Failed to load dashboard' }, { status: 500 })
  }
}
