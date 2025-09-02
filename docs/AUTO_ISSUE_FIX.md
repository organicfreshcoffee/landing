# Auto Issue Fix with Claude AI

This project includes an automated GitHub Action that uses Claude Haiku 3.5 to analyze and fix GitHub issues daily.

## How It Works

1. **Daily Schedule**: The workflow runs every day at 9:00 AM UTC
2. **Issue Analysis**: Claude Haiku 3.5 analyzes all open issues to determine the easiest one to fix
3. **Solution Generation**: Claude generates a complete solution with code changes
4. **Automatic Implementation**: The script applies the changes and commits them
5. **Pull Request Creation**: A PR is automatically created with the fix

## Setup

### 1. Required GitHub Secrets

Add these secrets to your repository settings (`Settings` → `Secrets and variables` → `Actions`):

- `ANTHROPIC_API_KEY`: Your Anthropic API key for Claude access
  - Get one at: https://console.anthropic.com/
  - Should start with `sk-ant-api...`

### 2. GitHub Token Permissions

The workflow uses the built-in `GITHUB_TOKEN` which should have the following permissions (configure in repository settings under `Actions` → `General` → `Workflow permissions`):

- ✅ Read and write permissions
- ✅ Allow GitHub Actions to create and approve pull requests

### 3. Manual Testing

You can test the workflow manually:

1. Go to `Actions` tab in your repository
2. Select "Auto Issue Fix with Claude"
3. Click "Run workflow"

### 4. Local Testing

To test the script locally:

```bash
# Install dependencies
npm install @anthropic-ai/sdk octokit

# Set environment variables
export ANTHROPIC_API_KEY="your-api-key"
export GITHUB_TOKEN="your-github-token"
export GITHUB_REPOSITORY="organicfreshcoffee/landing"

# Run the script
node scripts/auto-issue-fix.js
```

## Features

### Issue Selection Criteria

Claude analyzes issues based on:
- **Simplicity**: Prefers simple bug fixes over complex features
- **Clear requirements**: Issues with well-defined scope
- **Low risk**: Changes that won't break existing functionality
- **Automation potential**: Issues that can be solved with straightforward code changes

### Supported Fix Types

The system works best with:
- Simple bug fixes
- Configuration updates
- Documentation improvements
- Basic feature implementations
- Code style/linting issues
- Dependency updates

### Safety Features

- **Confidence scoring**: Claude rates its confidence in each solution
- **Low confidence skip**: Solutions with low confidence are not applied
- **Manual review**: All changes go through PR review process
- **Rollback capability**: Changes can be easily reverted via Git
- **Branch isolation**: Changes are made on separate branches

## Workflow Files

- `.github/workflows/auto-issue-fix.yml`: Main GitHub Action workflow
- `scripts/auto-issue-fix.js`: Core automation script

## Customization

### Modify Schedule

To change the run schedule, edit the cron expression in `.github/workflows/auto-issue-fix.yml`:

```yaml
on:
  schedule:
    - cron: '0 9 * * *'  # 9:00 AM UTC daily
```

### Adjust Issue Selection

Modify the analysis prompt in `scripts/auto-issue-fix.js` to change how Claude evaluates issues.

### Change Claude Model

Update the model in the script:

```javascript
model: 'claude-3-5-haiku-20241022'  // or other available models
```

## Monitoring

### Workflow Logs

Check the workflow execution logs in the `Actions` tab to see:
- Which issues were analyzed
- Which issue was selected for fixing
- What changes were made
- Whether a PR was created

### Pull Request Review

Review automatically created PRs for:
- Code quality and correctness
- Adherence to project standards
- Proper testing before merging

## Troubleshooting

### Common Issues

1. **No API Key**: Ensure `ANTHROPIC_API_KEY` is set in repository secrets
2. **Permission Denied**: Check GitHub token permissions
3. **No Issues Selected**: Claude may not find any issues suitable for automation
4. **Build Failures**: The changes may need manual testing before merging

### Debug Mode

Add debug logging by setting environment variables:

```yaml
env:
  DEBUG: "true"
  ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

## Limitations

- **Complex Issues**: Won't attempt complex architectural changes
- **External Dependencies**: May not handle issues requiring new services or APIs
- **Context Limits**: Large codebases may hit Claude's context limits
- **Testing**: Generated code should always be manually tested
- **Human Judgment**: Some issues require human creativity and judgment

## Best Practices

1. **Regular Review**: Check auto-generated PRs promptly
2. **Issue Quality**: Write clear, detailed issue descriptions
3. **Labels**: Use labels to help Claude understand issue types
4. **Testing**: Always test auto-generated fixes before merging
5. **Feedback**: Close or comment on issues that were successfully fixed

## Security

- API keys are stored securely in GitHub Secrets
- Changes are made on separate branches requiring review
- No direct pushes to main/production branches
- All changes are logged and auditable
