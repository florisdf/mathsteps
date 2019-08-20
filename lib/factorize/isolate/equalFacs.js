const ChangeTypes = require('../../ChangeTypes');
const Node = require('../../node');
const Status = require('../../node/Status');

const Polynom = require('../../polynom/Polynom');
const Term = require('../../term/Term');

const _ = require('lodash');


function putEqualFacsOutsideParensStep(node) {
  const oldNode = _.cloneDeep(node);
  let newNode = _.cloneDeep(node);

  // Mark the equal factors
  const comFacPaths = Term.getCommonFactorPaths(oldNode);

  comFacPaths.forEach(term => {
    term.forEach(facPath => {
      _.get(oldNode, facPath).changeGroup = 1;
    });
  });

  // Isolate
  if (comFacPaths[0].length > 0) {
    const divisor = Node.Creator.operator('*',
      comFacPaths[0].map(facPath => _.get(newNode, facPath)),
      true, true);
    const quot = Polynom.naive_divide(node, divisor);
    newNode = Node.Creator.operator('*', [divisor,
      Node.Creator.parenthesis(quot)]);
    newNode.args[0].changeGroup = 1;

    return new Status(ChangeTypes.EQUAL_FACTORS_OUTSIDE_PARENS, oldNode, newNode);
  }
  else {
    return Status.noChange(node);
  }
}

module.exports = putEqualFacsOutsideParensStep;
