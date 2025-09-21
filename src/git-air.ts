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

// Scans for Git repositories recursively and processes them (simplified approach)
async function runGitTasks(): Promise<void> {
  const currentDir = process.cwd();
  console.log(`🔍 Scanning for Git repositories starting from: ${currentDir}`);

  const repositories = await findAllGitRepositoriesSimple(currentDir);

  if (repositories.length === 0) {
    console.log('❌ No Git repositories found in current directory or subdirectories.');
    return;
  }

  console.log(`📁 Found ${repositories.length} Git repositories:`);
  repositories.forEach(repoPath => {
    console.log(`  📂 ${path.relative(currentDir, repoPath)}`);
  });

  // Process all repos in discovery order (naturally depth-first)
  let successCount = 0;
  let noChangesCount = 0;
  let failureCount = 0;
  const failedRepos: { name: string; path: string; issue: string }[] = [];

  for (const repoPath of repositories) {
    const repoName = path.basename(repoPath);
    const relativePath = path.relative(currentDir, repoPath);
    console.log(`\n📝 Processing ${repoName} (${relativePath})...`);

    // Add verbose status checking
    try {
      const { stdout: gitStatus } = await execAsync('git status --porcelain', { cwd: repoPath });
      const { stdout: branchStatus } = await execAsync('git status -b --porcelain', { cwd: repoPath });

      const hasUncommitted = gitStatus.trim().length > 0;
      const hasUnpushed = branchStatus.includes('ahead');
      const remoteInfo = await getRemoteInfo(repoPath);

      console.log(`  📊 Status: ${hasUncommitted ? 'uncommitted changes' : 'clean'}, ${hasUnpushed ? 'unpushed commits' : 'synced'}`);
      if (remoteInfo) {
        console.log(`  📡 Remote: ${remoteInfo}`);
      } else {
        console.log(`  📡 Remote: none configured`);
      }

      if (!hasUncommitted && !hasUnpushed) {
        console.log(`  ⏭️  ${repoName} - already synchronized`);
        noChangesCount++;
        continue;
      }
    } catch (statusError) {
      console.log(`  ⚠️  Could not read git status: ${statusError}`);
    }

    const result = await gitCommitAndPushWithDetails(repoPath);
    if (result.status === true) {
      console.log(`  ✅ ${repoName} processed successfully`);
      successCount++;
    } else if (result.status === 'no-changes') {
      console.log(`  ⏭️  ${repoName} - no changes detected`);
      noChangesCount++;
    } else {
      console.log(`  ❌ ${repoName} - FAILED (check logs above)`);
      failureCount++;
      failedRepos.push({
        name: repoName,
        path: relativePath,
        issue: result.error || 'Unknown error'
      });
    }
  }

  // Summary
  console.log(`\n🏁 Processing complete:`);
  console.log(`  📊 Total repositories scanned: ${repositories.length}`);

  if (successCount > 0) {
    console.log(`  ✅ ${successCount} repositories processed (commits/pushes made)`);
  }

  if (noChangesCount > 0) {
    console.log(`  ✓ ${noChangesCount} repositories already synchronized`);
  }

  if (failureCount > 0) {
    console.log(`  ❌ ${failureCount} repositories FAILED - REQUIRES ATTENTION!`);
    console.log(`\n  🚨 Failed repositories with issues:`);
    console.log(`  ────────────────────────────────`);

    failedRepos.forEach((repo, index) => {
      console.log(`  ${index + 1}. ${repo.name}`);
      console.log(`     Path: ${repo.path}`);
      console.log(`     Issue: ${repo.issue}`);
      console.log(`     Fix: cd ${repo.path} && git status`);
      console.log();
    });

    console.log(`  ────────────────────────────────`);
    console.log(`  💡 Tip: You can send an AI agent to fix these issues`);
    console.log(`  📋 Copy the list above and paste to your AI assistant`);
  } else {
    console.log(`  🎉 All ${repositories.length} repositories are fully synchronized!`);
  }
}

// Simple recursive finder - just like original git-air
async function findAllGitRepositoriesSimple(rootDir: string): Promise<string[]> {
  const repositories: string[] = [];

  async function walkDirectory(dir: string): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const fullPath = path.join(dir, entry.name);

          // Skip common directories (like original)
          if (['node_modules', 'vendor', '.vscode', '.idea'].includes(entry.name)) {
            continue;
          }

          // Found a .git directory
          if (entry.name === '.git') {
            repositories.push(dir); // Add parent directory as repo
            continue; // Don't recurse into .git
          }

          // Recurse into other directories
          await walkDirectory(fullPath);
        }
      }
    } catch (error) {
      // Skip directories we can't read (like original)
    }
  }

  await walkDirectory(rootDir);
  return repositories;
}

// Keep complex version for reference
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

// Simple repository processor - like original git-air
async function processRepositorySimpleWithResult(repoPath: string): Promise<boolean> {
  const repoName = path.basename(repoPath);
  console.log(`\n📝 Processing ${repoName}...`);

  // Simple: just commit and push
  const result = await gitCommitAndPush(repoPath);
  if (result === true) {
    console.log(`  ✅ ${repoName} processed successfully`);
    return true;
  } else if (result === 'no-changes') {
    console.log(`  ⏭️  ${repoName} - no changes`);
    return true; // Not a failure, just nothing to do
  } else {
    console.log(`  ❌ ${repoName} - FAILED (check logs above)`);
    return false;
  }
}

// Legacy function for backwards compatibility
async function processRepositorySimple(repoPath: string): Promise<void> {
  await processRepositorySimpleWithResult(repoPath);
}

// Keep advanced version for reference
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

  const commitResult = await gitCommitAndPush(repo.path);
  if (commitResult) {
    console.log('  ✅ Changes committed and pushed successfully');
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

    // Limit the number of files shown to AI to prevent overflow
    const changedFiles = stagedFiles.split('\n').filter(line => line.trim());
    const fileCount = changedFiles.length;

    console.log(`  - Found ${fileCount} changed files`);

    // Show only first 10 files to avoid overflow
    const filesToShow = changedFiles.slice(0, 10);
    filesToShow.forEach(line => {
      console.log(`    ${line.trim()}`);
    });

    if (fileCount > 10) {
      console.log(`    ... and ${fileCount - 10} more files`);
    }

    // Get a limited diff for context (first 5000 characters)
    console.log('  - Getting limited git diff for AI analysis...');
    const { stdout: diffOutput } = await execAsync('git diff --cached --stat', { cwd: repoPath });

    if (!diffOutput) {
      console.log('  - No diff output available for AI');
      return null;
    }

    console.log(`  - Diff stats: ${diffOutput.length} characters`);

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

      // Create a concise summary for the AI (avoid large data)
      const changesSummary = `${fileCount} files changed in ${path.basename(repoPath)}. Stats: ${diffOutput.substring(0, 500)}`;

      const { stdout: commitMessage } = await execAsync(`npx ts-node ${aiAgentPath} --man "${changesSummary}"`, {
        cwd: projectRoot,
        timeout: 30000,
        maxBuffer: 10 * 1024 * 1024 // Increase buffer to 10MB
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
      console.log(`  - ❌ AI agent failed: ${e}`);
      // Try fallback AI CLIs
      return await tryFallbackAIs(repoPath);
    }
  } catch (e) {
    console.log(`  - ❌ Error generating commit message with AI agent: ${e}`);
    // Try fallback AI CLIs
    return await tryFallbackAIs(repoPath);
  }

  console.log('  - Falling back to default commit message');
  return null;
}

// Try fallback AI CLIs when primary AI agent fails
async function tryFallbackAIs(repoPath: string): Promise<string | null> {
  const fallbackAIs = [
    { name: 'gemini-cli', command: 'gemini commit' },
    { name: 'claude', command: 'claude commit' },
    { name: 'codex', command: 'codex commit' }
  ];

  // Get git diff for AI context
  try {
    const { stdout: diffOutput } = await execAsync('git diff --cached --stat', { cwd: repoPath });
    if (!diffOutput.trim()) return null;

    const changesSummary = diffOutput.substring(0, 200); // Keep it short

    for (const ai of fallbackAIs) {
      try {
        console.log(`  - Trying fallback AI: ${ai.name}...`);

        // Check if AI CLI exists
        await execAsync(`which ${ai.name.split(' ')[0]}`, { timeout: 5000 });

        // Try to generate commit message
        const { stdout: commitMessage } = await execAsync(`echo "${changesSummary}" | ${ai.command}`, {
          cwd: repoPath,
          timeout: 15000,
          maxBuffer: 5 * 1024 * 1024
        });

        if (commitMessage.trim()) {
          const finalMessage = commitMessage.trim().split('\n')[0]; // First line only
          console.log(`  - ✅ ${ai.name} generated: "${finalMessage}"`);
          return finalMessage;
        }
      } catch (e) {
        console.log(`  - ❌ ${ai.name} failed`);
        continue;
      }
    }
  } catch (e) {
    console.log(`  - ❌ Error in fallback AIs: ${e}`);
  }

  return null;
}

// Get remote repository information
async function getRemoteInfo(repoPath: string): Promise<string | null> {
  try {
    const { stdout: remotes } = await execAsync('git remote -v', { cwd: repoPath });
    if (remotes.trim()) {
      const firstRemote = remotes.trim().split('\n')[0];
      const match = firstRemote.match(/(\w+)\s+(.+)\s+\(fetch\)/);
      if (match) {
        return `${match[1]} → ${match[2]}`;
      }
    }
    return null;
  } catch {
    return null;
  }
}

// Ask AI for solution to Git problems
async function askAIForSolution(repoPath: string, errorMessage: string): Promise<string | null> {
  try {
    console.log(`  - 🤖 Asking AI for solution...`);

    // Try different AI CLIs for problem solving
    const aiClis = [
      { name: 'gemini', command: 'gemini' },
      { name: 'claude', command: 'claude' },
      { name: 'codex', command: 'codex' }
    ];

    for (const aiCli of aiClis) {
      try {
        // Check if AI CLI exists
        await execAsync(`which ${aiCli.name}`, { timeout: 5000 });

        // Create a concise problem description
        const problemDescription = `Git push failed with error: "${errorMessage}". What's the solution? Answer in one sentence.`;

        const { stdout: aiResponse } = await execAsync(`echo "${problemDescription}" | ${aiCli.command}`, {
          cwd: repoPath,
          timeout: 30000,
          maxBuffer: 5 * 1024 * 1024
        });

        if (aiResponse.trim()) {
          const solution = aiResponse.trim().split('\n')[0]; // First line only
          console.log(`  - 🧠 ${aiCli.name} analyzed the problem`);
          return solution;
        }
      } catch (e) {
        // Try next AI CLI
        continue;
      }
    }

    console.log(`  - ❌ No AI CLIs available for problem analysis`);
    return null;
  } catch (e) {
    console.log(`  - ❌ Error asking AI for solution: ${e}`);
    return null;
  }
}

// Attempt to auto-fix common Git problems
async function attemptAutoFix(repoPath: string, errorMessage: string, aiSuggestion: string): Promise<boolean> {
  try {
    const error = errorMessage.toLowerCase();
    const suggestion = aiSuggestion.toLowerCase();

    // Common fixable issues
    if (error.includes('fetch first') || error.includes('non-fast-forward')) {
      console.log(`  - 🔧 Attempting git pull to resolve conflicts...`);
      try {
        // Try merge strategy first
        await execAsync('git pull --no-rebase', { cwd: repoPath });
        return true;
      } catch (mergeError) {
        console.log(`  - 🔧 Merge failed, trying rebase...`);
        try {
          await execAsync('git pull --rebase', { cwd: repoPath });
          return true;
        } catch (rebaseError) {
          console.log(`  - ❌ Both merge and rebase failed`);
          return false;
        }
      }
    }

    if (error.includes('repository not found') && suggestion.includes('create')) {
      console.log(`  - 📝 Note: Repository needs to be created on remote (cannot auto-fix)`);
      return false;
    }

    if (error.includes('host key verification failed')) {
      console.log(`  - 📝 Note: SSH key verification failed (manual intervention required)`);
      return false;
    }

    if (error.includes('permission denied') || error.includes('access rights')) {
      console.log(`  - 📝 Note: Access rights issue (manual intervention required)`);
      return false;
    }

    // If AI suggests a specific git command, we could try it (but be careful)
    if (suggestion.includes('git pull') && !error.includes('repository not found')) {
      console.log(`  - 🔧 Following AI suggestion: git pull`);
      await execAsync('git pull', { cwd: repoPath });
      return true;
    }

    console.log(`  - 📝 Note: No auto-fix available for this issue`);
    return false;
  } catch (e) {
    console.log(`  - ❌ Auto-fix attempt failed: ${e}`);
    return false;
  }
}

// Git commit and push with detailed error reporting
async function gitCommitAndPushWithDetails(repoPath: string): Promise<{ status: boolean | 'no-changes'; error?: string }> {
  // Store last error globally
  let lastError = '';

  const originalLog = console.log;
  console.log = (message: any) => {
    originalLog(message);
    // Capture error messages
    if (typeof message === 'string') {
      if (message.includes('PUSH FAILED')) {
        lastError = 'Push failed to remote repository';
      } else if (message.includes('repository not found')) {
        lastError = 'Remote repository not found';
      } else if (message.includes('SSH key verification failed')) {
        lastError = 'SSH key verification failed';
      } else if (message.includes('Host key verification failed')) {
        lastError = 'SSH host key verification failed';
      } else if (message.includes('unpushed commits')) {
        lastError = 'Repository has unpushed commits';
      } else if (message.includes('Error in commit/push')) {
        lastError = 'Failed to commit changes';
      }
    }
  };

  const result = await gitCommitAndPush(repoPath);
  console.log = originalLog; // Restore original

  return {
    status: result,
    error: result === false ? lastError || 'Unknown error' : undefined
  };
}

// Simple git commit and push using standard CLI commands
async function gitCommitAndPush(repoPath: string): Promise<boolean | 'no-changes'> {
  try {
    // Check for uncommitted changes
    const { stdout: statusOutput } = await execAsync('git status --porcelain', { cwd: repoPath });
    const hasUncommittedChanges = statusOutput.trim().length > 0;

    // Check for unpushed commits
    let hasUnpushedCommits = false;
    try {
      const { stdout: statusBranch } = await execAsync('git status -b --porcelain', { cwd: repoPath });
      hasUnpushedCommits = statusBranch.includes('ahead');
    } catch {
      // Ignore error, might not have remote
    }

    if (!hasUncommittedChanges && !hasUnpushedCommits) {
      console.log('  - No changes to commit or push');
      return 'no-changes' as any;
    }

    // Only commit if there are uncommitted changes
    if (hasUncommittedChanges) {
      // Stage all changes
      await execAsync('git add .', { cwd: repoPath });
      console.log('  - Changes staged');

      // Generate commit message with AI
      const aiCommitMessage = await generateCommitMessageWithAI(repoPath);
      const commitMessage = aiCommitMessage || `Auto-commit by git-air at ${new Date().toISOString()}`;

      // Commit
      try {
        await execAsync(`git commit -m "${commitMessage}"`, { cwd: repoPath });
        console.log(`  - Committed: "${commitMessage}"`);
      } catch (error: any) {
        if (error.message?.includes('nothing to commit')) {
          console.log('  - Nothing to commit');
          return false;
        }
        throw error;
      }
    } else if (hasUnpushedCommits) {
      console.log('  - Found unpushed commits, pushing...');
    }

    // Push (simple approach)
    try {
      await execAsync('git push', { cwd: repoPath });
      console.log('  - Pushed to remote');
      return true;
    } catch (pushError: any) {
      // Try setting upstream if push fails
      try {
        const { stdout: branch } = await execAsync('git branch --show-current', { cwd: repoPath });
        await execAsync(`git push -u origin ${branch.trim()}`, { cwd: repoPath });
        console.log('  - Pushed with upstream set');
        return true;
      } catch (upstreamError: any) {
        console.log(`  - ❌ PUSH FAILED: ${upstreamError.message || upstreamError}`);
        console.log(`  - ⚠️  Repository has unpushed commits!`);

        // Try to auto-fix common problems first
        const errorMsg = upstreamError.message || upstreamError;
        const fixAttempted = await attemptAutoFix(repoPath, errorMsg, '');
        if (fixAttempted) {
          console.log(`  - 🔧 Auto-fix attempted, checking result...`);
          // Try push again after fix
          try {
            await execAsync('git push', { cwd: repoPath });
            console.log(`  - ✅ Auto-fix successful! Push completed.`);
            return true;
          } catch (retryError) {
            console.log(`  - ❌ Auto-fix failed, manual intervention needed`);
          }
        }

        // Ask AI for solution if auto-fix didn't work
        const aiSolution = await askAIForSolution(repoPath, errorMsg);
        if (aiSolution) {
          console.log(`  - 🤖 AI suggests: ${aiSolution}`);
        } else {
          console.log(`  - 📝 Note: Manual fix required - check remote repository configuration`);
        }

        return false; // Push failure is a real failure
      }
    }
  } catch (error: any) {
    console.log(`  - Error in commit/push: ${error.message || error}`);
    return false;
  }
}

// Legacy function kept for AI integration (simplified)
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
    const hasRemote = stdout.trim().length > 0;
    console.log(`  - Remote check for ${path.basename(repoPath)}: ${hasRemote ? 'HAS remote' : 'NO remote'}`);
    if (hasRemote) {
      console.log(`  - Remotes: ${stdout.trim()}`);
    }
    return hasRemote;
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