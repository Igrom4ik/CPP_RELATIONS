import { InteractionAnalysis, CodeSnippet } from '../types';

/**
 * A rudimentary C++ parser using Regex to work offline in the browser.
 * It attempts to find function definitions in headers/source and their calls.
 */
export const localAnalyzeInteraction = (
    sourceFile: string,
    sourceCode: string,
    targetFile: string,
    targetCode: string
): InteractionAnalysis => {
    
    // 1. Try to find potential symbols defined in target (functions, classes)
    // Looking for: void FunctionName(...) or ClassName::FunctionName(...)
    // This is a naive regex, but works for many C++ cases
    const definitionRegex = /([a-zA-Z0-9_]+)\s*\([^)]*\)\s*(\{|;)/g;
    const definitions: string[] = [];
    let match;
    
    // Extract potential function names from target
    while ((match = definitionRegex.exec(targetCode)) !== null) {
        if (!['if', 'for', 'while', 'switch', 'catch'].includes(match[1])) {
            definitions.push(match[1]);
        }
    }

    // 2. Find usage in source
    let foundSymbol = "";
    let callerLine = 0;
    let calleeLine = 0;
    
    // Find the first symbol from target that appears in source
    for (const def of definitions) {
        // Look for "def(" in source
        const usageIndex = sourceCode.indexOf(`${def}(`);
        if (usageIndex !== -1) {
            foundSymbol = def;
            // Calculate line number
            callerLine = sourceCode.substring(0, usageIndex).split('\n').length;
            
            // Find definition line in target
            const defIndex = targetCode.indexOf(def);
            calleeLine = targetCode.substring(0, defIndex).split('\n').length;
            break;
        }
    }

    // Fallback if no specific function call found (just include dependency)
    if (!foundSymbol) {
        return {
            summary: "Обнаружено включение файла (Local Analysis)",
            isAiGenerated: false,
            callerSnippet: {
                file: sourceFile,
                code: `#include "${targetFile.split('/').pop()}"\n// Прямой вызов функций не обнаружен простым парсером`,
                startLine: 1,
                explanation: "Файл включает заголовок, но конкретные вызовы функций не найдены регулярным выражением."
            },
            calleeSnippet: {
                file: targetFile,
                code: targetCode.split('\n').slice(0, 10).join('\n') + "\n...",
                startLine: 1,
                explanation: "Начало целевого файла."
            }
        };
    }

    // Helper to extract context (5 lines before and after)
    const extractContext = (code: string, line: number) => {
        const lines = code.split('\n');
        const start = Math.max(0, line - 3);
        const end = Math.min(lines.length, line + 5);
        return lines.slice(start, end).join('\n');
    };

    return {
        summary: `Обнаружен вызов функции '${foundSymbol}' (Offline)`,
        isAiGenerated: false,
        callerSnippet: {
            file: sourceFile,
            code: extractContext(sourceCode, callerLine),
            startLine: Math.max(1, callerLine - 2),
            explanation: `Строка ${callerLine}: Вызов функции ${foundSymbol}`
        },
        calleeSnippet: {
            file: targetFile,
            code: extractContext(targetCode, calleeLine),
            startLine: Math.max(1, calleeLine - 2),
            explanation: `Строка ${calleeLine}: Определение функции ${foundSymbol}`
        }
    };
};