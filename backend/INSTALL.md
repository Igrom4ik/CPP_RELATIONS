# Backend Installation Guide

## Quick Start

### 1. Install Python 3.11+

**Windows:**
```bash
# Download from python.org or use winget
winget install Python.Python.3.11
```

**Linux/Mac:**
```bash
# Ubuntu/Debian
sudo apt update && sudo apt install python3.11 python3.11-venv

# macOS (with Homebrew)
brew install python@3.11
```

### 2. Create Virtual Environment

```bash
cd backend
python -m venv venv
```

### 3. Activate Virtual Environment

**Windows:**
```bash
venv\Scripts\activate
```

**Linux/Mac:**
```bash
source venv/bin/activate
```

### 4. Install Dependencies

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 5. Test Installation

```bash
# Test with a single C++ file
python test_parser.py path/to/your/file.cpp

# OR test with entire project
python test_parser.py path/to/your/cpp/project
```

## Troubleshooting

### Tree-sitter installation issues

If you get errors about tree-sitter-cpp:

```bash
# Reinstall tree-sitter
pip uninstall tree-sitter tree-sitter-cpp
pip install tree-sitter==0.21.0 tree-sitter-cpp==0.21.0
```

### Windows C++ Compiler Issues

If you see "Microsoft Visual C++ 14.0 or greater is required":

1. Install Visual Studio Build Tools: https://visualstudio.microsoft.com/downloads/
2. OR install via winget:
   ```bash
   winget install Microsoft.VisualStudio.2022.BuildTools
   ```

### Permission errors (Linux/Mac)

```bash
# Make test script executable
chmod +x test_parser.py
```

## Next Steps

1. **Test the parser** with your C++ project
2. **Check output** - `dependency_graph.json` will be created
3. **Start FastAPI server** (when implemented):
   ```bash
   uvicorn main:app --reload
   ```
4. **Integrate with frontend** - Configure frontend to use `http://localhost:8000/api`

## Verify Installation

Run this command to verify everything is installed:

```bash
python -c "from parser.ast_extractor import AstExtractor; print('✅ Backend installed successfully!')"
```

If you see "✅ Backend installed successfully!" - you're ready to go!
