const ChangeTypes = require('../../ChangeTypes');
const Node = require('../../node');
const NodeType = require('../../node/Type');
const Status = require('../../node/Status');

const Polynom = require('../../polynom/Polynom');
const Util = require('../../util/Util');

const _ = require('lodash');


function findOppositeFactorsStep(node, opEqFacs) {
  const oldNode = _.cloneDeep(node);
  const newNode = _.cloneDeep(node);

  opEqFacs.forEach((opEqFac, idx) => {
    opEqFac.oppos.forEach(opFac => {
      _.get(newNode, opFac.path).changeGroup = idx + 1;
    });
    opEqFac.equal.forEach(eqFac => {
      _.get(newNode, eqFac.path).changeGroup = idx + 1;
    });
  });

  return new Status(ChangeTypes.FIND_OP_FACS, oldNode, newNode);
}

function minOutsideOppositeFactorsStep(node, opEqFacs) {
  const oldNode = _.cloneDeep(node);
  const newNode = _.cloneDeep(node);

  opEqFacs.forEach((opEqFac, idx) => {
    opEqFac.oppos.forEach(opFac => {
      const path = opFac.path;
      _.get(oldNode, path).changeGroup = idx + 1;

      const negFac = Polynom.negate(_.get(newNode, path));
      const newFac = Node.Creator.parenthesis(Node.Creator.unaryMinus(negFac));
      _.set(newNode, path, newFac);
      _.get(newNode, path).changeGroup = idx + 1;
    });
  });

  return new Status(ChangeTypes.NEGATE_OP_FACS, oldNode, newNode);
}

function rmOpposFacsParensStep(node, opEqFacs) {
  const oldNode = _.cloneDeep(node);
  const newNode = _.cloneDeep(node);
  opEqFacs.forEach((opEqFac, idx) =>
    opEqFac.oppos.forEach(opFac => {
      // ChangeGroup will be the whole term
      _.get(newNode, opFac.termPath).changeGroup = idx + 1;

      // The opposite node has a unaryMinus inside parentheses in its top level
      // Remove this minus
      _.set(newNode, opFac.path, _.get(newNode, opFac.path).content.args[0]);

      // Now change the sign of the term
      // Go up the tree until we are at a node that is the second arg of a + or - operation
      let opPath = opFac.termPath;
      while (_.last(opPath.split('.')) !== 'args[1]'
             && opPath !== '') {
        opPath = Util.getParentPath(opPath);
      }

      let opNode;
      if (opPath === 'args[1]') {
        opPath = Util.getParentPath(opPath);
        opNode = (opPath !== '')
          ? _.get(newNode, opPath)
        // Else, the factor is in the 2nd arg of the top node
        // So the operation to negate is the top node
          : newNode;

        // Change the sign of that operation
        if (NodeType.isOperator(opNode, '+')) {
          if (opNode === newNode) {
            Util.modifyNode(newNode, Node.Creator.operator('-', opNode.args));
          }
          else {
            _.set(newNode, opPath, Node.Creator.operator('-', opNode.args));
          }
        }
        else if (NodeType.isOperator(opNode, '-')) {
          if (opNode === newNode) {
            Util.modifyNode(newNode, Node.Creator.operator('+', opNode.args));
          }
          else {
            _.set(newNode, opPath, Node.Creator.operator('+', opNode.args));
          }
        }
      }
      else {
        // opPath === ''
        // The factor is in the first arg of the top node
        // The factor term should be negated
        const term = _.get(newNode, opFac.termPath);
        if (NodeType.isUnaryMinus(term)) {
          _.set(newNode, opFac.termPath, term.args[0]);
        }
        else {
          _.set(newNode, opFac.termPath, Node.Creator.unaryMinus(term));
        }
      }
    })
  );

  return new Status(ChangeTypes.MINUS_OUTSIDE_PARENS, oldNode, newNode);
}

// Write all factors the same way
function equalizeOpEqFacsStep(node, opEqFacs) {
  const oldNode = _.cloneDeep(node);
  Status.resetChangeGroups(oldNode);
  const newNode = _.cloneDeep(oldNode);

  opEqFacs.forEach((opEqFac, idx) => {
    const eqNode = opEqFac.equal[0].val;

    _.slice(opEqFac.equal, 1).forEach(eqFac => {
      if (eqNode.toString() !== eqFac.val.toString()) {
        _.get(oldNode, eqFac.path).changeGroup = idx + 1;

        _.set(newNode, eqFac.path, _.cloneDeep(eqNode));
        _.get(newNode, eqFac.path).changeGroup = idx + 1;
      }
    });

    opEqFac.oppos.forEach(opFac => {
      if (eqNode.toString() !== opFac.val.toString()) {
        _.get(oldNode, opFac.path).changeGroup = idx + 1;

        _.set(newNode, opFac.path, _.cloneDeep(eqNode));
        _.get(newNode, opFac.path).changeGroup = idx + 1;
      }
    });
  });
  if (oldNode.toString() !== newNode.toString()) {
    return new Status(ChangeTypes.EQUALIZE_TERM_FACTORS, oldNode, newNode);
  }
  else {
    return Status.noChange(node);
  }
}

// Returns the step to equalize the factors, i.e. when two factors are
// themselves polynomials and are opposite each other, this function negates
// the opposite factors such that they become equal to the other. This prepares
// the polynomial to have this factor isolated.
//
// e.g. '3 * (x - 1) + 2 * (1 - x)' becomes '3 * (x - 1) + 2 * (-1) * (x - 1)'
function equalizeFacs(node) {
  const opEqFacs = Polynom.opEqFacs(node);
  if (opEqFacs.length === 0) { return Status.noChange(node); }

  const substeps = [];

  // Find opposite factors in terms
  substeps.push(findOppositeFactorsStep(node, opEqFacs));

  // Put a minus outside the brackets of the opposite
  // factors, changing signs inside the brackets
  const isolateMinStep = minOutsideOppositeFactorsStep(node, opEqFacs);
  substeps.push(isolateMinStep);

  // Remove the brackets around the opposite factors,
  // merging all minuses into a single sign before the term
  const rmParensStep = rmOpposFacsParensStep(isolateMinStep.newNode, opEqFacs);
  substeps.push(rmParensStep);


  // Write all factors the same way
  const eqzedStep = equalizeOpEqFacsStep(rmParensStep.newNode, opEqFacs);
  if (eqzedStep.hasChanged()) {
    substeps.push(eqzedStep);
  }

  // Compose the single step itself
  const oldNode = _.cloneDeep(node);
  const newNode = _.cloneDeep(Status.resetChangeGroups(_.last(substeps).newNode));
  opEqFacs.forEach((opEqFac, idx) =>
    opEqFac.oppos.forEach(opFac => {
      _.get(newNode, opFac.termPath).changeGroup = idx + 1;
      _.get(oldNode, opFac.termPath).changeGroup = idx + 1;
    })
  );
  return new Status(ChangeTypes.EQUALIZE_TERM_FACTORS, oldNode, newNode, substeps);
}

module.exports = equalizeFacs;
