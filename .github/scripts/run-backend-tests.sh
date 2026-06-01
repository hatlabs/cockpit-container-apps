#!/bin/bash
# Run backend tests in Docker container
# Checks for test pass/fail in output

# Disable exit on error to allow capturing output and checking results
set +e

output=$(cd backend && ./run test 2>&1)
echo "$output"

# Re-enable exit on error for final exit code
set -e

if echo "$output" | grep -q "passed" && ! echo "$output" | grep -q "failed"; then
  echo "✅ All backend tests passed"
  exit 0
else
  echo "❌ Backend tests failed"
  exit 1
fi
