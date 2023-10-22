#!/usr/bin/false

# See: run.sh

command_install()
{
  declare do_download="true"
  set_args "--skip-download" "$@"
  [[ -v __skip_download ]] && do_download="false"
  unset_args

  # Sanity check
  if [[ "$(basename "$parent_path")" != "explorer" ]]; then
    errchow "This should be run from within the explorer directory"
    choice="$(boolean_prompt "Download files to `pwd -P`?")"
    if [[ "$choice" == "n" ]]; then abort "Not installing"; fi
  fi

  # Download additional JS dependencies
  if [[ "$do_download" == "true" ]]; then
    c download_js "$@"
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
  declare clearf="false"
  set_args "--clear" "$@"
  [[ -v __clear ]] && clearf="true"
  unset_args
  declare -r plotly_path="$(sed -n -e 's/^\s*PLOTLY=//p' doc/README)"
  declare -r stats_path="$(sed -n -e 's/^\s*STATS=//p' doc/README)"
  declare -r stats_dir="statistics.js";

  ensure_directory "$stats_dir"

  if [[ "$clearf" == true ]]; then
    rm -v "$(basename "$plotly_path")";
    rm -v "$stats_dir/$(basename "$stats_path")";
  fi

  wget -c "$plotly_path"
  wget -P "$stats_dir" -c "$stats_path"
  #wait $(jobs -rp);
  echol "Done downloading $plotly_path and $stats_path"
}

command_pushall()
{
  declare force=""
  set_args "--force" "$@"
  [[ -v __force ]] && force="--force"
  unset_args

  choice="$(boolean_prompt "Are you sure you want to $force PUSH EVERYTHING?")"
  [[ "$choice" == "n" ]] && abort "Abort: No changes"
  git push $force origin &&
  git push $force origin --tags &&
  git push $force lolli &&
  git push $force lolli --tags
}
