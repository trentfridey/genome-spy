
import { transformData } from '../data/dataMapper';

/**
 * @typedef { import("./viewUtils").ViewSpec } ViewSpec
 * @typedef { import("./viewUtils").EncodingConfig } EncodingConfig
 * @typedef { import("./viewUtils").ViewContext} ViewContext 
 */
export default class View {
    /**
     * 
     * @param {ViewSpec} spec
     * @param {ViewContext} context 
     * @param {View} parent 
     * @param {string} name 
     */
    constructor(spec, context, parent, name) {
        this.context = context;
        this.parent = parent;
        this.name = spec.name || name;
        this.spec = spec;
        /** @type { View[] } */
        this.children = [];

        /** @type {Object.<string, import("./resolution").default>}  Resolved channels. Supports only scales for now.. */
        this.resolutions = {
        }
    }

    getPathString() {
        /** @type {string[]} */
        const path = [];
        /** @type {import("./view").default} */
        // eslint-disable-next-line consistent-this
        let view = this;
        do {
            path.push(view.name);
            view = view.parent;
        } while (view);

        return path.reverse().join("/");
    }

    
    /**
     * 
     * @param {function(View):void} visitor 
     */
    visit(visitor) {
        visitor(this);

        for (const viewUnit of this.children) {
            viewUnit.visit(visitor);
        }

        if (visitor.afterChildren) {
            visitor.afterChildren(this);
        }
    }

    /**
     * @return {Object.<string, EncodingConfig>}
     */
    getEncoding() {
        const pe = this.parent ? this.parent.getEncoding() : {};
        const te = this.spec.encoding || {};

        return {
            ...pe,
            ...te
        }
    }

    /**
     * @return {Object.<string, Object>}
     */
    getRenderConfig() {
        const pe = this.parent ? this.parent.getRenderConfig() : {};
        const te = this.spec.renderConfig || {};

        return {
            ...pe,
            ...te
        };
    }

    /**
     * 
     * @param {string} channel 
     * @returns {import("./resolution").default}
     */
    getResolution(channel) {
        return this.resolutions[channel] || (this.parent && this.parent.getResolution(channel)) || undefined;
    }

    /**
     * @returns {import("../data/group").Group}
     */
    getData() {
        // TODO: Redesign and replace with a more sophisticated data flow

        if (this.data) {
            return this.data;
        }

        if (this.parent) {
            return this.parent.getData();
        }

        throw new Error(`No data are available at ${this.getPathString()} or its parents.`);
    }

    async loadData() {
        if (this.spec.data) {
            this.data = await this.context.getDataSource(this.spec.data).getData();
        }
    }

    /**
     * Must be called in depth-first order
     */
    transformData() {
        if (this.spec.transform) {
            this.data = transformData(this.spec.transform, this.getData());
        }
    }
}
