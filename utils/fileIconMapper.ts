/**
 * File Icon Mapper - Maps file extensions and folder names to vscode-icons
 * Based on vscode-icons project: https://github.com/vscode-icons/vscode-icons
 * Icons License: CC BY-SA (Creative Commons ShareAlike)
 */

const ICON_BASE_PATH = '/vscode-icons/icons';

// File extension to icon mapping
const FILE_ICON_MAP: Record<string, string> = {
  // C/C++
  'cpp': 'file_type_cpp',
  'cc': 'file_type_cpp',
  'cxx': 'file_type_cpp',
  'c++': 'file_type_cpp',
  'c': 'file_type_c',
  'h': 'file_type_cppheader',
  'hpp': 'file_type_cppheader',
  'hh': 'file_type_cppheader',
  'hxx': 'file_type_cppheader',
  'h++': 'file_type_cppheader',

  // Build & Config
  'cmake': 'file_type_cmake',
  'json': 'file_type_json',
  'xml': 'file_type_xml',
  'yaml': 'file_type_yaml',
  'yml': 'file_type_yaml',
  'toml': 'file_type_toml',

  // JavaScript/TypeScript
  'js': 'file_type_js',
  'jsx': 'file_type_reactjs',
  'ts': 'file_type_typescript',
  'tsx': 'file_type_reactts',

  // Python
  'py': 'file_type_python',
  'pyw': 'file_type_python',
  'pyx': 'file_type_python',

  // Java
  'java': 'file_type_java',
  'class': 'file_type_class',
  'jar': 'file_type_jar',

  // Other languages
  'rs': 'file_type_rust',
  'go': 'file_type_go',
  'php': 'file_type_php',
  'rb': 'file_type_ruby',
  'swift': 'file_type_swift',
  'kt': 'file_type_kotlin',
  'scala': 'file_type_scala',
  'cs': 'file_type_csharp',

  // Web
  'html': 'file_type_html',
  'css': 'file_type_css',
  'scss': 'file_type_scss',
  'sass': 'file_type_sass',
  'less': 'file_type_less',

  // Documentation
  'md': 'file_type_markdown',
  'txt': 'file_type_text',
  'pdf': 'file_type_pdf',
  'doc': 'file_type_word',
  'docx': 'file_type_word',

  // Images
  'png': 'file_type_image',
  'jpg': 'file_type_image',
  'jpeg': 'file_type_image',
  'gif': 'file_type_image',
  'svg': 'file_type_svg',
  'ico': 'file_type_favicon',

  // Archives
  'zip': 'file_type_zip',
  'tar': 'file_type_zip',
  'gz': 'file_type_zip',
  '7z': 'file_type_zip',
  'rar': 'file_type_zip',

  // Shell
  'sh': 'file_type_shell',
  'bash': 'file_type_shell',
  'zsh': 'file_type_shell',
  'fish': 'file_type_shell',
  'bat': 'file_type_bat',
  'cmd': 'file_type_bat',
  'ps1': 'file_type_powershell',

  // Git
  'gitignore': 'file_type_git',
  'gitattributes': 'file_type_git',
  'gitmodules': 'file_type_git',
};

// Filename to icon mapping (for files without extensions or special names)
const FILENAME_ICON_MAP: Record<string, string> = {
  // Build files
  'CMakeLists.txt': 'file_type_cmake',
  'Makefile': 'file_type_makefile',
  'makefile': 'file_type_makefile',
  'Dockerfile': 'file_type_docker',
  'docker-compose.yml': 'file_type_docker',

  // Config files
  'package.json': 'file_type_node',
  'package-lock.json': 'file_type_npm',
  'tsconfig.json': 'file_type_tsconfig',
  'webpack.config.js': 'file_type_webpack',
  'vite.config.ts': 'file_type_vite',
  '.gitignore': 'file_type_git',
  '.gitattributes': 'file_type_git',
  '.gitmodules': 'file_type_git',
  '.env': 'file_type_dotenv',
  '.eslintrc': 'file_type_eslint',
  '.prettierrc': 'file_type_prettier',
  'LICENSE': 'file_type_license',
  'README.md': 'file_type_readme',
};

// Folder name to icon mapping
const FOLDER_ICON_MAP: Record<string, string> = {
  // Common folders
  'src': 'folder_type_src',
  'source': 'folder_type_src',
  'sources': 'folder_type_src',
  'include': 'folder_type_include',
  'includes': 'folder_type_include',
  'headers': 'folder_type_include',
  'lib': 'folder_type_lib',
  'libs': 'folder_type_lib',
  'library': 'folder_type_lib',
  'bin': 'folder_type_binary',
  'build': 'folder_type_buildtool',
  'dist': 'folder_type_dist',
  'out': 'folder_type_dist',
  'output': 'folder_type_dist',

  // Package managers
  'node_modules': 'folder_type_node',
  '.npm': 'folder_type_node',

  // Version control
  '.git': 'folder_type_git',
  '.github': 'folder_type_github',
  '.gitlab': 'folder_type_gitlab',

  // Config
  '.vscode': 'folder_type_vscode',
  '.idea': 'folder_type_intellij',
  'config': 'folder_type_config',
  'configs': 'folder_type_config',
  'configuration': 'folder_type_config',

  // Tests
  'test': 'folder_type_test',
  'tests': 'folder_type_test',
  '__tests__': 'folder_type_test',
  'spec': 'folder_type_test',

  // Documentation
  'docs': 'folder_type_docs',
  'doc': 'folder_type_docs',
  'documentation': 'folder_type_docs',

  // Assets
  'public': 'folder_type_public',
  'assets': 'folder_type_asset',
  'images': 'folder_type_images',
  'img': 'folder_type_images',
  'icons': 'folder_type_images',
  'fonts': 'folder_type_font',

  // Framework specific
  'components': 'folder_type_component',
  'pages': 'folder_type_routes',
  'views': 'folder_type_views',
  'utils': 'folder_type_utils',
  'helpers': 'folder_type_helper',
  'services': 'folder_type_api',
  'api': 'folder_type_api',
  'models': 'folder_type_model',
  'controllers': 'folder_type_controller',
  'hooks': 'folder_type_hook',
  'types': 'folder_type_typings',
  'interfaces': 'folder_type_typings',

  // Build tools
  'cmake': 'folder_type_cmake',
  'CMake': 'folder_type_cmake',
};

/**
 * Get icon path for a file based on its name
 * @param fileName - Full filename with extension (e.g., "main.cpp")
 * @returns Path to the icon SVG file
 */
export function getFileIcon(fileName: string): string {
  // Check exact filename match first
  if (FILENAME_ICON_MAP[fileName]) {
    return `${ICON_BASE_PATH}/${FILENAME_ICON_MAP[fileName]}.svg`;
  }

  // Extract extension and check
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext && FILE_ICON_MAP[ext]) {
    return `${ICON_BASE_PATH}/${FILE_ICON_MAP[ext]}.svg`;
  }

  // Special case for hidden files starting with dot
  if (fileName.startsWith('.') && fileName.includes('.')) {
    const hiddenExt = fileName.split('.').pop()?.toLowerCase();
    if (hiddenExt && FILE_ICON_MAP[hiddenExt]) {
      return `${ICON_BASE_PATH}/${FILE_ICON_MAP[hiddenExt]}.svg`;
    }
  }

  // Default file icon
  return `${ICON_BASE_PATH}/default_file.svg`;
}

/**
 * Get icon path for a folder based on its name
 * @param folderName - Folder name (e.g., "src", "node_modules")
 * @param isOpen - Whether the folder is expanded (unused for now, but can be used for open/closed icons)
 * @returns Path to the icon SVG file
 */
export function getFolderIcon(folderName: string, isOpen: boolean = false): string {
  const normalizedName = folderName.toLowerCase();

  if (FOLDER_ICON_MAP[normalizedName]) {
    const iconName = FOLDER_ICON_MAP[normalizedName];
    // Some folders have open variants
    if (isOpen) {
      const openIconPath = `${ICON_BASE_PATH}/${iconName}_opened.svg`;
      // We'll return the open version if it exists, otherwise fall back to closed
      return openIconPath;
    }
    return `${ICON_BASE_PATH}/${iconName}.svg`;
  }

  // Default folder icon
  return isOpen
    ? `${ICON_BASE_PATH}/default_folder_opened.svg`
    : `${ICON_BASE_PATH}/default_folder.svg`;
}

/**
 * Get color for file type (fallback for when icons don't load)
 * @param fileName - Filename
 * @returns Tailwind color class
 */
export function getFileColor(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();

  const colorMap: Record<string, string> = {
    'cpp': 'bg-blue-500',
    'c': 'bg-blue-600',
    'h': 'bg-orange-500',
    'hpp': 'bg-orange-500',
    'cmake': 'bg-green-500',
    'json': 'bg-yellow-500',
    'js': 'bg-yellow-400',
    'ts': 'bg-blue-400',
    'py': 'bg-blue-500',
    'java': 'bg-red-500',
  };

  return ext && colorMap[ext] ? colorMap[ext] : 'bg-zinc-500';
}
