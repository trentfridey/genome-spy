import { isString } from "vega-util";
import createFunction from "../utils/expression.js";

/**
 * A class that manages parameters and expressions.
 * Supports nesting and scoped parameters.
 *
 * @typedef {import("../utils/expression.js").ExpressionFunction & { addListener: (listener: () => void) => void, invalidate: () => void, identifier: () => string}} ExprRefFunction
 */
export default class ParamMediator {
    /**
     * @typedef {import("../spec/parameter.js").VariableParameter} VariableParameter
     * @typedef {(value: any) => void} ParameterSetter
     */

    /** @type {Map<string, any>} */
    #paramValues;

    /**
     * @type {Map<string, Set<() => void>>}
     * @protected
     */
    paramListeners;

    /** @type {Map<string, (value: any) => void>} */
    #allocatedSetters = new Map();

    /** @type {Map<string, ExprRefFunction>} */
    #expressions = new Map();

    /** @type {Map<string, VariableParameter>} */
    #paramConfigs = new Map();

    /** @type {() => ParamMediator} */
    #parentFinder;

    /**
     * @param {() => ParamMediator} [parentFinder]
     *      An optional function that returns the parent mediator.
     *      N.B. The function must always return the same mediator for the same parent,
     *      i.e., the changing the structure of the hierarchy is NOT supported.
     */
    constructor(parentFinder) {
        this.#parentFinder = parentFinder ?? (() => undefined);

        this.#paramValues = new Map();
        this.paramListeners = new Map();
    }

    /**
     * @param {VariableParameter} param
     * @returns {ParameterSetter}
     */
    registerParam(param) {
        if ("value" in param && "expr" in param) {
            throw new Error(
                "Parameter must not have both value and expr: " + param.name
            );
        }

        /** @type {ParameterSetter} */
        let setter;

        if ("value" in param) {
            setter = this.allocateSetter(param.name, param.value);
        } else if ("expr" in param) {
            const expr = this.createExpression(param.expr);
            // TODO: getSetter(param) should return a setter that throws if
            // modifying the value is attempted.
            const realSetter = this.allocateSetter(param.name, expr(null));
            expr.addListener(() => realSetter(expr(null)));
            // NOP
            setter = (_) => undefined;
        }

        this.#paramConfigs.set(param.name, param);

        return setter;
    }

    /**
     *
     * @param {string} paramName
     * @param {T} initialValue
     * @returns {(value: T) => void}
     * @template T
     */
    allocateSetter(paramName, initialValue) {
        if (this.#allocatedSetters.has(paramName)) {
            throw new Error(
                "Setter already allocated for parameter: " + paramName
            );
        }

        /** @type {(value: any) => void} */
        const setter = (value) => {
            const previous = this.#paramValues.get(paramName);
            if (value !== previous) {
                this.#paramValues.set(paramName, value);

                const listeners = this.paramListeners.get(paramName);
                if (listeners) {
                    for (const listener of listeners) {
                        listener();
                    }
                }
            }
        };

        setter(initialValue);

        this.#allocatedSetters.set(paramName, setter);

        return setter;
    }

    /**
     * Gets an existing setter for a parameter. Throws if the setter is not found.
     * @param {string} paramName
     */
    getSetter(paramName) {
        const setter = this.#allocatedSetters.get(paramName);
        if (!setter) {
            throw new Error("Setter not found for parameter: " + paramName);
        }
        return setter;
    }

    /**
     * Get the value of a parameter from this mediator.
     * @param {string} paramName
     */
    getValue(paramName) {
        return this.#paramValues.get(paramName);
    }

    /**
     * Get the value of a parameter from this mediator or the ancestors.
     * @param {string} paramName
     */
    findValue(paramName) {
        const mediator = this.findMediatorForParam(paramName);
        return mediator?.getValue(paramName);
    }

    /**
     * Returns configs for all parameters that have been registered using `registerParam`.
     */
    get paramConfigs() {
        return /** @type {ReadonlyMap<string, VariableParameter>} */ (
            this.#paramConfigs
        );
    }

    /**
     *
     * @param {string} paramName
     * @returns {ParamMediator}
     * @protected
     */
    findMediatorForParam(paramName) {
        if (this.#paramValues.has(paramName)) {
            return this;
        } else {
            return this.#parentFinder()?.findMediatorForParam(paramName);
        }
    }

    // TODO: deallocateSetter

    /**
     * Parse expr and return a function that returns the value of the parameter.
     *
     * @param {string} expr
     */
    createExpression(expr) {
        if (this.#expressions.has(expr)) {
            return this.#expressions.get(expr);
        }

        const globalObject = {};

        /** @type {ExprRefFunction} */
        const fn = /** @type {any} */ (createFunction(expr, globalObject));

        /** @type {Map<string, ParamMediator>} */
        const mediatorsForParams = new Map();

        for (const param of fn.globals) {
            const mediator = this.findMediatorForParam(param);
            if (!mediator) {
                throw new Error(
                    `Unknown variable "${param}" in expression: ${expr}`
                );
            }

            mediatorsForParams.set(param, mediator);

            Object.defineProperty(globalObject, param, {
                enumerable: true,
                get() {
                    return mediator.getValue(param);
                },
            });
        }
        // TODO: There should be a way to "materialize" the global object when
        // it is used in expressions in transformation batches, i.e., when the same
        // expression is applied to multiple data objects. In that case, the global
        // object remains constant and the Map lookups cause unnecessary overhead.

        // Keep track of them so that they can be detached later
        const myListeners = new Set();

        /**
         *
         * @param {() => void} listener
         */
        fn.addListener = (listener) => {
            for (const [param, mediator] of mediatorsForParams) {
                const listeners =
                    mediator.paramListeners.get(param) ?? new Set();
                mediator.paramListeners.set(param, listeners);

                listeners.add(listener);
                myListeners.add(listener);
            }
        };

        /**
         * Detach listeners. This must be called if the expression is no longer used.
         * TODO: What if the expression is used in multiple places?
         */
        fn.invalidate = () => {
            for (const [param, mediator] of mediatorsForParams) {
                for (const listener of myListeners) {
                    mediator.paramListeners.get(param)?.delete(listener);
                }
            }
        };

        // TODO: This should contain unique identifier for each parameter.
        // As the same parameter name may be used in different branches of the
        // hierarchy, they should be distinguished by a unique identifier, e.g.,
        // a serial number of something similar.
        fn.identifier = () => fn.code;

        this.#expressions.set(expr, fn);

        return fn;
    }

    /**
     * A convenience method for evaluating an expression.
     *
     * @param {string} expr
     */
    evaluateAndGet(expr) {
        const fn = this.createExpression(expr);
        return fn();
    }
}

/**
 * @param {any} x
 * @returns {x is import("../spec/parameter.js").ExprRef}
 */
export function isExprRef(x) {
    return typeof x == "object" && x != null && "expr" in x && isString(x.expr);
}

/**
 * Removes ExprRef from the type and checks that the value is not an ExprRef.
 * This is designed to be used with `activateExprRefProps`.
 *
 * @param {T | import("../spec/parameter.js").ExprRef} x
 * @template T
 * @returns {T}
 */
export function withoutExprRef(x) {
    if (isExprRef(x)) {
        throw new Error(
            `ExprRef ${JSON.stringify(
                x
            )} not allowed here. Expected a scalar value.`
        );
    }
    return /** @type {T} */ (x);
}

/**
 * Takes a record of properties that may have ExprRefs as values. Converts the
 * ExprRefs to getters and setups a listener that is called when any of the
 * expressions (upstream parameters) change.
 *
 * @param {ParamMediator} paramMediator
 * @param {T} props The properties object
 * @param {(props: (keyof T)[]) => void} [listener] Listener to be called when any of the expressions change
 * @returns T
 * @template {Record<string, any | import("../spec/parameter.js").ExprRef>} T
 */
export function activateExprRefProps(paramMediator, props, listener) {
    /** @type {Record<string, any | import("../spec/parameter.js").ExprRef>} */
    const activatedProps = { ...props };

    /** @type {(keyof T)[]} */
    const alteredProps = [];

    const batchPropertyChange = (/** @type {keyof T} */ prop) => {
        alteredProps.push(prop);
        if (alteredProps.length === 1) {
            queueMicrotask(() => {
                listener(alteredProps.slice());
                alteredProps.length = 0;
            });
        }
    };

    for (const [key, value] of Object.entries(props)) {
        if (isExprRef(value)) {
            const fn = paramMediator.createExpression(value.expr);
            if (listener) {
                fn.addListener(() => batchPropertyChange(key));
            }

            Object.defineProperty(activatedProps, key, {
                enumerable: true,
                get() {
                    return fn();
                },
            });
        } else {
            activatedProps[key] = value;
        }
    }

    return /** @type {T} */ (activatedProps);
}
