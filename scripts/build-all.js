#!/usr/bin/env node
/**
 * Build script for all packages in the vrchat-mcp-osc monorepo
 */

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Build order (dependencies first)
const buildOrder = [
  'types',
  'utils',
  'relay-server',
  'mcp-server',
  'vrchat-mcp-osc'
];

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

// Get the root directory of the monorepo
const rootDir = path.resolve(__dirname, '..');
const packagesDir = path.join(rootDir, 'packages');

console.log(`${colors.bright}${colors.blue}Building vrchat-mcp-osc packages${colors.reset}\n`);

// Build each package in order
let success = true;
for (const packageName of buildOrder) {
  const packageDir = path.join(packagesDir, packageName);
  
  // Check if package directory exists
  if (!fs.existsSync(packageDir)) {
    console.log(`${colors.yellow}Package ${packageName} not found, skipping${colors.reset}`);
    continue;
  }
  
  console.log(`${colors.bright}Building ${packageName}...${colors.reset}`);
  
  // Run the build command
  const result = spawnSync('pnpm', ['build'], {
    cwd: packageDir,
    stdio: 'inherit',
    shell: true
  });
  
  if (result.status !== 0) {
    console.log(`${colors.red}Failed to build ${packageName}${colors.reset}`);
    success = false;
    break;
  }
  
  console.log(`${colors.green}Successfully built ${packageName}${colors.reset}\n`);
}

if (success) {
  console.log(`${colors.bright}${colors.green}All packages built successfully${colors.reset}`);
  process.exit(0);
} else {
  console.log(`${colors.bright}${colors.red}Build failed${colors.reset}`);
  process.exit(1);
}