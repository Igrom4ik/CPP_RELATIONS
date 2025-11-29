import { FileNode, DependencyLink, GraphData, SymbolDefinition } from '../types';

// Helper to normalize paths
const normalizePath = (path: string) => path.replace(/\\/g, '/');

const getFolder = (path: string) => {
  const parts = path.split('/');
  return parts.length > 1 ? parts[parts.length - 2] : 'root';
};

// Regex to find C++ definitions and their lines
const extractSymbols = (content: string): SymbolDefinition[] => {
    const symbols: SymbolDefinition[] = [];
    const lines = content.split('\n');
    
    // Regex for Classes/Structs: class MyClass { ...
    const classRegex = /^\s*(class|struct|enum)\s+([a-zA-Z0-9_]+)/;
    
    // Regex for Functions: void MyFunc(...) { ... 
    const funcRegex = /^\s*(?:virtual\s+)?(?:static\s+)?(?:inline\s+)?(?:[a-zA-Z0-9_<>:*\s&]+)\s+([a-zA-Z0-9_]+)\s*\(/;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim().startsWith('//') || line.trim().startsWith('#')) continue;

        const classMatch = line.match(classRegex);
        if (classMatch) {
            symbols.push({
                name: `${classMatch[1]} ${classMatch[2]}`,
                line: i + 1,
                type: classMatch[1] === 'struct' ? 'struct' : 'class'
            });
            continue;
        }

        const funcMatch = line.match(funcRegex);
        if (funcMatch) {
            const name = funcMatch[1];
            if (!['if', 'while', 'for', 'switch', 'return', 'catch'].includes(name)) {
                symbols.push({
                    name: `${name}()`,
                    line: i + 1,
                    type: 'function'
                });
            }
        }
    }
    
    // Limit to top 5 important symbols to keep nodes clean
    return symbols.slice(0, 5);
};

export const parseProjectFiles = async (files: FileList): Promise<GraphData> => {
  const nodes: FileNode[] = [];
  
  // 1. Read files
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    // Skip hidden files, build folders, git
    if (file.name.startsWith('.') || file.name.includes('cmake-build') || file.name.includes('.git') || file.name.includes('node_modules')) continue;

    const path = normalizePath(file.webkitRelativePath || file.name);
    
    // Determine type
    let type: FileNode['type'] = 'other';
    if (path.match(/\.(h|hpp|hh)$/i)) type = 'header';
    else if (path.match(/\.(cpp|cxx|cc|c)$/i)) type = 'source';
    else if (path.match(/CMakeLists\.txt$/i) || path.match(/\.cmake$/i)) type = 'cmake';
    else if (path.match(/\.json$/i)) type = 'json';
    
    // Only process supported extensions
    if (type === 'other' && !path.match(/\.(cpp|cxx|cc|c|h|hpp|hh|cmake|json|txt)$/i)) continue;

    const text = await file.text();
    
    nodes.push({
      id: path,
      name: file.name,
      content: text,
      type: type,
      group: getFolder(path),
      exportedSymbols: (type === 'header' || type === 'source') ? extractSymbols(text) : []
    });
  }

  const links: DependencyLink[] = [];
  const linkSet = new Set<string>(); // To prevent duplicates

  const addLink = (source: string, target: string) => {
      const key = `${source}|${target}`;
      if (!linkSet.has(key) && source !== target) {
          links.push({ source, target });
          linkSet.add(key);
      }
  };

  // 2. Parse includes and dependencies
  nodes.forEach(node => {
    const content = node.content;
    const dir = node.id.substring(0, node.id.lastIndexOf('/')); // Directory of current file

    // --- C++ Includes ---
    if (node.type === 'header' || node.type === 'source') {
        const includeRegex = /#include\s+["<]([^">]+)[">]/g;
        let match;

        while ((match = includeRegex.exec(content)) !== null) {
          const includePath = match[1];
          // Smart resolve: 
          // 1. Check exact relative path
          // 2. Check suffix match (common for includes like "Components/Camera.h")
          // 3. Check filename match
          
          let targetNode = nodes.find(n => n.id === includePath); // Exact?
          
          if (!targetNode && dir) {
              // Try relative to current file
              targetNode = nodes.find(n => n.id === `${dir}/${includePath}`); 
          }

          if (!targetNode) {
              targetNode = nodes.find(n => n.id.endsWith(includePath));
          }
          
          if (!targetNode) {
              const potentialMatches = nodes.filter(n => n.name === includePath.split('/').pop());
              if (potentialMatches.length === 1) targetNode = potentialMatches[0];
          }

          if (targetNode) {
            addLink(node.id, targetNode.id);
          }
        }
        
        // Simple heuristic for JSON usage in C++
        nodes.filter(n => n.type === 'json').forEach(jsonNode => {
             // Strict check to avoid false positives on common words
             if (content.includes(`"${jsonNode.name}"`) || content.includes(`"${jsonNode.id}"`)) {
                 addLink(node.id, jsonNode.id);
             }
        });
    }

    // --- CMake Dependencies ---
    if (node.type === 'cmake') {
        // Tokenize content to find filenames and directories
        // Split by whitespace, quotes, parentheses
        const tokens = content.split(/[\s()"']+/).filter(t => t.length > 1 && !t.startsWith('#') && !t.startsWith('$'));

        tokens.forEach(token => {
            // 1. Check if token maps to a file in the project (Source files)
            // CMake usually references files relative to itself
            
            // Try exact relative match (e.g. "src/main.cpp")
            const relativePath = dir ? `${dir}/${token}` : token;
            
            let targetFile = nodes.find(n => n.id === relativePath);
            
            // Try loose match (just filename) if not found relative
            if (!targetFile) {
                targetFile = nodes.find(n => n.name === token && (n.type === 'source' || n.type === 'header'));
            }

            if (targetFile) {
                addLink(node.id, targetFile.id);
                return;
            }

            // 2. Check for add_subdirectory targets (CMake -> CMake)
            // If token matches a folder name that contains a CMakeLists.txt
            const targetCmakePath = relativePath + "/CMakeLists.txt";
            const targetCmake = nodes.find(n => n.id === targetCmakePath);
            
            if (targetCmake) {
                addLink(node.id, targetCmake.id);
            }
        });
    }
  });

  return { nodes, links };
};