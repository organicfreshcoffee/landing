#!/usr/bin/env node

/**
 * Test script to validate Google Cloud Secret Manager connectivity
 * Run this to diagnose issues with secret access in production
 */

const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

async function testSecretAccess() {
  console.log('Testing Google Cloud Secret Manager connectivity...');
  console.log('Environment variables:');
  console.log('  NODE_ENV:', process.env.NODE_ENV);
  console.log('  GOOGLE_CLOUD_PROJECT:', process.env.GOOGLE_CLOUD_PROJECT || 'NOT SET');
  console.log('  GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS || 'NOT SET');
  
  try {
    const client = new SecretManagerServiceClient();
    const projectId = process.env.GOOGLE_CLOUD_PROJECT;
    
    if (!projectId) {
      throw new Error('GOOGLE_CLOUD_PROJECT environment variable is required');
    }
    
    console.log('\nTesting access to firebase-client-config secret...');
    const secretName = `projects/${projectId}/secrets/firebase-client-config/versions/latest`;
    console.log('Secret path:', secretName);
    
    const [version] = await client.accessSecretVersion({ name: secretName });
    const payload = version.payload?.data?.toString();
    
    if (!payload) {
      throw new Error('Empty secret value');
    }
    
    console.log('✅ Success! Firebase client config secret is accessible');
    console.log('Secret length:', payload.length, 'characters');
    
    // Try to parse as JSON to validate format
    const config = JSON.parse(payload);
    console.log('✅ Success! Secret contains valid JSON');
    console.log('Config keys:', Object.keys(config));
    
  } catch (error) {
    console.error('❌ Error accessing secret:', error.message);
    console.error('Error details:', {
      name: error.name,
      code: error.code,
      details: error.details
    });
    process.exit(1);
  }
}

testSecretAccess();
