import React, { useEffect, useRef, useMemo } from 'react';

declare const Prism: any;

interface CodeViewerProps {
  code: string;
  fileName: string;
  highlightLines?: { start: number; color: string };
}

export const CodeViewer: React.FC<CodeViewerProps> = React.memo(({ code, fileName, highlightLines }) => {
    const codeRef = useRef<HTMLElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const ext = fileName.split('.').pop()?.toLowerCase();
    const lang = (ext === 'h' || ext === 'hpp') ? 'cpp' : (ext || 'cpp');

    useEffect(() => { 
        if (codeRef.current && typeof Prism !== 'undefined') {
            Prism.highlightElement(codeRef.current); 
        }
    }, [code]);

    useEffect(() => {
        if (highlightLines && containerRef.current) {
             const scrollEl = containerRef.current;
             const topPos = (highlightLines.start - 1) * 20 + 16;
             scrollEl.scrollTo({ top: topPos - (scrollEl.clientHeight / 2), behavior: 'smooth' });
        }
    }, [highlightLines]);

    const lines = useMemo(() => code.split('\n'), [code]);

    return (
        <div className="flex flex-col h-full bg-[#1e1e1e] font-mono text-sm relative group">
            <div className="flex-1 overflow-auto custom-scrollbar relative" ref={containerRef}>
                <div className="flex min-h-full">
                    {/* Gutter */}
                    <div className="bg-[#252526] border-r border-[#3e3e42] text-right pr-3 pl-2 py-4 select-none text-[#858585] w-12 flex-shrink-0 z-10 text-[13px] leading-[20px]">
                        {lines.map((_, i) => <div key={i} className="h-[20px]">{i + 1}</div>)}
                    </div>
                    {/* Code Area */}
                    <div className="flex-1 bg-[#1e1e1e] relative">
                         {highlightLines && (
                            <div className="absolute w-full pointer-events-none z-0"
                                style={{ 
                                    top: `${(highlightLines.start - 1) * 20 + 16}px`, 
                                    height: '20px', 
                                    backgroundColor: highlightLines.color === 'blue' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(249, 115, 22, 0.2)', 
                                    borderLeft: `2px solid ${highlightLines.color === 'blue' ? '#3b82f6' : '#f97316'}`, 
                                    width: '100%' 
                                }}
                            />
                         )}
                         <pre className="!m-0 !p-4 !bg-transparent z-10 relative !overflow-visible">
                            <code ref={codeRef} className={`language-${lang}`}>{code}</code>
                         </pre>
                    </div>
                </div>
            </div>
        </div>
    );
});