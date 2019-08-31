import UnitView from './unitView';
import LayerView from './layerView';
import View from './view';

/**
 * @typedef {Object} ViewContext 
 * @prop {import("../tracks/simpleTrack").default} [track]
 * @prop {import("../genomeSpy").default} genomeSpy TODO: Break genomeSpy dependency
 * @prop {function(string):import("../data/dataSource").default} getDataSource
 */

/**
 * @typedef {Object} MarkConfig
 * @prop {string} type
 * @prop {object} [tooltip]
 * @prop {object} [sorting]
 */

/**
 * @typedef {Object} EncodingSpec
 * @prop {string} [type]
 * @prop {Object} [axis] 
 * @prop {string} [field]
 * @prop {string} [value]
 * @prop {object} [scale]
 * @prop {object} [sort]
 * @prop {string} [title]
 */

/**
 * @typedef {Object} Spec
 * @prop {string} [name]
 * @prop {Spec[]} [layer]
 * @prop {string | MarkConfig | object} [mark]
 * @prop {object} [data] 
 * @prop {object[]} [transform]
 * @prop {string} [sample]
 * @prop {Object.<string, EncodingSpec>} [encoding]
 * @prop {Object} [renderConfig]
 * @prop {string} [title]
 * @prop {Object} [resolve]
 */

/**
 * 
 * @param {Spec} spec 
 */
export function isUnitSpec(spec) {
    return typeof spec.mark === "string" || typeof spec.mark === "object";
}

/**
 * 
 * @param {Spec} spec 
 */
export function isLayerSpec(spec) {
    return typeof spec.layer === "object";
}

/**
 * 
 * @param {Spec} spec 
 * @returns {typeof View} 
 */
export function getViewClass(spec) {
    if (isUnitSpec(spec)) {
        return UnitView;
    } else if (isLayerSpec(spec)) {
        return LayerView;
    } else {
        throw new Error("Invalid spec, cannot figure out the view: " + JSON.stringify(spec));
    }
}

/**
 * 
 * @param {Spec} spec 
 * @param {ViewContext} context 
 */
export function createView(spec, context) {
    const View = getViewClass(spec);
    return new View(spec, context, null, "root");
}


/**
 * Returns all marks in the order (DFS) they are rendered
 * @param {View} root
 */
export function getMarks(root) {
    return getFlattenedViews(root)
        .filter(view => view instanceof UnitView)
        .map(view => (/** @type {UnitView} */(view)).mark)
}

/**
 * @param {View} root
 */
export function getFlattenedViews(root) {
    /** @type {View[]} */
    const views = [];
    root.visit(view => views.push(view));
    return views;
}

/**
 * @param {View} root
 */
export async function initializeViewHierarchy(root) {
    const views = getFlattenedViews(root);
    await Promise.all(views.map(view => view.loadData()));

    for (const view of views) {
        view.transformData();
    }

    for (const view of views) {
        if (view instanceof UnitView) {
            view.resolve();
        }
    }

    for (const mark of getMarks(root)) {
        await mark.initializeData(); // TODO: async needed?
    }
}

// ----------------------------------------------
// TODO: Proper place for these:

/** @type {Object.<string, string>} */
export const secondaryChannels = {
    x: "x2",
    y: "y2"
};

/**
 * 
 * @param {string} channel 
 */
export function isSecondaryChannel(channel) {
    return Object.values(secondaryChannels).includes(channel);

}

/**
 * Returns an array that contains the given channel and its secondary channel if one exists.
 * 
 * @param {string} channel 
 */
export function channelWithSecondarys(channel) {
    return secondaryChannels[channel] ? [channel, secondaryChannels[channel]] : [channel];
}