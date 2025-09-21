#!/usr/bin/env node

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as readline from 'readline';

const execAsync = promisify(exec);

// Repository information
interface RepoInfo {
  path: string;
  isMonorepo: boolean;
  type: 'main' | 'submodule' | 'nested';
}

// Global timer for periodic tasks
let periodicTimer: NodeJS.Timeout | null = null;

// Entry point of the script
async function main(): Promise<void> {
  console.log('🚀 Git Air - Advanced Git automation with recursive repository discovery');
  console.log('📡 AI-powered commit messages for monorepos and multi-repos');
  console.log('Commands: r = re-scan, R = RELOAD script, q = quit');

  await runGitTasks(); // Run once immediately on start

  // Start periodic timer
  startPeriodicTimer();

  // Listen for keyboard input
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  // Only set raw mode if we're in a TTY
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }

  rl.on('line', async (input) => {
    const command = input.trim();

    switch (command) {
      case 'r':
        console.log('\n----- Manual re-scan triggered -----');
        await runGitTasks();
        break;
      case 'R':
        console.log('\n----- RELOADING script -----');
        await reloadScript();
        break;
      case 'q':
        console.log('\n----- Shutting down git_runner -----');
        if (periodicTimer) clearInterval(periodicTimer);
        rl.close();
        process.exit(0);
      default:
        if (command) {
          console.log(`Unknown command: ${command} (use r, R, or q)`);
        }
    }
  });
}

// Starts the periodic timer for automatic git checks
function startPeriodicTimer(): void {
  if (periodicTimer) clearInterval(periodicTimer);
  periodicTimer = setInterval(async () => {
    console.log(`\n----- Running periodic git check at ${new Date().toISOString()} -----`);
    await runGitTasks();
  }, 5 * 60 * 1000); // 5 minutes
}

// Reloads the script by restarting the Node process
async function reloadScript(): Promise<void> {
  try {
    if (periodicTimer) clearInterval(periodicTimer);

    // Get the current script path
    const scriptPath = process.argv[1];

    console.log(`Restarting script: ${scriptPath}`);

    // Start new process
    spawn('node', [scriptPath], {
      detached: true,
      stdio: 'inherit',
      cwd: process.cwd()
    });

    // Exit current process
    process.exit(0);
  } catch (e) {
    console.log(`Error reloading script: ${e}`);
    console.log('Continuing with current instance...');
    startPeriodicTimer(); // Restart timer if reload failed
  }
}

// Finds the project root by looking for a .git directory, starting from the script's directory
async function findProjectRoot(startDir: string): Promise<string | null> {
  let current = startDir;
  while (true) {
    try {
      await fs.access(path.join(current, '.git'));
      return current;
    } catch {
      // Stop if we reach the root directory
      const parent = path.dirname(current);
      if (parent === current) {
        return null;
      }
      current = parent;
    }
  }
}

// Scans for Git repositories recursively and processes them
async function runGitTasks(): Promise<void> {
  const currentDir = process.cwd();
  console.log(`🔍 Scanning for Git repositories starting from: ${currentDir}`);

  const repositories = await findAllGitRepositories(currentDir);

  if (repositories.length === 0) {
    console.log('❌ No Git repositories found in current directory or subdirectories.');
    return;
  }

  console.log(`📁 Found ${repositories.length} Git repositories:`);
  repositories.forEach(repo => {
    const repoType = repo.isMonorepo ? 'MONOREPO' : 'REPO';
    console.log(`  📂 ${path.relative(currentDir, repo.path)} [${repoType}]`);
  });

  // Process in correct order: submodules/nested repos first, then main repos
  const processOrder = sortRepositoriesForProcessing(repositories);

  for (const repo of processOrder) {
    await processRepositoryAdvanced(repo);
  }
}

// Recursively finds all .git directories starting from root directory
async function findAllGitRepositories(rootDir: string): Promise<RepoInfo[]> {
  const repositories: RepoInfo[] = [];

  async function walkDirectory(dir: string): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          // Skip common directories that shouldn't contain repos
          if (['node_modules', 'vendor', '.vscode', '.idea', 'dist', 'build'].includes(entry.name)) {
            continue;
          }

          // Found a .git directory
          if (entry.name === '.git') {
            const repoPath = dir;
            const isMonorepo = await checkIsMonorepo(repoPath);
            const type = await determineRepoType(repoPath, rootDir);

            repositories.push({
              path: repoPath,
              isMonorepo,
              type
            });
            continue; // Don't recurse into .git directories
          }

          // Recurse into other directories
          await walkDirectory(fullPath);
        }
      }
    } catch (error) {
      // Skip directories we can't read
      console.log(`  ⚠️  Skipping ${dir}: ${error}`);
    }
  }

  await walkDirectory(rootDir);
  return repositories;
}

// Checks if a repository is a monorepo (has submodules or nested git repos)
async function checkIsMonorepo(repoPath: string): Promise<boolean> {
  // Check for .gitmodules file
  try {
    await fs.access(path.join(repoPath, '.gitmodules'));
    return true;
  } catch {
    // No .gitmodules, check for nested repos
  }

  // Check for nested .git directories
  try {
    const entries = await fs.readdir(repoPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name !== '.git') {
        const nestedPath = path.join(repoPath, entry.name);
        try {
          await fs.access(path.join(nestedPath, '.git'));
          return true; // Found nested git repo
        } catch {
          // Continue checking
        }
      }
    }
  } catch {
    // Can't read directory
  }

  return false;
}

// Determines the type of repository (main, submodule, or nested)
async function determineRepoType(repoPath: string, rootDir: string): Promise<'main' | 'submodule' | 'nested'> {
  // If it's at the root level, it's likely a main repo
  if (repoPath === rootDir) {
    return 'main';
  }

  // Check if this is a submodule by looking for .git file (not directory)
  try {
    const gitPath = path.join(repoPath, '.git');
    const gitStat = await fs.stat(gitPath);
    if (gitStat.isFile()) {
      return 'submodule';
    }
  } catch {
    // Error accessing .git
  }

  return 'nested';
}

// Sorts repositories for processing - submodules and nested repos first, then main repos
function sortRepositoriesForProcessing(repos: RepoInfo[]): RepoInfo[] {
  return repos.sort((a, b) => {
    // Submodules first
    if (a.type === 'submodule' && b.type !== 'submodule') return -1;
    if (b.type === 'submodule' && a.type !== 'submodule') return 1;

    // Nested repos second
    if (a.type === 'nested' && b.type === 'main') return -1;
    if (b.type === 'nested' && a.type === 'main') return 1;

    // Main repos last
    return 0;
  });
}

// Advanced repository processing with monorepo support
async function processRepositoryAdvanced(repo: RepoInfo): Promise<void> {
  const repoName = path.basename(repo.path);
  const repoTypeLabel = repo.isMonorepo ? ' [MONOREPO]' : '';

  console.log(`\n📝 Processing ${repoName}${repoTypeLabel} (${repo.type})...`);

  // For monorepos: sync submodules FIRST
  if (repo.isMonorepo) {
    if (!await syncSubmodules(repo.path)) {
      console.log(`  ❌ Skipping ${repoName} - submodule sync failed`);
      return;
    }
  }

  // Check if there are changes AFTER submodule sync
  if (!await hasChanges(repo.path)) {
    console.log('  ✅ No changes to commit');
    return;
  }

  await gitCommit(repo.path);

  if (await gitRepoHasRemote(repo.path)) {
    console.log('  🚀 Remote found. Pushing changes...');
    await gitPush(repo.path);
  } else {
    console.log('  📍 No remote found. Skipping push.');
  }
}

// Checks if repository has uncommitted changes
async function hasChanges(repoPath: string): Promise<boolean> {
  try {
    const { stdout } = await execAsync('git status --porcelain', { cwd: repoPath });
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

// Syncs submodules for monorepos
async function syncSubmodules(repoPath: string): Promise<boolean> {
  try {
    console.log('  📦 Syncing submodules in monorepo...');

    // Check if there are submodules
    const gitmodulesPath = path.join(repoPath, '.gitmodules');
    try {
      await fs.access(gitmodulesPath);
    } catch {
      console.log('  ✅ No submodules found');
      return true; // No submodules, all good
    }

    // Update all submodules
    try {
      await execAsync('git submodule update --remote --merge', { cwd: repoPath });
      console.log('  ✅ Submodules synced successfully');

      // Add any submodule changes
      await execAsync('git add .', { cwd: repoPath });

      return true;
    } catch (error) {
      console.log(`  ⚠️  Submodule update failed: ${error}`);
      return false;
    }
  } catch (error) {
    console.log(`  ❌ Error syncing submodules: ${error}`);
    return false;
  }
}

// Checks if AI agent is available on the system
async function isAIAgentAvailable(): Promise<boolean> {
  try {
    console.log('  - Checking if AI agent is available...');

    const scriptDir = path.dirname(process.argv[1]);
    const projectRoot = await findProjectRoot(scriptDir);

    if (!projectRoot) {
      console.log('  - Could not find project root for AI agent');
      return false;
    }

    const aiAgentPath = path.join(projectRoot, 'ai-agent', 'bin', 'ai-commit-agent.ts');

    try {
      await fs.access(aiAgentPath);
      console.log(`  - AI agent found at: ${aiAgentPath}`);

      // Test if we can run it with --check-models
      try {
        await execAsync(`npx ts-node ${aiAgentPath} --check-models`, { cwd: projectRoot });
        console.log('  - AI agent is functional');
        return true;
      } catch (error) {
        console.log(`  - AI agent found but not functional: ${error}`);
        return false;
      }
    } catch {
      console.log(`  - AI agent not found at expected path: ${aiAgentPath}`);
      return false;
    }
  } catch (e) {
    console.log(`  - Error checking AI agent availability: ${e}`);
    return false;
  }
}

// Generates a commit message using AI agent based on staged changes
async function generateCommitMessageWithAI(repoPath: string): Promise<string | null> {
  try {
    console.log('  - Starting AI agent commit message generation...');

    // Check if there are staged changes
    console.log('  - Checking for staged changes...');
    const { stdout: stagedFiles } = await execAsync('git status --porcelain', { cwd: repoPath });

    if (!stagedFiles.trim()) {
      console.log('  - No staged changes found for AI analysis');
      return null;
    }

    console.log(`  - Found ${stagedFiles.split('\n').filter(line => line.trim()).length} changed files:`);
    stagedFiles.split('\n').forEach(line => {
      if (line.trim()) {
        console.log(`    ${line.trim()}`);
      }
    });

    // Get diff for more context
    console.log('  - Getting git diff for AI analysis...');
    const { stdout: diffOutput } = await execAsync('git diff --cached', { cwd: repoPath });

    if (!diffOutput) {
      console.log('  - No diff output available for AI');
      return null;
    }

    console.log(`  - Diff size: ${diffOutput.length} characters`);

    // Find the AI agent path
    const scriptDir = path.dirname(process.argv[1]);
    const projectRoot = await findProjectRoot(scriptDir);

    if (!projectRoot) {
      console.log('  - Could not find project root for AI agent');
      return null;
    }

    const aiAgentPath = path.join(projectRoot, 'ai-agent', 'bin', 'ai-commit-agent.ts');

    try {
      console.log('  - Executing AI agent...');

      // Create a simple summary for the AI
      const changesSummary = `Files changed: ${stagedFiles.split('\n').filter(f => f.trim()).length} files, Diff size: ${diffOutput.length} chars`;

      const { stdout: commitMessage } = await execAsync(`npx ts-node ${aiAgentPath} --man "${changesSummary}"`, {
        cwd: projectRoot,
        timeout: 30000,
        maxBuffer: 1024 * 1024
      });

      console.log('  - AI agent execution completed');

      if (commitMessage.trim()) {
        const finalMessage = commitMessage.trim();
        console.log(`  - ✅ Generated commit message: "${finalMessage}"`);
        return finalMessage;
      } else {
        console.log('  - ❌ AI agent returned empty output');
      }
    } catch (e) {
      console.log(`  - ❌ Error executing AI agent: ${e}`);
    }
  } catch (e) {
    console.log(`  - ❌ Error generating commit message with AI agent: ${e}`);
  }

  console.log('  - Falling back to default commit message');
  return null;
}

// Stages all changes and creates a commit
async function gitCommit(repoPath: string): Promise<void> {
  try {
    // Check if this is a sparse-checkout repository
    const gitPath = path.join(repoPath, '.git');
    let isSparseCheckout = false;
    let sparseCheckoutPath: string | null = null;

    try {
      const gitStat = await fs.stat(gitPath);
      if (gitStat.isFile()) {
        // This is likely a submodule, read the .git file to find the actual git directory
        const gitContent = await fs.readFile(gitPath, 'utf-8');
        const gitDirMatch = gitContent.trim().match(/gitdir: (.+)/);
        if (gitDirMatch) {
          const actualGitDir = gitDirMatch[1];
          const resolvedGitDir = path.isAbsolute(actualGitDir)
            ? actualGitDir
            : path.resolve(repoPath, actualGitDir);
          sparseCheckoutPath = path.join(resolvedGitDir, 'info', 'sparse-checkout');
          try {
            await fs.access(sparseCheckoutPath);
            isSparseCheckout = true;
          } catch {
            isSparseCheckout = false;
          }
        }
      } else if (gitStat.isDirectory()) {
        // Regular git repository
        sparseCheckoutPath = path.join(repoPath, '.git', 'info', 'sparse-checkout');
        try {
          await fs.access(sparseCheckoutPath);
          isSparseCheckout = true;
        } catch {
          isSparseCheckout = false;
        }
      }
    } catch {
      // Git directory doesn't exist
      return;
    }

    // Check for changes before staging
    const { stdout: statusOutput } = await execAsync('git status --porcelain', { cwd: repoPath });
    const hasChanges = statusOutput.trim().length > 0;

    if (isSparseCheckout) {
      console.log('  - Detected sparse-checkout repository');
      if (!hasChanges) {
        console.log('  - No changes in sparse-checkout repository.');
        return;
      }
    }

    if (!hasChanges) {
      console.log('  - No changes to commit.');
      return;
    }

    // Stage all changes
    await execAsync('git add .', { cwd: repoPath });

    // Generate commit message
    let commitMessage = `Auto-commit by git_runner at ${new Date().toISOString()}`;

    // Try to use AI agent if available
    console.log('  - Attempting to generate intelligent commit message...');
    if (await isAIAgentAvailable()) {
      console.log('  - ✅ AI agent is available, generating intelligent commit message...');
      const aiCommitMessage = await generateCommitMessageWithAI(repoPath);
      if (aiCommitMessage && aiCommitMessage.trim()) {
        commitMessage = aiCommitMessage;
        console.log('  - ✅ Using AI-generated commit message');
      } else {
        console.log('  - ❌ AI commit generation failed, using fallback message');
      }
    } else {
      console.log('  - ❌ AI agent not available, using default commit message');
    }

    // Commit with the generated message
    try {
      const { stdout: commitOutput } = await execAsync(`git commit -m "${commitMessage}"`, { cwd: repoPath });

      if (commitOutput.includes('nothing to commit')) {
        console.log('  - No changes to commit.');
      } else {
        console.log(`  - Changes committed with message: "${commitMessage}"`);
      }
    } catch (error: any) {
      if (error.stdout && error.stdout.includes('nothing to commit')) {
        console.log('  - No changes to commit.');
      } else {
        console.log(`  - Commit error: ${error.message}`);
      }
    }
  } catch (e) {
    console.log(`  - Error during commit in ${repoPath}: ${e}`);
  }
}

// Checks if the repository has any remotes configured
async function gitRepoHasRemote(repoPath: string): Promise<boolean> {
  try {
    const { stdout } = await execAsync('git remote', { cwd: repoPath });
    return stdout.trim().length > 0;
  } catch (e) {
    console.log(`  - Error checking for remote in ${repoPath}: ${e}`);
    return false;
  }
}

// Pushes the current branch to its upstream remote
async function gitPush(repoPath: string): Promise<void> {
  try {
    // Check if the current branch has an upstream
    try {
      await execAsync('git rev-parse --abbrev-ref --symbolic-full-name @{u}', { cwd: repoPath });
      // Upstream exists, do normal push
      const { stdout, stderr } = await execAsync('git push', { cwd: repoPath });
      if (stderr) console.log(`  - Push stderr: ${stderr}`);
      if (stdout) console.log(`  - Push stdout: ${stdout}`);
    } catch {
      // No upstream branch, set it up
      try {
        const { stdout: currentBranch } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: repoPath });
        const branch = currentBranch.trim();
        console.log(`  - Setting upstream for branch: ${branch}`);

        const { stdout, stderr } = await execAsync(`git push --set-upstream origin ${branch}`, { cwd: repoPath });
        if (stderr) console.log(`  - Push stderr: ${stderr}`);
        if (stdout) console.log(`  - Push stdout: ${stdout}`);
      } catch (e) {
        console.log(`  - Error setting upstream: ${e}`);
      }
    }
  } catch (e) {
    console.log(`  - Error during push in ${repoPath}: ${e}`);
  }
}

// Start the application
if (require.main === module) {
  main().catch(console.error);
}