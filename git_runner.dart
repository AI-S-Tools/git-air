import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;
import 'package:path/path.dart' as p;
import 'package:process/process.dart';

// Use a const ProcessManager for efficiency.
const ProcessManager processManager = LocalProcessManager();

// Global timer for periodic tasks
Timer? periodicTimer;

// Entry point of the script.
void main() async {
  print('Starting git_runner to perform periodic commits...');
  print('Commands: r = re-scan, R = RELOAD script, q = quit');
  
  runGitTasks(); // Run once immediately on start.
  
  // Start periodic timer
  startPeriodicTimer();
  
  // Listen for keyboard input
  stdin.echoMode = false;
  stdin.lineMode = false;
  
  await for (final input in stdin) {
    final command = String.fromCharCode(input.first);
    
    switch (command) {
      case 'r':
        print('\n----- Manual re-scan triggered -----');
        await runGitTasks();
        break;
      case 'R':
        print('\n----- RELOADING script -----');
        await reloadScript();
        break;
      case 'q':
        print('\n----- Shutting down git_runner -----');
        periodicTimer?.cancel();
        exit(0);
      default:
        print('Unknown command: $command (use r, R, or q)');
    }
  }
}

/// Starts the periodic timer for automatic git checks.
void startPeriodicTimer() {
  periodicTimer?.cancel(); // Cancel existing timer if any
  periodicTimer = Timer.periodic(Duration(minutes: 5), (timer) {
    print('\n----- Running periodic git check at ${DateTime.now()} -----');
    runGitTasks();
  });
}

/// Reloads the script by restarting the Dart process.
Future<void> reloadScript() async {
  try {
    periodicTimer?.cancel();
    
    // Get the current script path
    final scriptPath = Platform.script.toFilePath();
    
    print('Restarting script: $scriptPath');
    
    // Start new process
    await Process.start('dart', [scriptPath], mode: ProcessStartMode.detached);
    
    // Exit current process
    exit(0);
  } catch (e) {
    print('Error reloading script: $e');
    print('Continuing with current instance...');
    startPeriodicTimer(); // Restart timer if reload failed
  }
}

/// Finds the project root by looking for a .git directory, starting from the script's directory.
Future<Directory?> findProjectRoot(Directory startDir) async {
  var current = startDir;
  while (true) {
    if (await Directory(p.join(current.path, '.git')).exists()) {
      return current;
    }
    // Stop if we reach the root directory
    if (p.equals(current.path, current.parent.path)) {
      return null;
    }
    current = current.parent;
  }
}

/// Scans for Git repositories and processes them.
Future<void> runGitTasks() async {
  final scriptDir = Directory(p.dirname(Platform.script.toFilePath()));
  final projectRoot = await findProjectRoot(scriptDir);

  if (projectRoot == null) {
    print('Error: Could not find a .git repository in parent directories.');
    return;
  }
  print('Project root found at: ${projectRoot.path}');

  final repositoriesToProcess = await findGitRepositories(projectRoot);

  // Process submodules first to avoid conflicts
  final submodules =
      repositoriesToProcess.where((r) => r != projectRoot.path).toSet();
  for (final repoPath in submodules) {
    await _processRepository(repoPath);
  }

  // Then process the main repository and any other top-level repos
  final mainRepos = repositoriesToProcess.difference(submodules);
  for (final repoPath in mainRepos) {
    await _processRepository(repoPath);
  }
}

/// Finds all Git repositories within the project, including the root, workspace folders, and submodules.
Future<Set<String>> findGitRepositories(Directory projectRoot) async {
  final repositories = <String>{};

  // 1. Add the main project repository
  repositories.add(projectRoot.path);

  // 2. Look for a .code-workspace file and parse it for more repository paths
  final workspaceFile = projectRoot
      .listSync()
      .whereType<File>()
      .firstWhere((item) => item.path.endsWith('.code-workspace'),
          orElse: () => File(''));

  if (await workspaceFile.exists()) {
    print('Found workspace file: ${workspaceFile.path}');
    try {
      final content = await workspaceFile.readAsString();
      final json = jsonDecode(content) as Map<String, dynamic>;
      final folders = (json['folders'] as List<dynamic>?) ?? [];

      for (final folder in folders) {
        final folderPath = folder['path'] as String?;
        if (folderPath != null) {
          // Resolve the path relative to the project root
          final absolutePath = p.normalize(p.join(projectRoot.path, folderPath));
          final repoDir = Directory(absolutePath);
          if (await Directory(p.join(repoDir.path, '.git')).exists()) {
            print('Found Git repository in workspace folder: ${repoDir.path}');
            repositories.add(repoDir.path);
          }
        }
      }
    } catch (e) {
      print('Error parsing workspace file ${workspaceFile.path}: $e');
    }
  }

  // 3. Find all submodules
  final gitmodulesFile = File(p.join(projectRoot.path, '.gitmodules'));
  if (await gitmodulesFile.exists()) {
    final lines = await gitmodulesFile.readAsLines();
    for (final line in lines) {
      if (line.trim().startsWith('path =')) {
        final path = line.split('=')[1].trim();
        final submoduleDir = Directory(p.join(projectRoot.path, path));
        if (await FileSystemEntity.type(p.join(submoduleDir.path, '.git')) !=
            FileSystemEntityType.notFound) {
           print('Found submodule repository: ${submoduleDir.path}');
          repositories.add(submoduleDir.path);
        }
      }
    }
  }

  return repositories;
}


/// Helper function to process a single repository (commit and push).
Future<void> _processRepository(String path) async {
  print('Processing repository in: $path');
  await gitCommit(path);
  if (await gitRepoHasRemote(path)) {
    print('  - Remote found. Pushing changes...');
    await gitPush(path);
  } else {
    print('  - No remote found. Skipping push.');
  }
}

/// Checks if OpenRouter agent is available on the system.
Future<bool> isOpenRouterAgentAvailable() async {
  try {
    print('  - Checking if OpenRouter agent is available...');
    
    // Check if we can find the openrouter_agent.dart in the expected location
    final scriptDir = Directory(p.dirname(Platform.script.toFilePath()));
    final projectRoot = await findProjectRoot(scriptDir);
    
    if (projectRoot == null) {
      print('  - Could not find project root for OpenRouter agent');
      return false;
    }
    
    final openrouterAgentPath = p.join(projectRoot.path, 'openrouter', 'bin', 'openrouter_agent.dart');
    final agentFile = File(openrouterAgentPath);
    
    if (await agentFile.exists()) {
      print('  - OpenRouter agent found at: $openrouterAgentPath');
      
      // Test if we can run it with --help
      final testResult = await processManager.run([
        'dart', 
        openrouterAgentPath, 
        '--help'
      ]);
      
      if (testResult.exitCode == 0) {
        print('  - OpenRouter agent is functional');
        return true;
      } else {
        print('  - OpenRouter agent found but not functional (exit code: ${testResult.exitCode})');
        if (testResult.stderr.toString().isNotEmpty) {
          print('  - OpenRouter agent stderr: ${testResult.stderr}');
        }
        return false;
      }
    } else {
      print('  - OpenRouter agent not found at expected path: $openrouterAgentPath');
      return false;
    }
  } catch (e) {
    print('  - Error checking OpenRouter agent availability: $e');
    return false;
  }
}

/// Generates a commit message using OpenRouter agent based on staged changes.
Future<String?> generateCommitMessageWithOpenRouter(String path) async {
  try {
    print('  - Starting OpenRouter agent commit message generation...');
    
    // Check if there are staged changes
    print('  - Checking for staged changes...');
    final statusResult = await processManager.run(['git', 'status', '--porcelain'], workingDirectory: path);
    final stagedFiles = statusResult.stdout.toString().trim();
    
    if (stagedFiles.isEmpty) {
      print('  - No staged changes found for OpenRouter analysis');
      return null;
    }

    print('  - Found ${stagedFiles.split('\n').where((line) => line.trim().isNotEmpty).length} changed files:');
    final lines = stagedFiles.split('\n');
    for (final line in lines) {
      if (line.trim().isNotEmpty) {
        print('    ${line.trim()}');
      }
    }

    // Get diff for more context
    print('  - Getting git diff for OpenRouter analysis...');
    final diffResult = await processManager.run(['git', 'diff', '--cached'], workingDirectory: path);
    final diffOutput = diffResult.stdout.toString();
    
    if (diffOutput.isEmpty) {
      print('  - No diff output available for OpenRouter');
      return null;
    }
    
    print('  - Diff size: ${diffOutput.length} characters');
    
    // Find the OpenRouter agent path
    final scriptDir = Directory(p.dirname(Platform.script.toFilePath()));
    final projectRoot = await findProjectRoot(scriptDir);
    
    if (projectRoot == null) {
      print('  - Could not find project root for OpenRouter agent');
      return null;
    }
    
    final openrouterAgentPath = p.join(projectRoot.path, 'openrouter', 'bin', 'openrouter_agent.dart');
    
    // Create the query for OpenRouter
    final query = '''Analyze the following git diff and generate a conventional commit message.

Git Status:
$stagedFiles

Git Diff:
${diffOutput.length > 2000 ? diffOutput.substring(0, 2000) + '\n... (truncated)' : diffOutput}

Please generate a conventional commit message using the format: type(scope): description
Be concise and descriptive. Focus on what changed and why.
Return only the commit message, nothing else.''';

    try {
      print('  - Executing OpenRouter agent...');
      final openrouterResult = await processManager.run([
        'dart',
        openrouterAgentPath,
        '--man',
        query
      ], workingDirectory: path);

      print('  - OpenRouter agent execution completed');
      print('  - OpenRouter agent exit code: ${openrouterResult.exitCode}');
      
      if (openrouterResult.stdout.toString().isNotEmpty) {
        print('  - OpenRouter agent stdout length: ${openrouterResult.stdout.toString().length} characters');
        print('  - OpenRouter agent stdout preview: ${openrouterResult.stdout.toString().trim().substring(0, math.min(200, openrouterResult.stdout.toString().trim().length))}...');
      }
      
      if (openrouterResult.stderr.toString().isNotEmpty) {
        print('  - OpenRouter agent stderr: ${openrouterResult.stderr}');
      }

      if (openrouterResult.exitCode == 0) {
        final commitMessage = openrouterResult.stdout.toString().trim();
        if (commitMessage.isNotEmpty) {
          // Extract just the commit message if OpenRouter returns extra text
          final lines = commitMessage.split('\n');
          String finalMessage = commitMessage;
          
          // Look for a line that looks like a conventional commit
          for (final line in lines) {
            if (RegExp(r'^(feat|fix|docs|style|refactor|test|chore|perf|ci|build)(\(.+\))?: .+').hasMatch(line.trim())) {
              finalMessage = line.trim();
              break;
            }
          }
          
          // If no conventional commit found, use the first non-empty line
          if (finalMessage == commitMessage && lines.isNotEmpty) {
            finalMessage = lines.first.trim();
          }
          
          print('  - ✅ Generated commit message: "$finalMessage"');
          return finalMessage;
        } else {
          print('  - ❌ OpenRouter agent returned empty output');
        }
      } else {
        print('  - ❌ OpenRouter agent failed with exit code: ${openrouterResult.exitCode}');
      }
    } catch (e) {
      print('  - ❌ Error executing OpenRouter agent: $e');
    }
  } catch (e) {
    print('  - ❌ Error generating commit message with OpenRouter agent: $e');
  }
  
  print('  - Falling back to default commit message');
  return null;
}

/// Stages all changes and creates a commit.
Future<void> gitCommit(String path) async {
  try {
    // Check if this is a sparse-checkout repository by looking for sparse-checkout file
    // or if .git is a file (indicating a submodule with sparse-checkout)
    final gitPath = p.join(path, '.git');
    final gitFile = File(gitPath);
    final gitDir = Directory(gitPath);
    
    bool isSparseCheckout = false;
    String? sparseCheckoutPath;
    
    if (await gitFile.exists()) {
      // This is likely a submodule, read the .git file to find the actual git directory
      final gitContent = await gitFile.readAsString();
      final gitDirMatch = RegExp(r'gitdir: (.+)').firstMatch(gitContent.trim());
      if (gitDirMatch != null) {
        final actualGitDir = gitDirMatch.group(1)!;
        final resolvedGitDir = p.isAbsolute(actualGitDir) 
            ? actualGitDir 
            : p.normalize(p.join(path, actualGitDir));
        sparseCheckoutPath = p.join(resolvedGitDir, 'info', 'sparse-checkout');
        isSparseCheckout = await File(sparseCheckoutPath).exists();
      }
    } else if (await gitDir.exists()) {
      // Regular git repository
      sparseCheckoutPath = p.join(path, '.git', 'info', 'sparse-checkout');
      isSparseCheckout = await File(sparseCheckoutPath).exists();
    }
    
    // Check for changes before staging
    final statusResult = await processManager.run(['git', 'status', '--porcelain'], workingDirectory: path);
    final hasChanges = statusResult.stdout.toString().trim().isNotEmpty;
    
    if (isSparseCheckout) {
      print('  - Detected sparse-checkout repository');
      if (!hasChanges) {
        print('  - No changes in sparse-checkout repository.');
        return;
      }
    }

    if (!hasChanges) {
      print('  - No changes to commit.');
      return;
    }

    // Stage all changes.
    await processManager.run(['git', 'add', '.'], workingDirectory: path);

    // Generate commit message
    String commitMessage = 'Auto-commit by git_runner.dart at ${DateTime.now().toIso8601String()}';
    
    // Try to use OpenRouter agent if available
    print('  - Attempting to generate intelligent commit message...');
    if (await isOpenRouterAgentAvailable()) {
      print('  - ✅ OpenRouter agent is available, generating AI commit message...');
      final aiCommitMessage = await generateCommitMessageWithOpenRouter(path);
      if (aiCommitMessage != null && aiCommitMessage.isNotEmpty) {
        commitMessage = aiCommitMessage;
        print('  - ✅ Using AI-generated commit message');
      } else {
        print('  - ❌ AI commit generation failed, using fallback message');
      }
    } else {
      print('  - ❌ OpenRouter agent not available, using default commit message');
    }

    // Commit with the generated message.
    final commitResult = await processManager.run([
      'git',
      'commit',
      '-m',
      commitMessage,
    ], workingDirectory: path);

    if (commitResult.stdout.toString().contains('nothing to commit')) {
      print('  - No changes to commit.');
    } else {
      print('  - Changes committed with message: "$commitMessage"');
    }

    if (commitResult.stderr.isNotEmpty) {
      print('  - Commit stderr: ${commitResult.stderr}');
    }
  } catch (e) {
    print('  - Error during commit in $path: $e');
  }
}

/// Checks if the repository has any remotes configured.
Future<bool> gitRepoHasRemote(String path) async {
  try {
    final result = await processManager.run([
      'git',
      'remote',
    ], workingDirectory: path);
    // If 'git remote' has any output, a remote exists.
    return result.stdout.toString().trim().isNotEmpty;
  } catch (e) {
    print('  - Error checking for remote in $path: $e');
    return false;
  }
}

/// Pushes the current branch to its upstream remote.
Future<void> gitPush(String path) async {
  try {
    // Check if the current branch has an upstream
    final branchResult = await processManager.run([
      'git',
      'rev-parse',
      '--abbrev-ref',
      '--symbolic-full-name',
      '@{u}'
    ], workingDirectory: path);
    
    if (branchResult.exitCode != 0) {
      // No upstream branch, set it up
      final currentBranchResult = await processManager.run([
        'git',
        'rev-parse',
        '--abbrev-ref',
        'HEAD'
      ], workingDirectory: path);
      
      if (currentBranchResult.exitCode == 0) {
        final currentBranch = currentBranchResult.stdout.toString().trim();
        print('  - Setting upstream for branch: $currentBranch');
        
        final pushResult = await processManager.run([
          'git',
          'push',
          '--set-upstream',
          'origin',
          currentBranch
        ], workingDirectory: path);
        
        if (pushResult.stderr.isNotEmpty) {
          print('  - Push stderr: ${pushResult.stderr}');
        }
        if (pushResult.stdout.isNotEmpty) {
          print('  - Push stdout: ${pushResult.stdout}');
        }
        return;
      }
    }
    
    // Normal push if upstream exists
    final pushResult = await processManager.run([
      'git',
      'push',
    ], workingDirectory: path);
    
    if (pushResult.stderr.isNotEmpty) {
      print('  - Push stderr: ${pushResult.stderr}');
    }
    if (pushResult.stdout.isNotEmpty) {
      print('  - Push stdout: ${pushResult.stdout}');
    }
  } catch (e) {
    print('  - Error during push in $path: $e');
  }
}
