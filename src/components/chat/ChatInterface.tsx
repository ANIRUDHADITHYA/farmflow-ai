'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet'
import {
  Mic, MicOff, Camera, Send, Bot, User, ImageIcon, X,
  Stethoscope, Package, FileText, Bell, Sparkles,
  History, Plus, MessageSquare, Trash2, ArrowUp,
  Paperclip, Leaf, Zap, ChevronDown,
} from 'lucide-react'
import { ChatMessage, ChatSession, FarmContext } from '@/types'
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder'
import {
  getChatSessions, createChatSession, deleteChatSession,
  getChatMessages, saveChatMessage, updateChatSessionTitle,
} from '@/services/database'
import Image from 'next/image'

const quickActions = [
  { icon: Stethoscope, label: 'Log Treatment', prompt: 'I treated ', description: 'Record animal care', color: 'from-emerald-500 to-teal-500' },
  { icon: Package, label: 'Update Stock', prompt: 'I have ', description: 'Manage inventory', color: 'from-cyan-500 to-blue-500' },
  { icon: FileText, label: 'Log Invoice', prompt: 'Invoice $', description: 'Track expenses', color: 'from-amber-500 to-orange-500' },
  { icon: Bell, label: 'Set Reminder', prompt: 'Remind me to ', description: 'Never forget tasks', color: 'from-violet-500 to-purple-500' },
]

const intentColors: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  treatment: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: 'text-emerald-500' },
  inventory: { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', icon: 'text-cyan-500' },
  invoice: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: 'text-amber-500' },
  reminder: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', icon: 'text-violet-500' },
  general: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', icon: 'text-slate-400' },
}

const intentIcons: Record<string, React.ElementType> = {
  treatment: Stethoscope,
  inventory: Package,
  invoice: FileText,
  reminder: Bell,
  general: Sparkles,
}

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: "Hello! I'm your FarmClerk AI assistant. I can help you manage your farm operations seamlessly.\n\nHere's what I can do:\n\n🩺 Log treatments & track withdrawal periods\n📦 Manage feed & supply inventory\n📄 Record expenses & invoices\n🔔 Set smart reminders\n\nHow can I help you today?",
  timestamp: new Date().toISOString(),
  intent: 'general',
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE])
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [quickActionsOpen, setQuickActionsOpen] = useState(false)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [pendingAttachment, setPendingAttachment] = useState<string | null>(null)
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    intent: string;
    data: Record<string, unknown>;
  } | null>(null)
  const [draftData, setDraftData] = useState<Record<string, unknown>>({})
  const [draftIntent, setDraftIntent] = useState<string | null>(null)
  const farmContextRef = useRef<FarmContext | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { isRecording, startRecording, stopRecording, duration } = useVoiceRecorder()

  // Load sessions and farm context on mount
  useEffect(() => {
    loadSessions()
    loadFarmContext()
  }, [])

  const loadFarmContext = async () => {
    try {
      const res = await fetch('/api/farm-context')
      const ctx = await res.json()
      farmContextRef.current = ctx
    } catch (e) {
      console.error('Failed to load farm context:', e)
    }
  }

  const loadSessions = async () => {
    try {
      const data = await getChatSessions()
      setSessions(data)
    } catch (e) {
      console.error('Failed to load chat sessions:', e)
    }
  }

  const startNewSession = () => {
    setCurrentSessionId(null)
    setMessages([WELCOME_MESSAGE])
    setHistoryOpen(false)
    setPendingConfirmation(null)
    setDraftData({})
    setDraftIntent(null)
  }

  const loadSession = async (session: ChatSession) => {
    try {
      const rows = await getChatMessages(session.id)
      const loaded: ChatMessage[] = rows.map(r => ({
        id: r.id,
        role: r.role,
        content: r.content,
        timestamp: r.created_at,
        intent: r.intent || undefined,
        attachments: r.attachments || undefined,
        quickReplies: r.quick_replies || undefined,
      }))
      setCurrentSessionId(session.id)
      setMessages(loaded.length > 0 ? loaded : [WELCOME_MESSAGE])
      setHistoryOpen(false)
    } catch (e) {
      console.error('Failed to load session messages:', e)
    }
  }

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await deleteChatSession(sessionId)
      setSessions(prev => prev.filter(s => s.id !== sessionId))
      if (currentSessionId === sessionId) {
        startNewSession()
      }
    } catch (e) {
      console.error('Failed to delete session:', e)
    }
  }

  const ensureSession = async (firstMessage: string): Promise<string> => {
    if (currentSessionId) return currentSessionId
    const title = firstMessage.slice(0, 50) || 'New Chat'
    const session = await createChatSession(title)
    setCurrentSessionId(session.id)
    setSessions(prev => [session, ...prev])
    return session.id
  }

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading, scrollToBottom])

  const sendMessage = async (overrideMessage?: string) => {
    const text = overrideMessage || input.trim()
    if (!text && !pendingAttachment) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text || 'Uploaded an image for analysis',
      timestamp: new Date().toISOString(),
      attachments: pendingAttachment ? [pendingAttachment] : undefined,
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setImagePreview(null)
    setPendingAttachment(null)
    setIsLoading(true)

    try {
      const sessionId = await ensureSession(text)

      // Save user message to DB
      await saveChatMessage(sessionId, {
        role: 'user',
        content: userMessage.content,
        attachments: userMessage.attachments,
      })

      // Check if user is confirming or cancelling a pending action
      const lowerText = text.toLowerCase().trim()
      const isConfirm = pendingConfirmation && (
        lowerText.includes('confirm') || lowerText === 'yes' ||
        lowerText.includes('save') || lowerText.includes('go ahead') ||
        lowerText.includes('looks good') || text.startsWith('✅')
      )
      const isCancel = pendingConfirmation && (
        lowerText === 'cancel' || lowerText === 'no' ||
        lowerText.includes("don't save") || lowerText.includes('stop') ||
        text.startsWith('❌')
      )

      if (isConfirm && pendingConfirmation) {
        // Send confirmed data to API for DB write
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            confirmed: true,
            confirmedData: pendingConfirmation,
          }),
        })

        const data = await response.json()

        const aiMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.message || '✅ Saved successfully!',
          timestamp: new Date().toISOString(),
          intent: data.intent,
          quickReplies: data.follow_up_questions,
        }

        setMessages(prev => [...prev, aiMessage])
        setPendingConfirmation(null)
        setDraftData({})
        setDraftIntent(null)

        // Refresh farm context after DB write
        loadFarmContext()

        await saveChatMessage(sessionId, {
          role: 'assistant',
          content: aiMessage.content,
          intent: aiMessage.intent,
          quick_replies: aiMessage.quickReplies,
        })
      } else if (isCancel) {
        const aiMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'No problem! The action has been cancelled. Nothing was saved. What else can I help with?',
          timestamp: new Date().toISOString(),
          intent: 'general',
        }

        setMessages(prev => [...prev, aiMessage])
        setPendingConfirmation(null)
        setDraftData({})
        setDraftIntent(null)

        await saveChatMessage(sessionId, {
          role: 'assistant',
          content: aiMessage.content,
          intent: aiMessage.intent,
        })
      } else {
        // Normal message — send to AI with conversation history
        const history = messages
          .filter(m => m.id !== 'welcome')
          .slice(-20)
          .map(m => ({ role: m.role, content: m.content }))

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            attachments: pendingAttachment ? [pendingAttachment] : undefined,
            history,
          }),
        })

        const data = await response.json()

        // Merge draft data for multi-turn conversations
        if (data.intent && data.intent !== 'general') {
          const newIntent = data.intent
          const newData = data.data || {}

          if (draftIntent === newIntent) {
            // Same intent — merge accumulated data
            const merged = { ...draftData, ...newData }
            data.data = merged
            setDraftData(merged)
          } else {
            // New intent — reset draft
            setDraftData(newData)
            setDraftIntent(newIntent)
          }
        }

        // Check if this is a confirmation request
        if (data.needs_confirmation) {
          setPendingConfirmation({
            intent: data.intent,
            data: data.data,
          })
        }

        const aiMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.message || 'Done!',
          timestamp: new Date().toISOString(),
          intent: data.intent,
          quickReplies: data.follow_up_questions,
        }

        setMessages(prev => [...prev, aiMessage])

        await saveChatMessage(sessionId, {
          role: 'assistant',
          content: aiMessage.content,
          intent: aiMessage.intent,
          quick_replies: aiMessage.quickReplies,
        })
      }

      // Update session title from first user message
      if (messages.length <= 1) {
        await updateChatSessionTitle(sessionId, text.slice(0, 50))
        setSessions(prev =>
          prev.map(s => s.id === sessionId ? { ...s, title: text.slice(0, 50), updated_at: new Date().toISOString() } : s)
        )
      }
    } catch (error) {
      console.error('Error sending message:', error)
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Sorry, something went wrong. Please try again.',
          timestamp: new Date().toISOString(),
          intent: 'error',
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleVoice = async () => {
    if (isRecording) {
      const blob = await stopRecording()
      if (!blob) return

      setIsLoading(true)
      try {
        const formData = new FormData()
        formData.append('audio', blob, 'recording.webm')

        const res = await fetch('/api/transcribe', {
          method: 'POST',
          body: formData,
        })

        const { text } = await res.json()
        if (text) {
          setInput(text)
          await sendMessage(text)
        }
      } catch (error) {
        console.error('Transcription error:', error)
      } finally {
        setIsLoading(false)
      }
    } else {
      await startRecording()
    }
  }

  const handleFileUpload = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => setImagePreview(ev.target?.result as string)
    reader.readAsDataURL(file)

    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}.${fileExt}`
    const { error } = await supabase.storage
      .from('invoices')
      .upload(fileName, file)

    if (error) {
      console.error('Upload error:', error)
      setImagePreview(null)
      return
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('invoices').getPublicUrl(fileName)
    setPendingAttachment(publicUrl)

    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleQuickAction = (prompt: string) => {
    setInput(prompt)
    inputRef.current?.focus()
  }

  const handleQuickReply = (reply: string) => {
    sendMessage(reply)
  }

  const formatTime = (ts: string) =>
    new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="chat-container flex flex-col h-full bg-gradient-to-b from-white via-slate-50/50 to-slate-50">
      {/* ─── Header ─── */}
      <div className="chat-header relative z-10 overflow-hidden">
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #0F3D2A 0%, #1B6B4A 50%, #2D9B6E 100%)' }} />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 80% 20%, rgba(95,212,160,0.15) 0%, transparent 50%)' }} />
        <div className="relative px-4 py-3.5 flex items-center gap-3">
          {/* Avatar */}
          <div className="relative">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/20 shadow-lg">
              <Leaf className="w-5 h-5 text-white" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#1B6B4A]" />
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-[17px] font-bold text-white tracking-tight">FarmClerk AI</h1>
            <p className="text-[13px] font-medium text-white/50">
              {isLoading ? (
                <span className="flex items-center gap-1.5 text-emerald-300">
                  <span className="flex gap-0.5">
                    <span className="w-1 h-1 rounded-full bg-emerald-300 animate-bounce" />
                    <span className="w-1 h-1 rounded-full bg-emerald-300 animate-bounce [animation-delay:0.1s]" />
                    <span className="w-1 h-1 rounded-full bg-emerald-300 animate-bounce [animation-delay:0.2s]" />
                  </span>
                  Thinking...
                </span>
              ) : 'Online • Ready to help'}
            </p>
          </div>

          <div className="flex items-center gap-0.5">
            <button
              onClick={startNewSession}
              className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-all duration-200"
              title="New chat"
            >
              <Plus className="w-[18px] h-[18px]" />
            </button>

            <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
              <SheetTrigger asChild>
                <button
                  className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-all duration-200"
                  title="Chat history"
                >
                  <History className="w-[18px] h-[18px]" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 p-0 bg-white border-r border-slate-100">
                <SheetHeader className="px-5 pt-6 pb-4">
                  <SheetTitle className="text-lg font-semibold text-slate-800">Chat History</SheetTitle>
                </SheetHeader>
                <div className="px-3">
                  <button
                    onClick={startNewSession}
                    className="w-full flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Start New Chat
                  </button>
                  <ScrollArea className="h-[calc(100vh-160px)] mt-3">
                    <div className="space-y-0.5">
                      {sessions.length === 0 && (
                        <div className="text-center py-12">
                          <MessageSquare className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                          <p className="text-xs text-slate-400">No previous chats</p>
                        </div>
                      )}
                      {sessions.map(session => (
                        <div
                          key={session.id}
                          className={`group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ${
                            currentSessionId === session.id
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <MessageSquare className={`w-4 h-4 shrink-0 ${currentSessionId === session.id ? 'text-emerald-500' : 'text-slate-300'}`} />
                          <button
                            onClick={() => loadSession(session)}
                            className="flex-1 min-w-0 text-left"
                          >
                            <p className="text-sm font-medium truncate">{session.title}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {new Date(session.updated_at).toLocaleDateString('en-US', {
                                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                              })}
                            </p>
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteSession(session.id) }}
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition-all"
                            title="Delete session"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      {/* ─── Messages ─── */}
      <ScrollArea className="flex-1 overflow-y-auto" ref={scrollRef}>
        <div className="chat-messages px-4 py-6 space-y-6 max-w-2xl mx-auto w-full">
          {messages.map((message, index) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: index === messages.length - 1 ? 0.08 : 0, ease: [0.25, 0.1, 0.25, 1] }}
              className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {/* Avatar */}
              <div className="shrink-0 mt-1">
                {message.role === 'assistant' ? (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-sm">
                    <Leaf className="w-4 h-4 text-white" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center shadow-sm">
                    <User className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>

              <div className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'} max-w-[80%]`}>
                {/* Sender name */}
                <span className="text-[13px] font-medium text-slate-400 mb-1 px-1">
                  {message.role === 'assistant' ? 'FarmClerk AI' : 'You'}
                </span>

                {/* Intent badge */}
                {message.role === 'assistant' && message.intent && message.intent !== 'general' && message.intent !== 'error' && (
                  <div className="mb-1.5 flex items-center gap-1.5">
                    {(() => {
                      const Icon = intentIcons[message.intent] || Sparkles
                      const colors = intentColors[message.intent] || intentColors.general
                      return (
                        <span className={`inline-flex items-center gap-1 text-[12px] font-semibold px-2.5 py-0.5 rounded-full border ${colors.bg} ${colors.text} ${colors.border}`}>
                          <Icon className={`w-3 h-3 ${colors.icon}`} />
                          {message.intent.charAt(0).toUpperCase() + message.intent.slice(1)}
                        </span>
                      )
                    })()}
                  </div>
                )}

                {/* Message bubble */}
                <div
                  className={`relative rounded-2xl px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-slate-100 text-slate-800 rounded-tr-md'
                      : 'bg-white text-slate-700 rounded-tl-md shadow-sm border border-slate-100'
                  }`}
                >
                  {/* Attachments */}
                  {message.attachments && message.attachments.length > 0 && (
                    <div className="mb-2.5">
                      {message.attachments.map((url, i) => (
                        <img
                          key={i}
                          src={url}
                          alt="Attachment"
                          className="rounded-xl max-h-48 object-cover w-full"
                        />
                      ))}
                    </div>
                  )}

                  <p className="text-[18px] leading-[1.75] whitespace-pre-wrap font-normal">
                    {message.content}
                  </p>
                </div>

                {/* Timestamp */}
                <p className="text-[12px] text-slate-400 mt-1 px-1" suppressHydrationWarning>
                  {formatTime(message.timestamp)}
                </p>

                {/* Quick replies */}
                {message.quickReplies && message.quickReplies.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {message.quickReplies.map((reply, i) => (
                      <button
                        key={i}
                        onClick={() => handleQuickReply(reply)}
                        className="text-[13px] font-medium bg-white text-emerald-600 rounded-full px-3.5 py-2 border border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300 transition-all duration-200 shadow-sm"
                      >
                        {reply}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}

          {/* Typing indicator */}
          <AnimatePresence>
            {isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex gap-3"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-sm shrink-0">
                  <Leaf className="w-4 h-4 text-white" />
                </div>
                <div className="flex flex-col items-start">
                  <span className="text-[11px] font-medium text-slate-400 mb-1 px-1">FarmClerk AI</span>
                  <div className="bg-white rounded-2xl rounded-tl-md px-5 py-3.5 shadow-sm border border-slate-100">
                    <div className="flex items-center gap-1">
                      <div className="typing-dot w-2 h-2 bg-emerald-400 rounded-full" style={{ animationDelay: '0ms' }} />
                      <div className="typing-dot w-2 h-2 bg-emerald-400 rounded-full" style={{ animationDelay: '150ms' }} />
                      <div className="typing-dot w-2 h-2 bg-emerald-400 rounded-full" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </ScrollArea>

      {/* ─── Quick Actions Expandable ─── */}
      <AnimatePresence>
        {quickActionsOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden border-t border-slate-100 bg-white/90 backdrop-blur-xl"
          >
            <div className="px-4 py-3 max-w-2xl mx-auto w-full">
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider">Quick Actions</p>
                <button
                  onClick={() => setQuickActionsOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {quickActions.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => { handleQuickAction(action.prompt); setQuickActionsOpen(false) }}
                    className="group flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 hover:shadow-sm text-left transition-all duration-200 shrink-0"
                  >
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${action.color} flex items-center justify-center shadow-sm`}>
                      <action.icon className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <span className="text-[13px] font-semibold text-slate-700 block whitespace-nowrap">{action.label}</span>
                      <span className="text-[11px] text-slate-400 whitespace-nowrap">{action.description}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Image Preview ─── */}
      <AnimatePresence>
        {imagePreview && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 pb-2 max-w-2xl mx-auto w-full"
          >
            <div className="relative inline-block bg-white rounded-xl p-1.5 border border-slate-100 shadow-sm">
              <img src={imagePreview} alt="Preview" className="h-20 rounded-lg object-cover" />
              <button
                onClick={() => {
                  setImagePreview(null)
                  setPendingAttachment(null)
                }}
                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md hover:bg-red-600 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Recording Indicator ─── */}
      <AnimatePresence>
        {isRecording && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 pb-2 max-w-2xl mx-auto w-full"
          >
            <div className="flex items-center gap-3 bg-red-50 text-red-600 rounded-2xl px-4 py-3 border border-red-100">
              <div className="relative">
                <Mic className="w-5 h-5" />
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              </div>
              <span className="text-sm font-medium">Recording... {formatDuration(duration)}</span>
              <button
                onClick={handleVoice}
                className="ml-auto text-xs bg-red-500 text-white rounded-lg px-3 py-1.5 font-medium hover:bg-red-600 transition-colors"
              >
                Stop & Send
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Input Area ─── */}
      <div className="chat-input-area bg-white/80 backdrop-blur-xl border-t border-slate-100 px-4 py-3">
        <div className="max-w-2xl mx-auto w-full">
          <div className="flex items-center gap-2 bg-slate-50 rounded-2xl border border-slate-200 focus-within:border-emerald-300 focus-within:ring-2 focus-within:ring-emerald-500/10 transition-all duration-200 pr-1.5">
            {/* Attachment button */}
            <button
              onClick={handleFileUpload}
              className="shrink-0 p-2.5 ml-1 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <Paperclip className="w-[18px] h-[18px]" />
            </button>

            {/* Quick Actions toggle */}
            <button
              onClick={() => setQuickActionsOpen(prev => !prev)}
              className={`shrink-0 p-2 rounded-xl transition-colors ${
                quickActionsOpen
                  ? 'text-emerald-600 bg-emerald-50'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
              }`}
              title="Quick Actions"
            >
              <Zap className="w-[18px] h-[18px]" />
            </button>

            {/* Text input */}
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isRecording ? 'Recording...' : 'Message FarmClerk AI...'}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              disabled={isRecording}
              className="flex-1 bg-transparent py-3 text-[15px] text-slate-700 placeholder:text-slate-400 focus:outline-none font-medium"
            />

            {/* Voice / Send button */}
            {input.trim() || pendingAttachment ? (
              <button
                onClick={() => sendMessage()}
                disabled={isLoading}
                className="shrink-0 w-9 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 flex items-center justify-center transition-all duration-200 shadow-sm disabled:opacity-50"
              >
                <ArrowUp className="w-[18px] h-[18px] text-white" strokeWidth={2.5} />
              </button>
            ) : (
              <button
                onClick={handleVoice}
                className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 ${
                  isRecording
                    ? 'bg-red-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Mic className="w-[18px] h-[18px]" />
              </button>
            )}
          </div>

          <p className="text-[12px] text-slate-400 text-center mt-2 font-medium">
            FarmClerk AI can make mistakes. Verify important information.
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </div>
  )
}
