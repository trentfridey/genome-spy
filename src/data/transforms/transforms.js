import formula from './formula';
import gather from './gather';
import regexMatch from './regexMatch';
import simpleFilter from './simpleFilter';
import filter from './filter';
import flattenDelimited from './flattenDelimited';
import stack from './stack';
import equalize from './equalize';

const transforms = {
    equalize,
    filter,
    flattenDelimited,
    formula,
    gather,
    regexMatch,
    simpleFilter,
    stack
};

export default transforms;