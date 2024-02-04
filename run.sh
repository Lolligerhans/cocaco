#!/usr/bin/env bash
# ╭──────────────────────╮
# │ 🅅 ersion             │
# ╰──────────────────────╯
# version 0.0.0
# ╭──────────────────────╮
# │ 🛈 Info               │
# ╰──────────────────────╯
# Explorer runscript.
#
#     ./run.sh help
# ╭──────────────────────╮
# │ ⚙ Boilerplate        │
# ╰──────────────────────╯
declare -gr dotfiles="${DOTFILES:-"$HOME/dotfiles"}"; # TOKEN_DOTFILES_GLOBAL
# 📎 TODO Remove one no longer needed
declare -gr suppress_optionals_warning="true";
# ☯ Every file prevents multi-loads itself using this global dict
declare -gA _sourced_files=( ["runscript"]="" ); # Source only once
# 🖈 If the runscript requires a specific location, set it here
#declare -gr this_location="";
source "$dotfiles/scripts/boilerplate.sh" "${BASH_SOURCE[0]}" "$@";
# ✔ Ensure important boilerplate is present
satisfy_version "$dotfiles/scripts/boilerplate.sh" "0.0.0";
# ╭──────────────────────╮
# │ 🛠Configuration      │
# ╰──────────────────────╯
#_run_config["versioning"]=0;
#_run_config["log_loads"]=1;
#_run_config["error_frames"]=2;
# ╭──────────────────────╮
# │ 🗀 Dependencies       │
# ╰──────────────────────╯
# Ensure versions even if included already
load_version "$dotfiles/scripts/version.sh" "0.0.0";
load_version "$dotfiles/scripts/fileinteracts.sh" "0.2.0";
load_version "$dotfiles/scripts/setargs.sh" "0.0.0";
load_version "$dotfiles/scripts/termcap.sh" "0.0.0";
load_version "$dotfiles/scripts/userinteracts.sh" "0.1.0";
load_version "$dotfiles/scripts/utils.sh" "3.0.1";
# ╭──────────────────────╮
# │ 🗺 Globals           │
# ╰──────────────────────╯
# ╭──────────────────────╮
# │ ⌨  Commands          │
# ╰──────────────────────╯

function command_default()
{
  echow "This action downloads third party JavaScript from the internet"
  ok="$(boolean_prompt "Continue?")"
  if [[ "$ok" == "n" ]]; then
    abort "Aborted by user"
  fi
  subcommand install;
}

command_install()
{
  set_args "--skip-download --help" "$@"
  eval "$get_args";

  # Sanity check
  if [[ "$(basename "$parent_path")" != "explorer" ]]; then
    errchow "This should be run from within the explorer directory"
    choice="$(boolean_prompt "Download files to `pwd -P`?")"
    if [[ "$choice" == "n" ]]; then abort "Not installing"; fi
  fi

  # Download additional JS dependencies
  if [[ "$skip_download" == "true" ]]; then
    subcommand download_js "$@"
  else
    errchol "Skip: Downloading JS dependencies"
  fi

  echo "$(cat << EOF
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ ✓ Download dependencies                                                                    ┃
┃ · Install "explorer" extension temporarily [1]. Explained in [2].                          ┃
┃ · Activate the extension while browsing colonist.                                          ┃
┃                                                                                            ┃
┃ [1] about:debugging#/runtime/this-firefox                                                  ┃
┃ [2] https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/ ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
EOF
  )"
}

command_download_js()
{
  set_args "--clear --help" "$@"
  eval "$get_args";

  declare -r plotly_path="$(sed -n -e 's/^\s*PLOTLY=//p' doc/README)"
  declare -r stats_path="$(sed -n -e 's/^\s*STATS=//p' doc/README)"
  declare -r stats_dir="statistics.js";

  ensure_directory "$stats_dir"

  if [[ "$clear" == "true" ]]; then
    rm -v "$(basename "$plotly_path")";
    rm -v "$stats_dir/$(basename "$stats_path")";
  fi

  wget -c "$plotly_path"
  wget -P "$stats_dir" -c "$stats_path"
  #wait $(jobs -rp);
  echok "Downloaded $plotly_path and $stats_path"
}

command_pushall()
{
  set_args "--force" "$@"
  eval "$get_args";

  declare force_flag="";
  if [[ "$force" == "true" ]]; then
    force_flag="--force";
  fi

  command git s || errchow "Could not display commits";
  declare choice;
  choice="$(boolean_prompt "Are you sure you want to $force_flag PUSH EVERYTHING?")"
  [[ "$choice" == "n" ]] && abort "Abort: No changes"
  git push $force_flag origin &&
  git push $force_flag origin --tags &&
  git push $force_flag lolli &&
  git push $force_flag lolli --tags
}

command_symbols()
{
  set_args "--help" "$@";
  eval "$get_args";

  python3 symbols.py;
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
declare -r install_help_string="Prepare for use
DESCRIPTION
  Downloads dependent JS files and outputs usage explanation.
OPTIONS
  --skip-download: Skip dependency download (just show message).";
declare -r download_js_help_string="Download Js dependencies
DESCRIPTION
  Used by command 'install'.
OPTIONS
  --clear: Remove existing files before downloading.";
declare -r symbold_help_string="Show symbols available in plotly";
# ╭──────────────────────╮
# │ ⚙ Boilerplate        │
# ╰──────────────────────╯
# ⌂ Transition to provided command
subcommand "${@}";
# ╭──────────────────────╮
# │ 🕮  Documentation     │
# ╰──────────────────────╯
