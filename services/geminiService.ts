import { GoogleGenAI } from "@google/genai";
import { InteractionAnalysis, AISettings, ChatMessage } from "../types";

let currentSettings: AISettings = {
    provider: 'gemini',
    apiKey: process.env.API_KEY || ''
};

export const configureAI = (settings: AISettings) => {
    currentSettings = settings;
};

// 1. Google Gemini Implementation
const analyzeWithGemini = async (prompt: string): Promise<string> => {
    if (!currentSettings.apiKey) throw new Error("API Key missing");
    const ai = new GoogleGenAI({ apiKey: currentSettings.apiKey });
    const model = "gemini-2.5-flash"; 

    const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    return response.text || "{}";
};

const chatWithGemini = async (messages: ChatMessage[], context?: string): Promise<string> => {
    if (!currentSettings.apiKey) throw new Error("API Key missing");
    const ai = new GoogleGenAI({ apiKey: currentSettings.apiKey });
    const model = "gemini-2.5-flash";

    // Convert internal chat format to Gemini history
    const contents = messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
    }));

    const systemInstruction = context 
        ? `You are an expert C++ developer assisting with a project. \n\nPROJECT CONTEXT:\n${context}\n\nAnswer the user's questions based on this code.`
        : "You are an expert C++ developer.";

    const response = await ai.models.generateContent({
        model,
        contents: contents as any,
        config: {
            systemInstruction: systemInstruction
        }
    });
    return response.text || "";
};

// 2. Custom Provider Implementation
const analyzeWithCustom = async (prompt: string): Promise<string> => {
    const baseUrl = currentSettings.baseUrl || 'http://localhost:1234/v1';
    const modelName = currentSettings.modelName || 'local-model';
    
    const body = {
        model: modelName,
        messages: [
            { role: "system", content: "You are an expert C++ code analyst. Respond ONLY in valid JSON." },
            { role: "user", content: prompt }
        ],
        temperature: 0.2
    };

    const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${currentSettings.apiKey || 'lm-studio'}` },
        body: JSON.stringify(body)
    });

    if (!response.ok) throw new Error(`Custom AI Error: ${response.statusText}`);
    const data = await response.json();
    return data.choices[0]?.message?.content || "{}";
};

const chatWithCustom = async (messages: ChatMessage[], context?: string): Promise<string> => {
    const baseUrl = currentSettings.baseUrl || 'http://localhost:1234/v1';
    const modelName = currentSettings.modelName || 'local-model';

    const systemContent = context 
        ? `You are an expert C++ developer. PROJECT CONTEXT:\n${context}`
        : "You are an expert C++ developer.";

    const body = {
        model: modelName,
        messages: [
            { role: "system", content: systemContent },
            ...messages.map(m => ({ role: m.role, content: m.content }))
        ],
        temperature: 0.7
    };

    const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${currentSettings.apiKey || 'lm-studio'}` },
        body: JSON.stringify(body)
    });

    if (!response.ok) throw new Error(`Custom AI Error: ${response.statusText}`);
    const data = await response.json();
    return data.choices[0]?.message?.content || "";
};


export const analyzeInteraction = async (sourceFile: string, sourceCode: string, targetFile: string, targetCode: string): Promise<InteractionAnalysis> => {
  const prompt = `
    Analyze the C++ dependency between these two files.
    Source: "${sourceFile}"
    Target: "${targetFile}"
    SOURCE CODE (truncated): ${sourceCode.slice(0, 8000)}
    TARGET CODE (truncated): ${targetCode.slice(0, 4000)}
    Output JSON: { "summary": "string", "callerSnippet": { "file": "string", "code": "string", "startLine": number, "explanation": "string" }, "calleeSnippet": { ... } }
  `;
  try {
    let jsonString = currentSettings.provider === 'custom' ? await analyzeWithCustom(prompt) : await analyzeWithGemini(prompt);
    jsonString = jsonString.replace(/```json/g, '').replace(/```/g, '').trim();
    return { ...JSON.parse(jsonString), isAiGenerated: true };
  } catch (error) {
    console.error("AI Analysis Error:", error);
    throw error;
  }
};

export const sendChatMessage = async (messages: ChatMessage[], context?: string): Promise<string> => {
    try {
        if (currentSettings.provider === 'custom') {
            return await chatWithCustom(messages, context);
        } else {
            return await chatWithGemini(messages, context);
        }
    } catch (error) {
        console.error("Chat Error", error);
        return "Error communicating with AI service. Check your API key or connection.";
    }
};