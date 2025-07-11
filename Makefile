# Der Town Development Makefile
# Essential commands for rapid development iteration

.PHONY: help dev build preview db-reset db-seed db-migrate db-backup test-data validate-all format lint test clean db-seed-local-events venv venv-activate venv-install db-seed db-seed-local update-local-events markdownlint-fix

# Default target
help:
	@echo "Der Town Development Commands:"
	@echo "  dev              - Start development server"
	@echo "  build            - Build for production"
	@echo "  preview          - Build and preview production locally"
	@echo "  db-reset         - Reset local database with sample data"
	@echo "  db-seed          - Seed production/staging DB with canonical data (events, locations, orgs, tags, etc.)"
	@echo "  db-seed-local    - Seed local DB with local/test data (locations, orgs, tags, announcements, and local events with randomized dates)"
	@echo "  db-update-local-events - Update event dates in local DB to be in the near future"
	@echo "  db-migrate       - Run database migrations"
	@echo "  db-backup        - Backup current database state"
	@echo "  test-data        - Generate realistic test data"
	@echo "  validate-all     - Run all validations"
	@echo "  format           - Format code with Prettier"
	@echo "  lint             - Run ESLint and markdownlint"
	@echo "  test             - Run tests"
	@echo "  clean            - Clean build artifacts"
	@echo "  venv                - Create a Python virtual environment (.venv)"
	@echo "  venv-activate       - Print activation command for venv"
	@echo "  venv-install        - Install Python requirements in venv"

# Development server
dev:
	@echo "Starting development server..."
	npx astro dev

# Production build
build:
	@echo "Building for production..."
	npx astro build

# Build and preview production locally
preview:
	@echo "Building for production..."
	npx astro build
	@echo "Starting production preview server..."
	npx astro preview

# Database reset with sample data
db-reset:
	@echo "Resetting local database..."
	supabase db reset
	@echo "Database reset complete"

# Seed database with test data
db-seed:
	@echo "Seeding database with test data..."
	python3 scripts/seed_database.py
	@echo "Database seeding complete"

# Seed local database with local/test data
db-seed-local: db-reset
	@echo "Seeding local database with local/test data..."
	python3 scripts/seed_local_base.py
	python3 scripts/seed_local_events.py
	@echo "Local database seeding complete"

# Update
db-update-local-events:
	@echo "Updating local events..."
	python3 scripts/update_local_events.py 
	@echo "Local events updated"

# Run database migrations
db-migrate:
	@echo "Running database migrations..."
	supabase db push
	@echo "Database migrations complete"

# Backup current database state
db-backup:
	@echo "Creating database backup..."
	@mkdir -p backups
	@timestamp=$$(date +%Y%m%d_%H%M%S); \
	supabase db dump --data-only > backups/db_backup_$$timestamp.sql; \
	echo "Database backup saved to backups/db_backup_$$timestamp.sql"

# Generate realistic test data
test-data:
	@echo "Generating realistic test data..."
	python3 scripts/data_manager.py generate-test-data
	@echo "Test data generation complete"

# Run all validations
validate-all:
	@echo "Running all validations..."
	@echo "1. TypeScript compilation..."
	npx tsc --noEmit
	@echo "2. ESLint (excluding Astro files)..."
	npx eslint src/ --ext .js,.ts
	@echo "3. Prettier check..."
	npx prettier --check src/
	@echo "4. Build test..."
	npx astro build
	@echo "All validations passed!"

# Format code
format:
	@echo "Formatting code..."
	npx prettier --write src/
	@echo "Code formatting complete"

# Lint code
lint:
	@echo "Running linter..."
	npx eslint src/ --ext .js,.ts,.astro --fix
	@echo "Running markdownlint..."
	npx markdownlint "*.md" "src/**/*.md" "scripts/**/*.md" --fix
	@echo "Linting complete"

# Run tests
test:
	@echo "Running tests..."
	npm run test
	@echo "Tests complete"

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	rm -rf dist/
	rm -rf .astro/
	@echo "Clean complete"

# Seed local events
db-seed-local-events:
	python3 scripts/seed_local_events.py

venv:
	uv venv .venv

venv-activate:
	@echo "Run: source .venv/bin/activate"

venv-install:
	uv pip install -r requirements.txt

