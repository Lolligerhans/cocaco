#!/usr/bin/env bash
# ╭──────────────────────╮
# │ 🅅 ersion             │
# ╰──────────────────────╯
# version 0.1.0
# ╭──────────────────────╮
# │ 🛈 Info               │
# ╰──────────────────────╯
# Explorer runscript.
# ╭──────────────────────╮
# │ ⚙ Boilerplate        │
# ╰──────────────────────╯
# shellcheck disable=SC2154,SC2034
declare -gr dotfiles="${DOTFILES:-"./dependencies/dotfiles-copy"}"; # TOKEN_DOTFILES_GLOBAL
# ☯ Every file prevents multi-loads itself using this global dict
declare -gA _sourced_files=( ["runscript"]="" ); # Source only once
# 🖈 If the runscript requires a specific location, set it here
#declare -gr this_location="";
# shellcheck source=dependencies/dotfiles-copy/scripts/boilerplate.sh
source "$dotfiles/scripts/boilerplate.sh" "${BASH_SOURCE[0]}" "$@";
# ╭──────────────────────╮
# │ 🛠Configuration      │
# ╰──────────────────────╯
_run_config["versioning"]=0;
_run_config["log_loads"]=0;
#_run_config["error_frames"]=2;
# ╭──────────────────────╮
# │ 🗀 Dependencies       │
# ╰──────────────────────╯
# ✔ Ensure important boilerplate is present
satisfy_version "$dotfiles/scripts/boilerplate.sh" "0.0.0";
# Ensure versions even if included already
load_version "$dotfiles/scripts/version.sh" "0.0.0";
load_version "$dotfiles/scripts/fileinteracts.sh" "0.0.0";
load_version "$dotfiles/scripts/setargs.sh" "0.0.0";
load_version "$dotfiles/scripts/termcap.sh" "0.0.0";
load_version "$dotfiles/scripts/userinteracts.sh" "0.0.0";
load_version "$dotfiles/scripts/utils.sh" "0.0.0";
# ╭──────────────────────╮
# │ 🗺 Globals           │
# ╰──────────────────────╯
# ╭──────────────────────╮
# │ ⌨  Commands          │
# ╰──────────────────────╯

function command_default()
{
  echou "Execute '$0 install' to install the explorer extension";
  ok="$(boolean_prompt "Execute now?")"
  if [[ "$ok" == "n" ]]; then
    subcommand help;
    abort "Aborted by user"
  fi

  subcommand install;
}

command_check()
{
  set_args "--help" "$@";
  eval "$get_args";

  # Sanity checks
  if [[ "$(basename "$parent_path")" != explorer* ]]; then
    abort "This should be run from within the explorer directory";
  fi
  if [[ "$(git rev-parse --abbrev-ref HEAD)" != "master" ]]; then
    echow "Check: Not in master branch";
  fi
  if [[ "$(git status --porcelain)" != "" ]]; then
    echow "Check: Uncommitted changes";
  fi

  git submodule update --init --recursive;

  # Validate git repository state
  declare fsck_output;
  fsck_output="$(git fsck --no-dangling)";
  if [[ -n "$fsck_output" ]]; then
    echon "Run 'git fsck' to diagnose, git gc --prune=now to clean";
    abort "Git repository corrupted";
  fi

  echok "All good.";
}

command_pushall()
{
  set_args "--force --help" "$@"
  eval "$get_args";

  declare force_flag="";
  if [[ "$force" == "true" ]]; then
    force_flag="--force";
  fi

  command git s || errchow "Could not display commits";
  declare choice;
  choice="$(boolean_prompt "Are you sure you want to $force_flag PUSH EVERYTHING?")"
  [[ "$choice" == "n" ]] && abort "Abort: No changes";
  git push $force_flag origin &&
  git push $force_flag origin --tags &&
  git push $force_flag lolli &&
  git push $force_flag lolli --tags;
}

command_symbols()
{
  set_args "--help" "$@";
  eval "$get_args";

  python3 symbols.py;
}

command_uninstall()
{
  echou "To uninstall, delete the 'explorer' directory";
  echon "rm -r '${parent_path_coloured}'";
}

# ╭──────────────────────╮
# │ 🖩 Utils              │
# ╰──────────────────────╯
# ╭──────────────────────╮
# │ 𝑓 Functional         │
# ╰──────────────────────╯
# ╭──────────────────────╮
# │ 🖹 Help strings       │
# ╰──────────────────────╯
declare -r check_help_string="Verify files";
declare -r pushall_help_string="Push branch to remotes
DESCRIPTION
  Push both origin and lolli remotes, each with and without --tags.
OPTIONS
  --force: Use git push --force";
declare -r symbols_help_string="Show symbols available in plotly";
# ╭──────────────────────╮
# │ ⚙ Boilerplate        │
# ╰──────────────────────╯
# ⌂ Transition to provided command
subcommand "${@}";
# ╭──────────────────────╮
# │ 🕮  Documentation     │
# ╰──────────────────────╯
