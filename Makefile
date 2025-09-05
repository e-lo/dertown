# Der Town Development Makefile
# Essential commands for rapid development iteration

.PHONY: help dev build preview clean venv venv-activate venv-install \
	format lint test validate-all test-data \
	db-local-reset db-local-migrate db-local-seed db-local-update-events db-backup

# Default target
help:
	@echo "Der Town Development Commands:"
	@echo "  dev                 - Start development server"
	@echo "  build               - Build for production"
	@echo "  preview             - Build and preview production locally"
	@echo "  clean               - Clean build artifacts"
	@echo "  format              - Format code with Prettier"
	@echo "  lint                - Run ESLint and markdownlint"
	@echo "  test                - Run tests"
	@echo "  validate-all        - Run all validations"
	@echo "  test-data           - Generate realistic test data"
	@echo "  venv                - Create a Python virtual environment (.venv)"
	@echo "  venv-activate       - Print activation command for venv"
	@echo "  venv-install        - Install Python requirements in venv"
	@echo ""
	@echo "  db-local-reset         - Reset, migrate, and seed local database (all-in-one for dev)"
	@echo "  db-local-migrate       - Run migrations on local DB only (no data loss)"
	@echo "  db-local-seed          - Seed local DB with local/test data (including staged data)"
	@echo "  db-local-update-events - Update local event dates, etc."
	@echo "  db-backup              - Backup current database state (local)"
	@echo "  db-link-remote         - Link to remote project (uses REMOTE_SB_PROJECT_REF from .env)"
	@echo "  db-pull-schema         - Pull schema from remote to local"
	@echo "  db-sync-remote         - Sync data from remote to local database"
	@echo "  db-sync-full           - Full sync: schema + data from remote"
	@echo "  db-diff                - Check schema differences"
	@echo "  db-push-schema         - Push local schema changes to remote"

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

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	rm -rf dist/
	rm -rf .astro/
	@echo "Clean complete"

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

# Run all validations
validate-all:
	@echo "Running all validations..."
	@echo "1. TypeScript compilation..."
	npx tsc --noEmit
	@echo "2. ESLint (excluding Astro files)..."
	npx eslint src/ --ext .js,.ts
	@echo "3. Prettier check..."
	npx prettier --check src/
	@echo "4. Timezone logic test..."
	npm run test:timezone
	@echo "5. Build test..."
	npx astro build
	@echo "All validations passed!"

# Generate realistic test data
test-data:
	@echo "Generating realistic test data..."
	.venv/bin/python3 scripts/data_manager.py generate-test-data
	@echo "Test data generation complete"

venv:
	uv venv .venv

venv-activate:
	@echo "Run: source .venv/bin/activate"

venv-install:
	uv pip install -r requirements.txt

# =====================
# LOCAL DEVELOPMENT DATABASE COMMANDS
# =====================

# Reset local DB, run migrations, and seed local data (all-in-one for local dev)
db-local-reset:
	@echo "[LOCAL] Resetting, migrating, and seeding local database..."
	supabase db reset
	make db-local-migrate
	@echo "[LOCAL] Local database fully reset, migrated, and seeded."

# Run migrations on local DB only (no data loss)
db-local-migrate:
	@echo "[LOCAL] Running local database migrations..."
	supabase db push --include-all --db-url "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
	@echo "[LOCAL] Local database migrations complete."

db-local-seed-from-remote:
	supabase db dump --data-only --schema public > backups/db_dump$$timestamp.sql
	psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f backups/db_dump$$timestamp.sql --set ON_ERROR_STOP=off

# Backup current database state (local)
db-backup:
	@echo "[LOCAL] Creating database backup..."
	@mkdir -p backups
	@timestamp=$$(date +%Y%m%d_%H%M%S); \
	supabase db dump --data-only > backups/db_backup_$$timestamp.sql; \
	echo "Database backup saved to backups/db_backup_$$timestamp.sql"

# Link to remote project (first time setup)
db-link-remote:
	@echo "[LINK] Linking to remote Supabase project..."
	@if [ -f .env ]; then \
		export $$(cat .env | grep -v '^#' | xargs); \
	fi; \
	if [ -z "$$REMOTE_SB_PROJECT_REF" ]; then \
		echo "Error: REMOTE_SB_PROJECT_REF not found in .env file"; \
		echo ""; \
		echo "Please add your project ref to your .env file:"; \
		echo "  REMOTE_SB_PROJECT_REF=your-project-ref"; \
		echo ""; \
		echo "You can find your project ref by running:"; \
		echo "  supabase projects list"; \
		echo ""; \
		echo "Or from the Supabase dashboard URL:"; \
		echo "  https://supabase.com/dashboard/project/your-project-ref"; \
		exit 1; \
	fi; \
	supabase link --project-ref $$REMOTE_SB_PROJECT_REF

# Pull schema from remote to local
db-pull-schema:
	@echo "[SCHEMA] Pulling schema from remote to local..."
	@if [ -f .env ]; then \
		export $$(cat .env | grep -v '^#' | xargs); \
	fi; \
	supabase db pull --linked
	@echo "[SCHEMA] Resetting local database to apply schema changes..."
	supabase db reset

# Sync data from remote to local
db-sync-remote:
	@echo "[SYNC] Syncing data from remote to local database..."
	@if [ -f .env ]; then \
		export $$(cat .env | grep -v '^#' | xargs); \
	fi
	@mkdir -p backups
	@timestamp=$$(date +%Y%m%d_%H%M%S); \
	echo "[SYNC] Dumping remote data..."; \
	supabase db dump --data-only > backups/remote_dump_$$timestamp.sql; \
	echo "[SYNC] Restoring data to local database..."; \
	psql "postgresql://postgres:postgres@localhost:54322/postgres" -f backups/remote_dump_$$timestamp.sql --set ON_ERROR_STOP=off; \
	echo "[SYNC] Cleaning up..."; \
	rm backups/remote_dump_$$timestamp.sql; \
	echo "[SYNC] Data sync completed!"

# Full sync: pull schema and data from remote
db-sync-full:
	@echo "[SYNC] Full sync from remote to local..."
	$(MAKE) db-pull-schema
	$(MAKE) db-sync-remote

# Quick sync: just pull schema (no data)
db-sync-schema-only:
	@echo "[SYNC] Pulling schema only from remote..."
	$(MAKE) db-pull-schema

# Check schema differences between local and remote
db-diff:
	@echo "[DIFF] Checking schema differences..."
	@if [ -f .env ]; then \
		export $$(cat .env | grep -v '^#' | xargs); \
	fi; \
	supabase db diff --local --linked

# Push local schema changes to remote
db-push-schema:
	@echo "[PUSH] Pushing local schema changes to remote..."
	@if [ -f .env ]; then \
		export $$(cat .env | grep -v '^#' | xargs); \
	fi; \
	supabase db push --linked

# Seed ALL reference and content data (tags, organizations, locations, events, announcements) from /seed_data to the current database
db-initial-seed:
	@echo "Seeding ALL reference and content data (tags, organizations, locations, events, announcements) from /seed_data to the current database..."
	@if [ -f .env.production ]; then \
		export $$(cat .env.production | grep -v '^#' | xargs) && python3 scripts/seed_database.py; \
	else \
		echo "Error: .env.production file not found. Please create it with your Supabase credentials."; \
		exit 1; \
	fi
	@echo "Initial seed complete. Only run this on a fresh database!"

# =====================
# REMOTE/PRODUCTION DATABASE COMMANDS (future)
# =====================
# (Add remote/production DB commands here as needed)

