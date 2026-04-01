#!/bin/bash

# Usage: ./create_templates.sh <file_path> [optional_category]

INPUT_FILE="$1"
CATEGORY="${2:-Custom}"

if [ -z "$INPUT_FILE" ]; then
    echo "Usage: ./create_templates.sh <file_with_titles.txt> [category]"
    exit 1
fi

if [ ! -f .env.local ]; then
    echo "Error: .env.local file not found!"
    exit 1
fi

URL=$(grep "^NEXT_PUBLIC_SUPABASE_URL" .env.local | cut -d '=' -f2 | tr -d '"' | tr -d "'")
KEY=$(grep "^NEXT_PUBLIC_SUPABASE_ANON_KEY" .env.local | cut -d '=' -f2 | tr -d '"' | tr -d "'")

PROJECT_REF=$(echo $URL | sed 's/https:\/\///;s/\.supabase\.co//')
FUNCTION_URL="https://$PROJECT_REF.supabase.co/functions/v1/generate-templates"

echo "------------------------------------------------"
echo "Targeting Project: $PROJECT_REF"
echo "Category: $CATEGORY"
echo "Reading from: $INPUT_FILE"
echo "------------------------------------------------"

while IFS= read -r line || [ -n "$line" ]; do
    # Skip empty lines
    if [ -z "$line" ]; then continue; fi
    
    echo "Processing: $line"
    
    RESPONSE=$(curl -s -X POST "$FUNCTION_URL" \
      -H "Authorization: Bearer $KEY" \
      -H "Content-Type: application/json" \
      -d "{\"title\": \"$line\", \"category\": \"$CATEGORY\"}")
      
    echo "Result: $RESPONSE"
    echo "------------------------------------------------"
    # Sleep to avoid hammering the LLM API limits too hard
    sleep 2 
done < "$INPUT_FILE"

echo "Done."
