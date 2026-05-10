import { NextRequest, NextResponse } from 'next/server'
import { getInventory, upsertInventoryItem, deleteInventoryItem } from '@/services/database'

export async function GET() {
  try {
    const inventory = await getInventory()
    return NextResponse.json(inventory)
  } catch (error) {
    console.error('Inventory API error:', error)
    return NextResponse.json({ error: 'Failed to load inventory' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { item_name, quantity, unit } = body

    if (!item_name) {
      return NextResponse.json({ error: 'item_name is required' }, { status: 400 })
    }

    const item = await upsertInventoryItem({
      item_name,
      quantity: quantity || 0,
      unit: unit || 'units',
    })
    return NextResponse.json(item, { status: 201 })
  } catch (error) {
    console.error('Upsert inventory error:', error)
    return NextResponse.json({ error: 'Failed to update inventory' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    await deleteInventoryItem(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete inventory error:', error)
    return NextResponse.json({ error: 'Failed to delete inventory item' }, { status: 500 })
  }
}
