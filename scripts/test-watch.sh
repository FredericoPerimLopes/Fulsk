#!/bin/bash

# Watch mode test runner for development
# Runs tests automatically when files change

set -e

echo "👀 Starting test watch mode for Fulsk Backend"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${BLUE}[WATCH]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Setup test environment
setup_test_env() {
    print_info "Setting up test environment..."
    
    # Load test environment variables
    if [ -f ".env.test" ]; then
        export $(cat .env.test | xargs)
    fi
    
    # Ensure test database is ready
    npx prisma migrate deploy || {
        print_warning "Could not run migrations, continuing anyway..."
    }
    
    print_success "Test environment ready"
}

# Run specific test type based on argument
run_tests() {
    local test_type=${1:-"unit"}
    
    case $test_type in
        "unit")
            print_info "Running unit tests in watch mode..."
            npx jest --config=tests/test.config.ts --testNamePattern="unit" --watch --watchAll=false
            ;;
        "integration")
            print_info "Running integration tests in watch mode..."
            npx jest --config=tests/test.config.ts --testNamePattern="integration" --watch --watchAll=false
            ;;
        "all")
            print_info "Running all tests in watch mode..."
            npx jest --config=tests/test.config.ts --watch --watchAll=false
            ;;
        *)
            print_warning "Unknown test type: $test_type"
            print_info "Available options: unit, integration, all"
            exit 1
            ;;
    esac
}

# Main execution
main() {
    setup_test_env
    
    echo ""
    echo "🔍 Test Watch Mode Commands:"
    echo "- Press 'a' to run all tests"
    echo "- Press 'f' to run only failed tests"
    echo "- Press 'p' to filter by file name pattern"
    echo "- Press 't' to filter by test name pattern"
    echo "- Press 'q' to quit"
    echo ""
    
    run_tests "${1:-unit}"
}

main "$@"