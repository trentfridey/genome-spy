
import { formalizeEncodingConfig, createEncodingMapper, createCompositeEncodingMapper } from '../data/visualScales';
import { gatherTransform } from './transforms/gather';

/**
 * @typedef {Object} SimpleFilterConfig
 * @prop {string} field 
 * @prop {string} operator eq, neq, lt, lte, gte, gt
 * @prop {*} value
 * 
 * @typedef {Object} VariantDataConfig
 *    A configuration that specifies how data should be mapped
 *    to PointSpecs. The ultimate aim is to make this very generic
 *    and applicable to multiple types of data and visual encodings.
 * @prop {object[]} [transform]
 * @prop {string} [sample]
 * @prop {string} chrom
 * @prop {string} pos
 * @prop {Object} encoding 
 * @prop {SimpleFilterConfig[]} [filters]
 */

// TODO: Make enum, include constraints for ranges, etc, maybe some metadata (description)
const visualVariables = {
    color: { type: "color" },
    size: { type: "number" }
};

const transformers = {
    gather: gatherTransform
};

/**
 * 
 * @param {object[]} transformConfigs 
 */
function transformData(transformConfigs, rows) {
    for (const transformConfig of transformConfigs) {
        const type = transformConfig.type;
        if (!type) {
            throw new Error("Type not defined in transformConfig!");
        }

        const transformer = transformers[type];
        if (!transformer) {
            throw new Error(`Unknown transformer type: ${type}`);
        }

        rows = transformer(transformConfig, rows);
    }

    return rows;
}

/**
 * 
 * @param {VariantDataConfig} dataConfig 
 * @param {object[]} rows 
 * @param {import("../genome/genome").default} genome 
 */
export function processData(dataConfig, rows, genome) {
    const cm = genome.chromMapper;

    // TODO: Validate that data contains all fields that are referenced in the config.
    // ... just to prevent mysterious undefineds

    if (dataConfig.transform) {
        rows = transformData(dataConfig.transform, rows);
    }

    const encode = createCompositeEncodingMapper(dataConfig.encoding, visualVariables, rows);

    // TODO: Check that dataConfig.sample matches sample of gatherTransform
    // TODO: Support data that has just a single sample (no sample column)
    const extractSample = d => d[dataConfig.sample];
    
    const mappedRows = rows
        .map(d => ({
            // TODO: 0 or 1 based addressing?
            // Add 0.5 to center the symbol inside nucleotide boundaries
            pos: cm.toContinuous(d[dataConfig.chrom], +d[dataConfig.pos]) + 0.5,
            ...encode(d)
        }));

    /**
     * @typedef {import('../gl/segmentsToVertices').PointSpec} PointSpec
     * @type {Map<string, PointSpec[]>}
     */
    const pointsBySample = new Map();

    const addSpec = (sampleId, spec) => {
        let specs = pointsBySample.get(sampleId);
        if (specs) {
            specs.push(spec);
        } else {
            pointsBySample.set(sampleId, [spec]);
        }
    }
    
    mappedRows.forEach((spec, i) => addSpec(extractSample(rows[i]), spec));

    return pointsBySample;
}


/**
 * 
 * @param {SimpleFilterConfig} filterConfig 
 */
 export function createFilter(filterConfig) {
     const v = filterConfig.value;

     const accessor = x => x[filterConfig.field];

     // Assume that x is a string. Not very robust, but should be enough for now
     switch (filterConfig.operator) {
         case "eq":  return x => accessor(x) == v;
         case "neq": return x => accessor(x) != v;
         case "lt":  return x => accessor(x) < v;
         case "lte": return x => accessor(x) <= v;
         case "gte": return x => accessor(x) >= v;
         case "gt":  return x => accessor(x) > v;
         default:
            throw new Error(`Unknown operator: ${filterConfig.operator}`);
     }
 }
