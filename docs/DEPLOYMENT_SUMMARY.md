# Deployment Summary

## Overview
This project deploys a client-server architecture to Google Cloud Run:

- **Client**: Next.js app → `https://organicfreshcoffee.com`
- **Server**: Express.js API → `https://api.organicfreshcoffee.com`

## Quick Setup Steps

### 1. GCP Setup
```bash
# Run the setup script to configure GCP resources
./scripts/setup-gcp.sh
```

### 2. GitHub Secrets
Add these secrets to your GitHub repository:

**Required for deployment:**
- `GCP_PROJECT_ID`: Your GCP project ID
- `WORKLOAD_IDENTITY_PROVIDER`: From setup-gcp.sh output
- `SERVICE_ACCOUNT_EMAIL`: From setup-gcp.sh output
- `MONGODB_URI`: Your MongoDB connection string

**Required for runtime:**
- `CLIENT_URL`: https://organicfreshcoffee.com (after domain setup)
- `SERVER_URL`: https://api.organicfreshcoffee.com (after domain setup)

### 3. Deploy
```bash
git push origin main
```

### 4. Configure Domain
```bash
# After successful deployment
./scripts/setup-domain.sh
```

## Architecture Changes Made

### GitHub Workflow (`deploy.yml`)
- ✅ Split into separate client and server jobs
- ✅ Updated service names and repository references
- ✅ Fixed Docker build contexts for client/ and server/ directories
- ✅ Configured appropriate ports (3000 for client, 3001 for server)
- ✅ Set correct environment variables for each service

### GCP Setup Script (`setup-gcp.sh`)
- ✅ Updated to use correct repository name ("organicfreshcoffee" instead of "game-server")
- ✅ Fixed GitHub repository reference ("organicfreshcoffee/landing" instead of "organicfreshcoffee/server")
- ✅ Updated service names for client and server
- ✅ Improved messaging for dual-service deployment

### Domain Setup Script (`setup-domain.sh`)
- ✅ Added support for both main domain and API subdomain
- ✅ Maps organicfreshcoffee.com to client service
- ✅ Maps api.organicfreshcoffee.com to server service
- ✅ Provides comprehensive DNS configuration instructions

### Documentation (`docs/GCP_DEPLOYMENT.md`)
- ✅ Updated for client-server architecture
- ✅ Corrected repository and service names throughout
- ✅ Added proper domain configuration section
- ✅ Updated testing and monitoring instructions

## Environment Variables

### Client Service  
- `NODE_ENV=production`
- `SERVER_URL=${{ secrets.SERVER_URL }}` (https://api.organicfreshcoffee.com)

### Server Service
- `NODE_ENV=production` 
- `MONGODB_URI=${{ secrets.MONGODB_URI }}`
- `CLIENT_URL=${{ secrets.CLIENT_URL }}` (https://organicfreshcoffee.com)
- `GOOGLE_CLOUD_PROJECT=${{ secrets.GCP_PROJECT_ID }}`

## Deployment Flow

1. **Test Phase**: Both client and server are built and tested in parallel
2. **Deploy Phase**: Both services are deployed to Cloud Run with proper configuration
3. **Domain Setup**: Custom domains are mapped after deployment
4. **DNS Configuration**: Manual DNS setup in Google Domains

## Key Benefits

- **Scalable**: Auto-scales from 0 to 10 instances per service
- **Cost-effective**: Pay only for actual usage
- **Secure**: Uses Workload Identity Federation (no service account keys)
- **Professional**: Custom domain with SSL certificates
- **Monitoring**: Built-in Cloud Logging and Monitoring

## Next Steps After Deployment

1. **Update GitHub Secrets**:
   - Set `CLIENT_URL=https://organicfreshcoffee.com`
   - Set `SERVER_URL=https://api.organicfreshcoffee.com`
2. **Configure custom domains** with `./scripts/setup-domain.sh`
3. **Test both services**:
   - Client: https://organicfreshcoffee.com
   - Server: https://api.organicfreshcoffee.com/health
4. **Verify API connectivity** between client and server
5. **Set up monitoring alerts** if needed

## Troubleshooting

If deployment fails:
1. Check GitHub Actions logs
2. Verify all secrets are set correctly
3. Test Docker builds locally
4. Check GCP resource quotas
5. Verify MongoDB connection string

For domain issues:
1. Check DNS propagation with `dig organicfreshcoffee.com`
2. Verify domain ownership
3. Check Cloud Run domain mappings
4. Test SSL certificates

## Cost Estimation

**Monthly costs for moderate traffic:**
- Client Service: $5-15/month
- Server Service: $5-25/month  
- MongoDB Atlas: $0-9/month (free tier)
- Total: ~$10-50/month

**Free tier includes:**
- 2 million requests per month
- 360,000 GiB-seconds of memory
- 180,000 vCPU-seconds of compute time
