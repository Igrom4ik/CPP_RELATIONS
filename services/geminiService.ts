
import { GoogleGenAI } from "@google/genai";
import { InteractionAnalysis, AISettings, ChatMessage } from "../types";

let currentSettings: AISettings = {
    provider: 'gemini',
    apiKey: process.env.API_KEY || ''
};

export const configureAI = (settings: AISettings) => {
    currentSettings = settings;
};

// Helper to normalize Base URL
const normalizeBaseUrl = (url: string) => {
    let cleaned = url.trim().replace(/\/+$/, '');
    
    // Common mistake: user pastes the full endpoint url (e.g. http://localhost:1234/v1/chat/completions)
    // We need the base path (http://localhost:1234/v1)
    if (cleaned.endsWith('/chat/completions')) {
        cleaned = cleaned.substring(0, cleaned.length - '/chat/completions'.length);
    }
    
    // Clean up trailing slash again
    cleaned = cleaned.replace(/\/+$/, '');

    // Ensure it ends with /v1 (standard for OpenAI compatible endpoints)
    if (!cleaned.endsWith('/v1')) {
        cleaned += '/v1';
    }
    return cleaned;
};

const isCorsRestricted = (url: string) => {
    return url.includes('api.openai.com') || 
           url.includes('api.anthropic.com') || 
           url.includes('api.perplexity.ai') ||
           url.includes('api.mistral.ai') ||
           url.includes('api.groq.com');
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
    const baseUrl = normalizeBaseUrl(currentSettings.baseUrl || 'http://localhost:1234');
    const modelName = currentSettings.modelName || 'local-model';
    
    const body = {
        model: modelName,
        messages: [
            { role: "system", content: "You are an expert C++ code analyst. Respond ONLY in valid JSON." },
            { role: "user", content: prompt }
        ],
        temperature: 0.2
    };

    const headers: Record<string, string> = {
        "Content-Type": "application/json"
    };
    // Only attach Auth header if a key is explicitly provided
    if (currentSettings.apiKey && currentSettings.apiKey.trim() !== '') {
        headers["Authorization"] = `Bearer ${currentSettings.apiKey}`;
    }

    try {
        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: "POST",
            headers: headers,
            body: JSON.stringify(body)
        });

        if (!response.ok) throw new Error(`Custom AI Error: ${response.status} ${response.statusText}`);
        const data = await response.json();
        return data.choices[0]?.message?.content || "{}";
    } catch (error: any) {
        if (error.message === 'Failed to fetch') {
            if (isCorsRestricted(baseUrl)) {
                 throw new Error(`Browser Error: Cannot connect to ${baseUrl} directly due to CORS security policies.\n\nBrowsers block direct API calls to providers like OpenAI/Perplexity.\n\nSolutions:\n1. Use a Local AI (LM Studio) with CORS enabled.\n2. Use a browser extension that disables CORS (Dev only).\n3. Use a proxy server.`);
            }
            throw new Error(`Connection Failed to ${baseUrl}. \nCheck: \n1. Is LM Studio/Ollama running? \n2. Is CORS enabled? \n3. Try swapping 'localhost' vs '127.0.0.1'.`);
        }
        throw error;
    }
};

const chatWithCustom = async (messages: ChatMessage[], context?: string): Promise<string> => {
    const baseUrl = normalizeBaseUrl(currentSettings.baseUrl || 'http://localhost:1234');
    const modelName = currentSettings.modelName || 'local-model';

    // Prevent huge contexts from crashing local models (standard context is 4096 or 8192 tokens)
    let systemContent = context 
        ? `You are an expert C++ developer. PROJECT CONTEXT:\n${context}`
        : "You are an expert C++ developer.";
    
    // Hard cap system context char length (~3000-4000 tokens safe limit)
    if (systemContent.length > 12000) {
        systemContent = systemContent.substring(0, 12000) + "\n...[Context Truncated due to length]...";
    }

    // SLIDING WINDOW for history: Only keep last 6 messages to save context for prompt & completion
    const recentMessages = messages.slice(-6);

    const body = {
        model: modelName,
        messages: [
            { role: "system", content: systemContent },
            ...recentMessages.map(m => ({ role: m.role, content: m.content }))
        ],
        temperature: 0.7
    };

    const headers: Record<string, string> = {
        "Content-Type": "application/json"
    };
    // Only attach Auth header if a key is explicitly provided
    if (currentSettings.apiKey && currentSettings.apiKey.trim() !== '') {
        headers["Authorization"] = `Bearer ${currentSettings.apiKey}`;
    }

    try {
        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: "POST",
            headers: headers,
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errText = await response.text();
            if (errText.includes("context length")) {
                throw new Error("Context Overflow: Project too large for this AI model. Try increasing Context Length in LM Studio or select fewer files.");
            }
            throw new Error(`Custom AI Error: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        return data.choices[0]?.message?.content || "";
    } catch (error: any) {
        if (error.message === 'Failed to fetch') {
            if (isCorsRestricted(baseUrl)) {
                 throw new Error(`Browser CORS Error: Cannot connect to ${baseUrl} from a browser-based app.\n\nBrowsers block direct calls to Perplexity/OpenAI/Anthropic APIs for security.\n\nSolutions:\n1. Use a CORS Proxy (or browser extension).\n2. Switch to Local AI (LM Studio/Ollama) with CORS enabled.\n3. Use Gemini (supported natively).`);
            }
            throw new Error(`Connection Failed to ${baseUrl}. \nPossible causes: \n1. Server not running. \n2. CORS blocked (check server logs). \n3. Mixed Content (Using HTTP local server from HTTPS app).`);
        }
        throw error;
    }
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
    } catch (error: any) {
        console.error("Chat Error", error);
        return `Error: ${error.message || "Unknown error occurred"}`;
    }
};
