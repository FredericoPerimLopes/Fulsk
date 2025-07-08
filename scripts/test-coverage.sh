#!/bin/bash

# Coverage analysis and reporting script

set -e

echo "📊 Generating comprehensive test coverage report"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_info() {
    echo -e "${BLUE}[COVERAGE]${NC} $1"
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

# Clean previous coverage data
clean_coverage() {
    print_info "Cleaning previous coverage data..."
    rm -rf coverage/
    mkdir -p coverage
    print_success "Coverage directory cleaned"
}

# Run tests with coverage
run_coverage_tests() {
    print_info "Running tests with coverage collection..."
    
    # Load test environment
    if [ -f ".env.test" ]; then
        export $(cat .env.test | xargs)
    fi
    
    # Run all tests with coverage
    npx jest --config=tests/test.config.ts --coverage --coverageDirectory=coverage --watchAll=false || {
        print_error "Tests failed during coverage collection"
        exit 1
    }
    
    print_success "Coverage collection completed"
}

# Analyze coverage thresholds
analyze_coverage() {
    print_info "Analyzing coverage thresholds..."
    
    if [ -f "coverage/coverage-summary.json" ]; then
        # Check if coverage meets thresholds
        node -e "
            const fs = require('fs');
            const coverage = JSON.parse(fs.readFileSync('coverage/coverage-summary.json', 'utf8'));
            const total = coverage.total;
            
            const thresholds = {
                statements: 70,
                branches: 70,
                functions: 70,
                lines: 70
            };
            
            let failed = false;
            
            console.log('\n📈 Coverage Summary:');
            console.log('==================');
            
            Object.keys(thresholds).forEach(key => {
                const actual = total[key].pct;
                const threshold = thresholds[key];
                const status = actual >= threshold ? '✅' : '❌';
                
                if (actual < threshold) failed = true;
                
                console.log(\`\${status} \${key.padEnd(12)}: \${actual.toFixed(1)}% (threshold: \${threshold}%)\`);
            });
            
            console.log('==================\n');
            
            if (failed) {
                console.error('❌ Coverage thresholds not met!');
                process.exit(1);
            } else {
                console.log('✅ All coverage thresholds met!');
            }
        " || {
            print_error "Coverage analysis failed"
            exit 1
        }
    else
        print_warning "Coverage summary not found"
    fi
}

# Generate detailed reports
generate_reports() {
    print_info "Generating detailed coverage reports..."
    
    # Generate HTML report
    if [ -d "coverage" ]; then
        print_success "HTML coverage report available at: coverage/lcov-report/index.html"
        
        # Generate badge data
        if [ -f "coverage/coverage-summary.json" ]; then
            node -e "
                const fs = require('fs');
                const coverage = JSON.parse(fs.readFileSync('coverage/coverage-summary.json', 'utf8'));
                const statements = coverage.total.statements.pct;
                
                let color = 'red';
                if (statements >= 80) color = 'brightgreen';
                else if (statements >= 70) color = 'yellow';
                else if (statements >= 60) color = 'orange';
                
                const badge = {
                    schemaVersion: 1,
                    label: 'coverage',
                    message: statements.toFixed(1) + '%',
                    color: color
                };
                
                fs.writeFileSync('coverage/badge.json', JSON.stringify(badge, null, 2));
                console.log('📛 Coverage badge data generated');
            "
        fi
    fi
    
    print_success "Report generation completed"
}

# Show coverage summary
show_summary() {
    print_info "Coverage Summary:"
    echo ""
    
    if [ -f "coverage/lcov.info" ]; then
        # Count total files and covered files
        total_files=$(grep -c "^SF:" coverage/lcov.info || echo "0")
        
        echo "📁 Total files analyzed: $total_files"
        echo "📊 Detailed report: coverage/lcov-report/index.html"
        echo "📈 JSON summary: coverage/coverage-summary.json"
        echo "📛 Badge data: coverage/badge.json"
        echo ""
        
        # Show uncovered files
        print_info "Files with low coverage (< 70%):"
        node -e "
            const fs = require('fs');
            if (fs.existsSync('coverage/coverage-summary.json')) {
                const coverage = JSON.parse(fs.readFileSync('coverage/coverage-summary.json', 'utf8'));
                
                Object.keys(coverage).forEach(file => {
                    if (file !== 'total' && coverage[file].statements.pct < 70) {
                        console.log(\`  ⚠️  \${file}: \${coverage[file].statements.pct.toFixed(1)}%\`);
                    }
                });
            }
        " || echo "  ✅ All files meet coverage threshold"
        
    else
        print_warning "LCOV report not found"
    fi
}

# Main execution
main() {
    clean_coverage
    run_coverage_tests
    analyze_coverage
    generate_reports
    show_summary
    
    print_success "Coverage analysis complete!"
    echo ""
    echo "🌐 Open coverage/lcov-report/index.html in your browser to view detailed coverage"
}

main "$@"