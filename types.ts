
export interface SymbolDefinition {
  name: string;
  line: number;
  type: 'class' | 'function' | 'struct' | 'uniform' | 'attribute' | 'varying' | 'target' | 'key';
}

export interface FileNode {
  id: string; // Full relative path
  name: string;
  content: string;
  type: 'source' | 'header' | 'cmake' | 'json' | 'glsl' | 'other';
  group: string; // Folder name for clustering
  size?: number;
  lines?: number;
  exportedSymbols?: SymbolDefinition[]; // List of classes/functions defined here
  x?: number; // For manual positioning/drag
  y?: number;
}

export interface DependencyLink {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: FileNode[];
  links: DependencyLink[];
}

export interface CodeSnippet {
  file: string;
  code: string;
  startLine: number;
  explanation: string;
}

export interface InteractionAnalysis {
  summary: string;
  callerSnippet: CodeSnippet; // The code in the source file that calls the target
  calleeSnippet: CodeSnippet; // The definition in the target file (optional/inferred)
  isAiGenerated: boolean;
}

export interface Tab {
  id: string;
  title: string;
  type: 'graph' | 'code' | 'analysis';
  data?: any; // Stores state for that tab
  active: boolean;
}

export interface AISettings {
  provider: 'gemini' | 'custom';
  apiKey: string;
  baseUrl?: string; // For Custom/LM Studio (e.g., http://localhost:1234/v1)
  modelName?: string; // For Custom
  corsProxy?: string; // Optional CORS proxy prefix (e.g. https://corsproxy.io/?)
}

export interface VisualSettings {
  showArrowheads: boolean;
  palette: {
    source: string;
    header: string;
    cmake: string;
    json: string;
    glsl: string;
    other: string;
  };
  flow: {
    speed: number; // 1 = default speed; >1 faster, <1 slower
    size: number;  // particle radius in px
  };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}
