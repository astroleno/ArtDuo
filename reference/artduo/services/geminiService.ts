import { GoogleGenAI, Type } from "@google/genai";
import { AIAnalysis, Painting } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Cache key for localStorage
const CACHE_KEY = 'artduo_analysis_cache_v3';

// Helper to get cache from localStorage
const getCache = (): Record<string, AIAnalysis> => {
  try {
    const stored = localStorage.getItem(CACHE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

// Helper to save to localStorage
const saveToCache = (id: string, data: AIAnalysis) => {
  try {
    const cache = getCache();
    cache[id] = data;
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn('Failed to save analysis to cache', e);
  }
};

// 1. Structural Analysis (Fast, Cached)
export const analyzePainting = async (painting: Painting): Promise<AIAnalysis> => {
  const cache = getCache();
  if (cache[painting.id]) {
    return cache[painting.id];
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Act as a world-class art curator. Analyze "${painting.title}" by ${painting.artist}. 
      Return JSON with:
      1. mood: 2-3 words describing atmosphere.
      2. technique: key artistic technique used.
      3. description: A placeholder (will be streamed later).`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING },
            mood: { type: Type.STRING },
            technique: { type: Type.STRING }
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    const result = JSON.parse(text) as AIAnalysis;
    saveToCache(painting.id, result);
    return result;

  } catch (error) {
    console.error("Gemini analysis failed:", error);
    return {
      description: "A masterpiece waiting to be discovered.",
      mood: "Timeless",
      technique: "Oil on Canvas"
    };
  }
};

// 2. Streaming Description (Immersive text)
export async function* streamPaintingDescription(painting: Painting) {
  try {
    const stream = await ai.models.generateContentStream({
      model: 'gemini-2.5-flash',
      contents: `You are a poetic art curator. Write a 2-sentence evocative, immersive description of the painting "${painting.title}" by ${painting.artist}. Focus on the light, emotion, and story. Do not use markdown.`,
    });

    for await (const chunk of stream) {
      if (chunk.text) {
        yield chunk.text;
      }
    }
  } catch (e) {
    console.error("Stream error", e);
    yield "Experience the beauty of this timeless masterpiece.";
  }
}

// 3. Q&A / Chat with Curator
export async function* askPaintingQuestion(painting: Painting, question: string) {
  try {
    const stream = await ai.models.generateContentStream({
      model: 'gemini-2.5-flash',
      contents: `You are a knowledgeable and sophisticated art curator standing in front of the painting "${painting.title}" by ${painting.artist}. 
      
      User Question: "${question}"
      
      Answer briefly (under 60 words) but with depth and elegance. If the question relates to visual details, describe them vividly.`,
    });

    for await (const chunk of stream) {
      if (chunk.text) {
        yield chunk.text;
      }
    }
  } catch (e) {
    console.error("Q&A error", e);
    yield "I apologize, I am momentarily lost in thought about this piece.";
  }
}