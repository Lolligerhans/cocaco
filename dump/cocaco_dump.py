#!/usr/bin/env -S python3 -u

# For input
import json
import os
import struct
import sys

# For output
import atexit
import datetime
import time
import signal
import typing

class DoneException(Exception):
    pass
class TerminatedException(Exception):
    pass

# Determined by extension
dump_id = None

def log(args):
    """Abuse for debugging"""
    sys.stderr.write(f"cocaco_dump.py [{dump_id if dump_id != None else ""}]: {args}\n")

message_count: int = 0
ack_time = 0
def acknowledge():
    """After every 60s, respond to the next message."""
    global message_count
    message_count += 1

    now = time.time()
    global ack_time
    if now > ack_time:
        message = { "id": dump_id, "ack": message_count }
        sendMessage(encodeMessage(message))
        log(message)
        ack_time = now + 120

# TODO: How to tell correct from incorrect exit? Make sure file is closed?
def handle_signal(*_):
    log(f"Termination signal.\n")
    raise TerminatedException("Termination signal")
def handle_exit(*_):
    log(f"Exiting {dump_id}")
signal.signal(signal.SIGTERM, handle_signal)
signal.signal(signal.SIGINT, handle_signal)
atexit.register(handle_exit)

# ╭────────────────────────────────────────────────────────────────────────────╮
# │ Input                                                                      │
# ╰────────────────────────────────────────────────────────────────────────────╯

# Read a message from stdin and decode it.
# @returns: [parsed_message, json_string]
def getMessage():
    rawLength = sys.stdin.buffer.read(4)
    if len(rawLength) == 0:
        raise DoneException("No more input")
    messageLength = struct.unpack('@I', rawLength)[0]
    message = sys.stdin.buffer.read(messageLength).decode('utf-8')
    # log(f"Received message: {message}")
    return [json.loads(message), message]

# Encode a message for transmission,
# given its content.
def encodeMessage(messageContent):
    # https://docs.python.org/3/library/json.html#basic-usage
    # To get the most compact JSON representation, you should specify
    # (',', ':') to eliminate whitespace.
    # We want the most compact representation because the browser rejects
    # messages that exceed 1 MB.
    encodedContent = json.dumps(messageContent, separators=(',', ':')).encode('utf-8')
    encodedLength = struct.pack('@I', len(encodedContent))
    return {'length': encodedLength, 'content': encodedContent}

# Send an encoded message to stdout
def sendMessage(encodedMessage):
    # log(f"Sending message of length {encodedMessage['length']}")
    # log(f"with content: {encodedMessage['content']}")
    sys.stdout.buffer.write(encodedMessage['length'])
    sys.stdout.buffer.write(encodedMessage['content'])
    sys.stdout.buffer.flush()

# ╭────────────────────────────────────────────────────────────────────────────╮
# │ Output                                                                     │
# ╰────────────────────────────────────────────────────────────────────────────╯

def main_loop(file: typing.TextIO):
    while True:
        _, receivedJson = getMessage()
        acknowledge()
        # log(f"Got message of length {len(receivedJson)}")
        # log("Python type of obtained message: " + str(type(receivedMessage)))
        # We store the "raw" JSON as constructed by the nativeMessaging API
        file.write(receivedJson)
        file.write("\n")

# '2024-08-01T14:38:57' -> '2024-08-01T14-38-57'
# ":" is not allowed in filenames
time_string = datetime.datetime.now().replace(microsecond=0).isoformat()
# Trial and error: Working directory is $HOME.
filename = ".local/share/cocaco/data/" + time_string.replace(":", "-")
try:
    working_directory = os.getcwd()
    receivedMessage, receivedJson = getMessage()
    assert(type(receivedMessage) == int)
    dump_id = str(receivedMessage)
    filename += "_" + dump_id + ".json"
    # sendMessage(encodeMessage(f"cwd: {working_directory}"))
    # sendMessage(encodeMessage(f"filename: {filename}"))
    log(f"cwd: {working_directory}")
    log(f"filename: {filename}")
    with open(filename, "w") as file:
        main_loop(file)
except(DoneException):
    log(f"End of data for {dump_id}")
except(TerminatedException):
    log(f"Terminated {dump_id}")
