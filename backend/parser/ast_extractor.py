"""
AST Symbol Extractor
Extracts classes, functions, includes, and other symbols from C++ AST
"""

from typing import List, Dict, Any, Optional, Set
from dataclasses import dataclass, field
from pathlib import Path
from tree_sitter import Node

from .tree_sitter_parser import CppTreeSitterParser, CppQueryEngine


@dataclass
class SymbolInfo:
    """Information about a symbol (function, class, etc.)"""
    name: str
    type: str  # 'function', 'class', 'struct', 'namespace'
    line: int
    end_line: int
    scope: Optional[str] = None  # Namespace or class scope
    params: List[str] = field(default_factory=list)  # For functions
    return_type: Optional[str] = None  # For functions
    is_template: bool = False
    is_virtual: bool = False
    is_static: bool = False


@dataclass
class IncludeInfo:
    """Information about an include directive"""
    path: str
    line: int
    is_system: bool  # <> vs ""


@dataclass
class FileSymbols:
    """All symbols extracted from a file"""
    file_path: str
    functions: List[SymbolInfo] = field(default_factory=list)
    classes: List[SymbolInfo] = field(default_factory=list)
    structs: List[SymbolInfo] = field(default_factory=list)
    namespaces: List[SymbolInfo] = field(default_factory=list)
    includes: List[IncludeInfo] = field(default_factory=list)
    function_calls: Set[str] = field(default_factory=set)


class AstExtractor:
    """Extract symbols from C++ AST"""

    def __init__(self):
        self.parser = CppTreeSitterParser()
        self.query_engine = CppQueryEngine(self.parser.language)

    def extract_file(self, file_path: Path, source_code: Optional[str] = None) -> FileSymbols:
        """
        Extract all symbols from a C++ file

        Args:
            file_path: Path to the file
            source_code: Optional source code string (if already read)

        Returns:
            FileSymbols object with all extracted data
        """
        # Parse the file
        if source_code is not None:
            root_node = self.parser.parse_string(source_code)
            source_bytes = source_code.encode('utf-8')
        else:
            root_node = self.parser.parse_file(file_path)
            with open(file_path, 'rb') as f:
                source_bytes = f.read()

        if root_node is None:
            return FileSymbols(file_path=str(file_path))

        symbols = FileSymbols(file_path=str(file_path))

        # Extract different symbol types
        symbols.includes = self._extract_includes(root_node, source_bytes)
        symbols.functions = self._extract_functions(root_node, source_bytes)
        symbols.classes = self._extract_classes(root_node, source_bytes)
        symbols.structs = self._extract_structs(root_node, source_bytes)
        symbols.namespaces = self._extract_namespaces(root_node, source_bytes)
        symbols.function_calls = self._extract_function_calls(root_node, source_bytes)

        return symbols

    def _extract_includes(self, root: Node, source: bytes) -> List[IncludeInfo]:
        """Extract #include directives"""
        includes = []
        captures = self.query_engine.execute_query('includes', root)

        for capture_name, node in captures:
            if capture_name == 'path':
                path_text = self.parser.get_node_text(node, source)
                # Remove quotes or <>
                path_text = path_text.strip('"<>')

                # Determine if system include
                parent = node.parent
                is_system = '<' in self.parser.get_node_text(parent, source)

                includes.append(IncludeInfo(
                    path=path_text,
                    line=node.start_point[0] + 1,
                    is_system=is_system
                ))

        return includes

    def _extract_functions(self, root: Node, source: bytes) -> List[SymbolInfo]:
        """Extract function definitions"""
        functions = []
        captures = self.query_engine.execute_query('functions', root)

        for capture_name, node in captures:
            if capture_name == 'func_name':
                func_name = self.parser.get_node_text(node, source)

                # Get function definition node
                func_def = node.parent
                while func_def and func_def.type != 'function_definition':
                    func_def = func_def.parent

                if not func_def:
                    continue

                # Extract return type, params, modifiers
                return_type = self._get_return_type(func_def, source)
                params = self._get_function_params(func_def, source)
                is_virtual = self._is_virtual_function(func_def, source)
                is_static = self._is_static_function(func_def, source)

                # Get scope (class/namespace)
                scope = self._get_scope(func_def, source)

                functions.append(SymbolInfo(
                    name=func_name,
                    type='function',
                    line=func_def.start_point[0] + 1,
                    end_line=func_def.end_point[0] + 1,
                    scope=scope,
                    params=params,
                    return_type=return_type,
                    is_virtual=is_virtual,
                    is_static=is_static
                ))

        return functions

    def _extract_classes(self, root: Node, source: bytes) -> List[SymbolInfo]:
        """Extract class definitions"""
        classes = []
        captures = self.query_engine.execute_query('classes', root)

        for capture_name, node in captures:
            if capture_name == 'class_name':
                class_name = self.parser.get_node_text(node, source)

                # Get class specifier node
                class_node = node.parent
                while class_node and class_node.type != 'class_specifier':
                    class_node = class_node.parent

                if not class_node:
                    continue

                scope = self._get_scope(class_node, source)

                classes.append(SymbolInfo(
                    name=class_name,
                    type='class',
                    line=class_node.start_point[0] + 1,
                    end_line=class_node.end_point[0] + 1,
                    scope=scope
                ))

        return classes

    def _extract_structs(self, root: Node, source: bytes) -> List[SymbolInfo]:
        """Extract struct definitions"""
        structs = []
        captures = self.query_engine.execute_query('structs', root)

        for capture_name, node in captures:
            if capture_name == 'struct_name':
                struct_name = self.parser.get_node_text(node, source)

                struct_node = node.parent
                while struct_node and struct_node.type != 'struct_specifier':
                    struct_node = struct_node.parent

                if not struct_node:
                    continue

                structs.append(SymbolInfo(
                    name=struct_name,
                    type='struct',
                    line=struct_node.start_point[0] + 1,
                    end_line=struct_node.end_point[0] + 1
                ))

        return structs

    def _extract_namespaces(self, root: Node, source: bytes) -> List[SymbolInfo]:
        """Extract namespace definitions"""
        namespaces = []
        captures = self.query_engine.execute_query('namespaces', root)

        for capture_name, node in captures:
            if capture_name == 'ns_name':
                ns_name = self.parser.get_node_text(node, source)

                ns_node = node.parent
                while ns_node and ns_node.type != 'namespace_definition':
                    ns_node = ns_node.parent

                if not ns_node:
                    continue

                namespaces.append(SymbolInfo(
                    name=ns_name,
                    type='namespace',
                    line=ns_node.start_point[0] + 1,
                    end_line=ns_node.end_point[0] + 1
                ))

        return namespaces

    def _extract_function_calls(self, root: Node, source: bytes) -> Set[str]:
        """Extract all function call names"""
        calls = set()
        captures = self.query_engine.execute_query('call_expressions', root)

        for capture_name, node in captures:
            if capture_name == 'func_name':
                func_name = self.parser.get_node_text(node, source)
                calls.add(func_name)

        return calls

    def _get_return_type(self, func_def: Node, source: bytes) -> Optional[str]:
        """Extract return type from function definition"""
        for child in func_def.children:
            if child.type in ['primitive_type', 'type_identifier', 'qualified_identifier']:
                return self.parser.get_node_text(child, source)
        return None

    def _get_function_params(self, func_def: Node, source: bytes) -> List[str]:
        """Extract function parameters"""
        params = []

        # Find parameter list
        for child in func_def.children:
            if child.type == 'function_declarator':
                for param_node in child.children:
                    if param_node.type == 'parameter_list':
                        for param in param_node.children:
                            if param.type == 'parameter_declaration':
                                param_text = self.parser.get_node_text(param, source)
                                params.append(param_text)

        return params

    def _is_virtual_function(self, func_def: Node, source: bytes) -> bool:
        """Check if function is virtual"""
        for child in func_def.children:
            if child.type == 'virtual':
                return True
        return False

    def _is_static_function(self, func_def: Node, source: bytes) -> bool:
        """Check if function is static"""
        for child in func_def.children:
            if child.type == 'storage_class_specifier':
                text = self.parser.get_node_text(child, source)
                if 'static' in text:
                    return True
        return False

    def _get_scope(self, node: Node, source: bytes) -> Optional[str]:
        """Get the scope (namespace/class) of a node"""
        current = node.parent

        while current:
            if current.type == 'namespace_definition':
                # Find namespace name
                for child in current.children:
                    if child.type == 'identifier':
                        return self.parser.get_node_text(child, source)

            elif current.type in ['class_specifier', 'struct_specifier']:
                # Find class/struct name
                for child in current.children:
                    if child.type == 'type_identifier':
                        return self.parser.get_node_text(child, source)

            current = current.parent

        return None
