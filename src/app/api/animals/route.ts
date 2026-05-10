import { NextRequest, NextResponse } from 'next/server'
import { getAnimals, createAnimal, updateAnimal } from '@/services/database'

export async function GET() {
  try {
    const animals = await getAnimals()
    return NextResponse.json(animals)
  } catch (error) {
    console.error('Animals API error:', error)
    return NextResponse.json({ error: 'Failed to load animals' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tag_number, type, status } = body

    if (!tag_number || !type) {
      return NextResponse.json({ error: 'tag_number and type are required' }, { status: 400 })
    }

    const animal = await createAnimal({ tag_number, type, status: status || 'active' })
    return NextResponse.json(animal, { status: 201 })
  } catch (error) {
    console.error('Create animal error:', error)
    return NextResponse.json({ error: 'Failed to create animal' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const animal = await updateAnimal(id, updates)
    return NextResponse.json(animal)
  } catch (error) {
    console.error('Update animal error:', error)
    return NextResponse.json({ error: 'Failed to update animal' }, { status: 500 })
  }
}
