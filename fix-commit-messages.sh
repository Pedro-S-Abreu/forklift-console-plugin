#!/bin/bash

# Script to automatically add "Resolves: MTV-3470" to all commits in the branch
# This script will rebase all commits and add the Resolves line before Signed-off-by

set -e

TICKET="MTV-3470"
BASE_BRANCH="upstream/main"

echo "🔧 Fixing commit messages to add Resolves: $TICKET"
echo "📊 Base branch: $BASE_BRANCH"

# Count commits to fix
COMMIT_COUNT=$(git log --oneline $BASE_BRANCH..HEAD | wc -l | tr -d ' ')
echo "📝 Found $COMMIT_COUNT commits to fix"

if [ "$COMMIT_COUNT" -eq 0 ]; then
    echo "✅ No commits to fix!"
    exit 0
fi

# Backup current branch
CURRENT_BRANCH=$(git branch --show-current)
BACKUP_BRANCH="${CURRENT_BRANCH}-backup-$(date +%s)"
git branch "$BACKUP_BRANCH"
echo "💾 Created backup branch: $BACKUP_BRANCH"

# Create a temporary script for the rebase
TEMP_SCRIPT=$(mktemp)
cat > "$TEMP_SCRIPT" << 'SCRIPT_END'
#!/bin/bash

TICKET="MTV-3470"

# Get the current commit message
COMMIT_MSG=$(git log --format=%B -n 1 HEAD)

# Check if it already has a Resolves line
if echo "$COMMIT_MSG" | grep -q "^Resolves:"; then
    echo "✓ Commit already has Resolves line, skipping"
    exit 0
fi

# Check if this is a chore commit (those can have "Resolves: None")
if echo "$COMMIT_MSG" | grep -qiE "^chore:|^chore\("; then
    echo "✓ Chore commit detected, will add 'Resolves: None'"
    RESOLVES_LINE="Resolves: None"
else
    RESOLVES_LINE="Resolves: $TICKET"
fi

# Check if there's a Signed-off-by line
if echo "$COMMIT_MSG" | grep -q "^Signed-off-by:"; then
    # Add Resolves before Signed-off-by
    NEW_MSG=$(echo "$COMMIT_MSG" | awk -v resolves="$RESOLVES_LINE" '
        /^Signed-off-by:/ && !added {
            if (prev != "") print "";  # Add blank line if there was content before
            print resolves;
            print "";
            added=1;
        }
        { print; prev=$0; }
    ')
else
    # No Signed-off-by, just append at the end
    NEW_MSG="${COMMIT_MSG}

${RESOLVES_LINE}"
fi

# Amend the commit with the new message
echo "$NEW_MSG" | git commit --amend -F -

echo "✓ Added '$RESOLVES_LINE' to commit"
SCRIPT_END

chmod +x "$TEMP_SCRIPT"

echo ""
echo "🚀 Starting interactive rebase..."
echo "   This will automatically add 'Resolves: $TICKET' to all commits"
echo ""

# Use git rebase with exec to run our script on each commit
GIT_SEQUENCE_EDITOR="sed -i.bak '1,/^$/s/^pick /exec bash $TEMP_SCRIPT #/'" \
    git rebase -i --autosquash "$BASE_BRANCH"

# Actually, let's use a simpler approach with filter-branch
# Reverting to exec approach
git rebase -i "$BASE_BRANCH" --exec "bash $TEMP_SCRIPT"

echo ""
echo "✅ All commits fixed!"
echo ""
echo "🔍 Verify the changes with:"
echo "   git log --oneline -10"
echo "   git log -1  # Check last commit format"
echo ""
echo "💾 Original branch backed up to: $BACKUP_BRANCH"
echo ""
echo "🚀 If everything looks good, force push with:"
echo "   git push --force-with-lease origin $CURRENT_BRANCH"
echo ""
echo "🔄 If you need to restore the backup:"
echo "   git reset --hard $BACKUP_BRANCH"

# Cleanup
rm -f "$TEMP_SCRIPT"

