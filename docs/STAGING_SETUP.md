# Staging Environment Setup Guide

This guide will help you set up a complete staging environment for the Organic Fresh Coffee landing application.

## Overview

The staging environment includes:
- **Client**: `staging.organicfreshcoffee.com`
- **API**: `staging-api.organicfreshcoffee.com`
- **Game Server**: `staging-server.organicfreshcoffee.com`

## Prerequisites

1. DNS records already configured for:
   - `staging.organicfreshcoffee.com`
   - `staging-api.organicfreshcoffee.com`
2. Google Cloud Platform account with billing enabled
3. GitHub repository with appropriate permissions

## Setup Steps

### 1. Set up GCP Resources for Staging

Run the GCP setup script for staging:

```bash
./scripts/setup-gcp.sh staging
```

This will create:
- Staging service account: `github-actions-staging-sa`
- Staging Cloud Run services: `organicfreshcoffee-client-staging` and `organicfreshcoffee-server-staging`
- Workload Identity Federation for staging

### 2. Configure GitHub Secrets

Add these additional secrets to your GitHub repository for staging:

#### Required Staging Secrets:
```
WORKLOAD_IDENTITY_PROVIDER_STAGING=projects/[PROJECT_NUMBER]/locations/global/workloadIdentityPools/github-actions-pool/providers/github-actions-provider
SERVICE_ACCOUNT_EMAIL_STAGING=github-actions-staging-sa@[PROJECT_ID].iam.gserviceaccount.com
MONGODB_URI_STAGING=[Your staging MongoDB connection string]
CLIENT_URL_STAGING=https://staging.organicfreshcoffee.com
SERVER_URL_STAGING=https://staging-api.organicfreshcoffee.com
```

#### Existing Secrets (Production):
```
GCP_PROJECT_ID=[Your GCP Project ID]
WORKLOAD_IDENTITY_PROVIDER=[Production workload identity provider]
SERVICE_ACCOUNT_EMAIL=[Production service account email]
MONGODB_URI=[Production MongoDB connection string]
CLIENT_URL=https://organicfreshcoffee.com
SERVER_URL=https://api.organicfreshcoffee.com
```

### 3. Set up Custom Domains for Staging

After the first deployment, configure the staging domains:

```bash
./scripts/setup-domain.sh staging
```

This will:
- Create domain mappings for staging domains
- Provide DNS configuration instructions
- Set up SSL certificates

### 4. Configure MongoDB for Staging

The `init-mongo.js` script automatically detects the staging environment (`NODE_ENV=staging`) and configures the flagship server address as `staging-server.organicfreshcoffee.com`.

Make sure your staging MongoDB database is properly configured with the staging connection string.

## Deployment Options

### Automatic Staging Deployment

Staging is automatically deployed when you push to the `main` branch alongside production.

### PR-based Staging Deployment

To deploy a specific PR to staging:

1. Open a Pull Request
2. Add the label `deploy` to the PR
3. The staging environment will be updated with the PR code
4. A comment will be added to the PR with the deployment URLs

### Manual Staging Deployment

You can manually trigger staging deployment by pushing to `main` branch, which will deploy both production and staging environments.

## Environment Differences

| Aspect | Production | Staging |
|--------|------------|---------|
| Client Domain | `organicfreshcoffee.com` | `staging.organicfreshcoffee.com` |
| API Domain | `api.organicfreshcoffee.com` | `staging-api.organicfreshcoffee.com` |
| Game Server | `server.organicfreshcoffee.com` | `staging-server.organicfreshcoffee.com` |
| NODE_ENV | `production` | `staging` |
| Cloud Run Services | `organicfreshcoffee-*` | `organicfreshcoffee-*-staging` |
| MongoDB | Production DB | Staging DB |

## Testing the Staging Environment

After deployment, test your staging environment:

1. **Client App**: https://staging.organicfreshcoffee.com
2. **API Health Check**: https://staging-api.organicfreshcoffee.com/health
3. **Game Server**: staging-server.organicfreshcoffee.com

## Monitoring and Logs

View logs for staging services:

```bash
# Client logs
gcloud logs read "resource.type=cloud_run_revision AND resource.labels.service_name=organicfreshcoffee-client-staging" --limit=50

# Server logs
gcloud logs read "resource.type=cloud_run_revision AND resource.labels.service_name=organicfreshcoffee-server-staging" --limit=50
```

## Troubleshooting

### DNS Issues
- Verify DNS records are correctly configured
- Check DNS propagation with `dig staging.organicfreshcoffee.com`
- Wait up to 48 hours for full DNS propagation

### Deployment Issues
- Check GitHub Actions logs in the Actions tab
- Verify all required secrets are properly configured
- Ensure GCP permissions are correctly set up

### Database Connection Issues
- Verify `MONGODB_URI_STAGING` secret is correct
- Check MongoDB Atlas network access settings
- Ensure staging database exists and is accessible

## Cleanup

To remove staging environment:

```bash
# Delete Cloud Run services
gcloud run services delete organicfreshcoffee-client-staging --region=us-central1
gcloud run services delete organicfreshcoffee-server-staging --region=us-central1

# Delete domain mappings
gcloud beta run domain-mappings delete staging.organicfreshcoffee.com --region=us-central1
gcloud beta run domain-mappings delete staging-api.organicfreshcoffee.com --region=us-central1

# Delete service account
gcloud iam service-accounts delete github-actions-staging-sa@[PROJECT_ID].iam.gserviceaccount.com
```

## Security Considerations

1. Use separate MongoDB databases for production and staging
2. Staging environment should not have access to production data
3. Consider using different GCP projects for production and staging for better isolation
4. Regularly rotate service account keys and access tokens
5. Monitor staging environment for unauthorized access

## Additional Notes

- Staging deployments include the same testing and linting steps as production
- Docker images are tagged with PR numbers for easy tracking
- Staging environment uses the same resource limits as production
- SSL certificates are automatically managed by Google Cloud Run
