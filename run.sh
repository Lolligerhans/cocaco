#!/usr/bin/env bash
# ╭──────────────────────╮
# │ 🅅 ersion             │
# ╰──────────────────────╯
# version 0.1.0
# ╭──────────────────────╮
# │ 🛈 Info               │
# ╰──────────────────────╯
# Cocaco runscript.
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
_run_config["error_frames"]=1;
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
# We put our local game dumps
declare -r share_dir="$HOME/.local/share/cocaco/";
declare -r dump_data_dir="$share_dir/data";
# ╭──────────────────────╮
# │ ⌨  Commands          │
# ╰──────────────────────╯

command_default()
{
  default_delegate "$@";
}

command_serve() {
  # Recurse once setting --now to use the exit-logging of the runscript when
  # stopping to serve, but also run in the background to return immediately.
  set_args "--now" "$@";
  eval "$get_args";

  if [[ "$now" == "false" ]]; then
    # subcommand serve --now &
    echon "file://${HOME}/github/cocaco/html/sidebar.html";
    return;
  fi

  if ! 2>/dev/null python3 -m http.server -d html/sidebar.html; then
    echoe "Failed to start server. Already serving?";
  fi
}

command_game()
{
  declare most_recent;
  most_recent="$({ command ls -A -t "$dump_data_dir/"*".json" || [[ "$?" == "141" ]]; } | head -1)";
  show_variable most_recent;
  [[ "$most_recent" == *" "* ]] && abort "Filename must not contain spaces";

  set_args "--help --file=${most_recent} --no-format --list" "$@";
  eval "$get_args";

  if [[ "$list" == "true" ]]; then
    command ls --color=auto -Fh -A -ltr "$dump_data_dir/"*".json";
    command du -h "$dump_data_dir";
    return 0;
  fi

  ensure_jq;

  # Copy to temporary location
  declare tmp_dir;
  if [[ "$no_format" == "true" ]]; then
    tmp_dir="/tmp/cocaco_raw/";
  else
    tmp_dir="/tmp/cocaco_unwrapped";
  fi
  declare base;
  base="$(basename "$file")";
  declare -r tmp_dir file_unwrapped="$tmp_dir/$base";
  ensure_directory "$tmp_dir";
  show_variable file;
  show_variable file_unwrapped;

  # Format file if needed
  if [[ ! -f "$file_unwrapped" ]]; then
    echol "Unwrapping...";
    pushd "$dump_data_dir" || return;
    declare line;
    declare cmd="jq";
    if [[ "$no_format" == "true" ]]; then
      cmd="cat";
    fi
    while read -r line; do
      command "$cmd" <<< "$line";
    done < "$file" >> "$file_unwrapped";
    popd || return;
  else
    echos "Already present";
  fi

  command nvim -u NONE -U NONE -N -i NONE "$file_unwrapped";
  #command batcat -l json;
}

command_version()
{
  set_args "--help" "$@";
  eval "$get_args";

  declare version="";
  version="$(current_version)";
  echo "${text_bo}[🥥]${text_normal} $version";
}

command_provide_manifest()
{
  generate_dump_manifest;

  declare -r manifest_dir="$HOME/.mozilla/native-messaging-hosts";
  declare -r manifest_name="cocaco_dump.json";
  declare -r manifest_path="$manifest_dir/$manifest_name";
  ensure_directory "$manifest_dir";
  [[ -f "dump/$manifest_name" ]];
  command ln -vfs -t "$manifest_dir" "$parent_path/dump/$manifest_name" || true;
  [[ -f "$manifest_path" ]];

  declare -r program_dir="$HOME/.local/share/cocaco";
  declare -r program_name="cocaco_dump.py";
  ensure_directory "$program_dir";
  ensure_directory "$program_dir/data";
  command ln -vfs -t "$program_dir" "$parent_path/dump/$program_name" || true;

  echok "Provided cocaco dump manifest and program";
}

command_check()
{
  set_args "--help" "$@";
  eval "$get_args";

  # Sanity checks
  if [[ "$(basename "$parent_path")" != cocaco* ]]; then
    abort "This should be run from within the cocaco directory";
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
  declare tag;
  version="$(current_version)";
  tag="$(get_tag_name "$version")";
  echot "Did not test new tag creation and push yet";
  choice="$(boolean_prompt "Release ${text_user}${force_flag}${text_normal} ${version}?")";
  if [[ "$choice" == "n" ]]; then
    abort "Abort: No changes";
  fi

  add_git_tag --version="${version}" --force="$force";
  command git push $force_flag origin &&
  command git push $force_flag origin "$tag" &&
  command git push $force_flag lolli &&
  command git push $force_flag lolli "$tag";
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
  echou "To uninstall, delete the 'cocaco' directory";
  echon "rm -r '${parent_path_coloured}'";
}

# ╭──────────────────────╮
# │ 🖩 Utils              │
# ╰──────────────────────╯
default_delegate()
{
  echou "Execute '$0 install' to install the cocaco extension";
  ok="$(boolean_prompt "Execute now?")"
  if [[ "$ok" == "n" ]]; then
    subcommand help;
    abort "Aborted by user"
  fi
  subcommand install;
}
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
  tag_name="$(get_tag_name "$version_str")";
  command git tag $force_flag "$tag_name";
  echok "git tag $force_flag $tag_name";
}

get_tag_name() {
  # @param $1: Version string
  # @output: Tag name
  if (( "$#" != 1 )); then
    abort "Must have exactly one argument";
  fi
  printf -- "%s" "v${1}";
}

# Prints currently present (raw) value for 'version' in manifest.json
current_version()
{
  ensure_jq;

  declare version;
  version="$(jq -r .version manifest.json)";
  printf -- "%s" "${version}";
}

generate_dump_manifest()
{
  pushd dump || return;
  sed -e "s|HOME_DIR_PLACEHOLDER|${HOME}|" \
    cocaco_dump.json.template \
    > cocaco_dump.json;
  popd || reuturn;
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

sanity_check_version_loose() {
  # This function prints errors when finding obviously misconfigured versions.
  # Not a thorough version check.

  declare tag version expected tag;
  tag="$(git tag --points-at HEAD)";
  version="$(current_version)";
  expected_tag="$(get_tag_name "$version")";
  declare -r tag version expected tag;
  1>&2 show_variable version;

  # if [[ "$(is_clean_master 2>/dev/null )" != "true" ]]; then
  #   return;
  # fi

  # During development, set -dev version
  if [[ "$tag" == "" && "$version" != *"dev"* ]]; then
    errchoe "Forgot to set to dev version?";
  fi

  # If we have a tag, it should match the manifest version
  if [[ "$tag" == v* ]]; then
    if [[ "$tag" != "$expected_tag" ]]; then
      errchoe "Unexpected version tag";
      show_variable tag;
      show_variable expected_tag;
    fi
  fi
}

ensure_jq() {
  if ! &>/dev/null command jq --version; then
    echol "Installing 'jq'";
    sudo apt install jq;
  fi
  if ! &>/dev/null command jq --version; then
    abort "Unable to install 'jq'";
    return 1;
  fi
}
# ╭──────────────────────╮
# │ 🖹 Help strings       │
# ╰──────────────────────╯
declare -r game_help_string="Show dumped game
SYNOPSIS
  game
  game --file=filename
DESCRIPTION
  Show one of the games dumped by cocaco, in JSON format.
  In the first form, show the most recent dump.
  In the second form, show the specified file.
  The filename is relative to '$share_dir/dump/'.
OPTIONS
  --file=FILENAME: Show dump/FILENAME. By default, show the most recent dump.
  --no-format: Do not format with jq when showing a file.
  --list: List available files instead of showing one.";
declare -r version_help_string="Show extension verison";
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
sanity_check_version_loose;
# ⌂ Transition to provided command
subcommand "${@}";
# ╭──────────────────────╮
# │ 🕮  Documentation     │
# ╰──────────────────────╯
