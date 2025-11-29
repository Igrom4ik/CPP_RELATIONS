"""
Dependency Analyzer
Builds dependency graph from extracted symbols
"""

from typing import List, Dict, Set, Tuple, Optional
from pathlib import Path
from dataclasses import dataclass, field
import re

from .ast_extractor import FileSymbols, IncludeInfo, SymbolInfo


@dataclass
class FileDependency:
    """Dependency between two files"""
    source: str  # Source file path
    target: str  # Target file path
    reason: str  # Why the dependency exists ('include', 'call', 'inheritance')
    line: Optional[int] = None  # Line where dependency occurs


@dataclass
class DependencyGraph:
    """Complete dependency graph"""
    files: Dict[str, FileSymbols] = field(default_factory=dict)
    dependencies: List[FileDependency] = field(default_factory=list)
    # Quick lookup structures
    file_index: Dict[str, str] = field(default_factory=dict)  # filename -> full_path
    symbol_index: Dict[str, List[Tuple[str, SymbolInfo]]] = field(default_factory=dict)  # symbol_name -> [(file, symbol_info)]


class DependencyAnalyzer:
    """Analyze and build dependency graph"""

    def __init__(self):
        self.graph = DependencyGraph()

    def add_file(self, file_path: str, symbols: FileSymbols):
        """Add a parsed file to the graph"""
        self.graph.files[file_path] = symbols

        # Update indexes
        file_name = Path(file_path).name
        self.graph.file_index[file_name] = file_path

        # Index all symbols
        for symbol_list in [symbols.functions, symbols.classes, symbols.structs]:
            for symbol in symbol_list:
                if symbol.name not in self.graph.symbol_index:
                    self.graph.symbol_index[symbol.name] = []
                self.graph.symbol_index[symbol.name].append((file_path, symbol))

    def analyze_dependencies(self):
        """
        Analyze all dependencies between files
        Should be called after all files are added
        """
        self.graph.dependencies.clear()

        for file_path, symbols in self.graph.files.items():
            # 1. Analyze includes
            self._analyze_includes(file_path, symbols)

            # 2. Analyze function calls (call graph)
            self._analyze_function_calls(file_path, symbols)

    def _analyze_includes(self, source_file: str, symbols: FileSymbols):
        """Analyze #include dependencies"""
        for include in symbols.includes:
            target_file = self._resolve_include(include.path, source_file)

            if target_file:
                self.graph.dependencies.append(FileDependency(
                    source=source_file,
                    target=target_file,
                    reason='include',
                    line=include.line
                ))

    def _resolve_include(self, include_path: str, source_file: str) -> Optional[str]:
        """
        Resolve include path to actual file

        Tries multiple strategies:
        1. Exact match by full path
        2. Filename match
        3. Suffix match
        4. Relative to source file
        """
        # Strategy 1: Exact match
        if include_path in self.graph.files:
            return include_path

        # Strategy 2: Filename match
        include_filename = Path(include_path).name
        if include_filename in self.graph.file_index:
            return self.graph.file_index[include_filename]

        # Strategy 3: Suffix match (for nested includes like "Components/Camera.h")
        for file_path in self.graph.files.keys():
            if file_path.endswith(include_path):
                return file_path

        # Strategy 4: Relative to source file directory
        source_dir = Path(source_file).parent
        potential_path = str(source_dir / include_path)
        if potential_path in self.graph.files:
            return potential_path

        # Strategy 5: Search in all directories
        for file_path in self.graph.files.keys():
            if Path(file_path).name == include_filename:
                return file_path

        return None

    def _analyze_function_calls(self, source_file: str, symbols: FileSymbols):
        """Analyze function call dependencies"""
        # For each function call in source file
        for called_func in symbols.function_calls:
            # Find where this function is defined
            if called_func in self.graph.symbol_index:
                for target_file, symbol_info in self.graph.symbol_index[called_func]:
                    # Skip self-calls (within same file)
                    if target_file == source_file:
                        continue

                    # Only add if not already connected via include
                    if not self._has_dependency(source_file, target_file):
                        self.graph.dependencies.append(FileDependency(
                            source=source_file,
                            target=target_file,
                            reason='call',
                            line=None  # Don't know exact line of call
                        ))

    def _has_dependency(self, source: str, target: str) -> bool:
        """Check if dependency already exists"""
        return any(
            dep.source == source and dep.target == target
            for dep in self.graph.dependencies
        )

    def get_dependencies_of(self, file_path: str) -> List[str]:
        """Get all files that this file depends on"""
        return [
            dep.target for dep in self.graph.dependencies
            if dep.source == file_path
        ]

    def get_dependents_of(self, file_path: str) -> List[str]:
        """Get all files that depend on this file"""
        return [
            dep.source for dep in self.graph.dependencies
            if dep.target == file_path
        ]

    def get_file_metrics(self, file_path: str) -> Dict:
        """Get metrics for a file"""
        if file_path not in self.graph.files:
            return {}

        symbols = self.graph.files[file_path]
        dependencies = self.get_dependencies_of(file_path)
        dependents = self.get_dependents_of(file_path)

        return {
            'file': file_path,
            'functions_count': len(symbols.functions),
            'classes_count': len(symbols.classes),
            'structs_count': len(symbols.structs),
            'includes_count': len(symbols.includes),
            'dependencies_count': len(dependencies),
            'dependents_count': len(dependents),
            'coupling': len(dependencies) + len(dependents),
        }

    def find_circular_dependencies(self) -> List[List[str]]:
        """Find circular dependencies (cycles in the graph)"""
        import networkx as nx

        # Build directed graph
        G = nx.DiGraph()
        for dep in self.graph.dependencies:
            G.add_edge(dep.source, dep.target)

        # Find all cycles
        try:
            cycles = list(nx.simple_cycles(G))
            return cycles
        except:
            return []

    def get_most_coupled_files(self, limit: int = 10) -> List[Tuple[str, int]]:
        """Get files with highest coupling (most dependencies)"""
        coupling = {}

        for file_path in self.graph.files.keys():
            deps = len(self.get_dependencies_of(file_path))
            dependents = len(self.get_dependents_of(file_path))
            coupling[file_path] = deps + dependents

        # Sort by coupling
        sorted_files = sorted(coupling.items(), key=lambda x: x[1], reverse=True)
        return sorted_files[:limit]

    def export_to_dict(self) -> Dict:
        """Export graph to dictionary format (for JSON serialization)"""
        nodes = []
        links = []

        # Convert files to nodes
        for file_path, symbols in self.graph.files.items():
            # Extract file type
            file_type = 'other'
            if file_path.endswith(('.h', '.hpp', '.hh')):
                file_type = 'header'
            elif file_path.endswith(('.cpp', '.cc', '.cxx', '.c')):
                file_type = 'source'
            elif 'CMakeLists' in file_path or file_path.endswith('.cmake'):
                file_type = 'cmake'
            elif file_path.endswith('.json'):
                file_type = 'json'

            # Get folder/group
            parts = Path(file_path).parts
            group = parts[-2] if len(parts) > 1 else 'root'

            # Export symbols (limit to top 10)
            exported_symbols = []
            for func in symbols.functions[:5]:
                exported_symbols.append({
                    'name': f"{func.name}()",
                    'line': func.line,
                    'type': 'function'
                })
            for cls in symbols.classes[:5]:
                exported_symbols.append({
                    'name': f"class {cls.name}",
                    'line': cls.line,
                    'type': 'class'
                })

            nodes.append({
                'id': file_path,
                'name': Path(file_path).name,
                'type': file_type,
                'group': group,
                'exportedSymbols': exported_symbols,
                'metrics': self.get_file_metrics(file_path)
            })

        # Convert dependencies to links
        for dep in self.graph.dependencies:
            links.append({
                'source': dep.source,
                'target': dep.target,
                'reason': dep.reason
            })

        return {
            'nodes': nodes,
            'links': links,
            'metadata': {
                'total_files': len(nodes),
                'total_dependencies': len(links),
                'circular_dependencies': len(self.find_circular_dependencies())
            }
        }
