const checks = require('../checks');
const Node = require('../node');
const Status = require('../node/Status');
const ChangeTypes = require('../ChangeTypes');

const factorQuadratic = require('./factorQuadratic');

const flattenOperands = require('../util/flattenOperands');
const print = require('../util/print');
const removeUnnecessaryParens = require('../util/removeUnnecessaryParens');
const removeNegOne = require('../simplifyExpression/basicsSearch/removeMultiplicationByOne');

const Factor = require('../factor/Factor');
const Term = require('../term/Term');
const Polynom = require('../polynom/Polynom');
const math = require('mathjs');

// Transform each factor in the node using the callback and return the new node
// The callback has arguments (factorNode, termIndex, factorIndex)
function mapFactors(node, callback) {
  let newTermFacs = Term.getTerms(node).map((term, termIndex) =>
    Factor.getFactors(term).map((factor, factorIndex) => {
      if (typeof(factor) === 'undefined') {
        console.log('Found ya!');
      }
      return callback(factor, termIndex, factorIndex);
    })
  );
  return Polynom.termFacsToNode(newTermFacs);
}

// Returns the node obtained by applying the callback to all opposite factors,
// given by opposFacs.  The callback takes the factor and the index in
// opposFacs as an argument: (factor, opFacIdx)
function mapOppositeFactors(node, opposFacs, callback) {
  return mapFactors(node, (fac, tIdx, fIdx) => {
      // Check if this factor is one of the opposite factors that needs to be negated
      // The filter operation should return a list of either a single or no elements
      const opFacs = opposFacs.filter(opFac =>
      opFac.term === tIdx && opFac.fac === fIdx);

      if (opFacs.length > 0) {
        // This factor is an opposite factor
        const opFac = opFacs[0];
        callback(fac, opFac.opEqFacIdx);
      } else {
        // This factor is no opposite factor, so just return it as is
        return fac;
      }
    });
}

// Returns the steps to equalize the factors, i.e. when two factors are
// themselves polynomials and are opposite each other, this function negates
// the opposite factors such that they become equal to the other. This prepares
// the polynomial to have this factor isolated.
//
// e.g. '3 * (x - 1) + 2 * (1 - x)' becomes '3 * (x - 1) + 2 * (-1) * (x - 1)'
function equalizeFacs(node) {
  const steps = [];

  // Find opposite factors in terms
  const opEqFacs = Polynom.opEqFacs(node);
  if (opEqFacs.length === 0) { return []; }
  
  const opposFacs = opEqFacs.reduce(
    (acc, opeqfac, idx) => {
      opeqfac.oppos = opeqfac.oppos.map(
        fac => {
          fac.opEqFacIdx = idx;
          return fac;
        });
      return acc.concat(opeqfac.oppos);
    }, []
  );

  const findOpFacsNode = mapOppositeFactors(node.cloneDeep(), opposFacs,
    (fac, idx) => {
      fac.changeGroup = idx;
      return fac;
  });

  steps.push(new Status(ChangeTypes.FIND_OP_FACS,
    oldNode=node,
    newNode=findOpFacsNode))

  // Isolate a factor -1 from the opposite 
  // factors, changing signs in the brackets
  const negOpFacsNode = mapOppositeFactors(node.cloneDeep(), opposFacs,
    (fac, idx) => {
      const negFac = Polynom.negate(fac);
      const newFac = Node.Creator.operator('*', ['(-1)', negFac]);
      newFac.changeGroup = idx;
      return newFac;
    });
  steps.push(new Status(ChangeTypes.NEGATE_OP_FACS,
    oldNode=findOpFacsNode,
    newNode=negOpFacsNode))
  
  // Combine all -1's in each term to determine the final sign of each term
  let oldNode = math.parse(`${negOpFacsNode}`);
  let newStatus = removeNegOne(oldNode);
  if (newStatus.hasChanged) {
    steps.push(newStatus);
    oldNode = newStatus.newNode;
  }
  return steps;

  // Simplify the factors such that they are all the same
}


// Returns the steps to isolate the common factors from a polynomial
function isolateComFacs(node) {
  // Factorize the coefficients into primes and expand symbols with exponents
  // Look for common parts
  // Put the common parts outside the brackets
  // Simplify the factors outside the brackets and the terms inside the brackets
  return [];
}


// Given a mathjs expression node, takes the necessary steps to isolate the
// common factors in the expression
// Returns the steps taken
function isolate(node) {
  const steps = [];

  // Equalize the factors of the terms
  let facsEqSteps = equalizeFacs(node);
  if (facsEqSteps.length > 0) {
    steps.push(new Status(ChangeTypes.EQUALIZE_TERM_FACTORS,
                          oldNode=node,
                          newNode=facsEqSteps[-1].newNode,
                          substeps=facsEqSteps));
    node = facsEqSteps[-1].newNode;
  }

  // Isolate the common factors
  let isolSteps = isolateComFacs(node);
  if (isolSteps.length > 0) {
    steps.push(new Status(ChangeTypes.ISOLATE_COMMON_FACTOR,
                          oldNode=node,
                          newNode=isolSteps[-1].newNode,
                          substeps=isolSteps));
  }
  return steps;
}

// Given a mathjs expression node, steps through factoring the expression.
// Returns a list of details about each step.
function stepThrough(node, debug=false) {
  if (debug) {
    // eslint-disable-next-line
    console.log('\n\nFactoring: ' + print.ascii(node, false, true));
  }

  if (checks.hasUnsupportedNodes(node)) {
    return [];
  }

  let nodeStatus;
  const steps = [];

  node = flattenOperands(node);
  node = removeUnnecessaryParens(node, true);

  // Check the amount of terms
  const terms = Term.getTerms(node);
  if (terms.length === 1) {
    // There is only 1 term, so there is nothing to factorize
    return [];
  }

  // Isolate factor
  // isolateCommonFactor(node).forEach(s => steps.push(s));

  // If not, check if of (general) form a^2 + 2ab + b^2 or a^2 - b^2
  // Note that things like x^2 - 2x + 1 - a^2 should be recognised as (x - 1)^2 - a^2
  // Else if square, try with sum and product
  if (checks.isQuadratic(node)) {
    nodeStatus = factorQuadratic(node);
    if (nodeStatus.hasChanged()) {
      steps.push(nodeStatus);
    }
  }
  // Else if square, try with discriminant
  // Else, try to divide by x - a and factorize
  // Else, we can't factorize any further
  return steps;
}

// module.exports = stepThrough;
module.exports = {
  stepThrough: stepThrough,
  isolate: isolate
};
