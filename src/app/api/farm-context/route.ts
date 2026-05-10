import { NextResponse } from 'next/server'
import { getFarmContext } from '@/services/database'

export async function GET() {
  try {
    const context = await getFarmContext()
    return NextResponse.json(context)
  } catch (error) {
    console.error('Farm context error:', error)
    return NextResponse.json({ animals: [], inventory: [], suppliers: [] })
  }
}
