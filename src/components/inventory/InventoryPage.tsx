'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import {
  Plus, Search, Package, AlertTriangle, Trash2, Warehouse,
} from 'lucide-react'
import type { InventoryItem } from '@/types'

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
}

function stockLevel(qty: number): { label: string; color: string; progress: number; badgeClass: string; gradient: string } {
  if (qty <= 0) return { label: 'Empty', color: '#DC3545', progress: 0, badgeClass: 'bg-[#DC3545]/10 text-[#DC3545]', gradient: 'linear-gradient(90deg, #DC3545, #DC3545)' }
  if (qty < 5) return { label: 'Critical', color: '#DC3545', progress: Math.min(qty * 5, 25), badgeClass: 'bg-[#DC3545]/10 text-[#DC3545]', gradient: 'linear-gradient(90deg, #DC3545, #FF6B7A)' }
  if (qty < 10) return { label: 'Low', color: '#E8A838', progress: Math.min(qty * 5, 50), badgeClass: 'bg-[#FEF7E8] text-[#E8A838]', gradient: 'linear-gradient(90deg, #E8A838, #F0C464)' }
  if (qty < 25) return { label: 'Good', color: '#2D9B6E', progress: Math.min(qty * 3, 75), badgeClass: 'bg-[#E8F5EE] text-[#1B6B4A]', gradient: 'linear-gradient(90deg, #2D9B6E, #7BC4A5)' }
  return { label: 'Full', color: '#1B6B4A', progress: 100, badgeClass: 'bg-[#E8F5EE] text-[#1B6B4A]', gradient: 'linear-gradient(90deg, #1B6B4A, #2D9B6E)' }
}

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newQty, setNewQty] = useState('')
  const [newUnit, setNewUnit] = useState('units')

  useEffect(() => {
    loadInventory()
  }, [])

  const loadInventory = async () => {
    try {
      const res = await fetch('/api/inventory')
      const data = await res.json()
      setItems(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Failed to load inventory:', error)
    } finally {
      setLoading(false)
    }
  }

  const addItem = async () => {
    if (!newName.trim()) return
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_name: newName, quantity: parseInt(newQty) || 0, unit: newUnit }),
      })
      if (res.ok) {
        setNewName('')
        setNewQty('')
        setNewUnit('units')
        setDialogOpen(false)
        loadInventory()
      }
    } catch (error) {
      console.error('Failed to add item:', error)
    }
  }

  const deleteItem = async (id: string) => {
    try {
      const res = await fetch(`/api/inventory?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        setItems(prev => prev.filter(i => i.id !== id))
      }
    } catch (error) {
      console.error('Failed to delete item:', error)
    }
  }

  const filteredItems = items.filter((item) =>
    item.item_name.toLowerCase().includes(search.toLowerCase())
  )

  const lowStockCount = items.filter(i => i.quantity < 10).length

  if (loading) {
    return (
      <div className="min-h-full gradient-mesh">
        <div className="max-w-lg mx-auto px-5 py-6 pb-28">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="skeleton h-8 w-24 mb-2" />
              <div className="skeleton h-4 w-36" />
            </div>
            <div className="skeleton h-11 w-20 rounded-2xl" />
          </div>
          <div className="skeleton h-12 w-full rounded-2xl mb-5" />
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton h-24 rounded-2xl" />
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
            <h1 className="text-[28px] font-extrabold text-[#0F2419] tracking-tight">Stock</h1>
            <p className="text-sm font-semibold text-[#4A6B5D] mt-0.5">
              {items.length} item{items.length !== 1 ? 's' : ''}
              {lowStockCount > 0 && (
                <span className="text-[#DC3545] ml-1 font-bold">• {lowStockCount} low</span>
              )}
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
                <DialogTitle className="text-[#0F2419] text-lg font-extrabold">Add Stock Item</DialogTitle>
              </DialogHeader>
              <div className="space-y-5 mt-3">
                <div>
                  <label className="text-sm font-bold text-[#0F2419] mb-2 block">Item Name</label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g., Cattle feed"
                    className="rounded-2xl h-12 bg-[#F8FAF9] border-[#E2E8E5] text-[#0F2419] font-semibold focus:border-[#1B6B4A] focus:ring-[#1B6B4A]/20"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-bold text-[#0F2419] mb-2 block">Quantity</label>
                    <Input
                      type="number"
                      value={newQty}
                      onChange={(e) => setNewQty(e.target.value)}
                      placeholder="0"
                      className="rounded-2xl h-12 bg-[#F8FAF9] border-[#E2E8E5] text-[#0F2419] font-semibold focus:border-[#1B6B4A] focus:ring-[#1B6B4A]/20"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-bold text-[#0F2419] mb-2 block">Unit</label>
                    <select
                      value={newUnit}
                      onChange={(e) => setNewUnit(e.target.value)}
                      className="w-full h-12 rounded-2xl border border-[#E2E8E5] bg-[#F8FAF9] px-4 text-sm font-semibold text-[#0F2419] focus:border-[#1B6B4A] focus:ring-1 focus:ring-[#1B6B4A]/20 outline-none transition-all"
                    >
                      <option value="units">units</option>
                      <option value="kg">kg</option>
                      <option value="liters">liters</option>
                      <option value="bags">bags</option>
                      <option value="bottles">bottles</option>
                      <option value="doses">doses</option>
                    </select>
                  </div>
                </div>
                <Button
                  onClick={addItem}
                  className="w-full rounded-2xl h-12 font-bold text-white transition-all duration-300 hover:scale-[1.01] active:scale-[0.99]"
                  style={{
                    background: 'linear-gradient(135deg, #1B6B4A 0%, #2D9B6E 100%)',
                    boxShadow: '0 4px 16px rgba(27,107,74,0.25)',
                  }}
                  disabled={!newName.trim()}
                >
                  Add Item
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
              placeholder="Search stock items..."
              className="pl-11 rounded-2xl h-12 bg-white border-[#E2E8E5] text-[#0F2419] placeholder:text-[#8BB8A0] font-semibold focus:border-[#1B6B4A] focus:ring-[#1B6B4A]/20 card-elevated"
            />
          </div>
        </motion.div>

        {/* Inventory list */}
        <AnimatePresence mode="wait">
          {filteredItems.length === 0 ? (
            <motion.div key="empty" {...fadeUp} className="text-center py-16">
              <div className="relative w-20 h-20 mx-auto mb-4">
                <div className="absolute inset-0 rounded-full animate-breathe" style={{ background: 'radial-gradient(circle, rgba(45,155,110,0.08) 0%, transparent 70%)' }} />
                <div className="relative w-20 h-20 rounded-full bg-[#E0F5EC] flex items-center justify-center">
                  <Package className="w-10 h-10 text-[#7BC4A5]" />
                </div>
              </div>
              <h3 className="text-lg font-extrabold text-[#0F2419] mb-1">
                {search ? 'No Results' : 'No Stock Items'}
              </h3>
              <p className="text-sm text-[#4A6B5D] font-medium">
                {search ? 'Try a different search' : 'Add items or let FarmClerk AI track them'}
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="list"
              variants={{ animate: { transition: { staggerChildren: 0.04 } } }}
              initial="initial"
              animate="animate"
              className="space-y-3"
            >
              {filteredItems.map((item) => {
                const stock = stockLevel(item.quantity)
                return (
                  <motion.div key={item.id} variants={fadeUp}>
                    <div className="card-interactive rounded-2xl p-4">
                      <div className="flex items-center gap-4">
                        <div
                          className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                          style={{
                            background: stock.gradient,
                            boxShadow: `0 4px 12px ${stock.color}25`,
                          }}
                        >
                          <Package className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-bold text-[#0F2419] text-sm truncate">{item.item_name}</span>
                            <Badge className={`${stock.badgeClass} text-[10px] font-bold border-0 rounded-full px-2.5`}>
                              {stock.label}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between mb-2.5">
                            <span className="text-sm font-bold text-[#4A6B5D]">
                              {item.quantity} {item.unit}
                            </span>
                          </div>
                          <div className="h-1.5 bg-[#F1F4F3] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700 ease-out"
                              style={{
                                width: `${stock.progress}%`,
                                background: stock.gradient,
                              }}
                            />
                          </div>
                        </div>
                        <button
                          onClick={() => deleteItem(item.id)}
                          className="w-9 h-9 rounded-xl bg-[#F8FAF9] flex items-center justify-center text-[#8BB8A0] hover:text-[#DC3545] hover:bg-[#DC3545]/8 transition-all duration-200"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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
