
# Security Requirements and Standards

## Overview
This document outlines the security requirements and standards for the application.
It serves as a reference for ongoing development and ensures consistent implementation
of security controls across the application.

## Authentication

### JWT Validation
- All edge functions must validate JWT tokens using JWK verification
- Invalid or expired tokens must be rejected with appropriate error messages
- Implement token refresh mechanism to prevent disruption due to expiration

### Session Management
- Clean up auth state before sign-in and sign-out operations
- Use global sign-out to ensure complete session termination
- Implement proper session refresh patterns to maintain session continuity
- Avoid authentication "limbo" states by thorough cleanup of local storage

## Authorization

### Role-Based Access Control (RBAC)
- All user roles must be validated against allowed types ('admin', 'user')
- Default to least privilege ('user') when role information is missing or invalid
- Implement consistent role checking throughout the application
- Use security definer functions for role checks in RLS policies to avoid recursion

### Row-Level Security (RLS)
- Enable RLS on all tables containing user data
- Implement appropriate RLS policies for each operation (SELECT, INSERT, UPDATE, DELETE)
- Use type-safe role validation for all user input

## Preview Mode

### Development Environment
- Preview mode should be clearly indicated in the UI
- Implement secure mock data that doesn't expose production information
- Ensure consistent preview mode detection across all application components

## Edge Functions

### Security Configuration
- All secure edge functions must have `verify_jwt = true` in config.toml
- Implement appropriate CORS headers for all edge functions
- Use standardized error responses with appropriate HTTP status codes

### Error Handling
- Sanitize error messages to prevent information disclosure
- Implement consistent error logging for security-related events
- Use try-catch blocks with appropriate fallbacks for critical operations

## Type Safety

### Data Validation
- Validate all user input against defined schemas
- Implement runtime type checking for external data sources
- Ensure consistent typing between frontend and backend components

## Secure Storage

### API Keys and Secrets
- Never store API keys or secrets in client-side code
- Use Supabase secrets for all sensitive configuration
- Implement proper access controls for secret usage

## General Best Practices

### Code Organization
- Keep security-related code in dedicated modules
- Avoid duplicate implementation of security functions
- Document security-critical code with clear comments

### Ongoing Security
- Regularly review and update security controls
- Monitor for security issues in dependencies
- Implement proper error logging for security-related events
