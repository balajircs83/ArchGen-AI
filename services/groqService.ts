import Groq from 'groq-sdk';
import { GeneratedArchitecture, NodeType, ChatMessage } from '../types';

const apiKey = import.meta.env.VITE_GROQ_API_KEY || '';
const groq = new Groq({
    apiKey,
    dangerouslyAllowBrowser: true
});

// The user's screenshot suggested "meta-llama/llama-4-scout-17b-16e-instruct" 
// but we default to the stable, highly capable Llama 3.3 70B for reliability.
const MODEL_ID = "llama-3.3-70b-versatile";

const SYSTEM_PROMPT = `You are an expert software architect. 
You must output ONLY valid JSON. 
Do not include markdown formatting like \`\`\`json. 
Just the raw JSON object.`;

const architectureSchema = {
    type: "object",
    properties: {
        title: {
            type: "string",
            description: "A concise title for the system architecture."
        },
        nodes: {
            type: "array",
            description: "List of components in the system.",
            items: {
                type: "object",
                properties: {
                    id: { type: "string", description: "Unique identifier for the node." },
                    label: { type: "string", description: "Display name of the component." },
                    type: {
                        type: "string",
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
                    details: { type: "string", description: "A short description of the component's role." },
                    technologies: {
                        type: "array",
                        items: { type: "string" },
                        description: "List of specific technologies likely used (e.g., PostgreSQL, Redis, React)."
                    }
                },
                required: ["id", "label", "type", "details"]
            }
        },
        edges: {
            type: "array",
            description: "Connections between components representing data flow.",
            items: {
                type: "object",
                properties: {
                    id: { type: "string" },
                    source: { type: "string", description: "ID of the source node." },
                    target: { type: "string", description: "ID of the target node." },
                    label: { type: "string", description: "Description of the data flowing or interaction type." }
                },
                required: ["id", "source", "target"]
            }
        },
        explanation: {
            type: "string",
            description: "A detailed Markdown explanation of the architecture, key decisions, and flow."
        }
    },
    required: ["title", "nodes", "edges", "explanation"]
};

export const generateArchitecture = async (prompt: string): Promise<GeneratedArchitecture> => {
    try {
        const userPrompt = `Design a system architecture for: "${prompt}". 
    
    Strictly follow this JSON schema:
    ${JSON.stringify(architectureSchema, null, 2)}

    Ensure the output is a valid JSON matching the schema. 
    Focus on a modern, scalable, and robust design. 
    Identify 5-15 key components (nodes) and their interactions (edges).`;

        const completion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: userPrompt }
            ],
            model: MODEL_ID,
            temperature: 0.5,
            response_format: { type: "json_object" }
        });

        const content = completion.choices[0]?.message?.content;

        if (content) {
            // Clean up markdown if present despite instructions
            const cleanContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
            const data = JSON.parse(cleanContent) as GeneratedArchitecture;
            return data;
        }

        throw new Error("No content generated");
    } catch (error) {
        console.error("Groq API Error:", error);
        throw error;
    }
};

export const askArchitectureQuestion = async (
    architecture: GeneratedArchitecture,
    question: string,
    history: ChatMessage[]
): Promise<{ message: string; updatedArchitecture?: GeneratedArchitecture }> => {
    try {
        // Pass full architecture context so IDs and structure are preserved for modifications
        const context = JSON.stringify(architecture);

        const recentHistory = history.slice(-6).map(msg => ({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content
        }));

        const systemMessage = `You are an expert software architect assistant. 
    You have designed the following system:
    ${context}

    Your goal is to assist the user. They may ask questions about the architecture OR ask you to modify it.

    RESPONSE FORMAT:
    You must ALWAYS return a valid JSON object. Do not output markdown.
    
    Structure:
    {
      "message": "Your text response to the user here.",
      "updated_architecture": (OPTIONAL) The complete, valid architecture object if the user requested a change.
    }

    RULES:
    1. If the user asks a QUESTION (e.g., "Explain the flow", "What does Redis do?"):
       - Answer clearly in the "message" field.
       - Do NOT include "updated_architecture".
    
    2. If the user requests a MODIFICATION (e.g., "Add a load balancer", "Remove the cache", "Change SQL to NoSQL"):
       - Perform the modification on the architecture.
       - Return the FULL, valid \`updated_architecture\` object (following the original schema: title, nodes, edges, explanation).
       - Ensure all nodes have unique IDs.
       - In the "message" field, explain what you changed.
       - MAINTAIN existing node IDs if they haven't changed, to preserve layout context if possible.
       - Ensure the new architecture is complete and valid.

    3. STRICTLY follow the JSON format. verify the JSON is valid before outputting.
    `;

        const messages: any[] = [
            { role: "system", content: systemMessage },
            ...recentHistory,
            { role: "user", content: question }
        ];

        const completion = await groq.chat.completions.create({
            messages: messages,
            model: MODEL_ID,
            temperature: 0.7,
            response_format: { type: "json_object" }
        });

        const content = completion.choices[0]?.message?.content;

        if (content) {
            const cleanContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
            const result = JSON.parse(cleanContent);
            return {
                message: result.message || "I processed your request.",
                updatedArchitecture: result.updated_architecture
            };
        }

        return { message: "I couldn't generate a response. Please try again." };
    } catch (error) {
        console.error("Groq QnA Error:", error);
        return { message: "Sorry, I encountered an error while analyzing the architecture. Please try again." };
    }
};
