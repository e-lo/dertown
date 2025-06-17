# 🛠️ Developing Der Town

## Quickstart

- Install dependencies: `npm install`
- Start local dev server: `npm run dev` or `make dev`
- Build for production: `make build`
- Preview production locally: `make preview`
- Lint code: `npm run lint` or `make lint`
- Format code: `npm run format` or `make format`
- Run tests: `npm run test` or `make test`
- Reset database: `make db-reset`
- Seed test data: `make db-seed`

See below for full setup and workflow details.

## 🛠️ Makefile Commands

The project includes a Makefile with essential development commands for rapid iteration:

### Core Development Commands
```bash
make dev              # Start development server
make build            # Build for production
make preview          # Build and preview production locally
make clean            # Clean build artifacts
```

### Code Quality Commands
```bash
make format           # Format code with Prettier
make lint             # Run ESLint
make test             # Run tests
```

### Database Commands
```bash
make db-reset         # Reset local database with sample data
make db-seed          # Seed with test data
```

### Help
```bash
make help             # Show all available commands
```

### Usage Examples
```bash
# Start development
make dev

# Check code quality
make lint && make format

# Preview production build
make preview

# Reset database for fresh start
make db-reset
```

## 🐍 Python Development Utilities

The project includes Python utilities in `scripts/dev_utils.py` for database management and development tasks:

### Database Management
```python
# Reset database with sample data
python scripts/dev_utils.py reset_db

# Seed database with test data
python scripts/dev_utils.py seed_db

# Validate CSV data before upload
python scripts/dev_utils.py validate_csv events.csv
```

### Environment Setup
```python
# Check environment configuration
python scripts/dev_utils.py check_env

# Generate test data
python scripts/dev_utils.py generate_test_data
```

### Usage Examples
```bash
# Reset database and seed with sample data
python scripts/dev_utils.py reset_db

# Validate CSV before upload
python scripts/dev_utils.py validate_csv --file events.csv

# Generate realistic test data
python scripts/dev_utils.py generate_test_data --count 50
```

**Note**: These utilities require Supabase environment variables to be configured in your `.env` file.

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
   # Reset database and seed with static data
   make db-reset
   
   # Upload CSV data (optional)
   make db-upload local --events events.csv --organizations organizations.csv
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
# Reset local database with static data
make db-reset

# Apply migrations only
supabase db push

# Generate types from database
supabase gen types typescript --local > src/types/database.ts

# Upload CSV data to local database
make db-upload local --events events.csv --organizations organizations.csv

# Validate CSV data without uploading
make db-validate --events events.csv --organizations organizations.csv

# Check for potential duplicates
make db-check-duplicates --events events.csv --organizations organizations.csv
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
1. **Export data**: Use Supabase dashboard or API for data export
2. **Import data**: Use `make db-upload` for CSV data imports
3. **Validate data**: Use `make db-validate` before imports
4. **Check duplicates**: Use `make db-check-duplicates` to identify conflicts
5. **Update logs**: Document all import/export operations

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

### Database Management System

The project uses a Makefile-based system for consistent database operations across all environments.

#### Core Database Commands
```bash
# Reset local database (schema + static data)
make db-reset

# Upload CSV data to specified environment
make db-upload [local|staging|production] --events events.csv --organizations organizations.csv

# Validate CSV data without uploading
make db-validate --events events.csv --organizations organizations.csv

# Check for potential duplicates
make db-check-duplicates --events events.csv --organizations organizations.csv
```

#### Database Reset Process
The `make db-reset` command performs a complete database reset:
1. **Schema Reset**: Runs `supabase db reset` to apply all migrations
2. **Static Data Seeding**: Inserts core reference data (tags, core organizations, core locations)
3. **Data Validation**: Validates all inserted data against Pydantic models
4. **Status Report**: Provides summary of what was inserted/updated

#### Data Upload Process
The `make db-upload` command handles CSV data uploads:
1. **Environment Selection**: Targets local, staging, or production database
2. **CSV Validation**: Validates CSV format and data types
3. **Duplicate Detection**: Fuzzy matching on names (and dates for events)
4. **Conflict Resolution**: Flags potential duplicates for manual review
5. **Data Transformation**: Converts CSV data to database format
6. **Bulk Upload**: Efficient batch insertion with error handling
7. **Verification**: Confirms successful upload with record counts

#### Duplicate Detection Logic
- **Events**: Fuzzy matching on title + start_date + location
- **Organizations**: Fuzzy matching on name + website
- **Locations**: Fuzzy matching on name + address
- **Tags**: Exact matching on name (tags should be unique)

#### Static vs Dynamic Data
- **Static Data** (seeded on reset): tags, core organizations, core locations
- **Dynamic Data** (uploaded via CSV): events, announcements, additional organizations/locations

#### Environment-Specific Procedures
```bash
# Development: Full reset with sample data
make db-reset

# Staging: Upload production-like data
make db-upload staging --events events.csv --organizations organizations.csv

# Production: Incremental updates only
make db-upload production --events events.csv --organizations organizations.csv
```

#### Data Validation and Safety
- **Pre-upload Validation**: Always run `make db-validate` before uploads
- **Duplicate Checking**: Use `make db-check-duplicates` to identify conflicts
- **Backup Procedures**: Automatic backups before production uploads
- **Rollback Capability**: Database restore procedures for failed uploads

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

## 🧩 Client-Only Components & Browser-Only JS

- For browser-only libraries (like FullCalendar.js), do not import ESM modules from CDN in Astro frontmatter or at build time.
- Use Astro's `client:only` directive with a framework component, or a plain `<script type="module">` in the HTML body, to ensure code runs only in the browser.
- See `src/components/FullCalendar.astro` for the recommended approach.

# 🚀 Developing Der Town

This document provides comprehensive guidance for setting up and developing the Der Town community events platform.

## 📋 Prerequisites

- Node.js 18+ and npm
- Python 3.8+ and pip
- Git
- Supabase CLI (optional, for local development)

## 🛠️ Initial Setup

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd dertown
npm install
```

### 2. Environment Configuration

Copy the environment template and configure your local environment:

```bash
cp env.example .env
```

Edit `.env` with your specific configuration values.

### 3. Supabase Setup

#### Option A: Local Development (Recommended)

1. **Install Supabase CLI** (if not already installed):
   ```bash
   npm install -g supabase
   ```

2. **Start local Supabase services**:
   ```bash
   npx supabase start
   ```

3. **Apply database migrations**:
   ```bash
   npx supabase db reset
   ```

4. **Get your local credentials**:
   ```bash
   npx supabase status
   ```

5. **Update your `.env` file** with the local credentials from the status output.

#### Option B: Remote Supabase Project

1. **Create a Supabase project** at [supabase.com](https://supabase.com)
2. **Get your project credentials** from the project settings
3. **Update your `.env` file** with the remote credentials
4. **Apply migrations to remote**:
   ```bash
   npx supabase db push
   ```

### 4. Start Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:4321`

## 🗄️ Database Management

### Schema Overview

The Der Town platform uses the following core database tables:

- **`events`** - Main event data with relationships to locations, organizations, and tags
- **`locations`** - Physical locations where events occur
- **`organizations`** - Organizations hosting events
- **`tags`** - Event categories and classifications
- **`announcements`** - Community announcements and notifications
- **`source_sites`** - External data sources for event ingestion
- **`scrape_logs`** - Logging for data ingestion processes

### Database Operations

#### Local Development

```bash
# Start local database
npx supabase start

# Stop local database
npx supabase stop

# Reset database (applies all migrations and seed data)
npx supabase db reset

# Apply new migrations only
npx supabase db push

# Generate new migration from schema changes
npx supabase db diff -f migration_name

# View database status
npx supabase status
```

#### Production Database

```bash
# Apply migrations to production
npx supabase db push --db-url $PRODUCTION_DATABASE_URL

# Create backup
npx supabase db dump --db-url $PRODUCTION_DATABASE_URL > backup.sql

# Restore from backup
npx supabase db reset --db-url $PRODUCTION_DATABASE_URL < backup.sql
```

### Row Level Security (RLS)

The database implements Row Level Security with the following policies:

- **Public Read Access**: Approved events, locations, organizations, and published announcements
- **Admin Full Access**: Authenticated users can perform all operations
- **Public Event Submissions**: Anyone can submit new events (pending approval)

### Storage Buckets

- **`event-assets`**: Public bucket for event images and media files
- **Access Control**: Public read access, authenticated users can upload/update/delete

### Backup and Recovery

#### Automated Backups

Set up automated database backups using Supabase's built-in backup system or implement custom backup scripts.

#### Manual Backup Process

1. **Create backup**:
   ```bash
   npx supabase db dump --db-url $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Restore backup**:
   ```bash
   npx supabase db reset --db-url $DATABASE_URL < backup_file.sql
   ```

#### Backup Verification

```bash
# Verify backup integrity
pg_restore --list backup_file.sql

# Test restore to temporary database
createdb test_restore
psql test_restore < backup_file.sql
```

### Data Migration Procedures

#### From Django/Wagtail to Supabase

1. **Export Django data**:
   ```bash
   python manage.py dumpdata --natural-foreign --natural-primary > django_export.json
   ```

2. **Transform data** (use provided migration scripts):
   ```bash
   python scripts/migrate_django_data.py django_export.json
   ```

3. **Import to Supabase**:
   ```bash
   npx supabase db reset
   psql $DATABASE_URL < transformed_data.sql
   ```

#### Schema Updates

1. **Create migration**:
   ```bash
   npx supabase db diff -f descriptive_migration_name
   ```

2. **Review migration** in `supabase/migrations/`

3. **Apply migration**:
   ```bash
   npx supabase db push
   ```

4. **Update seed data** if needed:
   ```bash
   npx supabase db reset
   ```

### Performance Optimization

#### Indexing Strategy

The database includes indexes on:
- Event start dates and status
- Location and organization relationships
- Announcement visibility dates
- Import frequency for source sites

#### Query Optimization

- Use appropriate WHERE clauses to leverage indexes
- Implement pagination for large result sets
- Consider materialized views for complex aggregations

### Monitoring and Maintenance

#### Health Checks

```bash
# Check database connectivity
npx supabase status

# Verify RLS policies
psql $DATABASE_URL -c "SELECT schemaname, tablename, policyname FROM pg_policies;"

# Check storage bucket access
curl -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  "$SUPABASE_URL/storage/v1/object/list/event-assets"
```

#### Regular Maintenance Tasks

1. **Weekly**:
   - Review and clean up duplicate events
   - Check for outdated announcements
   - Verify source site import status

2. **Monthly**:
   - Archive old events and announcements
   - Update organization and location information
   - Review and optimize database performance

3. **Quarterly**:
   - Full database backup and recovery test
   - Review and update RLS policies
   - Audit user permissions and access

## 🔧 Development Workflow

### Code Quality

```bash
# Lint code
npm run lint

# Format code
npm run format

# Check formatting
npm run format:check

# Run tests
npm run test
```

### Git Workflow

1. **Create feature branch**:
   ```bash
   git checkout -b feature/descriptive-name
   ```

2. **Make changes** and commit with descriptive messages

3. **Run validation**:
   ```bash
   npm run lint && npm run format:check && npm run build
   ```

4. **Push and create pull request**

### Database Changes

1. **Create migration** for schema changes
2. **Update seed data** if needed
3. **Test locally** with `npx supabase db reset`
4. **Document changes** in this file

## 🚀 Deployment

### Staging Environment

1. **Deploy to staging**:
   ```bash
   npm run build
   # Deploy to staging platform (Vercel/Netlify)
   ```

2. **Apply staging database changes**:
   ```bash
   npx supabase db push --db-url $STAGING_DATABASE_URL
   ```

### Production Environment

1. **Deploy to production**:
   ```bash
   npm run build
   # Deploy to production platform
   ```

2. **Apply production database changes**:
   ```bash
   npx supabase db push --db-url $PRODUCTION_DATABASE_URL
   ```

3. **Verify deployment**:
   - Check all API endpoints
   - Verify database connectivity
   - Test authentication flows

## 🐛 Troubleshooting

### Common Issues

#### Database Connection Issues

```bash
# Check Supabase status
npx supabase status

# Verify environment variables
echo $SUPABASE_URL
echo $SUPABASE_ANON_KEY

# Test connection
psql $DATABASE_URL -c "SELECT version();"
```

#### RLS Policy Issues

```bash
# Check current policies
psql $DATABASE_URL -c "SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual FROM pg_policies;"

# Test policy enforcement
psql $DATABASE_URL -c "SELECT * FROM events LIMIT 1;"
```

#### Storage Issues

```bash
# Check bucket configuration
curl -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  "$SUPABASE_URL/storage/v1/bucket/list"

# Test file upload
curl -X POST \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -F "file=@test.jpg" \
  "$SUPABASE_URL/storage/v1/object/event-assets/test.jpg"
```

### Getting Help

1. **Check logs**:
   ```bash
   npx supabase logs
   ```

2. **Review documentation** in this file and project README

3. **Create issue** with detailed error information

## 📚 Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Astro Documentation](https://docs.astro.build)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [FullCalendar Documentation](https://fullcalendar.io/docs)
