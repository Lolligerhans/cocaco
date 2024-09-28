# Cocaco dump

Native program used by the Cocaco extension to dump data to the file system. The
data is found in `~/.local/share/cocaco/data`.

## Manifest

The manifest is `cocaco_dump.json.template`. We edit the template file with `ed`
to generate the literal manifest used by Firefox. This is needed because we
install dump in `~/.local/share/cocaco/`, but Firefox wants an absolute path. We edit
the path based on `$ whoami`.

## Dump

Python script to dump data received from stdin to the file system. The expects
the specific format used by Firefox's native messaging for browser extensions.
