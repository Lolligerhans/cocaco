#!/bin/bash

################################################################################
# Info
################################################################################

# Explorer main runscript. See commands.sh for commands.

################################################################################
# Boilerplate
################################################################################

# Identical to set -euETo pipefail
# If a subcommand/source file is allowed to fail, reset +eu flags temporarily.
set -o errexit -o nounset -o errtrace -o functrace -o pipefail;
shopt -s inherit_errexit;

# Store arguments as string for logging before changing IFS
readonly -n script_args="${*}";

IFS=$'\n\t';

source ~/dotfiles/scripts/utils.sh; # Also used by error handling
source ~/dotfiles/scripts/error_handling.sh;
source ~/dotfiles/scripts/setargs.sh;

# Catch-all error handling that prints problems to stderr when something bad
# happens (requires set -e).
trap 'report_error "${?}" "${LINENO}" "${BASH_SOURCE}" "${BASH_COMMAND}"'\
  ERR INT ABRT KILL TERM HUP;

# Move to parent directory for behaviour independent of working directory
declare -gr caller_path="$(pwd -P)"
cd "$(dirname "${BASH_SOURCE}")";
declare -gr parent_path="$(pwd -P)"

# Log script entry and exit to stdout
function col() { if (($1)) ; then echo "$text_red"; else echo "$text_green"; fi; }
errcho "[$text_blue${text_bold}LOG${text_normal}] $text_dim· →$text_normal \$(${text_bold}$text_italic$0${text_normal} ${script_args}) $text_dim@ $text_italic$parent_path$text_normal";
trap 'ret="$?"; errcho "[$text_blue${text_bold}LOG${text_normal}] $(col "$ret")$text_bold$ret $text_dim←$text_normal \$(${text_bold}$text_italic$0${text_normal} ${script_args}) $text_dim@ $text_italic$parent_path$text_normal"'\
  EXIT;

################################################################################
# Constants
################################################################################

################################################################################
# Helpers
################################################################################

################################################################################
# Predefined commands
################################################################################

# Default command (when no arguments are given)
function command_default()
{
  echow "This action downloads third party JavaScript from the internet"
  ok="$(boolean_prompt "Continue?")"
  if [[ "$ok" == "n" ]]; then
    abort "Aborted by user"
  fi
  c install;
}

function command_debug()
{
  bash -vx "$0" "${@}";
}

# Print list of available commands
function command_print_commands()
{
  if [ "$#" -eq 0 ]; then
    declare -a all_commands=($(declare -F | sed -ne 's/^declare -f command_\(\w\+\)/\1/p'));
    echo "${all_commands[*]}";
  else
    # Replace \n in case the user has changed IFS
    command_print_commands | sed -e 's/ /\n/g' | grep --color=auto -e "$1" || true;
  fi
  return 0;
}

################################################################################
# Command dispatcher
################################################################################

# Custom commands
source commands.sh;

function c()
{
  # Call command from args
  if (( $# > 0 )); then
    "command_${1}" "${@:2}"; # Pass rest of the arguments to subcommand
  else
    command_default;
  fi
  return "$?";
}

c "${@}";
exit "$?";
