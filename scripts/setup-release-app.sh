#!/usr/bin/env bash
#
# Stores the credentials of the GitHub App that release-please authenticates as.
#
# Run it once, after registering the App and downloading its private key:
#
#   bash scripts/setup-release-app.sh <app-id> ~/Downloads/battlezone-release.*.pem
#
# The key is read from the file and handed to gh over stdin, so it never lands in
# a shell history, a terminal transcript or a chat log. Delete the .pem afterwards;
# a new one can always be generated, and the old one should not outlive its use.
#
set -euo pipefail

REPOSITORY="CodingSteve01/battlezone"

app_id="${1:-}"
key_path="${2:-}"

if [[ -z "$app_id" || -z "$key_path" ]]; then
    echo "usage: $0 <app-id> <path-to-private-key.pem>" >&2
    exit 64
fi

if [[ ! "$app_id" =~ ^[0-9]+$ ]]; then
    echo "The app id is the numeric ID on the App's settings page, not its name." >&2
    exit 64
fi

if [[ ! -f "$key_path" ]]; then
    echo "No such file: $key_path" >&2
    exit 66
fi

if ! grep -q "BEGIN.*PRIVATE KEY" "$key_path"; then
    echo "$key_path does not look like a PEM private key." >&2
    exit 65
fi

gh variable set RELEASE_APP_ID --repo "$REPOSITORY" --body "$app_id"
gh secret set RELEASE_APP_PRIVATE_KEY --repo "$REPOSITORY" < "$key_path"

echo
echo "Stored for $REPOSITORY:"
gh variable list --repo "$REPOSITORY" | grep RELEASE_APP_ID
gh secret list --repo "$REPOSITORY" | grep RELEASE_APP_PRIVATE_KEY
echo
echo "The next push to main mints a token from the App instead of GITHUB_TOKEN."
echo "Now delete the key file:  rm '$key_path'"
