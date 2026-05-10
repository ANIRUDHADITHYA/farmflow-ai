import { NextRequest, NextResponse } from 'next/server'
import { getReminders, createReminder, updateReminderStatus } from '@/services/database'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || undefined
    const reminders = await getReminders(status)
    return NextResponse.json(reminders)
  } catch (error) {
    console.error('Reminders API error:', error)
    return NextResponse.json({ error: 'Failed to load reminders' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, due_date } = body

    if (!title || !due_date) {
      return NextResponse.json({ error: 'title and due_date are required' }, { status: 400 })
    }

    const reminder = await createReminder({ title, due_date })
    return NextResponse.json(reminder, { status: 201 })
  } catch (error) {
    console.error('Create reminder error:', error)
    return NextResponse.json({ error: 'Failed to create reminder' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, status } = body

    if (!id || !status) {
      return NextResponse.json({ error: 'id and status are required' }, { status: 400 })
    }

    const reminder = await updateReminderStatus(id, status)
    return NextResponse.json(reminder)
  } catch (error) {
    console.error('Update reminder error:', error)
    return NextResponse.json({ error: 'Failed to update reminder' }, { status: 500 })
  }
}
