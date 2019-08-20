const ChangeTypes = require('../../ChangeTypes');
const Node = require('../../node');
const NodeType = require('../../node/Type');
const Status = require('../../node/Status');

const simplExpr = require('../../simplifyExpression/stepThrough');

const Expon = require('../../expon/Expon');
const Factor = require('../../factor/Factor');
const Polynom = require('../../polynom/Polynom');
const putEqualFacsOutsideParensStep = require('./equalFacs');
const Term = require('../../term/Term');

const _ = require('lodash');
const math = require('mathjs');


// Simplify the exponent
// e.g. x^(2 + 3) -> x^5
//      x^2^3 -> x^6
function simplifyExponents(node) {
  const firstNode = node.cloneDeep();

  let oldNode = firstNode.cloneDeep();
  const substeps = [];

  // First, collapse the exponents
  const collapseStep = Polynom.Polynom.iterateTermFacsWithStep(node,
    ChangeTypes.COLLAPSE_EXPONENTS,
    (termPath, facPath, oldNode, newNode, term, fac) => {
      const newFac = Expon.collapseExponents(fac);
      if (`${newFac}` !== `${fac}`) {
        return newFac;
      }
    });

  if (collapseStep.hasChanged()) {
    substeps.push(collapseStep);
    oldNode = Status.resetChangeGroups(collapseStep.newNode);
  }

  // Then, simplify the exponent
  let simplifySubsteps = [];
  const simplifyStep = Polynom.iterateTermFacsWithStep(oldNode, ChangeTypes.SIMPLIFY_EXPONENTS,
    (termPath, facPath, oldNode, newNode, term, fac) => {
      if (NodeType.isOperator(fac, '^')) {
        const expon = fac.args[1];
        let substeps = simplExpr(expon);
        if (substeps.length > 0) {
          substeps = Status.putStepsInNodePath(
            newNode.cloneDeep(),
            `${facPath}.args[1]`,
            substeps);
          simplifySubsteps = simplifySubsteps.concat(substeps);

          return _.get(_.last(simplifySubsteps).newNode, facPath).cloneDeep();
        }
      }
    }
  );

  if (simplifyStep.hasChanged()) {
    simplifyStep.substeps = simplifySubsteps;
    substeps.push(simplifyStep);
  }

  if (substeps.length > 0) {
    const lastNode = Status.resetChangeGroups(_.last(substeps).newNode.cloneDeep());
    const step = Polynom.iterateTermFacsWithStep(firstNode, ChangeTypes.SIMPLIFY_EXPONENTS,
      (termPath, facPath, oldNode, newNode, term, fac) => {
        const newFac = _.get(lastNode, facPath);
        if (`${fac}` !== `${newFac}`) {
          return newFac;
        }
      });
    step.substeps = substeps;
    return step;
  }
  else {
    return Status.noChange(node);
  }
}

// Split exponents into factors
// e.g. x^(m + 1) -> x^m * x^1
function splitExponents(node) {
  return Polynom.iterateTermFacsWithStep(node, ChangeTypes.SPLIT_EXPONENT_TERMS,
    (termPath, facPath, oldNode, newNode, term, fac) => {
      if (!NodeType.isOperator(fac, '^')) {
        return;
      }

      let exp = fac.args[1];
      if (NodeType.isParenthesis(exp)) {
        exp = exp.content;
      }

      const expTerms = Term.getTerms(exp);

      if (expTerms.length > 1) {
        return Node.Creator.operator(
          '*',
          expTerms.map(exp => Node.Creator.operator('^', [fac.args[0], exp])),
          false, true);
      }
    });
}

function putExponFacsOutsideParensStep(node) {
  let oldNode = _.cloneDeep(node);
  let newNode = _.cloneDeep(node);
  const substeps = [];

  // Remove all exponents
  const tempNode = _.cloneDeep(newNode);
  Polynom.iterateTermFacs(tempNode, (termPath, facPath, term, fac) => {
    if (NodeType.isOperator(fac, '^')) {
      _.set(tempNode, facPath, fac.args[0]);
    }
  });

  // Get equal factor paths in adjusted expression
  let addedExpOne = false;
  const facsWithExp = {};
  Term.getCommonFactorPaths(tempNode).forEach(term => {
    term.forEach(facPath => {
      // Use the path to obtain the original factor (with exponent)
      let fac = _.get(newNode, facPath);
      if (!NodeType.isOperator(fac, '^')) {
        fac = Node.Creator.operator('^', [fac, math.parse('1')]);
        _.set(newNode, facPath, fac);

        _.get(newNode, facPath).changeGroup = 1;
        _.get(oldNode, facPath).changeGroup = 1;
        addedExpOne = true;
      }

      if (NodeType.isOperator(fac, '^')) {
        let exp = fac.args[1];
        if (NodeType.isParenthesis(exp)) {
          exp = exp.content;
        }

        // Check if there is an integer in the factors of the exponent
        if (!Factor.getFactors(exp).some(expFac => NodeType.isConstant(expFac)
          && Number.isInteger(parseFloat(expFac.value)))) {
          // If not, multiply the exponent by 1

          fac.args[1] = Node.Creator.operator('*', [math.parse('1'), exp]);
          _.set(newNode, facPath, fac);

          _.get(newNode, facPath).changeGroup = 1;
          _.get(oldNode, facPath).changeGroup = 1;
          addedExpOne = true;
        }
      }

      // Push the facPath to a list of exponents with the same base
      const base = `${fac.args[0]}`;
      if (base in facsWithExp) {
        facsWithExp[base].push(facPath);
      }
      else {
        facsWithExp[base] = [facPath];
      }
    });
  });

  if (addedExpOne) {
    substeps.push(new Status(ChangeTypes.ADD_EXPONENT_OF_ONE,
      _.cloneDeep(oldNode), _.cloneDeep(newNode)));
    newNode = Status.resetChangeGroups(newNode);
    oldNode = newNode.cloneDeep();
  }

  // For each factor with a constant exponent, find the smallest exponent
  const minExpPerBase = {};
  _.forOwn(facsWithExp, (facPaths, base) => {
    const exps = facPaths.map(path => _.get(newNode, path).args[1]);

    if (exps.every(exp => NodeType.isConstant(exp)
      && Number.isInteger(parseFloat(exp.value))
      && parseInt(exp.value) > 0)) {
      // If all exponents are positive integer numbers,
      // find the smallest exponent
      minExpPerBase[base] = exps.reduce((acc, curVal) => acc < curVal ? acc : curVal);
    }
    else {
      const pseudoExpr =  Node.Creator.operator('+',
        exps.map(n => NodeType.isParenthesis(n) ? n.content : n),
        false, false);
      const comFacPaths = Term.getCommonFactorPaths(pseudoExpr);

      if (comFacPaths.length > 0 && comFacPaths[0].length > 0) {
        // The exponents have a common factor
        const comFacs = comFacPaths[0].map(p => _.get(pseudoExpr, p));

        // Store the common factor as a single expression
        const comFacsExpr = Node.Creator.operator('*', comFacs, false, true);

        // Remove the common factor from each exponent
        // and keep the first non-common factor
        const noComExps = exps.map(exp => {
          if (NodeType.isParenthesis(exp)) {
            exp = exp.content;
          }
          const noComs = Factor.getFactors(exp)
            .filter(fac => !_.includes(comFacs.map(f => `${f}`), `${fac}`));
          if (noComs.length > 0) {
            return Node.Creator.operator('*', noComs, false, true);
          }
          else {
            return math.parse('1');
          }
        });

        // Check if the non-common part are all positive integers
        if (noComExps.every(exp => NodeType.isConstant(exp)
          && Number.isInteger(parseFloat(exp.value))
          && parseInt(exp.value) > 0)) {
          // Find the smallest exponent and add the common part to it
          minExpPerBase[base] = Node.Creator.operator('*',
            [noComExps.reduce((acc, curVal) => acc < curVal ? acc : curVal),
              comFacsExpr]);
        }
      }
      // If the exponents don't fit in any of the above cases, ignore that base
    }
  });

  // Split the exponents of the factors with a larger exponent into the
  // smallest exponent + a rest-exponent
  let splitExpons = false;
  _.toPairs(facsWithExp).forEach(([base, facPaths], idx) => {
    const minExp = minExpPerBase[base];
    facPaths.forEach(facPath => {
      const fac = _.get(newNode, facPath);
      const exp = fac.args[1];
      if (exp !== minExp) {
        const newExp = math.simplify(Node.Creator.operator('-', [exp, minExp]));
        if (newExp.value === '0') {
          fac.args[1] = minExp, newExp;
        }
        else {
          fac.args[1] = Node.Creator.operator('+', [minExp, newExp]);
        }

        splitExpons = true;
      }
      _.get(newNode, facPath).changeGroup = idx + 1;
      _.get(oldNode, facPath).changeGroup = idx + 1;
    });
  });

  if (splitExpons) {
    substeps.push(new Status(ChangeTypes.SPLIT_INTEGER_EXPONENTS,
      _.cloneDeep(oldNode), _.cloneDeep(newNode)));
    oldNode = Status.resetChangeGroups(oldNode);
    newNode = Status.resetChangeGroups(newNode);
  }

  // Split the exponent terms
  const splitExponsStep = splitExponents(newNode);
  if (splitExponsStep.hasChanged()) {
    substeps.push(splitExponsStep);
    newNode = Status.resetChangeGroups(splitExponsStep.newNode.cloneDeep());
    oldNode = newNode.cloneDeep();
  }

  // Put the common factor outside the parentheses
  const eqFacsOutside = putEqualFacsOutsideParensStep(newNode);
  if (eqFacsOutside.hasChanged()) {
    substeps.push(eqFacsOutside);
    newNode = Status.resetChangeGroups(eqFacsOutside.newNode.cloneDeep());
    oldNode = newNode.cloneDeep();
  }

  // If there is an exponent "1" in the factor outside the parens, remove it
  let removedExponOne = false;
  Factor.getFactorPaths(newNode).forEach(facPath => {
    const fac = _.get(newNode, facPath);
    if (NodeType.isOperator(fac, '^')) {
      const expFacs = Factor.getFactors(fac.args[1]);
      const newExpFacs = expFacs.filter(expFac => expFac.value !== '1');
      if (newExpFacs.length < expFacs.length) {
        const newExp = Node.Creator.operator('*', newExpFacs, false, true);
        fac.args[1] = newExp;

        _.get(newNode, facPath).changeGroup = 1;
        _.get(oldNode, facPath).changeGroup = 1;
        removedExponOne = true;
      }
    }
  });
  if (removedExponOne) {
    substeps.push(new Status(ChangeTypes.REMOVE_EXPONENT_BY_ONE,
      _.cloneDeep(oldNode), _.cloneDeep(newNode)));
    oldNode = Status.resetChangeGroups(oldNode);
    newNode = Status.resetChangeGroups(newNode);
  }


  return new Status(ChangeTypes.EXPON_FACTORS_OUTSIDE_PARENS, oldNode, newNode, substeps);
}

module.exports = {
  splitExponents,
  simplifyExponents,
  putExponFacsOutsideParensStep,
};
