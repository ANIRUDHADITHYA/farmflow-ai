import { NextResponse } from 'next/server'
import { getLedgerEntries } from '@/services/database'

export async function GET() {
  try {
    const entries = await getLedgerEntries(100)
    return NextResponse.json(entries)
  } catch (error) {
    console.error('Ledger API error:', error)
    return NextResponse.json({ error: 'Failed to load ledger' }, { status: 500 })
  }
}
