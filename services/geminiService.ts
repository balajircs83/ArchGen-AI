import { GoogleGenAI, Type, Schema } from "@google/genai";
import { GeneratedArchitecture, NodeType, ChatMessage } from '../types';

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

const architectureSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "A concise title for the system architecture."
    },
    nodes: {
      type: Type.ARRAY,
      description: "List of components in the system.",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: "Unique identifier for the node." },
          label: { type: Type.STRING, description: "Display name of the component." },
          type: {
            type: Type.STRING,
            description: "Category of the component. Must be one of: service, database, client, queue, external, cache.",
            enum: [
              NodeType.SERVICE,
              NodeType.DATABASE,
              NodeType.CLIENT,
              NodeType.QUEUE,
              NodeType.EXTERNAL,
              NodeType.CACHE
            ]
          },
          details: { type: Type.STRING, description: "A short description of the component's role." },
          technologies: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "List of specific technologies likely used (e.g., PostgreSQL, Redis, React)."
          }
        },
        required: ["id", "label", "type", "details"]
      }
    },
    edges: {
      type: Type.ARRAY,
      description: "Connections between components representing data flow.",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          source: { type: Type.STRING, description: "ID of the source node." },
          target: { type: Type.STRING, description: "ID of the target node." },
          label: { type: Type.STRING, description: "Description of the data flowing or interaction type." }
        },
        required: ["id", "source", "target"]
      }
    },
    explanation: {
      type: Type.STRING,
      description: "A detailed Markdown explanation of the architecture, key decisions, and flow."
    }
  },
  required: ["title", "nodes", "edges", "explanation"]
};

export const generateArchitecture = async (prompt: string): Promise<GeneratedArchitecture> => {
  try {
    const modelId = "gemini-1.5-flash"; // Good balance of speed and reasoning for structured output

    const response = await ai.models.generateContent({
      model: modelId,
      contents: `Design a system architecture for: "${prompt}". 
      Ensure the output is a valid JSON matching the schema. 
      Focus on a modern, scalable, and robust design. 
      Identify 5-15 key components (nodes) and their interactions (edges).`,
      config: {
        responseMimeType: "application/json",
        responseSchema: architectureSchema,
        temperature: 0.5, // Slightly creative but deterministic enough for structure
      }
    });

    if (response.text) {
      const data = JSON.parse(response.text) as GeneratedArchitecture;
      return data;
    }

    throw new Error("No content generated");
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

export const askArchitectureQuestion = async (
  architecture: GeneratedArchitecture,
  question: string,
  history: ChatMessage[]
): Promise<string> => {
  try {
    const modelId = "gemini-1.5-flash";

    // Simplify architecture for context to save tokens and focus attention
    const context = JSON.stringify({
      title: architecture.title,
      nodes: architecture.nodes.map(n => ({ label: n.label, type: n.type, details: n.details })),
      edges: architecture.edges.map(e => ({ source: e.source, target: e.target, label: e.label }))
    });

    const recentHistory = history.slice(-6).map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`).join('\n');

    const prompt = `
      You are an expert software architect assistant. 
      You have designed the following system:
      ${context}

      The user is asking a question about this specific architecture.
      
      Conversation History:
      ${recentHistory}

      User Question: "${question}"

      Answer the user's question clearly and concisely. 
      Use specific examples from the architecture provided (reference specific node names).
      Explain the flow or component responsibility if asked.
    `;

    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        temperature: 0.7,
      }
    });

    return response.text || "I couldn't generate a response. Please try again.";
  } catch (error) {
    console.error("Gemini QnA Error:", error);
    return "Sorry, I encountered an error while analyzing the architecture. Please try again.";
  }
};