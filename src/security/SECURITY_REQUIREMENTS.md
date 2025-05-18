
# Security Requirements and Standards

## Overview
This document outlines the security requirements and standards for the application.
It serves as a reference for ongoing development and ensures consistent implementation
of security controls across the application.

## Authentication

### JWT Validation
- All edge functions must validate JWT tokens using JWK verification
- Invalid or expired tokens must be rejected with appropriate error messages
- Use token refresh mechanisms to prevent disruption due to expiration
- Never expose authentication tokens in URLs or unencrypted storage

### Session Management
- Use `cleanupAuthState()` before sign-in and sign-out operations
- Use global sign-out to ensure complete session termination
- Implement proper session refresh patterns to maintain session continuity
- Defer API calls after auth state changes using setTimeout to prevent deadlocks
- Avoid authentication "limbo" states by thorough cleanup of local storage

## Authorization

### Role-Based Access Control (RBAC)
- All user roles must be validated against allowed types ('admin', 'user')
- Default to least privilege ('user') when role information is missing or invalid
- Implement consistent role checking through the centralized security service
- Use security definer functions for role checks in RLS policies to avoid recursion

### Row-Level Security (RLS)
- Enable RLS on all tables containing user data
- Implement appropriate RLS policies for each operation (SELECT, INSERT, UPDATE, DELETE)
- Use security definer functions to avoid recursive RLS policy issues
- Use type-safe role validation for all user input

## Preview Mode

### Development Environment
- Use `isPreviewMode()` from previewService.ts as the single source of truth
- Preview mode should be clearly indicated in the UI
- Implement secure mock data that doesn't expose production information
- Ensure consistent preview mode detection across all application components

## Edge Functions

### Security Configuration
- All secure edge functions must have `verify_jwt = true` in config.toml
- Implement appropriate CORS headers for all edge functions
- Use standardized error response formats with appropriate HTTP status codes
- Include detailed logging for debugging but sanitize sensitive information

### Error Handling
- Sanitize error messages to prevent information disclosure
- Implement consistent error logging for security-related events
- Use try-catch blocks with appropriate fallbacks for critical operations
- Return user-friendly error messages without exposing system details

## Type Safety

### Data Validation
- Validate all user input against defined schemas
- Implement runtime type checking for external data sources
- Use the validateUserRole() function for all role assignments
- Ensure consistent typing between frontend and backend components

## Secure Storage

### API Keys and Secrets
- Never store API keys or secrets in client-side code
- Use Supabase secrets for all sensitive configuration
- Implement proper access controls for secret usage
- Regularly rotate secrets and API keys

## General Best Practices

### Code Organization
- Keep security-related code in dedicated modules under src/services/security
- Use the centralized securityService.ts as the entry point for all security operations
- Document security-critical code with clear comments
- Keep security utility functions small and focused on a single responsibility

### Ongoing Security
- Regularly review and update security controls
- Monitor for security issues in dependencies
- Implement proper error logging for security-related events
- Follow the principle of least privilege in all access controls
