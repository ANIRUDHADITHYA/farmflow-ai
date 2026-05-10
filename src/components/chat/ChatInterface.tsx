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
  History, Plus, MessageSquare, Trash2,
} from 'lucide-react'
import { ChatMessage, ChatSession } from '@/types'
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder'
import {
  getChatSessions, createChatSession, deleteChatSession,
  getChatMessages, saveChatMessage, updateChatSessionTitle,
} from '@/services/database'
import Image from 'next/image'

const quickActions = [
  { icon: Stethoscope, label: 'Log Treatment', prompt: 'I treated ', color: 'bg-gradient-to-br from-[#1B6B4A] to-[#2D9B6E]', iconColor: 'text-white' },
  { icon: Package, label: 'Update Stock', prompt: 'I have ', color: 'bg-gradient-to-br from-[#2D9B6E] to-[#7BC4A5]', iconColor: 'text-white' },
  { icon: FileText, label: 'Log Invoice', prompt: 'Invoice $', color: 'bg-gradient-to-br from-[#E8A838] to-[#F0C464]', iconColor: 'text-white' },
  { icon: Bell, label: 'Set Reminder', prompt: 'Remind me to ', color: 'bg-gradient-to-br from-[#4A6B5D] to-[#7BC4A5]', iconColor: 'text-white' },
]

const intentColors: Record<string, string> = {
  treatment: 'bg-[#E8F5EE] text-[#1B6B4A]',
  inventory: 'bg-[#E0F5EC] text-[#2D9B6E]',
  invoice: 'bg-[#FEF7E8] text-[#E8A838]',
  reminder: 'bg-[#E8F5EE] text-[#4A6B5D]',
  general: 'bg-[#F1F4F3] text-[#4A6B5D]',
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
  content: "Hey! I'm your FarmFlow AI assistant. Here's what I can do:\n\n• Log animal treatments & track withdrawal periods\n• Manage feed & supply inventory\n• Record expenses & invoices\n• Set smart reminders\n\nWhat can I help you with today?",
  timestamp: new Date().toISOString(),
  intent: 'general',
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE])
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [pendingAttachment, setPendingAttachment] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { isRecording, startRecording, stopRecording, duration } = useVoiceRecorder()

  // Load sessions on mount
  useEffect(() => {
    loadSessions()
  }, [])

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
      // Ensure we have a session (creates one on first message)
      const sessionId = await ensureSession(text)

      // Save user message to DB
      await saveChatMessage(sessionId, {
        role: 'user',
        content: userMessage.content,
        attachments: userMessage.attachments,
      })

      // Build conversation history for AI context (last 20 messages)
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

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message || 'Done!',
        timestamp: new Date().toISOString(),
        intent: data.intent,
        quickReplies: data.follow_up_questions,
      }

      setMessages(prev => [...prev, aiMessage])

      // Save assistant message to DB
      await saveChatMessage(sessionId, {
        role: 'assistant',
        content: aiMessage.content,
        intent: aiMessage.intent,
        quick_replies: aiMessage.quickReplies,
      })

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
    <div className="flex flex-col h-full bg-[#F8FAF9]">
      {/* Header — Gradient with glass effect */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #0F3D2A 0%, #1B6B4A 50%, #2D9B6E 100%)' }} />
        {/* Subtle mesh overlay */}
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 80% 20%, rgba(95,212,160,0.15) 0%, transparent 50%)' }} />
        <div className="relative px-5 py-4 flex items-center gap-3">
          <div className="relative">
            <div className="w-11 h-11 rounded-2xl overflow-hidden ring-2 ring-white/15 shadow-lg">
              <Image src="/icon.png" alt="FarmFlow AI" width={44} height={44} className="object-cover" />
            </div>
            {/* Online indicator */}
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#5FD4A0] border-2 border-[#1B6B4A]" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-[15px] font-bold text-white">FarmFlow AI</h1>
            <p className="text-[11px] font-semibold text-white/50">
              {isLoading ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#5FD4A0] animate-pulse" />
                  Thinking...
                </span>
              ) : 'Ready to help'}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={startNewSession}
              className="text-white/60 hover:text-white hover:bg-white/10 rounded-xl h-9 w-9 transition-all"
              title="New chat"
            >
              <Plus className="w-5 h-5" />
            </Button>
            <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white/60 hover:text-white hover:bg-white/10 rounded-xl h-9 w-9 transition-all"
                  title="Chat history"
                >
                  <History className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 p-0 bg-[#F8FAF9]">
                <SheetHeader className="px-5 py-4 relative overflow-hidden">
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #0F3D2A 0%, #1B6B4A 100%)' }} />
                  <SheetTitle className="relative text-white text-[15px] font-bold">Chat History</SheetTitle>
                </SheetHeader>
                <div className="p-3">
                  <button
                    onClick={startNewSession}
                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold text-sm transition-all duration-300 hover:scale-[1.01] active:scale-[0.99]"
                    style={{
                      background: 'linear-gradient(135deg, rgba(27,107,74,0.08), rgba(45,155,110,0.04))',
                      color: '#1B6B4A',
                    }}
                  >
                    <Plus className="w-4 h-4" />
                    New Chat
                  </button>
                  <ScrollArea className="h-[calc(100vh-180px)] mt-3">
                    <div className="space-y-1">
                      {sessions.length === 0 && (
                        <p className="text-xs text-[#8BB8A0] text-center py-8 font-semibold">No previous chats</p>
                      )}
                      {sessions.map(session => (
                        <div
                          key={session.id}
                          className={`group flex items-center gap-2 px-4 py-3 rounded-2xl cursor-pointer transition-all duration-200 ${
                            currentSessionId === session.id
                              ? 'text-white'
                              : 'hover:bg-[#E8F5EE] text-[#0F2419]'
                          }`}
                          style={currentSessionId === session.id ? {
                            background: 'linear-gradient(135deg, #1B6B4A, #2D9B6E)',
                            boxShadow: '0 4px 16px rgba(27,107,74,0.2)',
                          } : {}}
                        >
                          <MessageSquare className="w-4 h-4 shrink-0 opacity-50" />
                          <button
                            onClick={() => loadSession(session)}
                            className="flex-1 min-w-0 text-left"
                          >
                            <p className="text-sm font-semibold truncate">{session.title}</p>
                            <p className={`text-[10px] font-semibold ${
                              currentSessionId === session.id ? 'text-white/50' : 'text-[#8BB8A0]'
                            }`}>
                              {new Date(session.updated_at).toLocaleDateString('en-US', {
                                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                              })}
                            </p>
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteSession(session.id) }}
                            className={`opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-all ${
                              currentSessionId === session.id
                                ? 'hover:bg-white/20 text-white/50'
                                : 'hover:bg-[#DC3545]/10 text-[#DC3545]/60'
                            }`}
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

      {/* Messages */}
      <ScrollArea className="flex-1 overflow-y-auto premium-scroll" ref={scrollRef}>
        <div className="px-4 py-5 space-y-5 pb-2">
          {messages.map((message, index) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 14, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.3, delay: index === messages.length - 1 ? 0.1 : 0, ease: [0.4, 0, 0.2, 1] }}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[82%] ${message.role === 'user' ? 'order-1' : 'order-2'}`}>
                {/* Intent badge */}
                {message.role === 'assistant' && message.intent && message.intent !== 'general' && message.intent !== 'error' && (
                  <div className="mb-2 flex items-center gap-1.5">
                    {(() => {
                      const Icon = intentIcons[message.intent] || Sparkles
                      return <Icon className="w-3 h-3" />
                    })()}
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${intentColors[message.intent] || intentColors.general}`}>
                      {message.intent.charAt(0).toUpperCase() + message.intent.slice(1)}
                    </span>
                  </div>
                )}

                <div
                  className={`rounded-[20px] px-4 py-3 ${
                    message.role === 'user'
                      ? 'rounded-br-md text-white'
                      : 'rounded-bl-md text-[#0F2419] card-elevated'
                  }`}
                  style={message.role === 'user' ? {
                    background: 'linear-gradient(135deg, #1B6B4A 0%, #2D9B6E 100%)',
                    boxShadow: '0 2px 12px rgba(27,107,74,0.2)',
                  } : {}}
                >
                  {/* Attachments */}
                  {message.attachments && message.attachments.length > 0 && (
                    <div className="mb-2">
                      {message.attachments.map((url, i) => (
                        <img
                          key={i}
                          src={url}
                          alt="Attachment"
                          className="rounded-2xl max-h-48 object-cover w-full"
                        />
                      ))}
                    </div>
                  )}

                  <p className="text-[13px] leading-relaxed whitespace-pre-wrap font-medium">
                    {message.content}
                  </p>

                  <p
                    className={`text-[10px] mt-2 font-semibold ${
                      message.role === 'user' ? 'text-white/40' : 'text-[#8BB8A0]'
                    }`}
                    suppressHydrationWarning
                  >
                    {formatTime(message.timestamp)}
                  </p>
                </div>

                {/* Quick replies */}
                {message.quickReplies && message.quickReplies.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {message.quickReplies.map((reply, i) => (
                      <button
                        key={i}
                        onClick={() => handleQuickReply(reply)}
                        className="text-[11px] font-bold bg-[#E8F5EE] text-[#1B6B4A] rounded-full px-3.5 py-1.5 hover:bg-[#D0ECE1] transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
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
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex justify-start"
              >
                <div className="card-elevated rounded-[20px] rounded-bl-md px-5 py-4">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-[#1B6B4A] rounded-full animate-bounce opacity-60" />
                    <div className="w-2 h-2 bg-[#2D9B6E] rounded-full animate-bounce [animation-delay:0.15s] opacity-60" />
                    <div className="w-2 h-2 bg-[#7BC4A5] rounded-full animate-bounce [animation-delay:0.3s] opacity-60" />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </ScrollArea>

      {/* Quick Actions */}
      {messages.length <= 1 && !isLoading && (
        <div className="px-4 pb-3">
          <p className="text-[10px] font-bold text-[#8BB8A0] uppercase tracking-[0.15em] mb-2.5 px-1">Quick Actions</p>
          <div className="grid grid-cols-2 gap-2">
            {quickActions.map((action) => (
              <button
                key={action.label}
                onClick={() => handleQuickAction(action.prompt)}
                className="flex items-center gap-3 p-3.5 rounded-2xl card-interactive text-left group"
              >
                <div className={`w-10 h-10 rounded-xl ${action.color} flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-105`}
                  style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                >
                  <action.icon className={`w-[18px] h-[18px] ${action.iconColor}`} />
                </div>
                <span className="text-xs font-bold text-[#0F2419]">{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Image preview */}
      <AnimatePresence>
        {imagePreview && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 pb-2"
          >
            <div className="relative inline-block">
              <img src={imagePreview} alt="Preview" className="h-20 rounded-2xl object-cover" />
              <button
                onClick={() => {
                  setImagePreview(null)
                  setPendingAttachment(null)
                }}
                className="absolute -top-2 -right-2 w-6 h-6 bg-[#E63946] text-white rounded-full flex items-center justify-center shadow-md"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recording indicator */}
      <AnimatePresence>
        {isRecording && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 pb-2"
          >
            <div className="flex items-center gap-3 bg-[#DC3545]/8 text-[#DC3545] rounded-2xl px-4 py-3 border border-[#DC3545]/15">
              <div className="relative">
                <MicOff className="w-5 h-5" />
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#DC3545] rounded-full animate-pulse" />
              </div>
              <span className="text-sm font-bold">Recording... {formatDuration(duration)}</span>
              <button
                onClick={handleVoice}
                className="ml-auto text-xs bg-[#DC3545] text-white rounded-xl px-3.5 py-1.5 font-bold hover:bg-red-700 transition-colors"
              >
                Stop & Send
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="p-4 glass-strong border-t border-white/20">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleFileUpload}
            className="shrink-0 text-[#8BB8A0] hover:text-[#1B6B4A] hover:bg-[#E8F5EE] rounded-xl h-11 w-11 transition-all"
          >
            {imagePreview ? (
              <ImageIcon className="w-5 h-5 text-[#1B6B4A]" />
            ) : (
              <Camera className="w-5 h-5" />
            )}
          </Button>

          <div className="flex-1 relative">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isRecording ? 'Recording...' : 'Type your message...'}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              disabled={isRecording}
              className="rounded-2xl pr-4 h-11 bg-[#F1F4F3] border-[#E2E8E5] text-[#0F2419] font-medium placeholder:text-[#8BB8A0] focus:border-[#1B6B4A] focus:ring-[#1B6B4A]/20 transition-all"
            />
          </div>

          {input.trim() || pendingAttachment ? (
            <Button
              onClick={() => sendMessage()}
              disabled={isLoading}
              className="shrink-0 rounded-xl h-11 w-11 p-0 transition-all duration-300 hover:scale-105 active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #1B6B4A 0%, #2D9B6E 100%)',
                boxShadow: '0 4px 16px rgba(27,107,74,0.25)',
              }}
            >
              <Send className="w-4 h-4 text-white" />
            </Button>
          ) : (
            <Button
              variant={isRecording ? 'destructive' : 'ghost'}
              size="icon"
              onClick={handleVoice}
              className={`shrink-0 rounded-xl h-11 w-11 transition-all ${
                isRecording
                  ? 'bg-[#DC3545] hover:bg-red-700 text-white'
                  : 'text-[#8BB8A0] hover:text-[#1B6B4A] hover:bg-[#E8F5EE]'
              }`}
            >
              <Mic className="w-5 h-5" />
            </Button>
          )}
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
