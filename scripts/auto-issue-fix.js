#!/usr/bin/env node
/**
 * Auto Issue Fix Script
 * 
 * This script uses Claude Sonnet to automatically analyze and fix GitHub issues.
 * It fetches open issues, determines the easiest one to fix, and implements a solution.
 * 
 * Required Environment Variables:
 * - ANTHROPIC_API_KEY: Your Anthropic API key for Claude
 * - GITHUB_TOKEN: GitHub token with repo access
 * - GITHUB_REPOSITORY: Repository in format "owner/repo"
 * 
 * Usage:
 * node scripts/auto-issue-fix.js
 */

const { Anthropic } = require('@anthropic-ai/sdk');
const { Octokit } = require('octokit');
const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

// Initialize clients
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');

class AutoIssueFixer {
  constructor() {
    this.workspaceRoot = process.cwd();
  }

  async log(message) {
    console.log(`[${new Date().toISOString()}] ${message}`);
  }

  async getOpenIssues() {
    this.log('Fetching open issues...');
    
    try {
      const { data: issues } = await octokit.rest.issues.listForRepo({
        owner,
        repo,
        state: 'open',
        sort: 'created',
        direction: 'desc',
        per_page: 20,
      });

      // Filter out pull requests (GitHub API includes PRs in issues)
      const actualIssues = issues.filter(issue => !issue.pull_request);
      
      this.log(`Found ${actualIssues.length} open issues`);
      return actualIssues;
    } catch (error) {
      this.log(`Error fetching issues: ${error.message}`);
      throw error;
    }
  }

  async analyzeIssues(issues) {
    this.log('Analyzing issues with Claude...');
    
    const issuesSummary = issues.map(issue => ({
      number: issue.number,
      title: issue.title,
      body: issue.body || '',
      labels: issue.labels.map(label => label.name),
      created_at: issue.created_at,
      comments: issue.comments,
    }));

    const prompt = `You are an expert software engineer analyzing GitHub issues to determine which one would be easiest to fix automatically.

Here are the open issues for a Node.js/TypeScript project with a Next.js frontend and Express backend:

${JSON.stringify(issuesSummary, null, 2)}

Please analyze these issues and determine which one would be:
1. Easiest to fix with code changes
2. Most likely to be successfully automated
3. Has clear requirements and scope
4. Doesn't require external dependencies or complex setup

Consider factors like:
- Simple bug fixes vs feature requests
- Clear reproduction steps
- Well-defined scope
- Minimal risk of breaking changes
- Can be solved with straightforward code changes

Respond with a JSON object containing:
{
  "selected_issue": {
    "number": <issue_number>,
    "title": "<issue_title>",
    "reasoning": "<why this issue was selected>"
  },
  "analysis": "<your analysis of why this is the best choice>"
}

If no issue seems suitable for automation, set selected_issue to null and explain why in the analysis.`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const analysis = JSON.parse(response.content[0].text);
      this.log(`Claude selected issue #${analysis.selected_issue?.number}: ${analysis.selected_issue?.title}`);
      
      return analysis;
    } catch (error) {
      this.log(`Error analyzing issues: ${error.message}`);
      throw error;
    }
  }

  async getRepositoryContext() {
    this.log('Gathering repository context...');
    
    try {
      // Read key files for context
      const keyFiles = [
        'README.md',
        'package.json',
        'client/package.json',
        'server/package.json',
        'client/next.config.js',
        'server/src/index.ts',
      ];

      const context = {};
      
      for (const file of keyFiles) {
        try {
          const filePath = path.join(this.workspaceRoot, file);
          const content = await fs.readFile(filePath, 'utf8');
          context[file] = content;
        } catch (error) {
          // File doesn't exist, skip it
          context[file] = null;
        }
      }

      // Get directory structure
      const getDirectoryStructure = (dir, prefix = '', maxDepth = 3, currentDepth = 0) => {
        if (currentDepth >= maxDepth) return '';
        
        try {
          const items = require('fs').readdirSync(dir);
          return items
            .filter(item => !item.startsWith('.') && item !== 'node_modules' && item !== 'temp_output')
            .map(item => {
              const itemPath = path.join(dir, item);
              const stats = require('fs').statSync(itemPath);
              if (stats.isDirectory()) {
                return `${prefix}${item}/\n${getDirectoryStructure(itemPath, prefix + '  ', maxDepth, currentDepth + 1)}`;
              }
              return `${prefix}${item}`;
            })
            .join('\n');
        } catch (error) {
          return '';
        }
      };

      context['_structure'] = getDirectoryStructure(this.workspaceRoot);
      
      return context;
    } catch (error) {
      this.log(`Error gathering context: ${error.message}`);
      return {};
    }
  }

  async fixIssue(issue, repositoryContext) {
    this.log(`Attempting to fix issue #${issue.number}...`);
    
    // Get the full issue details
    const { data: fullIssue } = await octokit.rest.issues.get({
      owner,
      repo,
      issue_number: issue.number,
    });

    // Get issue comments for additional context
    const { data: comments } = await octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: issue.number,
    });

    const prompt = `You are an expert software engineer tasked with fixing a GitHub issue automatically.

## Repository Context
This is a Node.js/TypeScript project with:
- Next.js frontend (client/)
- Express backend (server/)
- MongoDB database
- Docker deployment

### Key Files:
${Object.entries(repositoryContext)
  .filter(([key, value]) => value !== null && key !== '_structure')
  .map(([file, content]) => `\n#### ${file}\n\`\`\`\n${content.substring(0, 1000)}${content.length > 1000 ? '...' : ''}\n\`\`\``)
  .join('\n')}

### Directory Structure:
\`\`\`
${repositoryContext._structure}
\`\`\`

## Issue to Fix
**Title:** ${fullIssue.title}
**Number:** #${fullIssue.number}
**Body:**
${fullIssue.body || 'No description provided'}

**Labels:** ${fullIssue.labels.map(l => l.name).join(', ')}

### Comments:
${comments.map(comment => `**${comment.user.login}:** ${comment.body}`).join('\n\n')}

## Task
Analyze this issue and provide a complete solution. Respond with a JSON object containing:

{
  "solution": {
    "description": "<clear description of the fix>",
    "files_to_modify": [
      {
        "file_path": "<relative path from repo root>",
        "action": "create|modify|delete",
        "content": "<complete file content if create/modify>",
        "reasoning": "<why this change is needed>"
      }
    ],
    "commit_message": "<descriptive commit message>",
    "testing_notes": "<how to test the fix>"
  },
  "confidence": "<high|medium|low - your confidence in this solution>",
  "risks": ["<potential risks or side effects>"]
}

Rules:
1. Only modify files that exist or create new files where clearly needed
2. Provide complete file content, not just snippets
3. Ensure changes are minimal and focused
4. Follow existing code style and patterns
5. Don't break existing functionality
6. If the issue is unclear or too complex, set confidence to "low" and explain why`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const solution = JSON.parse(response.content[0].text);
      this.log(`Generated solution with ${solution.confidence} confidence`);
      
      return solution;
    } catch (error) {
      this.log(`Error generating solution: ${error.message}`);
      throw error;
    }
  }

  async applySolution(solution) {
    this.log('Applying solution...');
    
    if (solution.confidence === 'low') {
      this.log('Solution confidence is low, skipping application');
      return false;
    }

    try {
      for (const fileChange of solution.solution.files_to_modify) {
        const filePath = path.join(this.workspaceRoot, fileChange.file_path);
        
        this.log(`${fileChange.action.toUpperCase()}: ${fileChange.file_path}`);
        
        if (fileChange.action === 'create' || fileChange.action === 'modify') {
          // Ensure directory exists
          const dir = path.dirname(filePath);
          await fs.mkdir(dir, { recursive: true });
          
          // Write file content
          await fs.writeFile(filePath, fileChange.content, 'utf8');
        } else if (fileChange.action === 'delete') {
          try {
            await fs.unlink(filePath);
          } catch (error) {
            if (error.code !== 'ENOENT') throw error;
          }
        }
      }

      // Stage all changes
      execSync('git add .', { cwd: this.workspaceRoot });
      
      // Check if there are changes to commit
      try {
        execSync('git diff --cached --exit-code', { cwd: this.workspaceRoot });
        this.log('No changes to commit');
        return false;
      } catch (error) {
        // Exit code 1 means there are differences, which is what we want
      }

      // Commit changes
      const commitMessage = solution.solution.commit_message || 'Auto-fix: Resolve issue';
      execSync(`git commit -m "${commitMessage}"`, { cwd: this.workspaceRoot });
      
      this.log('Changes committed successfully');
      return true;
    } catch (error) {
      this.log(`Error applying solution: ${error.message}`);
      throw error;
    }
  }

  async run() {
    try {
      this.log('Starting auto issue fix process...');
      
      // Validate environment variables
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY environment variable is required');
      }
      if (!process.env.GITHUB_TOKEN) {
        throw new Error('GITHUB_TOKEN environment variable is required');
      }
      if (!process.env.GITHUB_REPOSITORY) {
        throw new Error('GITHUB_REPOSITORY environment variable is required');
      }

      // Get open issues
      const issues = await this.getOpenIssues();
      
      if (issues.length === 0) {
        this.log('No open issues found');
        return;
      }

      // Analyze issues to find the easiest one to fix
      const analysis = await this.analyzeIssues(issues);
      
      if (!analysis.selected_issue) {
        this.log('No suitable issue found for automation');
        this.log(analysis.analysis);
        return;
      }

      // Get repository context
      const repositoryContext = await this.getRepositoryContext();

      // Generate solution for the selected issue
      const solution = await this.fixIssue(analysis.selected_issue, repositoryContext);
      
      // Apply the solution
      const applied = await this.applySolution(solution);
      
      if (applied) {
        this.log('✅ Issue fix completed successfully');
        this.log(`Commit message: ${solution.solution.commit_message}`);
        this.log(`Testing notes: ${solution.solution.testing_notes}`);
      } else {
        this.log('❌ No changes applied');
      }

    } catch (error) {
      this.log(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  }
}

// Run the script
if (require.main === module) {
  const fixer = new AutoIssueFixer();
  fixer.run();
}

module.exports = AutoIssueFixer;
