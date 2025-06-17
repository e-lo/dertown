# Der Town Development Makefile
# Essential commands for rapid development iteration

.PHONY: help dev build preview db-reset db-seed format lint test clean

# Default target
help:
	@echo "Der Town Development Commands:"
	@echo "  dev              - Start development server"
	@echo "  build            - Build for production"
	@echo "  preview          - Build and preview production locally"
	@echo "  db-reset         - Reset local database with sample data"
	@echo "  db-seed          - Seed with test data"
	@echo "  format           - Format code with Prettier"
	@echo "  lint             - Run ESLint"
	@echo "  test             - Run tests"
	@echo "  clean            - Clean build artifacts"

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
	python scripts/dev_utils.py seed
	@echo "Database seeding complete"

# Format code
format:
	@echo "Formatting code..."
	npx prettier --write src/
	@echo "Code formatting complete"

# Lint code
lint:
	@echo "Running linter..."
	npx eslint src/ --ext .js,.ts,.astro
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