import { Node, Edge } from 'reactflow';

export enum NodeType {
  SERVICE = 'service',
  DATABASE = 'database',
  CLIENT = 'client',
  QUEUE = 'queue',
  EXTERNAL = 'external',
  CACHE = 'cache'
}

export interface ArchitectureNodeData {
  label: string;
  type: NodeType;
  details: string;
  technologies?: string[];
}

export interface GeneratedArchitecture {
  title: string;
  nodes: {
    id: string;
    label: string;
    type: NodeType;
    details: string;
    technologies?: string[];
  }[];
  edges: {
    id: string;
    source: string;
    target: string;
    label?: string;
  }[];
  explanation: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface SavedArchitecture extends GeneratedArchitecture {
  id: string;
  userId: string;
  timestamp: number;
  prompt: string;
}

export type Role = 'user' | 'ai';

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
}

// React Flow specific types
export type CustomNode = Node<ArchitectureNodeData>;
export type CustomEdge = Edge;

export interface LayoutOptions {
  direction: 'TB' | 'LR';
}