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
    console.log('Starting git_runner to perform periodic commits...');
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
// Scans for Git repositories and processes them
async function runGitTasks() {
    const scriptDir = path.dirname(process.argv[1]);
    const projectRoot = await findProjectRoot(scriptDir);
    if (!projectRoot) {
        console.log('Error: Could not find a .git repository in parent directories.');
        return;
    }
    console.log(`Project root found at: ${projectRoot}`);
    const repositoriesToProcess = await findGitRepositories(projectRoot);
    // Process submodules first to avoid conflicts
    const submodules = new Set([...repositoriesToProcess].filter(r => r !== projectRoot));
    for (const repoPath of submodules) {
        await processRepository(repoPath);
    }
    // Then process the main repository and any other top-level repos
    const mainRepos = new Set([...repositoriesToProcess].filter(r => !submodules.has(r)));
    for (const repoPath of mainRepos) {
        await processRepository(repoPath);
    }
}
// Finds all Git repositories within the project, including the root, workspace folders, and submodules
async function findGitRepositories(projectRoot) {
    const repositories = new Set();
    // 1. Add the main project repository
    repositories.add(projectRoot);
    // 2. Look for a .code-workspace file and parse it for more repository paths
    try {
        const files = await fs.readdir(projectRoot);
        const workspaceFile = files.find(file => file.endsWith('.code-workspace'));
        if (workspaceFile) {
            const workspaceFilePath = path.join(projectRoot, workspaceFile);
            console.log(`Found workspace file: ${workspaceFilePath}`);
            try {
                const content = await fs.readFile(workspaceFilePath, 'utf-8');
                const json = JSON.parse(content);
                const folders = json.folders || [];
                for (const folder of folders) {
                    const folderPath = folder.path;
                    if (folderPath) {
                        // Resolve the path relative to the project root
                        const absolutePath = path.resolve(projectRoot, folderPath);
                        try {
                            await fs.access(path.join(absolutePath, '.git'));
                            console.log(`Found Git repository in workspace folder: ${absolutePath}`);
                            repositories.add(absolutePath);
                        }
                        catch {
                            // Not a git repository, skip
                        }
                    }
                }
            }
            catch (e) {
                console.log(`Error parsing workspace file ${workspaceFilePath}: ${e}`);
            }
        }
    }
    catch (e) {
        console.log(`Error reading project root directory: ${e}`);
    }
    // 3. Find all submodules
    try {
        const gitmodulesPath = path.join(projectRoot, '.gitmodules');
        const gitmodulesContent = await fs.readFile(gitmodulesPath, 'utf-8');
        const lines = gitmodulesContent.split('\n');
        for (const line of lines) {
            if (line.trim().startsWith('path =')) {
                const submodulePath = line.split('=')[1].trim();
                const submoduleDir = path.join(projectRoot, submodulePath);
                try {
                    await fs.access(path.join(submoduleDir, '.git'));
                    console.log(`Found submodule repository: ${submoduleDir}`);
                    repositories.add(submoduleDir);
                }
                catch {
                    // Not accessible, skip
                }
            }
        }
    }
    catch {
        // No .gitmodules file, skip
    }
    return repositories;
}
// Helper function to process a single repository (commit and push)
async function processRepository(repoPath) {
    console.log(`Processing repository in: ${repoPath}`);
    await gitCommit(repoPath);
    if (await gitRepoHasRemote(repoPath)) {
        console.log('  - Remote found. Pushing changes...');
        await gitPush(repoPath);
    }
    else {
        console.log('  - No remote found. Skipping push.');
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
// Stages all changes and creates a commit
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
        return stdout.trim().length > 0;
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
//# sourceMappingURL=git-runner.js.map