"use strict";

// The frame format is described in the documentation:
//      doc/colonist/message_format.md

/**
 * @param {Uint8Array} frame Encoded frame
 * @return {*} Decoded frame
 */
function cocaco_decode_receive(frame) {
    let res;
    try {
        res = msgpack.deserialize(frame);
    } catch (e) {
        console.error("Failed to decode received frame", frame, e);
        debugger;
    }
    return res;
}

/**
 * @param {*} frame Decoded frame
 * @return {Uint8Array} Encoded frame
 */
function cocaco_encode_receive(frame) {
    let res;
    try {
        res = msgpack.serialize(frame);
    } catch (e) {
        console.error("Failed to encode received frame", frame, e);
        debugger;
    }
    return res;
}

/**
 * @param {Uin8Array} frame Encoded frame
 * @return {*} Decoded frame
 */
function cocaco_decode_send(frame) {
    const [v0, v1, strlen] = frame.slice(0, 3);
    // console.debug("deserialized v0 v1 strlen:", v0, v1, strlen);
    const overlen = 3 + strlen;
    const [start, stop] = [frame.byteOffset + 2, frame.byteOffset + overlen];
    // console.log("String start and stop:", start, stop);
    const data_str = frame.buffer.slice(start, stop);
    // HACK: Convert from [length][str] to msgpack format
    // TODO: Use the fixstr internal?
    let tmp = new Uint8Array(data_str);
    // console.debug("str array before manipulation:", tmp);
    tmp[0] += 0xa0;
    // console.debug("str array after manipulation:", tmp);
    // console.debug("Shortened buffer data_str:", data_str);
    const str = msgpack.deserialize(tmp);
    // console.debug("deserialized str:", str);
    const data_message = frame.buffer.slice(
        frame.byteOffset + overlen, frame.byteLength + frame.byteOffset);
    // console.debug("Shortened buffer data_message:", data_message);
    const u8 = new Uint8Array(data_message);
    const message = msgpack.deserialize(u8);
    // console.debug("deserialized message:", message);
    const res = {v0: v0, v1: v1, str: str, message: message};
    return res;
}

/**
 * @param {Number} v0 Value v0 as described in the documentation
 * @param {Number} v1 Value v1 as described in the documentation
 * @param {string} str Value str as described in the documentation
 * @param {*} message Message object as described in the documentation
 * @return {Uint8Array} Encoded frame
 */
function cocaco_encode_send({v0, v1, str, message}) {
    // We create a larger ArrayBuffer with a new full-sized uint8 view and copy the
    // serialized message into it. Not sure if we could convince msgpack to write
    // into a buffer we give to it.
    const isByte = x => x >= 0 && x <= 255;
    console.assert(str.length >= 1); // Empty str is not intended
    console.assert(isByte(v0));
    console.assert(isByte(v1));
    console.assert(isByte(str.length)); // We only reserve 1 length byte

    // TODO: Use msgpack fixstr/int helpers?
    const messageSerialized = msgpack.serialize(message);
    const strOffset = 3;
    const strAsAscii =
        [...Array(str.length).keys()].map(i => str.charCodeAt(i));
    const messageOffset = strOffset + str.length;
    const fullLength = messageOffset + messageSerialized.byteLength;

    let fullBuffer = new ArrayBuffer(fullLength);
    let fullView = new Uint8Array(fullBuffer);
    fullView.set([v0, v1, str.length], 0);
    fullView.set(strAsAscii, strOffset);
    fullView.set(messageSerialized, messageOffset);

    return fullView;
}
