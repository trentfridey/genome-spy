import * as d3 from "d3";
import EventEmitter from "eventemitter3";

const defaultConverter = obj => Promise.resolve(obj);
const defaultEqTest = (a, b) => Object.is(a, b);

/**
 * A tool for tracking mouse movement and handling tooltips etc...
 * 
 * @typedef {Object} ConstructorParams
 * @prop {HTMLElement} element element to observe
 * @prop {function} resolver function that resolves an object based on its coordinates
 * @prop {import("./tooltip").default} [tooltip] tooltip
 * @prop {function} [tooltipConverter] function that converts the object to html for tooltip
 * @prop {function} [eqTest] function that tests whether two objects are equal
 * 
 */
export default class MouseTracker {

    /**
     * @param {ConstructorParams} params parameters
     */
    constructor({ element, resolver, tooltip, tooltipConverter = defaultConverter, eqTest = defaultEqTest }) {
        
        this.element = element;
        this.resolver = resolver;
        this.tooltip = tooltip;
        this.tooltipConverter = tooltipConverter;
        this.eqTest = eqTest;

        this.currentTooltipObject = null;

        this.tooltipDelay = 400; // in milliseconds

        this.timeoutId = null;

        this.currentObject = null;

        for (let type of ["mousemove", "mouseleave", "wheel", "click"]) {
            element.addEventListener(type, event => this._handleMouseEvent(/** @type {MouseEvent} */(event)), false);
        }

        this.eventEmitter = new EventEmitter();
    }

    on(...args) {
        // TODO: A mixin or multiple inheritance would be nice
        this.eventEmitter.on(...args);
        return this;
    }

    clear() {
        this._updateTooltip(null);
    }

    /**
     * @param {MouseEvent} event 
     */
    _handleMouseEvent(event) {
        let resolvedObject = null;

        if (["mousemove", "click"].includes(event.type)) {
            resolvedObject = this.resolver(d3.clientPoint(this.element, event));
        }

        if (event.type == "mousemove") {
            if (this.tooltip) {
                this.tooltip.handleMouseMove(event);
            }

        } else if (event.type == "click") {
            if (resolvedObject) {
                this.eventEmitter.emit(event.detail == 1 ? "click" : "dblclick", resolvedObject, event);
            }
        }

        // TODO: Mouseover, mouseleave, dblclick

        this._updateTooltip(event.buttons == 0 ? resolvedObject : null);

        if (resolvedObject && resolvedObject != this.currentObject) {
            this.eventEmitter.emit("mouseover", resolvedObject, event);

        } else if (resolvedObject && !this.currentObject) {
            this.eventEmitter.emit("mouseover", resolvedObject, event);

        } else if (!resolvedObject && this.currentObject) {
            this.eventEmitter.emit("mouseleave", event);
        }

        this.currentObject = resolvedObject;
    }


    _updateTooltip(obj) {
        if (!this.tooltip) {
            return;
        }

        if (!this.eqTest(obj, this.currentTooltipObject)) {
            if (typeof this.timeoutId == "number") {
                clearTimeout(this.timeoutId);
            }

            this.tooltip.setContent(null);

            if (obj) {
                this.timeoutId = setTimeout(() => {
                    this.tooltipConverter(obj)
                        .then(content => {
                            // Ensure that the resolved object is still current
                            if (this.eqTest(obj, this.currentTooltipObject)) {
                                this.tooltip.setContent(content)
                            }
                        });
                }, this.tooltipDelay);
            }

            //console.log(`HoverHandler current: ${obj}`);
            this.currentTooltipObject = obj;
        }
    }

}