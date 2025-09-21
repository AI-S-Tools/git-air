#!/usr/bin/env ts-node

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface AIModel {
  name: string;
  command: string;
  available: boolean;
  priority: number;
}

class AICommitAgent {
  private models: AIModel[] = [
    {
      name: 'gemini',
      command: 'gemini',
      available: false,
      priority: 1
    },
    {
      name: 'qwen',
      command: 'qwen',
      available: false,
      priority: 2
    },
    {
      name: 'claude',
      command: 'claude',
      available: false,
      priority: 3
    }
  ];

  async checkModelAvailability(): Promise<void> {
    for (const model of this.models) {
      try {
        await execAsync(`which ${model.command}`);
        model.available = true;
        console.log(`✅ ${model.name} is available`);
      } catch (error) {
        model.available = false;
        console.log(`❌ ${model.name} is not available`);
      }
    }
  }

  getBestAvailableModel(): AIModel | null {
    const availableModels = this.models
      .filter(model => model.available)
      .sort((a, b) => a.priority - b.priority);

    return availableModels.length > 0 ? availableModels[0] : null;
  }

  async generateCommitMessage(gitStatus: string, gitDiff: string): Promise<string> {
    const model = this.getBestAvailableModel();

    if (!model) {
      throw new Error('No AI models available for commit message generation');
    }

    const prompt = this.createPrompt(gitStatus, gitDiff);

    try {
      console.log(`🤖 Using ${model.name} for commit message generation...`);
      return await this.callModel(model, prompt);
    } catch (error) {
      console.error(`❌ Error with ${model.name}: ${error}`);
      throw error;
    }
  }

  private createPrompt(gitStatus: string, gitDiff: string): string {
    // Truncate diff if too long to avoid token limits
    const maxDiffLength = 2000;
    const truncatedDiff = gitDiff.length > maxDiffLength
      ? gitDiff.substring(0, maxDiffLength) + '\n... (truncated)'
      : gitDiff;

    return `Analyze this git diff and generate a conventional commit message.

Git Status:
${gitStatus}

Git Diff:
${truncatedDiff}

Requirements:
- Use conventional commit format: type(scope): description
- Types: feat, fix, docs, style, refactor, test, chore, perf, ci, build
- Be concise and descriptive
- Focus on what changed and why
- Return ONLY the commit message, nothing else

Examples:
- feat: add user authentication system
- fix: resolve memory leak in data processing
- docs: update API documentation
- refactor: simplify error handling logic

Generate the commit message:`;
  }

  private async callModel(model: AIModel, prompt: string): Promise<string> {
    let command: string;

    switch (model.name) {
      case 'qwen':
        command = `echo "${this.escapeForShell(prompt)}" | qwen -p "Please analyze and respond:"`;
        break;
      case 'claude':
        command = `echo "${this.escapeForShell(prompt)}" | claude --print`;
        break;
      case 'gemini':
        command = `echo "${this.escapeForShell(prompt)}" | gemini -p "Please analyze and respond:"`;
        break;
      default:
        throw new Error(`Unknown model: ${model.name}`);
    }

    try {
      const { stdout } = await execAsync(command, {
        timeout: 30000,
        maxBuffer: 1024 * 1024
      });

      return this.extractCommitMessage(stdout);
    } catch (error: any) {
      throw new Error(`Model execution failed: ${error.message}`);
    }
  }

  private escapeForShell(text: string): string {
    return text.replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/`/g, '\\`');
  }

  private extractCommitMessage(output: string): string {
    const lines = output.trim().split('\n');

    // Look for conventional commit pattern
    const conventionalPattern = /^(feat|fix|docs|style|refactor|test|chore|perf|ci|build)(\(.+\))?: .+/;

    for (const line of lines) {
      const trimmed = line.trim();
      if (conventionalPattern.test(trimmed)) {
        return trimmed;
      }
    }

    // Look for any line that looks like a commit message
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length > 10 && trimmed.length < 100 && !trimmed.includes('```')) {
        return trimmed;
      }
    }

    // Fallback to first non-empty line
    const firstLine = lines.find(line => line.trim().length > 0);
    return firstLine?.trim() || 'chore: update files';
  }
}

async function main() {
  try {
    const args = process.argv.slice(2);

    if (args.length === 0 || args[0] === '--help') {
      console.log(`
Usage: ai-commit-agent.ts [options] [git-status] [git-diff]

Options:
  --help              Show this help message
  --check-models      Check which AI models are available
  --man "prompt"      Generate commit message from manual prompt

Arguments:
  git-status          Output from 'git status --porcelain'
  git-diff            Output from 'git diff --cached'

Examples:
  ai-commit-agent.ts --check-models
  ai-commit-agent.ts "M  file.txt" "diff --git a/file.txt..."
  ai-commit-agent.ts --man "Added new feature for user login"
`);
      process.exit(0);
    }

    const agent = new AICommitAgent();
    await agent.checkModelAvailability();

    if (args[0] === '--check-models') {
      const bestModel = agent.getBestAvailableModel();
      if (bestModel) {
        console.log(`🎯 Best available model: ${bestModel.name}`);
      } else {
        console.log('❌ No AI models available');
        process.exit(1);
      }
      return;
    }

    if (args[0] === '--man' && args[1]) {
      // Manual mode - generate from simple prompt
      const manualPrompt = args[1];
      const simplePrompt = `Generate a conventional commit message for: ${manualPrompt}

Use format: type(scope): description
Types: feat, fix, docs, style, refactor, test, chore, perf, ci, build
Return only the commit message.`;

      const model = agent.getBestAvailableModel();
      if (!model) {
        console.error('❌ No AI models available');
        process.exit(1);
      }

      try {
        const result = await (agent as any).callModel(model, simplePrompt);
        console.log(result);
      } catch (error: any) {
        console.error(`❌ Error: ${error.message}`);
        process.exit(1);
      }
      return;
    }

    if (args.length < 2) {
      console.error('❌ Error: Both git-status and git-diff are required');
      process.exit(1);
    }

    const [gitStatus, gitDiff] = args;
    const commitMessage = await agent.generateCommitMessage(gitStatus, gitDiff);

    console.log(commitMessage);

  } catch (error: any) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}