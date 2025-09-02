#!/usr/bin/env node
/**
 * Test Script for Auto Issue Fix Setup
 * 
 * This script validates that the auto issue fix system is properly configured.
 * 
 * Usage:
 * node scripts/test-auto-fix.js
 */

const path = require('path');
const fs = require('fs').promises;

class AutoFixTester {
  constructor() {
    this.workspaceRoot = process.cwd();
    this.errors = [];
    this.warnings = [];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'warning' ? '⚠️' : '✅';
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  addError(message) {
    this.errors.push(message);
    this.log(message, 'error');
  }

  addWarning(message) {
    this.warnings.push(message);
    this.log(message, 'warning');
  }

  async checkFile(filePath, description) {
    try {
      await fs.access(path.join(this.workspaceRoot, filePath));
      this.log(`Found ${description}: ${filePath}`);
      return true;
    } catch (error) {
      this.addError(`Missing ${description}: ${filePath}`);
      return false;
    }
  }

  async checkEnvironmentVars() {
    this.log('Checking environment variables...');
    
    const requiredVars = [
      'ANTHROPIC_API_KEY',
      'GITHUB_TOKEN',
      'GITHUB_REPOSITORY'
    ];

    for (const varName of requiredVars) {
      if (process.env[varName]) {
        this.log(`Environment variable ${varName} is set`);
      } else {
        this.addWarning(`Environment variable ${varName} is not set (required for runtime)`);
      }
    }
  }

  async checkDependencies() {
    this.log('Checking dependencies...');
    
    try {
      // Check if package.json exists
      const packagePath = path.join(this.workspaceRoot, 'package.json');
      const packageContent = await fs.readFile(packagePath, 'utf8');
      const packageJson = JSON.parse(packageContent);
      
      const requiredDeps = ['@anthropic-ai/sdk', 'octokit'];
      
      for (const dep of requiredDeps) {
        if (packageJson.dependencies && packageJson.dependencies[dep]) {
          this.log(`Dependency ${dep} found in package.json`);
        } else {
          this.addError(`Missing dependency: ${dep}`);
        }
      }
      
      // Try to require the dependencies
      try {
        require('@anthropic-ai/sdk');
        this.log('Anthropic SDK can be imported');
      } catch (error) {
        this.addWarning('Anthropic SDK not installed (run: npm install)');
      }
      
      try {
        require('octokit');
        this.log('Octokit can be imported');
      } catch (error) {
        this.addWarning('Octokit not installed (run: npm install)');
      }
      
    } catch (error) {
      this.addError(`Error checking dependencies: ${error.message}`);
    }
  }

  async checkGitHubAction() {
    this.log('Checking GitHub Action workflow...');
    
    const workflowPath = '.github/workflows/auto-issue-fix.yml';
    const exists = await this.checkFile(workflowPath, 'GitHub Action workflow');
    
    if (exists) {
      try {
        const content = await fs.readFile(path.join(this.workspaceRoot, workflowPath), 'utf8');
        
        // Check for required sections
        const requiredSections = [
          'schedule:',
          'cron:',
          'ANTHROPIC_API_KEY',
          'GITHUB_TOKEN',
          'auto-issue-fix.js'
        ];
        
        for (const section of requiredSections) {
          if (content.includes(section)) {
            this.log(`Workflow contains required section: ${section}`);
          } else {
            this.addError(`Workflow missing required section: ${section}`);
          }
        }
        
      } catch (error) {
        this.addError(`Error reading workflow file: ${error.message}`);
      }
    }
  }

  async checkScripts() {
    this.log('Checking automation scripts...');
    
    const scripts = [
      { path: 'scripts/auto-issue-fix.js', description: 'Auto issue fix script' },
      { path: 'docs/AUTO_ISSUE_FIX.md', description: 'Documentation' }
    ];
    
    for (const script of scripts) {
      await this.checkFile(script.path, script.description);
    }
    
    // Check if script is executable
    try {
      const scriptPath = path.join(this.workspaceRoot, 'scripts/auto-issue-fix.js');
      const content = await fs.readFile(scriptPath, 'utf8');
      
      if (content.startsWith('#!/usr/bin/env node')) {
        this.log('Auto-fix script has proper shebang');
      } else {
        this.addWarning('Auto-fix script missing shebang line');
      }
      
      // Check for required classes/functions
      if (content.includes('class AutoIssueFixer')) {
        this.log('AutoIssueFixer class found in script');
      } else {
        this.addError('AutoIssueFixer class not found in script');
      }
      
    } catch (error) {
      this.addError(`Error checking script content: ${error.message}`);
    }
  }

  async checkRepositoryStructure() {
    this.log('Checking repository structure...');
    
    const requiredDirs = [
      '.github/workflows',
      'scripts',
      'docs',
      'client',
      'server'
    ];
    
    for (const dir of requiredDirs) {
      try {
        const stats = await fs.stat(path.join(this.workspaceRoot, dir));
        if (stats.isDirectory()) {
          this.log(`Found required directory: ${dir}`);
        } else {
          this.addError(`${dir} exists but is not a directory`);
        }
      } catch (error) {
        this.addError(`Missing required directory: ${dir}`);
      }
    }
  }

  async run() {
    this.log('Starting auto issue fix setup validation...');
    
    await this.checkRepositoryStructure();
    await this.checkGitHubAction();
    await this.checkScripts();
    await this.checkDependencies();
    await this.checkEnvironmentVars();
    
    this.log('\n=== VALIDATION SUMMARY ===');
    
    if (this.errors.length === 0 && this.warnings.length === 0) {
      this.log('✅ All checks passed! Auto issue fix is ready to use.');
    } else {
      if (this.errors.length > 0) {
        this.log(`❌ Found ${this.errors.length} error(s):`);
        this.errors.forEach(error => console.log(`   - ${error}`));
      }
      
      if (this.warnings.length > 0) {
        this.log(`⚠️ Found ${this.warnings.length} warning(s):`);
        this.warnings.forEach(warning => console.log(`   - ${warning}`));
      }
      
      if (this.errors.length > 0) {
        this.log('\n❌ Please fix the errors before using the auto issue fix feature.');
        process.exit(1);
      } else {
        this.log('\n✅ Setup looks good! Warnings are informational only.');
      }
    }
    
    this.log('\nNext steps:');
    this.log('1. Add ANTHROPIC_API_KEY to your GitHub repository secrets');
    this.log('2. Ensure GitHub Actions have write permissions for your repository');
    this.log('3. The workflow will run daily at 9:00 AM UTC automatically');
    this.log('4. You can also trigger it manually from the Actions tab');
  }
}

// Run the test
if (require.main === module) {
  const tester = new AutoFixTester();
  tester.run().catch(error => {
    console.error('❌ Test script failed:', error.message);
    process.exit(1);
  });
}

module.exports = AutoFixTester;
