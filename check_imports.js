const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = process.cwd();
const SRC_DIR = path.join(PROJECT_ROOT, 'src');
const TS_CONFIG_PATH = path.join(PROJECT_ROOT, 'tsconfig.json');

// Simple alias resolver
function resolveAlias(importPath) {
  if (importPath.startsWith('@/')) {
    return path.join(PROJECT_ROOT, 'src', importPath.slice(2));
  }
  return null;
}

// Extensions to try if explicit extension is missing
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.d.ts', '.json'];

function resolveFile(baseDir, importPath) {
  let targetPath;

  if (importPath.startsWith('@/')) {
    targetPath = resolveAlias(importPath);
  }
  else if (importPath.startsWith('.')) {
    targetPath = path.resolve(baseDir, importPath);
  }
  else {
    return true;
  }

  if (fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) return true;

  for (const ext of EXTENSIONS) {
    if (fs.existsSync(targetPath + ext) && fs.statSync(targetPath + ext).isFile()) return true;
  }

  // Check directory index
  if (fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory()) {
    for (const ext of EXTENSIONS) {
      const indexPath = path.join(targetPath, 'index' + ext);
      if (fs.existsSync(indexPath) && fs.statSync(indexPath).isFile()) return true;
    }
  }

  return false;
}

function getAllFiles(dirPath, arrayOfFiles) {
  const files = fs.readdirSync(dirPath);
  arrayOfFiles = arrayOfFiles || [];

  files.forEach(function (file) {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else {
      if (file.match(/\.(ts|tsx|js|jsx)$/)) {
        arrayOfFiles.push(fullPath);
      }
    }
  });

  return arrayOfFiles;
}

function checkImports() {
  const allFiles = getAllFiles(SRC_DIR);
  let brokenImports = [];

  const importRegex = /from\s+['"]([^'"]+)['"]|import\(['"]([^'"]+)['"]\)|import\s+['"]([^'"]+)['"]/g;

  allFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1] || match[2] || match[3];
      if (!importPath) continue;

      if (importPath.match(/\.(css|scss|sass|less|png|jpg|jpeg|svg|gif|webp)$/)) continue;

      const baseDir = path.dirname(file);
      const isResolved = resolveFile(baseDir, importPath);

      if (!isResolved) {
        brokenImports.push({
          file: path.relative(PROJECT_ROOT, file),
          import: importPath
        });
      }
    }
  });

  if (brokenImports.length > 0) {
    console.log("Found broken imports:");
    brokenImports.forEach(item => {
      console.log(`File: ${item.file} -> Import: ${item.import}`);
    });
    process.exit(1);
  } else {
    console.log("No broken imports found in src directory.");
    process.exit(0);
  }
}

checkImports();
