#!/usr/bin/env python3
"""
Test script for C++ parser
Usage: python test_parser.py <path_to_cpp_file_or_directory>
"""

import sys
import json
from pathlib import Path
from parser.ast_extractor import AstExtractor
from parser.dependency_analyzer import DependencyAnalyzer


def test_single_file(file_path: Path):
    """Test parsing a single C++ file"""
    print(f"\n{'='*60}")
    print(f"Parsing: {file_path}")
    print(f"{'='*60}\n")

    extractor = AstExtractor()
    symbols = extractor.extract_file(file_path)

    print(f"📄 File: {symbols.file_path}")
    print(f"\n📦 Includes ({len(symbols.includes)}):")
    for inc in symbols.includes[:10]:  # Limit to 10
        prefix = "  <>" if inc.is_system else '  ""'
        print(f"{prefix} {inc.path} (line {inc.line})")

    print(f"\n🔧 Functions ({len(symbols.functions)}):")
    for func in symbols.functions[:10]:
        scope_str = f"{func.scope}::" if func.scope else ""
        modifiers = []
        if func.is_virtual: modifiers.append("virtual")
        if func.is_static: modifiers.append("static")
        mod_str = " ".join(modifiers) + " " if modifiers else ""
        print(f"  {mod_str}{scope_str}{func.name} (line {func.line})")
        if func.return_type:
            print(f"    → returns: {func.return_type}")

    print(f"\n📐 Classes ({len(symbols.classes)}):")
    for cls in symbols.classes[:10]:
        scope_str = f"{cls.scope}::" if cls.scope else ""
        print(f"  {scope_str}{cls.name} (lines {cls.line}-{cls.end_line})")

    print(f"\n📊 Structs ({len(symbols.structs)}):")
    for struct in symbols.structs[:10]:
        print(f"  {struct.name} (line {struct.line})")

    print(f"\n🌍 Namespaces ({len(symbols.namespaces)}):")
    for ns in symbols.namespaces[:10]:
        print(f"  namespace {ns.name} (lines {ns.line}-{ns.end_line})")

    print(f"\n📞 Function Calls ({len(symbols.function_calls)}):")
    for call in list(symbols.function_calls)[:15]:
        print(f"  {call}()")

    print()


def test_project(project_dir: Path):
    """Test parsing an entire C++ project"""
    print(f"\n{'='*60}")
    print(f"Parsing project: {project_dir}")
    print(f"{'='*60}\n")

    # Find all C++ files
    cpp_extensions = ['*.cpp', '*.cc', '*.cxx', '*.c', '*.h', '*.hpp', '*.hh']
    cpp_files = []
    for ext in cpp_extensions:
        cpp_files.extend(project_dir.rglob(ext))

    # Filter out build directories
    cpp_files = [
        f for f in cpp_files
        if not any(part in f.parts for part in ['build', 'cmake-build', '.git', 'node_modules'])
    ]

    print(f"📁 Found {len(cpp_files)} C++ files\n")

    if len(cpp_files) == 0:
        print("❌ No C++ files found!")
        return

    # Parse all files
    extractor = AstExtractor()
    analyzer = DependencyAnalyzer()

    print("⏳ Parsing files...")
    for i, cpp_file in enumerate(cpp_files, 1):
        print(f"  [{i}/{len(cpp_files)}] {cpp_file.name}", end='\r')
        try:
            symbols = extractor.extract_file(cpp_file)
            analyzer.add_file(str(cpp_file.relative_to(project_dir)), symbols)
        except Exception as e:
            print(f"\n  ⚠️  Error parsing {cpp_file.name}: {e}")

    print("\n\n⏳ Analyzing dependencies...")
    analyzer.analyze_dependencies()

    # Export graph
    graph_data = analyzer.export_to_dict()

    print(f"\n{'='*60}")
    print("📊 Analysis Results")
    print(f"{'='*60}\n")

    print(f"📄 Total files: {len(graph_data['nodes'])}")
    print(f"🔗 Total dependencies: {len(graph_data['links'])}")
    print(f"🔄 Circular dependencies: {graph_data['metadata']['circular_dependencies']}")

    # Find cycles
    cycles = analyzer.find_circular_dependencies()
    if cycles:
        print(f"\n⚠️  Found {len(cycles)} circular dependencies:")
        for cycle in cycles[:5]:  # Show first 5
            cycle_str = " → ".join([Path(f).name for f in cycle])
            print(f"  • {cycle_str} → {Path(cycle[0]).name}")

    # Most coupled files
    print(f"\n📈 Most coupled files:")
    coupled = analyzer.get_most_coupled_files(10)
    for file_path, coupling in coupled:
        print(f"  {Path(file_path).name}: {coupling} connections")

    # Save to JSON
    output_file = project_dir / "dependency_graph.json"
    with open(output_file, 'w') as f:
        json.dump(graph_data, f, indent=2)

    print(f"\n✅ Graph saved to: {output_file}")


def main():
    if len(sys.argv) < 2:
        print("Usage: python test_parser.py <path_to_cpp_file_or_directory>")
        sys.exit(1)

    path = Path(sys.argv[1])

    if not path.exists():
        print(f"❌ Error: Path does not exist: {path}")
        sys.exit(1)

    if path.is_file():
        test_single_file(path)
    elif path.is_dir():
        test_project(path)
    else:
        print(f"❌ Error: Invalid path: {path}")
        sys.exit(1)


if __name__ == "__main__":
    main()
