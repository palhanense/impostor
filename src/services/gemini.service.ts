import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY || '';
const isMock = apiKey === 'YOUR_GEMINI_KEY' || !apiKey;
const genAI = isMock ? null : new GoogleGenerativeAI(apiKey);

export interface IntentResponse {
    type: 'GAME_ACTION' | 'SOCIAL' | 'NEW_GAME' | 'DATA_ENTRY' | 'CONFIRMATION';
    action?: 'VOTE' | 'GUESS_WORD' | 'JOIN';
    target?: string;
    rationale?: string;
    data?: string; // For data entry
    confirmed?: boolean; // For confirmation
}

export class GeminiService {
    private model = genAI ? genAI.getGenerativeModel({ model: "gemini-pro" }) : null;

    async classifyIntent(message: string, context: string): Promise<IntentResponse> {
        if (isMock) {
            console.log("[MOCK] Classifying Intent for:", message);
            const lower = message.toLowerCase();

            // Context Awareness Check (Simulated)
            if (context.includes('Wait for Pix Confirmation')) {
                if (lower.includes('sim') || lower.includes('correto') || lower.includes('yes') || lower.includes('isso')) return { type: 'CONFIRMATION', confirmed: true };
                if (lower.includes('não') || lower.includes('errado') || lower.includes('no')) return { type: 'CONFIRMATION', confirmed: false };
            }

            if (lower.includes('começar') || lower.includes('nova partida')) return { type: 'NEW_GAME' };

            if (lower.includes('entrar')) {
                const codeMatch = message.match(/[A-Z0-9]{6}/);
                if (codeMatch) {
                    return { type: 'GAME_ACTION', action: 'JOIN', target: codeMatch[0] };
                }
                return { type: 'GAME_ACTION', action: 'JOIN' };
            }

            // Data Entry Mock: Assume emails or phones are Pix keys
            if (lower.includes('@') || lower.match(/\d{9,}/)) {
                return { type: 'DATA_ENTRY', data: message.trim() };
            }

            if (lower.includes('votar') || lower.includes('acho que é a')) return { type: 'GAME_ACTION', action: 'VOTE', target: 'Bia' };
            if (lower.includes('palavra') && lower.includes('chute')) return { type: 'GAME_ACTION', action: 'GUESS_WORD', target: 'Banana' };

            return { type: 'SOCIAL' };
        }

        const prompt = `
      You are the Game Master of "Impostor Pay".
      Analyze the user's message in the context of the game.
      Context: ${context}
      User Message: "${message}"
      
      Look for:
      1. Game codes (6 uppercase characters) if joining.
      2. Pix Keys (Email, CPF, Phone, Random Key) if context implies requesting data.
      3. Confirmation (Yes/No) if context implies confirming data.
      
      Classify:
      {
        "type": "GAME_ACTION" | "SOCIAL" | "NEW_GAME" | "DATA_ENTRY" | "CONFIRMATION",
        "action": "VOTE" | "GUESS_WORD" | "JOIN",
        "target": "PlayerName or Word or GameCode",
        "data": "Extracted Data (Pix Key)",
        "confirmed": true/false
      }
    `;

        try {
            if (!this.model) throw new Error("No model");
            const result = await this.model.generateContent(prompt);
            const response = result.response;
            const text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(text) as IntentResponse;
        } catch (error) {
            console.error("Gemini Error:", error);
            return { type: 'SOCIAL' };
        }
    }

    async narrate(context: string, event: string): Promise<string> {
        if (isMock) {
            return `[MOCK_NARRATION] ${event} (Context: ${context.substring(0, 20)}...)`;
        }
        const prompt = `
      You are the Game Master of "Impostor Pay".
      Personality: Sarcastic, funny, uses Brazilian slang, host of a game involving money.
      Situation: ${event}
      Game State: ${context}
      
      Write a short, engaging response/narration for the WhatsApp group. Keep it under 200 characters if possible to fit the chat vibe.
    `;
        try {
            if (!this.model) throw new Error("No model");
            const result = await this.model.generateContent(prompt);
            return result.response.text();
        } catch (error) {
            console.error("Gemini Narration Error:", error);
            return "Opa, deu um branco aqui no Mestre. Segue o jogo!";
        }
    }
}
