"""
Tree-sitter based C++ parser
Provides accurate AST parsing for C++ code
"""

from typing import Optional, Dict, Any
from pathlib import Path
import tree_sitter_cpp as tscpp
from tree_sitter import Language, Parser, Node


class CppTreeSitterParser:
    """Tree-sitter parser for C++ code"""

    def __init__(self):
        """Initialize the parser with C++ language"""
        self.parser = Parser()
        self.language = Language(tscpp.language())
        self.parser.language = self.language

    def parse_file(self, file_path: Path) -> Optional[Node]:
        """
        Parse a C++ file and return the root AST node

        Args:
            file_path: Path to the C++ file

        Returns:
            Root node of the AST or None if parsing fails
        """
        try:
            with open(file_path, 'rb') as f:
                source_code = f.read()

            tree = self.parser.parse(source_code)
            return tree.root_node
        except Exception as e:
            print(f"Error parsing {file_path}: {e}")
            return None

    def parse_string(self, source_code: str) -> Optional[Node]:
        """
        Parse C++ source code string

        Args:
            source_code: C++ source code as string

        Returns:
            Root node of the AST or None if parsing fails
        """
        try:
            tree = self.parser.parse(source_code.encode('utf-8'))
            return tree.root_node
        except Exception as e:
            print(f"Error parsing source: {e}")
            return None

    def get_node_text(self, node: Node, source: bytes) -> str:
        """Extract text from a node"""
        return source[node.start_byte:node.end_byte].decode('utf-8')

    def traverse_tree(self, node: Node, callback, depth: int = 0):
        """
        Traverse AST tree and call callback for each node

        Args:
            node: Current AST node
            callback: Function to call for each node (node, depth)
            depth: Current depth in the tree
        """
        callback(node, depth)
        for child in node.children:
            self.traverse_tree(child, callback, depth + 1)

    def find_nodes_by_type(self, root: Node, node_type: str) -> list[Node]:
        """
        Find all nodes of a specific type

        Args:
            root: Root node to start search
            node_type: Type of nodes to find (e.g., 'function_definition')

        Returns:
            List of matching nodes
        """
        result = []

        def collector(node: Node, depth: int):
            if node.type == node_type:
                result.append(node)

        self.traverse_tree(root, collector)
        return result

    def get_node_info(self, node: Node) -> Dict[str, Any]:
        """
        Get detailed information about a node

        Returns:
            Dictionary with node information
        """
        return {
            'type': node.type,
            'start_line': node.start_point[0] + 1,  # 1-indexed
            'start_col': node.start_point[1],
            'end_line': node.end_point[0] + 1,
            'end_col': node.end_point[1],
            'start_byte': node.start_byte,
            'end_byte': node.end_byte,
            'is_named': node.is_named,
            'has_error': node.has_error,
            'child_count': node.child_count,
        }


# Query patterns for common C++ constructs
CPP_QUERIES = {
    'functions': """
        (function_definition
            declarator: (function_declarator
                declarator: (identifier) @func_name
            )
        ) @function
    """,
    'classes': """
        (class_specifier
            name: (type_identifier) @class_name
        ) @class
    """,
    'structs': """
        (struct_specifier
            name: (type_identifier) @struct_name
        ) @struct
    """,
    'includes': """
        (preproc_include
            path: [
                (string_literal) @path
                (system_lib_string) @path
            ]
        ) @include
    """,
    'namespaces': """
        (namespace_definition
            name: (identifier) @ns_name
        ) @namespace
    """,
    'call_expressions': """
        (call_expression
            function: [
                (identifier) @func_name
                (qualified_identifier
                    name: (identifier) @func_name
                )
                (field_expression
                    field: (field_identifier) @func_name
                )
            ]
        ) @call
    """,
}


class CppQueryEngine:
    """Query engine for Tree-sitter AST"""

    def __init__(self, language: Language):
        self.language = language
        self.queries = {}

        # Pre-compile queries
        for name, query_string in CPP_QUERIES.items():
            try:
                self.queries[name] = language.query(query_string)
            except Exception as e:
                print(f"Failed to compile query '{name}': {e}")

    def execute_query(self, query_name: str, root_node: Node) -> list:
        """
        Execute a pre-defined query

        Args:
            query_name: Name of the query from CPP_QUERIES
            root_node: Root node to query

        Returns:
            List of (capture_name, node) tuples
        """
        if query_name not in self.queries:
            return []

        query = self.queries[query_name]
        return query.captures(root_node)
