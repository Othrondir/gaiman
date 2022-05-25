/*    ______      _
 *   / ____/___ _(_)___ ___  ____ _____
 *  / / __/ __ `/ / __ `__ \/ __ `/ __ \
 * / /_/ / /_/ / / / / / / / /_/ / / / /
 * \____/\__,_/_/_/ /_/ /_/\__,_/_/ /_/
 *
 * Code generated by Gaiman version {{VER}}
 * https://gaiman.js.org
 */
function parse_cookies(cookies) {
    const result = {};
    cookies.split(/\s*;\s*/).forEach(function(pair) {
        pair = pair.split(/\s*=\s*/);
        var name = decodeURIComponent(pair[0]);
        var value = decodeURIComponent(pair.splice(1).join('='));
        result[name] = value;
    });
    return result;
}

function is_function(obj) {
    return typeof obj === 'function';
}

function is_promise(obj) {
    return obj && is_function(obj.then);
}

function is_node() {
    return typeof process !== 'undefined' &&
        process.release.name === 'node';
}

// based on https://stackoverflow.com/a/46282334/387194
function extend(object, prototype) {
    const descriptors = Object.getOwnPropertyDescriptors(object);
    for (const prop in descriptors) {
        Object.defineProperty(prototype, prop, descriptors[prop]);
    }
}

const loops = {};

const Gaiman = {
    _get_time() {
        return +new Date;
    },
    should_break_loop(id) {
        if (!loops[id]) {
            loops[id] = {
                start: this._get_time(),
                count: 1
            };
            return false;
        } else {
            var now = this._get_time();
            const { start } = loops[id];
            const count = ++loops[id].count;
            if (count > this._config.loop_threshold) {
                const stop = now - start > this._config.loop_timeout;
                if (stop) {
                    window.parent.postMessage({
                        message: 'Infinite Loop detected!',
                        colno: null,
                        lineno: null
                    });
                }
                return stop;
            }
            return false;
        }
    },
    exit_loop(id) {
        delete loops[id];
    },
    type(obj) {
        if (obj === 'null') {
            return 'null';
        } else if (Number.isNaN(obj)) {
            return 'nan';
        } else if (obj instanceof Array) {
            return 'array';
        } else {
            var type = typeof obj;
            if (type === 'object') {
                // https://tinyurl.com/fixing-typeof
                return ({}).toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase();
            }
            return type;
        }
    },
    parse(input) {
        return $.terminal.parse_arguments(input);
    },
    parse_extra(input) {
        return $.terminal.split_arguments(input);
    },
    post(url, data = {}) {
        return $.post(url, data);
    },
    post_extra(url, data = {}) {
        return $.post(url, data, $.noop, "text");
    },
    get(url) {
        return $.get(url);
    },
    get_extra(url) {
        return $.get(url, $.noop, "text");
    }
};

if (!('Map' in this)) {
    $.getScript('https://cdn.jsdelivr.net/gh/jcubic/static/js/map.min.js').then(() => {
        window.Map = ES6_Map;
    });
}

function to_string(object) {
    if (object instanceof Array) {
        object = object.map(to_string);
    } else {
        var type = typeof object;
        if (type === 'number') {
            object = String(object);
        } else if (type !== 'string') {
            if (object) {
                object = JSON.stringify(object, null, 2);
            } else {
                object = String(object);
            }
        }
    }
    return object;
}

class WebAdapter {
    constructor(config = {}) {
        this._config = $.extend({
            newline: true,
            loop_threshold: 500,
            loop_timeout: 200
        }, config);
        var root = $('#term');
        var options = root.css('--options');
        if (typeof options === 'undefined') {
            options = {};
        } else {
            try {
                options = JSON.parse(options);
            } catch(e) {
                console.warn('Gaiman: Invalid --option CSS variable');
                options = {};
            }
        }
        this._term = root.terminal($.noop, $.extend({
            greetings: false,
            exit: false,
            exceptionHandler(e) {
                if (is_iframe) {
                    window.parent.postMessage({
                        message: 'Internal: ' + e.message,
                        colno: null,
                        lineno: null
                    });
                } else {
                    throw e;
                }
            }
        }, options));
    }
    config(name, value) {
        if (typeof name === 'string') {
            this._config[name] = value;
        } else {
            const { completion, ...rest } = name;
            this._term.settings().completion = completion;
            $.extend(rest, name);
        }
    }
    store(name, ...args) {
        try {
            if (args.length === 0) {
                return JSON.parse(localStorage.getItem(name));
            } else {
                const [ value ] = args;
                localStorage.setItem(name, JSON.stringify(value));
            }
        } catch(e) {
            // ignore errors that may happen in Incognito mode
        }
    }
    sleep(timeout, visible = false) {
        this._term.pause(visible);
        return new Promise(resolve => {
            setTimeout(() => {
                this._term.resume();
                resolve();
            }, Number(timeout));
        });
    }
    sleep_extra(timeout) {
        return this.sleep(timeout, true);
    }
    error(e) {
        var message;
        if (e.statusText) {
            message = `Failed to fetch: ${e.url}\n${e.statusText}`;
        } else {
            message = e.message || e;
        }
        this._term.error(message);
    }
    echo(arg) {
        this._term.echo(to_string(arg), { newline: this._config.newline });
    }
    echo_extra(string, delay) {
        return this._term.echo(string, { typing: true, delay });
    }
    ask(message, validator = () => true) {
        return new Promise(resolve => {
            this._term.push(result => {
                return Promise.resolve().then(async () => {
                    if (typeof validator !== 'function') {
                        throw new Error('ask validator needs to be a function');
                    }
                    if (await validator(result)) {
                        this._term.pop();
                        resolve(result);
                    }
                });
            }, {
                prompt: message
            });
        });
    }
    ask_extra(message, delay, validator = () => true) {
        return new Promise(resolve => {
            const prompt = this._term.get_prompt();
            this._term.push(result => {
                return Promise.resolve().then(async () => {
                    if (typeof validator !== 'function') {
                        throw new Error('ask* validator needs to be a function');
                    }
                    if (await validator(result)) {
                        this._term.pop().set_prompt(prompt);
                        resolve(result);
                    } else {
                        this._term.set_prompt(message, {
                            typing: true,
                            delay
                        });
                    }
                })
            }).set_prompt(message, {
                typing: true,
                delay
            });
        });
    }
    update(index, string) {
        this._term.update(index, string);
    }
    prompt(string) {
        this._term.set_prompt(string);
    }
    prompt_extra(string, delay) {
        return this._term.set_prompt(string, { typing: true, delay });
    }
    input(string) {
        return this._term.exec(string);
    }
    input_extra(string, delay) {
        return this._term.exec(string, { typing: true, delay });
    }
    clear() {
        this._term.clear();
    }
}

$.ajaxSetup({
    beforeSend: function(jqXHR, settings) {
        jqXHR.url = settings.url;
    }
});

extend(Gaiman, WebAdapter.prototype);

class GaimanArray extends Array {
    map(...args) {
        function call(arr) {
            return new GaimanArray(...arr);
        }
        const arr = super.map.apply(this, args);
        const some = super.some;
        const has_promise = some.call(arr, is_promise);
        if (has_promise) {
            return Promise.all(arr).then(call);
        } else {
            return call(arr);
        }
    }
    forEach(...args) {
        return this.map(...args);
    }
    filter(fn, ctx) {
        const filter = super.filter;
        function call(arr) {
            return new GaimanArray(...filter.call(arr, x => x));
        }
        const items = this.map(fn, ctx);
        if (is_promise(items)) {
            return items.then(arr => {
                return call(arr);
            });
        } else {
            return call(items);
        }
    }
    reduce(fn, init) {
        return new GaimanArray(...super.reduce.call(this, function(acc, ...args) {
            if (is_promise(acc)) {
                return acc.then(acc => {
                    return fn(acc, ...args);
                });
            } else {
                return fn(acc, ...args);
            }
        }, init));
    }
    sort(fn = defaultSortFn) {
        return mergeSort(this, fn);
    }
    some(fn, ctx) {
        const some = super.some;
        return this.mapWithCallback(fn, (arr) => {
            return some.call(arr, x => x);
        }, ctx);
    }
    every(fn, ctx) {
        const every = super.every;
        return this.mapWithCallback(fn, (arr) => {
            return every.call(arr, x => x);
        }, ctx);
    }
    find(fn, ctx) {
        return this.mapWithCallback(fn, (arr) => {
            const index = arr.findIndex(x => x);
            return this[index];
        }, ctx);
    }
    flatMap(fn, ...args) {
        return this.map(...args).flat();
    }
    mapWithCallback(fn, callback, ctx) {
        const items = this.map(fn, ctx);
        if (is_promise(items)) {
            return items.then(arr => {
                return callback(arr);
            });
        } else {
            return callback(items);
        }
    }
}

function defaultSortFn(a, b) {
    if (typeof a !== 'string') {
        a = String(a);
    }
    if (typeof b !== 'string') {
        b = String(b);
    }
    if (a < b) {
        return -1;
    }
    if (a > b) {
        return 1;
    }
    return 0;
}

// based on: https://rosettacode.org/wiki/Sorting_algorithms/Merge_sort#JavaScript
async function mergeSort(array, fn = defaultSortFn) {
    if (array.length <= 1) {
        return array;
    }
    const mid = Math.floor(array.length / 2),
          left = array.slice(0, mid), right = array.slice(mid);
    await mergeSort(left, fn);
    await mergeSort(right, fn);
    let ia = 0, il = 0, ir = 0;
    while (il < left.length && ir < right.length) {
        array[ia++] = (await fn(left[il], right[ir]) <= 0) ? left[il++] : right[ir++];
    }
    while (il < left.length) {
        array[ia++] = left[il++];
    }
    while (ir < right.length) {
        array[ia++] = right[ir++];
    }
    return array;
}

var cookie, argv, gaiman, $$__m;
try {
    if (is_node()) {
        argv = process.argv;
    } else {
        cookie = parse_cookies(document.cookie);
        gaiman = new WebAdapter();
    }
    main();
} catch (e) {
    window.parent.postMessage({
        message: e.message,
        colno: null,
        lineno: null
    });
}
