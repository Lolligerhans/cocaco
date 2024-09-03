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
declare -gr dotfiles="${DOTFILES:-"$HOME/dotfiles"}"; # TOKEN_DOTFILES_GLOBAL
# ☯ Every file prevents multi-loads itself using this global dict
declare -gA _sourced_files=( ["runscript"]="" ); # Source only once
# 🖈 If the runscript requires a specific location, set it here
#declare -gr this_location="";
# HACK: Depends on location
# shellcheck source=../../dotfiles/scripts/boilerplate.sh
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
load_version "$dotfiles/scripts/bash_meta.sh" "0.0.0";
load_version "$dotfiles/scripts/fileinteracts.sh" "0.0.0";
load_version "$dotfiles/scripts/git_utils.sh" 0.0.0;
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

command_default()
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

command_release()
{
  set_args "--force --help" "$@"
  eval "$get_args";

  declare force_flag="";
  if [[ "$force" == "true" ]]; then
    force_flag="--force";
  fi

  # Sanity check
  if [[ "$(is_clean_master)" != "true" ]]; then
    abort "Must be clean master";
  fi

  command git s || errchow "Could not display commits";

  declare choice;
  declare version;
  version="$(current_version)";
  choice="$(boolean_prompt "Release ${text_user}${force_flag}${text_normal} ${version}?")";
  if [[ "$choice" == "n" ]]; then
    abort "Abort: No changes";
  fi

  add_git_tag --version="${version}" --force="$force";
  command git push $force_flag origin &&
  command git push $force_flag origin --tags &&
  command git push $force_flag lolli &&
  command git push $force_flag lolli --tags;
  echok "Released ${version}";
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

add_git_tag()
{
  set_args "--force --version" "$@";
  eval "$get_args";

  declare force_flag="";
  if [[ "$force" == "true" ]]; then
    force_flag="--force";
  fi

  declare version_str="";
  if [[ "$version" != "false" ]]; then
    version_str="$version";
  else
    version_str="$(current_version)";
  fi

  declare tag_name;
  tag_name="v${version_str}";
  command git tag $force_flag "$tag_name";
  echok "git tag $force_flag $tag_name";
}

# Pritns currently present (raw) value for 'version' in manifest.json
current_version()
{
  declare version;
  version="$(jq -r .version manifest.json)";
  printf -- "%s" "${version}";
}

# Prints "false" or "true"
is_clean_master()
{
  declare current_branch clean;
  current_branch="$(git_current_branch)";
  git_is_clean clean;
  if [[ "$current_branch" != "master"  || "$clean" != "y" ]]; then
    >&2 show_variable current_branch;
    >&2 show_variable clean;
    printf -- "false";
  else
    printf -- "true";
  fi
}
# ╭──────────────────────╮
# │ 🖹 Help strings       │
# ╰──────────────────────╯
declare -r check_help_string="Verify files with git-fsck";
declare -r release_help_string="Release HEAD->master
DESCRIPTION
  Create version tag. Push remotes. Push tags.
OPTIONS
  --force: Use --force for 'git tag' and 'git push'.";
declare -r symbols_help_string="Show symbols available in plotly";
# ╭──────────────────────╮
# │ ⚙ Boilerplate        │
# ╰──────────────────────╯
# ⌂ Transition to provided command
subcommand "${@}";
# ╭──────────────────────╮
# │ 🕮  Documentation     │
# ╰──────────────────────╯
