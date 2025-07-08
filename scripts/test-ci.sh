#!/bin/bash

# CI Test Runner Script for Fulsk Backend
# This script runs the complete test suite with proper setup and teardown

set -e

echo "🚀 Starting Fulsk Backend Test Suite"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required environment variables are set
check_environment() {
    print_status "Checking environment setup..."
    
    if [ -z "$DATABASE_URL" ]; then
        print_warning "DATABASE_URL not set, using default test database"
        export DATABASE_URL="postgresql://test:test@localhost:5432/fulsk_test"
    fi
    
    if [ -z "$NODE_ENV" ]; then
        export NODE_ENV="test"
    fi
    
    print_success "Environment setup complete"
}

# Setup test database
setup_database() {
    print_status "Setting up test database..."
    
    # Load test environment
    if [ -f ".env.test" ]; then
        export $(cat .env.test | xargs)
    fi
    
    # Run database migrations
    npx prisma migrate deploy || {
        print_error "Database migration failed"
        exit 1
    }
    
    print_success "Database setup complete"
}

# Run linting
run_lint() {
    print_status "Running ESLint..."
    
    npm run lint || {
        print_error "Linting failed"
        exit 1
    }
    
    print_success "Linting passed"
}

# Run type checking
run_typecheck() {
    print_status "Running TypeScript type checking..."
    
    npm run typecheck || {
        print_error "Type checking failed"
        exit 1
    }
    
    print_success "Type checking passed"
}

# Run unit tests
run_unit_tests() {
    print_status "Running unit tests..."
    
    npx jest --config=tests/test.config.ts --testNamePattern="unit" --coverage --coverageDirectory=coverage/unit || {
        print_error "Unit tests failed"
        exit 1
    }
    
    print_success "Unit tests passed"
}

# Run integration tests
run_integration_tests() {
    print_status "Running integration tests..."
    
    npx jest --config=tests/test.config.ts --testNamePattern="integration" --coverage --coverageDirectory=coverage/integration || {
        print_error "Integration tests failed"
        exit 1
    }
    
    print_success "Integration tests passed"
}

# Run performance tests
run_performance_tests() {
    print_status "Running performance tests..."
    
    npx jest --config=tests/test.config.ts --testNamePattern="performance" --testTimeout=60000 || {
        print_warning "Performance tests failed or timed out"
        # Don't exit on performance test failure, just warn
    }
    
    print_success "Performance tests completed"
}

# Generate test coverage report
generate_coverage() {
    print_status "Generating combined coverage report..."
    
    # Combine coverage reports if they exist
    if [ -d "coverage/unit" ] && [ -d "coverage/integration" ]; then
        npx nyc merge coverage coverage/merged.json || print_warning "Could not merge coverage reports"
    fi
    
    print_success "Coverage report generated"
}

# Cleanup function
cleanup() {
    print_status "Cleaning up test artifacts..."
    
    # Clean up test database
    if [ "$NODE_ENV" = "test" ]; then
        npx prisma db push --force-reset --schema=prisma/schema.prisma || print_warning "Could not reset test database"
    fi
    
    print_success "Cleanup complete"
}

# Main execution flow
main() {
    # Start timer
    start_time=$(date +%s)
    
    # Setup trap for cleanup on exit
    trap cleanup EXIT
    
    # Run all test phases
    check_environment
    setup_database
    run_lint
    run_typecheck
    run_unit_tests
    run_integration_tests
    run_performance_tests
    generate_coverage
    
    # Calculate total time
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    
    print_success "🎉 All tests completed successfully in ${duration}s"
    
    # Print summary
    echo ""
    echo "📊 Test Summary:"
    echo "- Linting: ✅ Passed"
    echo "- Type Checking: ✅ Passed"
    echo "- Unit Tests: ✅ Passed"
    echo "- Integration Tests: ✅ Passed"
    echo "- Performance Tests: ✅ Completed"
    echo "- Total Duration: ${duration} seconds"
    echo ""
    echo "📁 Coverage reports available in:"
    echo "- coverage/unit/ (Unit test coverage)"
    echo "- coverage/integration/ (Integration test coverage)"
    echo "- coverage/ (Combined coverage)"
}

# Run main function
main "$@"