"use strict";

// Strategy pattern to multiplex console.log() alternatives according to the
// global cocaco_config object.
//
//                                            ⋮
//   logMessage() ⎫                           ⋮
//   logChat()    ⎬  logDom()     ⎫           ⋮                ⎧ logMessage = false
//                ⎭  logConsole() ⎬ log()     ⋮  cocaco_config ⎨ debugMessage = true
//                   ...          ⎭           ⋮                ⎩ ...
//                                            ⋮
//
//   log(messageElement, "hello")                           // messageElement must be present
//   log(null,           "hello")                           // messageElement may be null
//   log(null,           "with %ccolour%c", "<css>", "")    // '%' is reserved. '%c' inserts a styled span.
//   clear()                                                // Deletes elements added by logDom()

class MessageLog {
    enabled = true;

    static className = "ex-dbg-msg";

    // Take a string containing '%c' and pslit it into spans with styles
    // prescribed by ...args.
    // Mimicks the behaviour of console.log().
    // ❕ The '%' character is reserved for styling only.
    // To remove them later we use a common class names for all added dom
    // elements.
    static styledElement(formatString, ...args) {
        const html = formatString.replace(/%c([^%]*)/g, (_match, text) => {
            const style = args.shift();
            return `<span style="${style}">${text}</span>`;
        });
        const element = document.createElement("div");
        element.className = MessageLog.className;
        element.innerHTML = html;
        return element;
    }

    static clear() {
        document.querySelectorAll(`.${MessageLog.className}`)
            .forEach(element => element.remove());
    }

    constructor(chatElement = null) {
        this.init(chatElement);
    }

}

MessageLog.prototype.clear = function () {
    MessageLog.clear();
}

// Defaults to global cocaco_config object
MessageLog.prototype.init = function (chatElement) {
    this.chatElement = chatElement;
    this.loggers = [];
    for (const [key, value] of Object.entries(MessageLog.configOptions)) {
        if (cocaco_config[key]) {
            this.loggers.push(value);
        }
        console.log(`🥥 MessageLog: ${key} = ${cocaco_config[key]}`);
    }
}

// Entry point
MessageLog.prototype.log = function (...args) {
    if (this.enabled === false) {
        return;
    }
    for (const l of this.loggers) {
        l.call(this, ...args);
    }
}

MessageLog.prototype.logChat = function (...args) {
    if (this.chatElement == null) {
        return;
    }
    const element = MessageLog.styledElement(...args);
    this.chatElement.appendChild(element);
    element.scrollIntoView();
}

MessageLog.prototype.logConsole = function (_messageElement, ...args) {
    // Drop the first argument which is the DOM message element
    console.log(...args);
}

// Switch between logMessage() and logChat() dependign on the presence of
// a message element. Results in a dom element being added somewhere.
MessageLog.prototype.logDom = function (messageElement, ...args) {
    if (messageElement)
        this.logMessage(messageElement, ...args);
    else
        this.logChat(...args);
}

MessageLog.prototype.logMessage = function (messageElement, ...args) {
    const element = MessageLog.styledElement(...args);
    messageElement.appendChild(element);
}

MessageLog.configOptions =
{
    // These keys must be in the gloval cocaco_config element
    "logConsole": MessageLog.prototype.logConsole,
    "logDom": MessageLog.prototype.logDom,
};
