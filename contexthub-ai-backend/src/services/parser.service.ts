import type { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import Parser from 'web-tree-sitter';
import { prisma } from '../config/database.js';

const ignoredDirectories = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  '.next',
  'coverage',
  '.turbo',
  'vendor',
  'target'
]);

const supportedExtensions = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.py',
  '.go',
  '.json',
  '.prisma',
  '.sql'
]);

const wasmByExtension = new Map<string, string>([
  ['.ts', 'tree-sitter-typescript.wasm'],
  ['.tsx', 'tree-sitter-tsx.wasm'],
  ['.js', 'tree-sitter-javascript.wasm'],
  ['.jsx', 'tree-sitter-javascript.wasm'],
  ['.mjs', 'tree-sitter-javascript.wasm'],
  ['.cjs', 'tree-sitter-javascript.wasm'],
  ['.py', 'tree-sitter-python.wasm'],
  ['.go', 'tree-sitter-go.wasm'],
  ['.json', 'tree-sitter-json.wasm']
]);

const languageByExtension = new Map<string, string>([
  ['.ts', 'typescript'],
  ['.tsx', 'typescript'],
  ['.js', 'javascript'],
  ['.jsx', 'javascript'],
  ['.mjs', 'javascript'],
  ['.cjs', 'javascript'],
  ['.py', 'python'],
  ['.go', 'go'],
  ['.json', 'json'],
  ['.prisma', 'prisma'],
  ['.sql', 'sql']
]);

interface ParsedArtifact {
  kind: string;
  name: string;
  startLine: number;
  endLine: number;
  metadata?: Record<string, unknown>;
}

let parserInitialized = false;
const loadedLanguages = new Map<string, Parser.Language>();

const ensureParser = async (extension: string) => {
  if (!parserInitialized) {
    await Parser.init();
    parserInitialized = true;
  }

  const wasmFile = wasmByExtension.get(extension);
  if (!wasmFile) {
    return null;
  }

  if (loadedLanguages.has(wasmFile)) {
    return loadedLanguages.get(wasmFile)!;
  }

  try {
    const wasmPath = path.join(process.cwd(), 'node_modules', 'tree-sitter-wasms', 'out', wasmFile);
    const lang = await Parser.Language.load(wasmPath);
    loadedLanguages.set(wasmFile, lang);
    return lang;
  } catch (error) {
    console.warn(`Failed to load Tree-sitter language for ${extension}:`, error);
    return null;
  }
};

const walkFiles = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        if (ignoredDirectories.has(entry.name)) {
          return [];
        }

        return walkFiles(entryPath);
      }

      if (!entry.isFile() || !supportedExtensions.has(path.extname(entry.name))) {
        return [];
      }

      const entryStat = await stat(entryPath);

      if (entryStat.size > 1024 * 1024) {
        return [];
      }

      return [entryPath];
    })
  );

  return files.flat();
};

const lineNumberForIndex = (content: string, index: number) => content.slice(0, index).split('\n').length;

const collectMatches = (content: string, kind: string, expression: RegExp): ParsedArtifact[] => {
  const artifacts: ParsedArtifact[] = [];

  for (const match of content.matchAll(expression)) {
    if (match.index === undefined || !match[1]) {
      continue;
    }

    const line = lineNumberForIndex(content, match.index);
    artifacts.push({
      kind,
      name: match[1],
      startLine: line,
      endLine: line
    });
  }

  return artifacts;
};

const parseArtifactsWithTreeSitter = async (relativePath: string, content: string): Promise<ParsedArtifact[]> => {
  const extension = path.extname(relativePath);
  const artifacts: ParsedArtifact[] = [];

  // Regex fallback for non-WASM languages
  if (extension === '.prisma') {
    artifacts.push(...collectMatches(content, 'database_entity', /\bmodel\s+([A-Za-z_][\w]*)/g));
  }

  if (extension === '.sql') {
    artifacts.push(...collectMatches(content, 'database_entity', /create\s+table\s+(?:if\s+not\s+exists\s+)?["`]?([\w.]+)["`]?/gi));
  }

  if (path.basename(relativePath) === 'package.json') {
    try {
      const packageJson = JSON.parse(content) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };

      for (const dependency of Object.keys(packageJson.dependencies ?? {})) {
        artifacts.push({ kind: 'dependency', name: dependency, startLine: 1, endLine: 1, metadata: { scope: 'runtime' } });
      }

      for (const dependency of Object.keys(packageJson.devDependencies ?? {})) {
        artifacts.push({ kind: 'dependency', name: dependency, startLine: 1, endLine: 1, metadata: { scope: 'development' } });
      }
    } catch {
      // Ignored
    }
  }

  const lang = await ensureParser(extension);
  
  if (lang) {
    const parser = new Parser();
    parser.setLanguage(lang);
    const tree = parser.parse(content);
    if (!tree) return artifacts;
    
    const walkNode = (node: Parser.SyntaxNode) => {
      // Classes
      if (node.type === 'class_declaration' || node.type === 'class_definition') {
        const nameNode = node.childForFieldName('name');
        if (nameNode) {
          artifacts.push({
            kind: 'class',
            name: nameNode.text,
            startLine: node.startPosition.row + 1,
            endLine: node.endPosition.row + 1
          });
        }
      }

      // Functions and Methods
      if (node.type === 'function_declaration' || node.type === 'function_definition' || node.type === 'method_definition') {
        const nameNode = node.childForFieldName('name');
        if (nameNode) {
          artifacts.push({
            kind: 'function',
            name: nameNode.text,
            startLine: node.startPosition.row + 1,
            endLine: node.endPosition.row + 1
          });
        }
      }
      
      // Arrow Functions (assigned to variables)
      if (node.type === 'variable_declarator') {
        const nameNode = node.childForFieldName('name');
        const valueNode = node.childForFieldName('value');
        if (nameNode && valueNode && valueNode.type === 'arrow_function') {
           artifacts.push({
            kind: 'function',
            name: nameNode.text,
            startLine: node.startPosition.row + 1,
            endLine: node.endPosition.row + 1
          });
        }
      }

      // Imports
      if (node.type === 'import_statement' || node.type === 'import_from_statement') {
        const sourceNode = node.childForFieldName('source') || node.childForFieldName('module_name');
        if (sourceNode) {
          artifacts.push({
            kind: 'import',
            name: sourceNode.text.replace(/['"]/g, ''),
            startLine: node.startPosition.row + 1,
            endLine: node.endPosition.row + 1
          });
        }
      }

      // API Routes (.get, .post, etc)
      if (node.type === 'call_expression') {
        const functionNode = node.childForFieldName('function');
        if (functionNode && functionNode.type === 'member_expression') {
          const propertyNode = functionNode.childForFieldName('property');
          if (propertyNode && ['get', 'post', 'put', 'patch', 'delete'].includes(propertyNode.text)) {
             const args = node.childForFieldName('arguments');
             if (args && args.namedChildCount > 0) {
               const routeNode = args.namedChildren[0];
               if (routeNode.type === 'string' || routeNode.type === 'template_string') {
                 artifacts.push({
                   kind: 'api',
                   name: routeNode.text.replace(/['"`]/g, ''),
                   startLine: node.startPosition.row + 1,
                   endLine: node.endPosition.row + 1
                 });
               }
             }
          }
        }
      }

      for (const child of node.namedChildren) {
        walkNode(child);
      }
    };
    
    walkNode(tree.rootNode);
  }

  return artifacts;
};

export const parserService = {
  async parseRepository(projectId: string) {
    const repositories = await prisma.repository.findMany({
      where: { projectId }
    });

    let fileCount = 0;
    let artifactCount = 0;

    for (const repository of repositories) {
      if (!repository.clonedPath) {
        continue;
      }

      const filePaths = await walkFiles(repository.clonedPath);

      for (const filePath of filePaths) {
        const content = await readFile(filePath, 'utf8');
        const relativePath = path.relative(repository.clonedPath, filePath);
        const language = languageByExtension.get(path.extname(filePath)) ?? 'text';
        const contentHash = createHash('sha256').update(content).digest('hex');
        
        const parsedFile = await prisma.file.upsert({
          where: {
            repositoryId_path: {
              repositoryId: repository.id,
              path: relativePath
            }
          },
          update: {
            language,
            contentHash
          },
          create: {
            repositoryId: repository.id,
            path: relativePath,
            language,
            contentHash
          }
        });

        await prisma.artifact.deleteMany({ where: { fileId: parsedFile.id } });

        const artifacts = await parseArtifactsWithTreeSitter(relativePath, content);

        for (const artifact of artifacts) {
          await prisma.artifact.create({
            data: {
              fileId: parsedFile.id,
              kind: artifact.kind,
              name: artifact.name,
              startLine: artifact.startLine,
              endLine: artifact.endLine,
              metadata: (artifact.metadata ?? {}) as Prisma.InputJsonValue
            }
          });
        }

        fileCount += 1;
        artifactCount += artifacts.length;
      }
    }

    return {
      projectId,
      artifacts: {
        files: fileCount,
        total: artifactCount,
        classes: await prisma.artifact.count({ where: { file: { repository: { projectId } }, kind: 'class' } }),
        functions: await prisma.artifact.count({ where: { file: { repository: { projectId } }, kind: 'function' } }),
        apis: await prisma.artifact.count({ where: { file: { repository: { projectId } }, kind: 'api' } }),
        imports: await prisma.artifact.count({ where: { file: { repository: { projectId } }, kind: 'import' } }),
        dependencies: await prisma.artifact.count({ where: { file: { repository: { projectId } }, kind: 'dependency' } }),
        databaseEntities: await prisma.artifact.count({ where: { file: { repository: { projectId } }, kind: 'database_entity' } })
      }
    };
  }
};
