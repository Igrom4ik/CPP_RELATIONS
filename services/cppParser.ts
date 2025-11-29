import { FileNode, DependencyLink, GraphData, SymbolDefinition } from '../types';

// Helper to normalize paths
const normalizePath = (path: string) => path.replace(/\\/g, '/');

const getFolder = (path: string) => {
  const parts = path.split('/');
  return parts.length > 1 ? parts[parts.length - 2] : 'root';
};

// Extract C++ symbols (classes, functions, namespaces, templates)
const extractSymbols = (content: string, limit: number = 20): SymbolDefinition[] => {
    const symbols: SymbolDefinition[] = [];
    const lines = content.split('\n');

    // Regex patterns for C++
    const classRegex = /^\s*(class|struct|enum)\s+([a-zA-Z0-9_]+)/;
    const namespaceRegex = /^\s*namespace\s+([a-zA-Z0-9_]+)/;
    const templateRegex = /^\s*template\s*<[^>]+>\s*(class|struct)\s+([a-zA-Z0-9_]+)/;
    const funcRegex = /^\s*(?:virtual\s+)?(?:static\s+)?(?:inline\s+)?(?:explicit\s+)?(?:[a-zA-Z0-9_<>:*\s&]+)\s+([a-zA-Z0-9_~]+)\s*\(/;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim().startsWith('//') || line.trim().startsWith('#')) continue;

        // Template classes
        const templateMatch = line.match(templateRegex);
        if (templateMatch) {
            symbols.push({
                name: `template ${templateMatch[1]} ${templateMatch[2]}`,
                line: i + 1,
                type: templateMatch[1] === 'struct' ? 'struct' : 'class'
            });
            continue;
        }

        // Namespaces
        const namespaceMatch = line.match(namespaceRegex);
        if (namespaceMatch) {
            symbols.push({
                name: `namespace ${namespaceMatch[1]}`,
                line: i + 1,
                type: 'class' // Use 'class' for namespace grouping
            });
            continue;
        }

        // Classes/Structs/Enums
        const classMatch = line.match(classRegex);
        if (classMatch) {
            symbols.push({
                name: `${classMatch[1]} ${classMatch[2]}`,
                line: i + 1,
                type: classMatch[1] === 'struct' ? 'struct' : 'class'
            });
            continue;
        }

        // Functions (including constructors, destructors, operators)
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

    return symbols.slice(0, limit);
};

// Extract GLSL symbols (uniforms, attributes, varying, functions)
const extractGLSLSymbols = (content: string, limit: number = 15): SymbolDefinition[] => {
    const symbols: SymbolDefinition[] = [];
    const lines = content.split('\n');

    const uniformRegex = /^\s*uniform\s+([a-zA-Z0-9_]+)\s+([a-zA-Z0-9_]+)/;
    const attributeRegex = /^\s*(attribute|in)\s+([a-zA-Z0-9_]+)\s+([a-zA-Z0-9_]+)/;
    const varyingRegex = /^\s*(varying|out)\s+([a-zA-Z0-9_]+)\s+([a-zA-Z0-9_]+)/;
    const functionRegex = /^\s*([a-zA-Z0-9_]+)\s+([a-zA-Z0-9_]+)\s*\([^)]*\)\s*\{?/;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim().startsWith('//') || line.trim().startsWith('#version')) continue;

        // Uniforms
        const uniformMatch = line.match(uniformRegex);
        if (uniformMatch) {
            symbols.push({
                name: `uniform ${uniformMatch[2]}`,
                line: i + 1,
                type: 'uniform'
            });
            continue;
        }

        // Attributes/In
        const attributeMatch = line.match(attributeRegex);
        if (attributeMatch) {
            symbols.push({
                name: `${attributeMatch[1]} ${attributeMatch[3]}`,
                line: i + 1,
                type: 'attribute'
            });
            continue;
        }

        // Varying/Out
        const varyingMatch = line.match(varyingRegex);
        if (varyingMatch) {
            symbols.push({
                name: `${varyingMatch[1]} ${varyingMatch[3]}`,
                line: i + 1,
                type: 'varying'
            });
            continue;
        }

        // Functions (including main)
        const functionMatch = line.match(functionRegex);
        if (functionMatch && functionMatch[1] !== 'if' && functionMatch[1] !== 'for') {
            symbols.push({
                name: `${functionMatch[2]}()`,
                line: i + 1,
                type: 'function'
            });
        }
    }

    return symbols.slice(0, limit);
};

// Extract CMake symbols (targets, executables, libraries, subdirectories)
const extractCMakeSymbols = (content: string, limit: number = 15): SymbolDefinition[] => {
    const symbols: SymbolDefinition[] = [];

    // Remove comments first to avoid false matches
    const cleanContent = content.replace(/#[^\n]*/g, '');

    // More lenient regex patterns that handle multiline and whitespace
    const executableRegex = /add_executable\s*\(\s*([a-zA-Z0-9_-]+)/gi;
    const libraryRegex = /add_library\s*\(\s*([a-zA-Z0-9_-]+)/gi;
    const subdirRegex = /add_subdirectory\s*\(\s*([a-zA-Z0-9_\/.\\-]+)/gi;
    const packageRegex = /find_package\s*\(\s*([a-zA-Z0-9_-]+)/gi;
    const projectRegex = /project\s*\(\s*([a-zA-Z0-9_-]+)/gi;
    const setRegex = /set\s*\(\s*([A-Z_][A-Z0-9_]*)\s/gi;

    // Find line numbers for each match
    const lines = content.split('\n');
    const findLineNumber = (matchIndex: number): number => {
        let charCount = 0;
        for (let i = 0; i < lines.length; i++) {
            charCount += lines[i].length + 1; // +1 for newline
            if (charCount > matchIndex) return i + 1;
        }
        return 1;
    };

    // Extract projects
    let match;
    while ((match = projectRegex.exec(cleanContent)) !== null && symbols.length < limit) {
        symbols.push({
            name: `project: ${match[1]}`,
            line: findLineNumber(match.index),
            type: 'target'
        });
    }

    // Extract executables
    while ((match = executableRegex.exec(cleanContent)) !== null && symbols.length < limit) {
        symbols.push({
            name: `executable: ${match[1]}`,
            line: findLineNumber(match.index),
            type: 'target'
        });
    }

    // Extract libraries
    while ((match = libraryRegex.exec(cleanContent)) !== null && symbols.length < limit) {
        symbols.push({
            name: `library: ${match[1]}`,
            line: findLineNumber(match.index),
            type: 'target'
        });
    }

    // Extract subdirectories
    while ((match = subdirRegex.exec(cleanContent)) !== null && symbols.length < limit) {
        symbols.push({
            name: `subdir: ${match[1]}`,
            line: findLineNumber(match.index),
            type: 'target'
        });
    }

    // Extract packages
    while ((match = packageRegex.exec(cleanContent)) !== null && symbols.length < limit) {
        symbols.push({
            name: `package: ${match[1]}`,
            line: findLineNumber(match.index),
            type: 'target'
        });
    }

    // Extract important variables
    const seenVars = new Set<string>();
    while ((match = setRegex.exec(cleanContent)) !== null && symbols.length < limit) {
        const varName = match[1];
        if (!seenVars.has(varName)) {
            seenVars.add(varName);
            symbols.push({
                name: `var: ${varName}`,
                line: findLineNumber(match.index),
                type: 'target'
            });
        }
    }

    return symbols.slice(0, limit);
};

// Extract function calls from CPP files (what the file uses/calls)
const extractCppCalls = (content: string, limit: number = 15): SymbolDefinition[] => {
    const symbols: SymbolDefinition[] = [];
    const lines = content.split('\n');
    const seenCalls = new Set<string>();

    // Regex to match function calls: functionName(...) or Class::method(...)
    const callRegex = /\b([a-zA-Z_][a-zA-Z0-9_]*(?:::[a-zA-Z_][a-zA-Z0-9_]*)?)\s*\(/g;

    // Keywords to exclude
    const keywords = new Set([
        'if', 'while', 'for', 'switch', 'return', 'catch', 'sizeof', 'typeof',
        'static_cast', 'dynamic_cast', 'reinterpret_cast', 'const_cast',
        'alignof', 'decltype', 'typeid', 'noexcept'
    ]);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Skip comments, preprocessor directives, and function definitions
        if (line.startsWith('//') || line.startsWith('#') || line.startsWith('*')) continue;

        // Skip lines that look like function definitions (return type before name)
        if (line.match(/^\s*(?:virtual\s+)?(?:static\s+)?(?:inline\s+)?(?:[a-zA-Z0-9_<>:*\s&]+)\s+[a-zA-Z0-9_]+\s*\([^)]*\)\s*(?:const\s*)?\{?$/)) continue;

        let match;
        callRegex.lastIndex = 0;
        while ((match = callRegex.exec(line)) !== null) {
            const funcName = match[1];

            // Filter out keywords, constructors, and duplicates
            if (!keywords.has(funcName) &&
                !funcName.match(/^[A-Z]/) && // Skip likely constructors (capitalize)
                !seenCalls.has(funcName)) {
                seenCalls.add(funcName);
                symbols.push({
                    name: `→ ${funcName}()`,
                    line: i + 1,
                    type: 'function'
                });

                if (symbols.length >= limit) break;
            }
        }
        if (symbols.length >= limit) break;
    }

    return symbols;
};

// Extract JSON symbols (top-level keys and structure)
const extractJSONSymbols = (content: string, limit: number = 10): SymbolDefinition[] => {
    const symbols: SymbolDefinition[] = [];

    try {
        const parsed = JSON.parse(content);
        const lines = content.split('\n');

        const extractKeys = (obj: any, prefix: string = '', depth: number = 0) => {
            if (depth > 2 || symbols.length >= limit) return; // Limit depth and count

            for (const key in obj) {
                if (!obj.hasOwnProperty(key)) continue;

                const fullKey = prefix ? `${prefix}.${key}` : key;
                const value = obj[key];

                // Find line number of this key in source
                let lineNum = 1;
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].includes(`"${key}":`)) {
                        lineNum = i + 1;
                        break;
                    }
                }

                if (typeof value === 'object' && value !== null) {
                    if (Array.isArray(value)) {
                        symbols.push({
                            name: `${fullKey}: [${value.length}]`,
                            line: lineNum,
                            type: 'key'
                        });
                    } else {
                        symbols.push({
                            name: `${fullKey}: {...}`,
                            line: lineNum,
                            type: 'key'
                        });
                        if (depth < 1) extractKeys(value, fullKey, depth + 1);
                    }
                } else {
                    const valueStr = String(value).substring(0, 20);
                    symbols.push({
                        name: `${fullKey}: ${valueStr}`,
                        line: lineNum,
                        type: 'key'
                    });
                }

                if (symbols.length >= limit) break;
            }
        };

        extractKeys(parsed);
    } catch (e) {
        // Malformed JSON - try to extract keys with regex
        const keyRegex = /"([^"]+)"\s*:/g;
        let match;
        const lines = content.split('\n');

        for (let i = 0; i < lines.length && symbols.length < limit; i++) {
            const line = lines[i];
            while ((match = keyRegex.exec(line)) !== null) {
                symbols.push({
                    name: match[1],
                    line: i + 1,
                    type: 'key'
                });
                if (symbols.length >= limit) break;
            }
        }
    }

    return symbols;
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
    // Broaden supported C/C++ extensions
    if (path.match(/\.(h|hpp|hh|hxx|h\+\+|inl|ipp|tpp|ixx|cuh)$/i)) type = 'header';
    else if (path.match(/\.(cpp|cxx|cc|c|c\+\+|cu|cppm)$/i)) type = 'source';
    else if (path.match(/\.(glsl|vert|frag|geom|comp|tesc|tese)$/i)) type = 'glsl';
    else if (path.match(/CMakeLists\.txt$/i) || path.match(/\.cmake$/i)) type = 'cmake';
    else if (path.match(/\.json$/i)) type = 'json';

    // Only process supported extensions
    if (type === 'other' && !path.match(/\.(cpp|cxx|cc|c|c\+\+|cu|cppm|h|hpp|hh|hxx|h\+\+|inl|ipp|tpp|ixx|cuh|cmake|json|txt|glsl|vert|frag|geom|comp|tesc|tese)$/i)) continue;

    const text = await file.text();

    // Extract symbols based on file type
    let exportedSymbols: SymbolDefinition[] = [];
    switch(type) {
      case 'header':
        // Headers: show definitions only
        exportedSymbols = extractSymbols(text, 20);
        break;
      case 'source':
        // CPP files: show both definitions AND function calls
        const definitions = extractSymbols(text, 10);
        const calls = extractCppCalls(text, 10);
        exportedSymbols = [...definitions, ...calls];
        break;
      case 'glsl':
        exportedSymbols = extractGLSLSymbols(text, 15);
        break;
      case 'cmake':
        exportedSymbols = extractCMakeSymbols(text, 15);
        break;
      case 'json':
        exportedSymbols = extractJSONSymbols(text, 10);
        break;
    }

    nodes.push({
      id: path,
      name: file.name,
      content: text,
      type: type,
      group: getFolder(path),
      exportedSymbols: exportedSymbols
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
        const includeRegex = /#include\s+(["<]([^">]+)[">])/g;
        let match;

        while ((match = includeRegex.exec(content)) !== null) {
          const includeRaw = match[1];
          const includePath = match[2];
          const includeLine = content.substring(0, match.index).split(/\r?\n/).length;
          const normalizedInclude = normalizePath(includePath);
          // Smart resolve: 
          // 1. Check exact relative path
          // 2. Check suffix match (common for includes like "Components/Camera.h")
          // 3. Check filename match
          
          let targetNode = nodes.find(n => n.id === normalizedInclude); // Exact?
          
          if (!targetNode && dir) {
              // Try relative to current file
              targetNode = nodes.find(n => n.id === `${dir}/${normalizedInclude}`); 
          }

          if (!targetNode) {
              targetNode = nodes.find(n => n.id.endsWith(normalizedInclude));
          }
          
          if (!targetNode) {
              const potentialMatches = nodes.filter(n => n.name === normalizedInclude.split('/').pop());
              if (potentialMatches.length === 1) targetNode = potentialMatches[0];
          }

          if (targetNode) {
            // Reverse direction: header defines → cpp depends
            // When Application.cpp includes Application.hpp, arrow goes FROM header TO cpp
            addLink(targetNode.id, node.id);

            // Also surface this interaction inside the node's symbol list
            node.exportedSymbols = node.exportedSymbols || [];
            node.exportedSymbols.push({
                name: `#include ${targetNode.name}`,
                line: includeLine,
                type: 'include'
            });
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