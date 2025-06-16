# 🛠️ Developing Der Town

## Quickstart

- Install dependencies: `npm install`
- Start local dev server: `npm run dev`
- Lint code: `npm run lint`
- Format code: `npm run format`
- Run tests: `npm run test`

See below for full setup and workflow details.

This document contains all instructions and procedures for developers working on the Der Town community events platform.

## 📋 Table of Contents

1. [Initial Setup](#initial-setup)
2. [Development Process](#development-process)
3. [Administrative Processes & Chores](#administrative-processes--chores)
4. [Getting Involved](#getting-involved)

---

## 🚀 Initial Setup

### Prerequisites
- Node.js 18+ 
- Python 3.10+
- Git
- Supabase CLI
- Vercel CLI (for deployment)

### Development Environment Setup
1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/dertown.git
   cd dertown
   ```

2. **Install Node.js dependencies**
   ```bash
   npm install
   ```

3. **Install Python dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your local configuration
   ```

5. **Initialize Supabase**
   ```bash
   supabase init
   supabase start
   ```

6. **Set up database**
   ```bash
   # Run database migrations
   supabase db reset
   
   # Seed initial data
   npm run db:seed
   ```

7. **Start development server**
   ```bash
   npm run dev
   ```

### Environment Variables
Create a `.env` file with the following variables:

```env
# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Authentication
AUTH_SECRET=your_auth_secret

# External Services
GOOGLE_CALENDAR_API_KEY=your_google_api_key
OPENAI_API_KEY=your_openai_api_key

# Deployment
VERCEL_TOKEN=your_vercel_token
```

### Local Development Workflow

#### Starting Local Development
```bash
# Start local Supabase
supabase start

# Start development server
npm run dev

# In another terminal, watch for changes
npm run dev:watch
```

#### Local Testing
```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run specific test suite
npm run test:unit
npm run test:integration
npm run test:e2e

# Run linting and formatting
npm run lint
npm run format
```

#### Database Management (Local)
```bash
# Reset local database
supabase db reset

# Apply migrations
supabase db push

# Generate types from database
supabase gen types typescript --local > src/types/database.ts

# Seed local database
npm run db:seed
```

### Preview Environment Setup

#### Staging Environment
The staging environment is deployed to `staging.dertown.org` and provides a production-like environment for testing.

**Access**:
- **URL**: https://staging.dertown.org
- **Database**: Separate staging database
- **Storage**: Separate staging storage buckets

#### Preview Deployments
Every pull request automatically creates a preview deployment for testing.

**Workflow**:
1. Create pull request
2. Automatic preview deployment is created
3. Preview URL is added to PR comments
4. Test changes in preview environment
5. Merge after approval

#### Environment-Specific Configuration

**Development** (`.env.development`):
```env
NODE_ENV=development
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=your_local_anon_key
ENABLE_DEBUG=true
```

**Staging** (`.env.staging`):
```env
NODE_ENV=staging
SUPABASE_URL=your_staging_supabase_url
SUPABASE_ANON_KEY=your_staging_anon_key
ENABLE_DEBUG=false
```

**Production** (`.env.production`):
```env
NODE_ENV=production
SUPABASE_URL=your_production_supabase_url
SUPABASE_ANON_KEY=your_production_anon_key
ENABLE_DEBUG=false
```

### Preview Deployment Workflow

#### Creating Preview Deployments
```bash
# Deploy to staging
npm run deploy:staging

# Deploy preview for current branch
npm run deploy:preview

# Deploy to production (after staging approval)
npm run deploy:production
```

#### Testing in Preview Environment
1. **Functional Testing**:
   - Test all user flows
   - Verify new features work correctly
   - Check for regressions

2. **Integration Testing**:
   - Test with real external services
   - Verify database operations
   - Check API endpoints

3. **Performance Testing**:
   - Run Lighthouse tests
   - Check Core Web Vitals
   - Monitor error rates

4. **Cross-Browser Testing**:
   - Test in Chrome, Firefox, Safari, Edge
   - Test on mobile devices
   - Verify responsive design

#### Preview Environment Validation
```bash
# Run full test suite against staging
npm run test:staging

# Run performance tests
npm run test:performance

# Run accessibility tests
npm run test:accessibility

# Run security tests
npm run test:security
```

#### Staging Environment Maintenance
**Frequency**: Weekly
**Procedure**:
1. Update staging environment with latest changes
2. Sync staging database with production schema
3. Test all critical user flows
4. Verify staging environment health
5. Clean up old preview deployments

### Environment Management

#### Switching Between Environments
```bash
# Switch to development
npm run env:dev

# Switch to staging
npm run env:staging

# Switch to production
npm run env:prod
```

#### Environment Health Checks
```bash
# Check development environment
npm run health:dev

# Check staging environment
npm run health:staging

# Check production environment
npm run health:prod
```

#### Database Management Across Environments
```bash
# Apply migrations to staging
supabase db push --db-url staging_url

# Apply migrations to production
supabase db push --db-url production_url

# Backup staging database
supabase db dump --db-url staging_url > staging_backup.sql

# Backup production database
supabase db dump --db-url production_url > production_backup.sql
```

### Security & Monitoring

#### Security Audits
**Frequency**: Monthly
**Procedure**:
1. Run `npm audit` and `pip audit`
2. Review dependency vulnerabilities
3. Update dependencies as needed
4. Document findings in security log

#### SSL Certificate Management
**Frequency**: 90 days before expiration
**Procedure**:
1. Check certificate expiration dates
2. Renew certificates through hosting provider
3. Update DNS records if needed
4. Test HTTPS functionality

### Performance & Optimization

#### Performance Monitoring
**Frequency**: Weekly
**Procedure**:
1. Review Core Web Vitals in Google Analytics
2. Check Lighthouse scores
3. Monitor database query performance
4. Review error rates and response times

#### Database Optimization
**Frequency**: Monthly
**Procedure**:
1. Analyze slow queries
2. Update database indexes
3. Clean up unused data
4. Optimize storage usage

### Content & Data Management

#### Content Moderation
**Frequency**: Daily
**Procedure**:
1. Review pending event submissions
2. Check for spam and inappropriate content
3. Approve or reject submissions
4. Update moderation guidelines as needed

#### Data Import/Export
**Frequency**: As needed
**Procedure**:
1. Export data: `npm run export:data`
2. Import data: `npm run import:data`
3. Validate data integrity
4. Update import/export logs

### Backup & Recovery

#### Database Backups
**Frequency**: Daily
**Procedure**:
1. Automated backup via Supabase
2. Verify backup integrity
3. Store backup logs
4. Test recovery procedures monthly

#### Recovery Procedures
**Frequency**: Test monthly
**Procedure**:
1. Identify backup to restore from
2. Stop affected services
3. Restore database from backup
4. Verify data integrity
5. Restart services

### Scheduled Tasks

#### GitHub Actions Maintenance
**Frequency**: Weekly
**Procedure**:
1. Review workflow logs
2. Update scheduled jobs as needed
3. Monitor resource usage
4. Update dependencies in workflows

#### Cron Job Management
**Frequency**: Monthly
**Procedure**:
1. Review all scheduled tasks
2. Update job schedules as needed
3. Monitor job execution logs
4. Clean up old logs

### System Health

#### Health Checks
**Frequency**: Daily
**Procedure**:
1. Check application uptime
2. Monitor error rates
3. Verify database connectivity
4. Test critical user flows

#### Diagnostics
**Frequency**: As needed
**Procedure**:
1. Collect system logs
2. Analyze error patterns
3. Identify root causes
4. Implement fixes
5. Document lessons learned

---

## 🤝 Getting Involved

### Contributing
1. Fork the repository
2. Create feature branch
3. Make changes following coding standards
4. Add tests for new functionality
5. Submit pull request

### Issue Reporting
- Use GitHub Issues for bug reports
- Include steps to reproduce
- Provide environment details
- Add screenshots if applicable

### Feature Requests
- Use GitHub Discussions for feature requests
- Describe the problem and proposed solution
- Consider implementation complexity
- Get community feedback

### Community Guidelines
- Be respectful and inclusive
- Follow the code of conduct
- Help others learn and grow
- Share knowledge and best practices

---

## 📞 Contact & Escalation

### Emergency Contacts
- **System Administrator**: [Contact Info]
- **Database Administrator**: [Contact Info]
- **Security Team**: [Contact Info]

### Escalation Procedures
1. Document the issue
2. Attempt immediate resolution
3. Escalate to appropriate team member
4. Follow up with resolution report

---

## 📚 Additional Resources

- [Project Requirements](./PROJECT_REQUIREMENTS.md)
- [Implementation Plan](./TODO.md)
- [API Documentation](./docs/api.md)
- [Component Library](./docs/components.md)
- [Deployment Guide](./docs/deployment.md)

---

## 🔄 Development Process

### Code Style & Formatting
- **TypeScript**: Use strict mode, follow ESLint rules
- **Python**: Use ruff for formatting and linting
- **Markdown**: Follow markdownlint rules
- **CSS**: Use Tailwind CSS utility classes

### Git Workflow
1. Create feature branch from `main`
2. Make changes with descriptive commits
3. Run tests and linting
4. Create pull request
5. Code review and merge

### Testing
- **Unit tests**: `npm run test`
- **Integration tests**: `npm run test:integration`
- **E2E tests**: `npm run test:e2e`
- **Coverage**: Aim for >80% coverage

### Code Review Process
1. All changes require pull request
2. At least one approval required
3. All tests must pass
4. Code coverage must not decrease

### Sub-Phase Validation & Testing

#### Required Validation Steps
At the end of each sub-phase (e.g., 1.1, 1.2, 1.3), you MUST complete these validation steps:

1. **Code Quality Checks**:
   ```bash
   # JavaScript/TypeScript
   npm run lint
   npm run format:check
   npm run build
   
   # Python
   ruff check .
   ruff format --check .
   python -m pytest
   ```

2. **Functional Testing**:
   - Test the implemented functionality manually
   - Verify integration points work correctly
   - Check that the feature meets requirements
   - Ensure no regressions in existing functionality

3. **Database Validation** (if applicable):
   ```bash
   supabase db reset
   # Verify schema and data integrity
   ```

4. **Preview Environment Testing** (if applicable):
   ```bash
   # Deploy to preview environment
   npm run deploy:preview
   
   # Test in preview environment
   npm run test:preview
   
   # Run performance tests
   npm run test:performance
   
   # Verify staging environment health
   npm run health:staging
   ```

#### Autonomous Error Resolution
- If any validation fails, diagnose and fix the issue immediately
- Re-run validation tools after each fix
- Continue iteratively until ALL checks pass
- Only escalate to user if blocked by Clarification Threshold

#### Summary Reporting
After completing each sub-phase and resolving all issues, provide:

**Format**:
```
## ✅ Sub-Phase [X.Y] Complete

### What Was Implemented
- [Brief description of what was built/configured]

### What to Review
- [Specific areas for user review and testing]

### Suggested Commit Message
```
feat: [concise description of changes]
```
```

**Example**:
```
## ✅ Sub-Phase 1.1 Complete

### What Was Implemented
- Initialized Astro project with TypeScript configuration
- Set up Tailwind CSS with custom theme variables
- Configured ESLint, Prettier, and TypeScript rules
- Created basic project structure and configuration files

### What to Review
- Check that `npm run dev` starts the development server
- Verify Tailwind CSS classes are working in the browser
- Test that linting and formatting work: `npm run lint` and `npm run format`

### Suggested Commit Message
```
feat: initialize astro project with typescript and tailwind
```
```

---

## 🛠️ Administrative Processes & Chores

### Database Management

#### Database Migrations
**Frequency**: As needed for schema changes
**Procedure**:
1. Create migration file: `supabase migration new migration_name`
2. Write SQL changes in the migration file
3. Test locally: `supabase db reset`
4. Apply to staging: `supabase db push --db-url staging_url`
5. Apply to production: `supabase db push --db-url production_url`

**Rollback**: Use `supabase db reset` to previous migration

#### Database Maintenance
**Frequency**: Weekly
**Procedure**:
```sql
-- Run in Supabase SQL editor
VACUUM ANALYZE;
REINDEX DATABASE dertown;
```
