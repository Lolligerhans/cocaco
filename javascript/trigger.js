"use strict";

class Trigger {
    static always = "trigger_always";
    constructor() {
        // { name: [...callbacks], ... }
        this.triggers = {};
    }
}

Trigger.prototype.ensureTrigger = function (name) {
    if (!Object.hasOwn(this.triggers, name)) {
        // console.debug("Trigger: Ensuring trigger (by adding it empty):", name);
        this.triggers[name] = [];
    }
}

Trigger.prototype.onTrigger = function (name, callback) {
    if (!name) {
        name = Trigger.always;
    }
    this.ensureTrigger(name);
    // console.debug("Trigger: registering onTrigger callback for:", name);
    this.triggers[name].push(callback);
}

Trigger.prototype.activateTrigger = function (name, data) {
    this.ensureTrigger(Trigger.always);
    this.triggers[Trigger.always] = this.triggers[Trigger.always].filter(callback => {
        return !callback({name: name, data: data});
    });
    // console.debug("trigger: Activating trigger:", name, data);
    this.ensureTrigger(name);
    this.triggers[name] = this.triggers[name].filter(callback => {
        return !callback(data);
    });
}
