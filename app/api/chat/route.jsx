import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs"; // retained if needed for other uses

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function GET(request) {
  return NextResponse.json({ message: "Chat API POST response OK with data" });
}

export async function POST(request) {
  try {
    const body = await request.json();
    console.log("Request body:", body);
    const { query, image, useTavily } = body;
    
    // Initialize or extract chat history
    let chatHistory = body.chatHistory || [
      { role: "system", content: "You are an expert medical assistant providing accurate, responsible and helpful medical advice." }
    ];
    
    // Build user message
    let userMessageText = query || "";
    if (image) {
      const imageUrl = image.startsWith("data:") ? image : `data:image/jpeg;base64,${image}`;
      userMessageText += ` [Image: ${imageUrl}]`;
    }
    if (!userMessageText) {
      throw new Error("Empty message");
    }
    chatHistory.push({ role: "user", content: userMessageText });
    
    // Build conversation string
    const conversationString = chatHistory.map(msg => {
      const speaker = msg.role === "system" ? "System" : (msg.role === "user" ? "User" : "Assistant");
      return `${speaker}: ${msg.content}`;
    }).join("\n");
    
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    const imageParts = [];
    if (image) {
      imageParts.push({
        inlineData: {
          data: image,
          mimeType: "image/jpeg"
        }
      });
    }
    
    // Generate primary content using Gemini AI with a token limit below 80
    const generatedContent = await model.generateContent([conversationString, ...imageParts], { max_completion_tokens: 80 });
    let geminiReply = generatedContent.response.text();
    let finalReply = `${geminiReply}`;
    
    // If useTavily is true, execute Tavily Search and combine answer
    if (useTavily) {
      const tavilyRequestBody = {
        query: query,
        topic: "general",
        search_depth: "basic",
        max_results: 1,
        days: 3,
        include_answer: true,
        include_raw_content: false,
        include_images: false,
        include_image_descriptions: false,
        include_domains: [],
        exclude_domains: []
      };
      
      const tavilyResponse = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(tavilyRequestBody)
      });
      
      if (!tavilyResponse.ok) {
        console.error("Tavily Search error:", tavilyResponse.statusText);
        throw new Error("Tavily Search request failed");
      }
      
      const tavilyData = await tavilyResponse.json();
      const tavilyAnswer = tavilyData.answer || "No answer from Tavily Search.";
      const combinedPrompt = `Please combine the following responses into one coherent and user-relevant answer:\n\nGemini: ${geminiReply}\n\nTavily Search: ${tavilyAnswer}`;
      // Generate a combined reply with token limit below 80
      const combinedResponse = await model.generateContent([combinedPrompt], { max_completion_tokens: 20 });
      finalReply = combinedResponse.response.text();
    }
    
    chatHistory.push({ role: "assistant", content: finalReply });
    
    // Keep only the last 10 conversation entries
    chatHistory = chatHistory.slice(-10);
    
    return NextResponse.json({ reply: finalReply, chatHistory });
  } catch (err) {
    console.error("API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
