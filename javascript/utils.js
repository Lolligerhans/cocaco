"use strict";

// Dependency free helpers

// For debugging
function p(object) {
    return JSON.stringify(object);
}

// Swap keys with their values in an object. The caller must ensure that values
// are of appropriate types. Number values become string keys.
// @transform: Function to ransform the resulting value. For example, to convert
//             to a number (which the then-key could not be as key).
function invertObject(object, transform = x => x) {
    let res = {};
    Object.entries(object).forEach(([k, v]) => {
        res[v] = transform(k);
    });
    return res;
}

// @param variable: Array of Object
// @return Different values when 'variable' is of type Array or Object
function _combinedType(variable) {
    return (typeof variable === "object") + (Array.isArray(variable));
}

// Construct new Object corresponging by recursively merging 'update' into
// 'object'. Conflicts are resolved by preferring the 'update' object.
// @return New object representing 'object' updated by 'update'
function combineObject(object, update) {
    const unmergable = typeof update !== "object" ||
        update == null ||
        object == null ||
        _combinedType(object) !== _combinedType(update);
    if (unmergable) {
        return structuredClone(update);
    }
    const cloneObject = structuredClone(object);
    const cloneUpdate = structuredClone(update);
    updateObjectNoClone(
        cloneObject,
        cloneUpdate,
    );
    if (Object.values(cloneObject).includes(undefined)) {
        debugger; // FIXME: Bug?
    }
    return cloneObject;
}

function updateObjectNoClone(object, update) {
    Object.keys(update).forEach(key => {
        const unmergable = typeof update[key] !== "object" ||
            update[key] == null ||
            object[key] == null ||
            _combinedType(object[key]) !== _combinedType(update[key]);
        if (unmergable) {
            // console.debug("Resetting", key);
            object[key] = update[key];
        } else {
            // console.debug("Merging", key);
            updateObjectNoClone(
                object[key],
                update[key],
            );
        }
    });
}
