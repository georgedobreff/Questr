#!/bin/bash

# 2. Load credentials from .env.local
if [ ! -f .env.local ]; then
    echo "Error: .env.local file not found!"
    exit 1
fi

URL=$(grep "^NEXT_PUBLIC_SUPABASE_URL" .env.local | cut -d '=' -f2 | tr -d '"' | tr -d "'")
KEY=$(grep "^NEXT_PUBLIC_SUPABASE_ANON_KEY" .env.local | cut -d '=' -f2 | tr -d '"' | tr -d "'")

if [ -z "$URL" ] || [ -z "$KEY" ]; then
    echo "Error: Could not parse NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY from .env.local"
    exit 1
fi

# Extract Project Ref from URL (e.g., https://xyz.supabase.co -> xyz)
PROJECT_REF=$(echo $URL | sed 's/https:\/\///;s/\.supabase\.co//')
FUNCTION_URL="https://$PROJECT_REF.supabase.co/functions/v1/populate-templates"

echo "------------------------------------------------"
echo "Targeting Project: $PROJECT_REF"
echo "Function URL: $FUNCTION_URL"
echo "------------------------------------------------"

# 3. Run the population loop
while true; do
  echo "Requesting next module population..."
  
  echo "Sending request (waiting for response)..."
  RESPONSE=$(curl -s --max-time 90 -X POST "$FUNCTION_URL" \
    -H "Authorization: Bearer $KEY" \
    -H "Content-Type: application/json")
  
  echo "Response: $RESPONSE"
  
  # Check for completion
  if echo "$RESPONSE" | grep -q '"status":"completed"'; then
    echo "------------------------------------------------"
    echo "✅ SUCCESS: All templates are fully populated!"
    break
  fi

  # Check for errors (simple check)
  if echo "$RESPONSE" | grep -q '"error"'; then
    echo "------------------------------------------------"
    echo "❌ ERROR: The function returned an error. Stopping script."
    break
  fi

  sleep 1
done
