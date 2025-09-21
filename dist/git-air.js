#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const util_1 = require("util");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const readline = __importStar(require("readline"));
const execAsync = (0, util_1.promisify)(child_process_1.exec);
// Global timer for periodic tasks
let periodicTimer = null;
// Entry point of the script
async function main() {
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
                if (periodicTimer)
                    clearInterval(periodicTimer);
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
function startPeriodicTimer() {
    if (periodicTimer)
        clearInterval(periodicTimer);
    periodicTimer = setInterval(async () => {
        console.log(`\n----- Running periodic git check at ${new Date().toISOString()} -----`);
        await runGitTasks();
    }, 5 * 60 * 1000); // 5 minutes
}
// Reloads the script by restarting the Node process
async function reloadScript() {
    try {
        if (periodicTimer)
            clearInterval(periodicTimer);
        // Get the current script path
        const scriptPath = process.argv[1];
        console.log(`Restarting script: ${scriptPath}`);
        // Start new process
        (0, child_process_1.spawn)('node', [scriptPath], {
            detached: true,
            stdio: 'inherit',
            cwd: process.cwd()
        });
        // Exit current process
        process.exit(0);
    }
    catch (e) {
        console.log(`Error reloading script: ${e}`);
        console.log('Continuing with current instance...');
        startPeriodicTimer(); // Restart timer if reload failed
    }
}
// Finds the project root by looking for a .git directory, starting from the script's directory
async function findProjectRoot(startDir) {
    let current = startDir;
    while (true) {
        try {
            await fs.access(path.join(current, '.git'));
            return current;
        }
        catch {
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
async function runGitTasks() {
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
    for (const repoPath of repositories) {
        await processRepositorySimple(repoPath);
    }
}
// Simple recursive finder - just like original git-air
async function findAllGitRepositoriesSimple(rootDir) {
    const repositories = [];
    async function walkDirectory(dir) {
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
        }
        catch (error) {
            // Skip directories we can't read (like original)
        }
    }
    await walkDirectory(rootDir);
    return repositories;
}
// Keep complex version for reference
async function findAllGitRepositories(rootDir) {
    const repositories = [];
    async function walkDirectory(dir) {
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
        }
        catch (error) {
            // Skip directories we can't read
            console.log(`  ⚠️  Skipping ${dir}: ${error}`);
        }
    }
    await walkDirectory(rootDir);
    return repositories;
}
// Checks if a repository is a monorepo (has submodules or nested git repos)
async function checkIsMonorepo(repoPath) {
    // Check for .gitmodules file
    try {
        await fs.access(path.join(repoPath, '.gitmodules'));
        return true;
    }
    catch {
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
                }
                catch {
                    // Continue checking
                }
            }
        }
    }
    catch {
        // Can't read directory
    }
    return false;
}
// Determines the type of repository (main, submodule, or nested)
async function determineRepoType(repoPath, rootDir) {
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
    }
    catch {
        // Error accessing .git
    }
    return 'nested';
}
// Sorts repositories for processing - submodules and nested repos first, then main repos
function sortRepositoriesForProcessing(repos) {
    return repos.sort((a, b) => {
        // Submodules first
        if (a.type === 'submodule' && b.type !== 'submodule')
            return -1;
        if (b.type === 'submodule' && a.type !== 'submodule')
            return 1;
        // Nested repos second
        if (a.type === 'nested' && b.type === 'main')
            return -1;
        if (b.type === 'nested' && a.type === 'main')
            return 1;
        // Main repos last
        return 0;
    });
}
// Simple repository processor - like original git-air
async function processRepositorySimple(repoPath) {
    const repoName = path.basename(repoPath);
    console.log(`\n📝 Processing ${repoName}...`);
    // Simple: just commit and push
    const success = await gitCommitAndPush(repoPath);
    if (success) {
        console.log(`  ✅ ${repoName} processed successfully`);
    }
    else {
        console.log(`  ⏭️  ${repoName} - no changes or failed`);
    }
}
// Keep advanced version for reference
async function processRepositoryAdvanced(repo) {
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
async function hasChanges(repoPath) {
    try {
        const { stdout } = await execAsync('git status --porcelain', { cwd: repoPath });
        return stdout.trim().length > 0;
    }
    catch {
        return false;
    }
}
// Syncs submodules for monorepos
async function syncSubmodules(repoPath) {
    try {
        console.log('  📦 Syncing submodules in monorepo...');
        // Check if there are submodules
        const gitmodulesPath = path.join(repoPath, '.gitmodules');
        try {
            await fs.access(gitmodulesPath);
        }
        catch {
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
        }
        catch (error) {
            console.log(`  ⚠️  Submodule update failed: ${error}`);
            return false;
        }
    }
    catch (error) {
        console.log(`  ❌ Error syncing submodules: ${error}`);
        return false;
    }
}
// Checks if AI agent is available on the system
async function isAIAgentAvailable() {
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
            }
            catch (error) {
                console.log(`  - AI agent found but not functional: ${error}`);
                return false;
            }
        }
        catch {
            console.log(`  - AI agent not found at expected path: ${aiAgentPath}`);
            return false;
        }
    }
    catch (e) {
        console.log(`  - Error checking AI agent availability: ${e}`);
        return false;
    }
}
// Generates a commit message using AI agent based on staged changes
async function generateCommitMessageWithAI(repoPath) {
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
            }
            else {
                console.log('  - ❌ AI agent returned empty output');
            }
        }
        catch (e) {
            console.log(`  - ❌ Error executing AI agent: ${e}`);
        }
    }
    catch (e) {
        console.log(`  - ❌ Error generating commit message with AI agent: ${e}`);
    }
    console.log('  - Falling back to default commit message');
    return null;
}
// Simple git commit and push using standard CLI commands
async function gitCommitAndPush(repoPath) {
    try {
        // Check for changes
        const { stdout: statusOutput } = await execAsync('git status --porcelain', { cwd: repoPath });
        if (!statusOutput.trim()) {
            console.log('  - No changes to commit');
            return false;
        }
        // Stage all changes
        await execAsync('git add .', { cwd: repoPath });
        console.log('  - Changes staged');
        // Generate commit message (simple fallback for now)
        const timestamp = new Date().toISOString();
        const commitMessage = `Auto-commit by git-air at ${timestamp}`;
        // Commit
        try {
            await execAsync(`git commit -m "${commitMessage}"`, { cwd: repoPath });
            console.log(`  - Committed: "${commitMessage}"`);
        }
        catch (error) {
            if (error.message?.includes('nothing to commit')) {
                console.log('  - Nothing to commit');
                return false;
            }
            throw error;
        }
        // Push (simple approach)
        try {
            await execAsync('git push', { cwd: repoPath });
            console.log('  - Pushed to remote');
            return true;
        }
        catch (pushError) {
            // Try setting upstream if push fails
            try {
                const { stdout: branch } = await execAsync('git branch --show-current', { cwd: repoPath });
                await execAsync(`git push -u origin ${branch.trim()}`, { cwd: repoPath });
                console.log('  - Pushed with upstream set');
                return true;
            }
            catch (upstreamError) {
                console.log(`  - No remote or push failed: ${upstreamError}`);
                return true; // Still successful commit
            }
        }
    }
    catch (error) {
        console.log(`  - Error in commit/push: ${error}`);
        return false;
    }
}
// Legacy function kept for AI integration (simplified)
async function gitCommit(repoPath) {
    try {
        // Check if this is a sparse-checkout repository
        const gitPath = path.join(repoPath, '.git');
        let isSparseCheckout = false;
        let sparseCheckoutPath = null;
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
                    }
                    catch {
                        isSparseCheckout = false;
                    }
                }
            }
            else if (gitStat.isDirectory()) {
                // Regular git repository
                sparseCheckoutPath = path.join(repoPath, '.git', 'info', 'sparse-checkout');
                try {
                    await fs.access(sparseCheckoutPath);
                    isSparseCheckout = true;
                }
                catch {
                    isSparseCheckout = false;
                }
            }
        }
        catch {
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
            }
            else {
                console.log('  - ❌ AI commit generation failed, using fallback message');
            }
        }
        else {
            console.log('  - ❌ AI agent not available, using default commit message');
        }
        // Commit with the generated message
        try {
            const { stdout: commitOutput } = await execAsync(`git commit -m "${commitMessage}"`, { cwd: repoPath });
            if (commitOutput.includes('nothing to commit')) {
                console.log('  - No changes to commit.');
            }
            else {
                console.log(`  - Changes committed with message: "${commitMessage}"`);
            }
        }
        catch (error) {
            if (error.stdout && error.stdout.includes('nothing to commit')) {
                console.log('  - No changes to commit.');
            }
            else {
                console.log(`  - Commit error: ${error.message}`);
            }
        }
    }
    catch (e) {
        console.log(`  - Error during commit in ${repoPath}: ${e}`);
    }
}
// Checks if the repository has any remotes configured
async function gitRepoHasRemote(repoPath) {
    try {
        const { stdout } = await execAsync('git remote', { cwd: repoPath });
        const hasRemote = stdout.trim().length > 0;
        console.log(`  - Remote check for ${path.basename(repoPath)}: ${hasRemote ? 'HAS remote' : 'NO remote'}`);
        if (hasRemote) {
            console.log(`  - Remotes: ${stdout.trim()}`);
        }
        return hasRemote;
    }
    catch (e) {
        console.log(`  - Error checking for remote in ${repoPath}: ${e}`);
        return false;
    }
}
// Pushes the current branch to its upstream remote
async function gitPush(repoPath) {
    try {
        // Check if the current branch has an upstream
        try {
            await execAsync('git rev-parse --abbrev-ref --symbolic-full-name @{u}', { cwd: repoPath });
            // Upstream exists, do normal push
            const { stdout, stderr } = await execAsync('git push', { cwd: repoPath });
            if (stderr)
                console.log(`  - Push stderr: ${stderr}`);
            if (stdout)
                console.log(`  - Push stdout: ${stdout}`);
        }
        catch {
            // No upstream branch, set it up
            try {
                const { stdout: currentBranch } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: repoPath });
                const branch = currentBranch.trim();
                console.log(`  - Setting upstream for branch: ${branch}`);
                const { stdout, stderr } = await execAsync(`git push --set-upstream origin ${branch}`, { cwd: repoPath });
                if (stderr)
                    console.log(`  - Push stderr: ${stderr}`);
                if (stdout)
                    console.log(`  - Push stdout: ${stdout}`);
            }
            catch (e) {
                console.log(`  - Error setting upstream: ${e}`);
            }
        }
    }
    catch (e) {
        console.log(`  - Error during push in ${repoPath}: ${e}`);
    }
}
// Start the application
if (require.main === module) {
    main().catch(console.error);
}
//# sourceMappingURL=git-air.js.map