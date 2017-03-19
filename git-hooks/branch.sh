#!/bin/bash
# Stops accidental commits and pushes to master and develop. https://gist.github.com/stefansundin/9059706

BRANCH=`git rev-parse --abbrev-ref HEAD`

if [[ "$BRANCH" == "release/"* || "$BRANCH" == "develop" ]]; then
	tput setaf 1; printf "\n\nYou are on branch $BRANCH. Are you sure you want to commit to this branch?"
	printf "\nIf so, commit with -n to bypass this pre-commit hook.\n\n"
	exit 1
fi

exit 0