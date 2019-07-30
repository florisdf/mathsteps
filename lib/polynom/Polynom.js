const math = require('mathjs');

const Factor = require('../factor/Factor');
const Term = require('../term/Term');
const simplify = require('../simplifyExpression/simplify');

const Polynom = {};

// Divides a given polynomial by a non-polynomial divisor
Polynom.divide_np = function(node, divisor) {
  let terms = Term.getTerms(node);
  if (terms.length > 1) {
    // Multiple terms, so divide each term
    let quots = terms.map(t => Polynom.divide_np(t, divisor));

    // Join all quotients in a summation
    quot = quots.map(q => `(${q.toString()})`).join('+');
    return math.simplify(quot);
  }

  let nodeFacs = Factor.getFactors(node)
                        .map(fac => math.simplify(fac).toString());
  let divFacs = Factor.getFactors(divisor)
                      .map(fac => math.simplify(fac).toString());

  if (!divFacs.every(f => nodeFacs.includes(f))) {
    throw "Node is not divisible by divisor";
  }

  let nodeFacIdxs = [];
  divFacs.forEach((fac, idx) => {
    let nodeFacIdx = nodeFacs.indexOf(fac);
    if (nodeFacIdxs.includes(nodeFacIdx)) {
      // This factor occurs more than once in divFacs
      nodeFacIdx = nodeFacs.indexOf(fac, nodeFacIdx + 1);
    }
    nodeFacIdxs.push(nodeFacIdx);
  });

  let quotFacs = nodeFacs.filter((fac, idx) => !nodeFacIdxs.includes(idx));
  if (quotFacs.length === 0) {
    quotFacs.push('1');
  }
  return math.simplify(quotFacs.map(fac => `(${fac.toString()})`).join('*'));
};

// Isolate the factor from the give node
// e.g. node 'x^2 + x' and factor 'x' return 'x * (x + 1)'
Polynom.isolate = function(node, factor) {
   try {
     let quot = Polynom.divide_np(node, factor);
   } catch(e) {
     throw "Can't isolate factor from node"
   }
  return math.simplify(`( ${factor.toString()} ) *`
    + `( ${quot.toString()} )`);
}

// Given two polynomials, returns whether the polynomials are equal
Polynom.areEqual = function(node1, node2) {
  // Check if the second expression equals the first
  // after negate + expand + simplify
  return math.simplify(simplify(node1).toString()).toString()
    === math.simplify(simplify(node2).toString()).toString();
}

// Given two polynomials, returns whether the polynomials are opposite each
// other
Polynom.areOpposite = function(node1, node2) {
  // Check if the second expression equals the first
  // after negate + expand + simplify
  let invNode2 = math.parse(`-(${node2})`);
  return Polynom.areEqual(node1, invNode2);
}

module.exports = Polynom;
