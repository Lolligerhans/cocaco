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
declare -gr dotfiles="${DOTFILES:-"./dotfiles-copy"}"; # TOKEN_DOTFILES_GLOBAL
# ☯ Every file prevents multi-loads itself using this global dict
declare -gA _sourced_files=( ["runscript"]="" ); # Source only once
# 🖈 If the runscript requires a specific location, set it here
#declare -gr this_location="";
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
declare -r doc_readme="doc/README"; # Grep this file for download links
# ╭──────────────────────╮
# │ ⌨  Commands          │
# ╰──────────────────────╯

# For testing/debugging
function command_clear()
{
  rm -vrf plotly/ statistics.js/;
  git submodule deinit --all;
  echok "Cleared repository";
}

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

command_download_js()
{
  set_args "--clear --help" "$@"
  eval "$get_args";

  declare plotly_path plotly_hash;
  plotly_path="$(sed -n -e 's/^\s*PLOTLY=//p' "${doc_readme}")";
  plotly_hash="$(sed -n -e 's/^\s*PLOTLY_HASH=//p' "${doc_readme}")";
  declare -r plotly_path plotly_hash plotly_dir="plotly/";

  if [[ "$clear" == "true" ]]; then
    rm -rv "$plotly_dir";
  fi

  if [[ -f "${plotly_dir}/$(basename "$plotly_path")" ]]; then
    echos "$(basename "$plotly_path") already exists";
  else
    wget --https-only -P "$plotly_dir/" -c "$plotly_path";
    echok "Downloaded $plotly_path";
  fi

  if ! sha256sum -c <<< "$plotly_hash"; then
    pushd "$plotly_dir";
    mv -v "$(basename "$plotly_path")" "$(basename "$plotly_path").bad";
    popd;
    errchoe "Downloaded ${text_user}${plotly_path}${text_normal} does not match expected checksum";
    abort "Failed to download $plotly_path";
  fi
}

command_install()
{
  set_args "--skip-download --clear --help" "$@";
  eval "$get_args";

  # Sanity checks
  if [[ "$(basename "$parent_path")" != "explorer" ]]; then
    errchow "This should be run from within the explorer directory";
    echou "You probably do not want to do this";
    choice="$(boolean_prompt "Download files to `pwd -P`?")";
    if [[ "$choice" == "n" ]]; then
      abort "Not installing";
    fi
  fi
  if [[ "$(git rev-parse --abbrev-ref HEAD)" != "master" ]]; then
    echow "Instaling: Not in master branch";
  fi
  if [[ "$(git status --porcelain)" != "" ]]; then
    echow "Installing: Uncommitted changes";
  fi

  # Make sure to have gitmodules loaded since it is easily forgotten
  git submodule update --init --recursive;

  # Validate git repository state
  declare fsck_output;
  fsck_output="$(git fsck --no-dangling)";
  if [[ ! -z "$fsck_output" ]]; then
    echon "Run 'git fsck' to diagnose, git gc --prune=now to clean";
    abort "Git repository corrupted";
  fi

  # Download additional JS dependencies
  if [[ "$skip_download" == "true" ]]; then
    echos "Downloading JS dependencies";
  else
    subcommand download_js "--clear=${clear}";
  fi

  declare -r g="${text_lightgreen}";
  declare -r b="${text_lightblue}";
  declare -r n="${text_normal}";
  declare -r d="${text_normal}${text_dim}";
  echo "$(cat <<- EOF
		┏━${n}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${n}┓
		┃ ${g}☑ Download dependencies                                                                    ${n}┃
		┃ ${b}☐ Install "explorer" extension temporarily [1]. Explained in [2].                          ${n}┃
		┃ ${b}☐ Activate the extension while browsing colonist.                                          ${n}┃
		┃ ${n}                                                                                           ${n}┃
		┃ ${d}[1] about:debugging#/runtime/this-firefox                                                  ${n}┃
		┃ ${d}[2] https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/ ${n}┃
		┗━${n}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${n}┛
		EOF
    )";
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
declare -r download_js_help_string="Download JS dependencies
DESCRIPTION
  Downloads plotly. Used by command 'install'.
OPTIONS
  --clear: Remove existing files before downloading.";
declare -r install_help_string="Prepare for use
DESCRIPTION
  Downloads submodules and standalone JS files. Outputs instructions for usage.
OPTIONS
  --clear: Pass --clear to subcommand download_js.
  --skip-download: Skip dependency download (just show message).";
declare -r pushall_help_string="Push branch to remotes
DESCRIPTION
  Push both origin and lolli remotes, each with and without --tags.
OPTIONS
  --force: Use git push --force";
declare -r symbold_help_string="Show symbols available in plotly";
# ╭──────────────────────╮
# │ ⚙ Boilerplate        │
# ╰──────────────────────╯
# ⌂ Transition to provided command
subcommand "${@}";
# ╭──────────────────────╮
# │ 🕮  Documentation     │
# ╰──────────────────────╯
