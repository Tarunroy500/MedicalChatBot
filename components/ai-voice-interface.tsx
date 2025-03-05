"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Mic, Send, Upload, X, Loader2, Volume2, User, Bot } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export function AIVoiceInterface() {
  // Add a mounted flag
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  // Initialize conversation state with lazy initializer
  const [conversation, setConversation] = useState<Array<{ type: "user" | "ai"; content: string }>>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("conversationHistory")
      if (stored) return JSON.parse(stored)
    }
    return [{ type: "ai", content: "Hello, I'm your medical assistant. How can I help you today?" }]
  })

  const [query, setQuery] = useState("")
  const [isListening, setIsListening] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [image, setImage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const [useTavily, setUseTavily] = useState(false) // New state for Tavily option

  // Persist conversation history to localStorage on every update
  useEffect(() => {
    localStorage.setItem("conversationHistory", JSON.stringify(conversation))
    // Auto-scroll to bottom of conversation
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }, [conversation])

  // Clear history function
  const clearHistory = () => {
    setConversation([{ type: "ai", content: "Hello, I'm your medical assistant. How can I help you today?" }])
    localStorage.removeItem("conversationHistory")
  }

  // Speech recognition setup
  const startListening = () => {
    if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      const recognition = new SpeechRecognition()

      recognition.lang = "en-US"
      recognition.interimResults = false

      recognition.onstart = () => {
        setIsListening(true)
      }

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript
        setQuery(transcript)
      }

      recognition.onend = () => { 
        setIsListening(false)
      }

      recognition.start()
    } else {
      alert("Speech recognition is not supported in your browser.")
    }
  }

  // Handle image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setImage(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  // Handle image removal
  const removeImage = () => {
    setImage(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query && !image) return

    // Add user message to conversation
    const userMessage = query || "Sent an image"
    setConversation((prev) => [...prev, { type: "user", content: userMessage }])
    setIsLoading(true)

    try {
      // Pass converted chatHistory to match API expectations ("user" remains, "ai" maps to "assistant")
      const convertedHistory = conversation.map(msg => ({
        role: msg.type === "user" ? "user" : "assistant",
        content: msg.content
      }))
      
      // Include the Tavily option in the request
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, image, chatHistory: convertedHistory, useTavily })
      })
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Fetch error:", errorData.error);
        throw new Error("Failed to get AI response");
      }
      const data = await response.json()
      const aiResponse = data.reply
      setConversation((prev) => [...prev, { type: "ai", content: aiResponse }])
      
      speakResponse(aiResponse)
    } catch (error: any) {
      console.error("Handle submit error:", error.message);
      alert(error.message)
    } finally {
      // Reset form
      setQuery("")
      setImage(null)
      setIsLoading(false)
    }
  }

  // Text-to-speech function
  const speakResponse = (text: string) => {
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text)
      window.speechSynthesis.speak(utterance)
    } else {
      alert("Text-to-speech is not supported in your browser.")
    }
  }

  // Speak a specific message
  const speakMessage = (message: string) => {
    if ("speechSynthesis" in window) {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel()

      // Speak the new message
      const utterance = new SpeechSynthesisUtterance(message)
      window.speechSynthesis.speak(utterance)
    }
  }

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setImage(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  // Prevent client/server markup mismatch during hydration
  if (!mounted) return null

  return (
    <Card className="w-full max-w-2xl shadow-lg border-0 bg-white overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-cyan-600 to-teal-600 text-white p-6">
        <CardTitle className="text-2xl font-bold flex items-center gap-2">
          <Bot className="h-6 w-6" />
          Medical Assistant
        </CardTitle>
      </CardHeader>

      <CardContent className="p-0">
        {/* Conversation Area */}
        <ScrollArea className="h-[400px] p-4" ref={scrollAreaRef}>
          <div className="space-y-4">
            {conversation.map((message, index) => (
              <div key={index} className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`flex gap-3 max-w-[80%] ${message.type === "user" ? "flex-row-reverse" : "flex-row"}`}>
                  <Avatar className={`h-8 w-8 ${message.type === "user" ? "bg-blue-100" : "bg-teal-100"}`}>
                    {message.type === "user" ? (
                      <User className="h-5 w-5 text-blue-700" />
                    ) : (
                      <Bot className="h-5 w-5 text-teal-700" />
                    )}
                    <AvatarFallback>{message.type === "user" ? "U" : "AI"}</AvatarFallback>
                  </Avatar>

                  <div
                    className={`rounded-2xl px-4 py-3 text-sm ${
                      message.type === "user" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    <p>{message.content}</p>

                    {message.type === "ai" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 mt-1 ml-auto block opacity-70 hover:opacity-100"
                        onClick={() => speakMessage(message.content)}
                      >
                        <Volume2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="flex gap-3 max-w-[80%]">
                  <Avatar className="h-8 w-8 bg-teal-100">
                    <Bot className="h-5 w-5 text-teal-700" />
                    <AvatarFallback>AI</AvatarFallback>
                  </Avatar>

                  <div className="rounded-2xl px-4 py-3 bg-gray-100 text-gray-800">
                    <div className="flex items-center space-x-2">
                      <div
                        className="h-2 w-2 bg-teal-600 rounded-full animate-bounce"
                        style={{ animationDelay: "0ms" }}
                      ></div>
                      <div
                        className="h-2 w-2 bg-teal-600 rounded-full animate-bounce"
                        style={{ animationDelay: "300ms" }}
                      ></div>
                      <div
                        className="h-2 w-2 bg-teal-600 rounded-full animate-bounce"
                        style={{ animationDelay: "600ms" }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Image Preview (if any) */}
        {image && (
          <div className="px-4 py-2 border-t border-gray-100">
            <div className="relative inline-block">
              <img src={image || "/placeholder.svg"} alt="Preview" className="h-20 rounded-md object-contain" />
              <Button
                variant="destructive"
                size="icon"
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full"
                onClick={removeImage}
              >
                <X size={12} />
              </Button>
            </div>
          </div>
        )}

        {/* Add Clear History Button */}
        <div className="p-4">
          <Button variant="destructive" size="sm" onClick={clearHistory}>
            Clear History
          </Button>
        </div>
      </CardContent>

      <CardFooter className="p-4 border-t bg-gray-50">
        <div className="w-full space-y-4">
          {/* Voice Input Button */}
          <div className="flex justify-center">
            <Button
              onClick={startListening}
              className={`w-12 h-12 rounded-full transition-all duration-300 ${
                isListening ? "bg-red-500 hover:bg-red-600 animate-pulse" : "bg-teal-600 hover:bg-teal-700"
              }`}
              disabled={isLoading}
            >
              <Mic size={20} className={`${isListening ? "animate-bounce" : ""}`} />
            </Button>
          </div>

          {/* Text Input Form */}
          <form onSubmit={handleSubmit} className="flex flex-col space-y-2">
            <div className="relative flex-1">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={useTavily ? "Type your question (Tavily Search enabled)..." : "Type your medical question..."}
                className="pr-10 bg-white"
                disabled={isLoading}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full w-10 text-gray-400 hover:text-teal-600"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
              >
                <Upload size={16} />
              </Button>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={isLoading}
              />
            </div>
            {/* New checkbox option for Tavily AI */}
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={useTavily}
                onChange={(e) => setUseTavily(e.target.checked)}
                disabled={isLoading}
              />
              <span>Use Web Search</span>
            </label>
            <Button type="submit" disabled={(!query && !image) || isLoading} className="bg-teal-600 hover:bg-teal-700">
              {isLoading ? <Loader2 className="animate-spin" /> : <Send />}
            </Button>
          </form>

          {/* Image Upload Area (hidden but functional for drag & drop) */}
          <div className="hidden" onDragOver={handleDragOver} onDrop={handleDrop}></div>
        </div>
      </CardFooter>
    </Card>
  )
}

