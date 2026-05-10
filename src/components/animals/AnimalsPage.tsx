'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import {
  Plus, Search, PawPrint, Bird, Egg, Rabbit,
  Stethoscope, Beef, ChevronRight,
} from 'lucide-react'
import type { Animal } from '@/types'

const animalIcons: Record<string, React.ElementType> = {
  cow: Beef,
  chicken: Bird,
  goat: Rabbit,
  sheep: PawPrint,
  pig: Egg,
}

const animalGradients: Record<string, { bg: string; shadow: string }> = {
  cow: { bg: 'linear-gradient(135deg, #1B6B4A, #2D9B6E)', shadow: 'rgba(27,107,74,0.25)' },
  chicken: { bg: 'linear-gradient(135deg, #E8A838, #F0C464)', shadow: 'rgba(232,168,56,0.25)' },
  goat: { bg: 'linear-gradient(135deg, #4A6B5D, #7BC4A5)', shadow: 'rgba(74,107,93,0.25)' },
  sheep: { bg: 'linear-gradient(135deg, #2D9B6E, #7BC4A5)', shadow: 'rgba(45,155,110,0.25)' },
  pig: { bg: 'linear-gradient(135deg, #E8A838, #1B6B4A)', shadow: 'rgba(232,168,56,0.2)' },
}

const statusColors: Record<string, string> = {
  active: 'bg-[#E8F5EE] text-[#1B6B4A]',
  sold: 'bg-[#FEF7E8] text-[#E8A838]',
  deceased: 'bg-[#F1F4F3] text-[#8BB8A0]',
}

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
}

export default function AnimalsPage() {
  const [animals, setAnimals] = useState<Animal[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newTag, setNewTag] = useState('')
  const [newType, setNewType] = useState('cow')

  useEffect(() => {
    loadAnimals()
  }, [])

  const loadAnimals = async () => {
    try {
      const res = await fetch('/api/animals')
      const data = await res.json()
      setAnimals(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Failed to load animals:', error)
    } finally {
      setLoading(false)
    }
  }

  const addAnimal = async () => {
    if (!newTag.trim()) return

    try {
      const res = await fetch('/api/animals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag_number: newTag, type: newType }),
      })
      if (res.ok) {
        setNewTag('')
        setNewType('cow')
        setDialogOpen(false)
        loadAnimals()
      }
    } catch (error) {
      console.error('Failed to add animal:', error)
    }
  }

  const filteredAnimals = animals.filter(
    (a) =>
      a.tag_number.toLowerCase().includes(search.toLowerCase()) ||
      a.type.toLowerCase().includes(search.toLowerCase())
  )

  const animalTypes = ['cow', 'chicken', 'goat', 'sheep', 'pig']

  if (loading) {
    return (
      <div className="min-h-full gradient-mesh">
        <div className="max-w-lg mx-auto px-5 py-6 pb-28">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="skeleton h-8 w-40 mb-2" />
              <div className="skeleton h-4 w-28" />
            </div>
            <div className="skeleton h-11 w-20 rounded-2xl" />
          </div>
          <div className="skeleton h-12 w-full rounded-2xl mb-5" />
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton h-20 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full gradient-mesh">
      <div className="max-w-lg mx-auto px-5 py-6 pb-28">
        {/* Header */}
        <motion.div {...fadeUp} className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-[28px] font-extrabold text-[#0F2419] tracking-tight">My Animals</h1>
            <p className="text-sm font-semibold text-[#4A6B5D] mt-0.5">
              {animals.length} animal{animals.length !== 1 ? 's' : ''} registered
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button
                className="rounded-2xl gap-2 h-11 px-5 font-bold text-sm text-white transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: 'linear-gradient(135deg, #1B6B4A 0%, #2D9B6E 100%)',
                  boxShadow: '0 4px 16px rgba(27,107,74,0.25)',
                }}
              >
                <Plus className="w-4 h-4" />
                Add
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md rounded-3xl border-0 shadow-[0_24px_80px_rgba(0,0,0,0.12)]">
              <DialogHeader>
                <DialogTitle className="text-[#0F2419] text-lg font-extrabold">Add New Animal</DialogTitle>
              </DialogHeader>
              <div className="space-y-5 mt-3">
                <div>
                  <label className="text-sm font-bold text-[#0F2419] mb-2 block">Tag Number</label>
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="e.g., 284"
                    className="rounded-2xl h-12 bg-[#F8FAF9] border-[#E2E8E5] text-[#0F2419] font-semibold focus:border-[#1B6B4A] focus:ring-[#1B6B4A]/20"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-[#0F2419] mb-2 block">Type</label>
                  <div className="grid grid-cols-5 gap-2">
                    {animalTypes.map((type) => {
                      const Icon = animalIcons[type] || PawPrint
                      const gradient = animalGradients[type]
                      const isSelected = newType === type
                      return (
                        <button
                          key={type}
                          onClick={() => setNewType(type)}
                          className={`p-3 rounded-2xl border-2 flex flex-col items-center gap-1.5 transition-all duration-300 ${
                            isSelected
                              ? 'border-[#1B6B4A] scale-[1.03]'
                              : 'border-[#E2E8E5] hover:border-[#8BB8A0]'
                          }`}
                          style={isSelected ? {
                            background: 'linear-gradient(135deg, rgba(27,107,74,0.06), rgba(45,155,110,0.04))',
                          } : {}}
                        >
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={isSelected ? {
                              background: gradient?.bg,
                              boxShadow: `0 2px 8px ${gradient?.shadow}`,
                            } : {
                              background: '#F1F4F3',
                            }}
                          >
                            <Icon className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-[#8BB8A0]'}`} />
                          </div>
                          <span className={`text-[10px] capitalize font-bold ${isSelected ? 'text-[#1B6B4A]' : 'text-[#8BB8A0]'}`}>{type}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
                <Button
                  onClick={addAnimal}
                  className="w-full rounded-2xl h-12 font-bold text-white transition-all duration-300 hover:scale-[1.01] active:scale-[0.99]"
                  style={{
                    background: 'linear-gradient(135deg, #1B6B4A 0%, #2D9B6E 100%)',
                    boxShadow: '0 4px 16px rgba(27,107,74,0.25)',
                  }}
                  disabled={!newTag.trim()}
                >
                  Add Animal
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </motion.div>

        {/* Search */}
        <motion.div {...fadeUp} transition={{ delay: 0.1 }} className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8BB8A0]" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by tag or type..."
              className="pl-11 rounded-2xl h-12 bg-white border-[#E2E8E5] text-[#0F2419] placeholder:text-[#8BB8A0] font-semibold focus:border-[#1B6B4A] focus:ring-[#1B6B4A]/20 card-elevated"
            />
          </div>
        </motion.div>

        {/* Animals Grid */}
        <AnimatePresence mode="wait">
          {filteredAnimals.length === 0 ? (
            <motion.div
              key="empty"
              {...fadeUp}
              className="text-center py-16"
            >
              <div className="relative w-20 h-20 mx-auto mb-4">
                <div className="absolute inset-0 rounded-full animate-breathe" style={{ background: 'radial-gradient(circle, rgba(27,107,74,0.08) 0%, transparent 70%)' }} />
                <div className="relative w-20 h-20 rounded-full bg-[#E8F5EE] flex items-center justify-center">
                  <PawPrint className="w-10 h-10 text-[#7BC4A5]" />
                </div>
              </div>
              <h3 className="text-lg font-extrabold text-[#0F2419] mb-1">
                {search ? 'No Results' : 'No Animals Yet'}
              </h3>
              <p className="text-sm text-[#4A6B5D] font-medium">
                {search ? 'Try a different search term' : 'Add your first animal to get started'}
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="grid"
              variants={{ animate: { transition: { staggerChildren: 0.05 } } }}
              initial="initial"
              animate="animate"
              className="space-y-3"
            >
              {filteredAnimals.map((animal) => {
                const Icon = animalIcons[animal.type] || PawPrint
                const gradient = animalGradients[animal.type] || animalGradients.cow
                return (
                  <motion.div key={animal.id} variants={fadeUp}>
                    <div className="card-interactive rounded-2xl p-4">
                      <div className="flex items-center gap-4">
                        <div
                          className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                          style={{
                            background: gradient.bg,
                            boxShadow: `0 4px 12px ${gradient.shadow}`,
                          }}
                        >
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <div className="font-extrabold text-[#0F2419] text-base">#{animal.tag_number}</div>
                            <Badge className={`${statusColors[animal.status]} text-[10px] capitalize font-bold border-0 rounded-full px-2.5`}>
                              {animal.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-sm font-semibold text-[#4A6B5D] capitalize">{animal.type}</span>
                            <span className="text-[11px] text-[#8BB8A0]">•</span>
                            <span className="text-[11px] text-[#8BB8A0] font-semibold flex items-center gap-1">
                              <Stethoscope className="w-3 h-3" />
                              {new Date(animal.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-[#D0ECE1]" />
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
