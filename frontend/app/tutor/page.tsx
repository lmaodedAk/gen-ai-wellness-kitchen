'use client'
import { useState } from 'react'
import { useAuthStore } from '@/lib/store'
import { GraduationCap, Send, Lightbulb, ChefHat, Leaf, Sparkles } from 'lucide-react'

const QUICK_QUESTIONS = [
  "Why should you soak rice before cooking?",
  "What is saffron used for?",
  "How do I make the perfect dough for chapati?",
  "What is the difference between ghee and butter?",
  "Why does tadka (tempering) make food taste better?",
  "How do I know when oil is hot enough for frying?",
  "What are the health benefits of turmeric?",
  "How to reduce spice level if food is too hot?",
]

interface Message {
  role: 'user' | 'ai'
  text: string
  data?: any
}

export default function TutorPage() {
  const token = useAuthStore((s: any) => s.accessToken)
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'ai',
      text: "Namaste! 👨‍🍳 I'm your AI Cooking Tutor. Ask me anything about cooking techniques, ingredients, nutrition, or culinary science. I'll explain it like a patient chef!",
      data: null
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  async function askQuestion(q: string) {
    if (!q.trim() || loading) return
    const currentToken = typeof window !== 'undefined' ? localStorage.getItem('access_token') : token
    
    setMessages(prev => [...prev, { role: 'user', text: q }])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('http://localhost:8000/tutor/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentToken}` },
        body: JSON.stringify({ question: q })
      })
      const json = await res.json()
      if (json.success) {
        setMessages(prev => [...prev, { role: 'ai', text: json.data.answer, data: json.data }])
      } else {
        setMessages(prev => [...prev, { role: 'ai', text: "Sorry, I couldn't process that. Try again!" }])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'ai', text: "Connection error. Please check if the backend is running." }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] fade-up">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center">
          <GraduationCap className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">AI Cooking Tutor</h1>
          <p className="text-gray-500 text-sm">Ask anything about cooking, ingredients, nutrition & culinary science</p>
        </div>
      </div>

      {/* Quick question chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        {QUICK_QUESTIONS.slice(0,4).map((q, i) => (
          <button
            key={i}
            onClick={() => askQuestion(q)}
            className="text-xs px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full hover:bg-amber-100 transition"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'ai' && (
              <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center mr-2 flex-shrink-0 mt-1">
                <ChefHat className="w-4 h-4 text-white" />
              </div>
            )}
            <div className={`max-w-[75%] space-y-2`}>
              <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-brand-500 text-white rounded-tr-sm'
                  : 'bg-white border border-gray-100 text-gray-800 rounded-tl-sm shadow-sm'
              }`}>
                {msg.text}
              </div>
              
              {/* Rich AI response details */}
              {msg.role === 'ai' && msg.data && (
                <div className="space-y-2 ml-1">
                  {msg.data.cooking_tips?.length > 0 && (
                    <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                      <p className="text-xs font-bold text-amber-800 mb-1.5 flex items-center gap-1">
                        <ChefHat className="w-3 h-3" /> Chef Tips
                      </p>
                      {msg.data.cooking_tips.map((tip: string, j: number) => (
                        <p key={j} className="text-xs text-amber-700 mb-1">• {tip}</p>
                      ))}
                    </div>
                  )}
                  {msg.data.nutrition_tip && (
                    <div className="bg-green-50 rounded-xl p-3 border border-green-100">
                      <p className="text-xs font-bold text-green-800 mb-1 flex items-center gap-1">
                        <Leaf className="w-3 h-3" /> Nutrition
                      </p>
                      <p className="text-xs text-green-700">{msg.data.nutrition_tip}</p>
                    </div>
                  )}
                  {msg.data.did_you_know && (
                    <div className="bg-purple-50 rounded-xl p-3 border border-purple-100">
                      <p className="text-xs font-bold text-purple-800 mb-1 flex items-center gap-1">
                        <Lightbulb className="w-3 h-3" /> Did You Know?
                      </p>
                      <p className="text-xs text-purple-700">{msg.data.did_you_know}</p>
                    </div>
                  )}
                  {msg.data.related_questions?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {msg.data.related_questions.map((q: string, j: number) => (
                        <button
                          key={j}
                          onClick={() => askQuestion(q)}
                          className="text-[11px] px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full hover:bg-brand-50 hover:text-brand-600 transition"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        
        {loading && (
          <div className="flex justify-start">
            <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center mr-2 flex-shrink-0">
              <ChefHat className="w-4 h-4 text-white" />
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{animationDelay:'0ms'}} />
                <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{animationDelay:'150ms'}} />
                <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{animationDelay:'300ms'}} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="flex gap-2 bg-white border border-gray-200 rounded-2xl p-2 shadow-sm">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && askQuestion(input)}
          placeholder="Ask anything about cooking... (e.g. why does yoga affect digestion?)"
          className="flex-1 bg-transparent text-sm outline-none px-2"
        />
        <button
          onClick={() => askQuestion(input)}
          disabled={!input.trim() || loading}
          className="bg-amber-500 text-white rounded-xl p-2.5 hover:bg-amber-600 transition disabled:opacity-40"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
