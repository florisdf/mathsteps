const math = require('mathjs');
const Factor = require('../factor/Factor');
const simplify = require('../simplifyExpression/simplify');
const Util = require('../util/Util');

const Term = {};

// Given an expression (symbolic or not), returns a list of all terms by
// simply splitting the top-level additions (and subtractions).
// e.g. x + 2 becomes [x, 2]
//      x - 2 becomes [x, -2]
//      (x - 2) becomes [(x -2)] as it does not contain a top-level + or -
Term.getTerms = function(node) {
  let terms = [];

  if (node.op === '+') {
    node.args.forEach(n =>
      terms.push(...Term.getTerms(n)));
  } else if (node.op === '-' && node.args.length > 1) {
    terms.push(...Term.getTerms(node.args[0]));

    let opposite = math.parse('-' + node.args[1].toString());
    terms.push(...Term.getTerms(opposite));
  } else {
    terms.push(node);
  }
  return terms;
};

// Given a term (symbolic or not), factorizes the expression and returns
// a dictionary with the factor as key and the number of times it occured as
// value.
// e.g. 12x^2 * y^3 becomes {'2': 2, '3': 1, 'x': 2, 'y': 3}
//
// NOTE that the keys of the returned object are string representations of the
// factors
Term.getFactorCounts = function(node) {
  let factors = Factor.getFactors(node);

  let factorCounts = {};
  factors.forEach(f => f in factorCounts ? factorCounts[f] += 1 : factorCounts[f] = 1);
  return factorCounts;
}

// Given a list of terms (symbolic or not), returns a list of common
// factors, factorizing all numbers into primes and expanding exponents into
// factors where possible.
// e.g. [12x^2 * y^3, 3x * y^2] becomes [3, x, y, y]
Term.getCommonFactors = function(nodes) {
  let facsPerTerm = nodes.map(n => Factor.getFactors(n));
  let nFacsPerTerm = facsPerTerm.map(facs => facs.length);

  let facCountsPerTerm = nodes.map(n => Term.getFactorCounts(n));

  // Get the factors of the term with the least amount of factors
  let idx = nFacsPerTerm.indexOf(Math.min(...nFacsPerTerm));
  let facs = Object.keys(facCountsPerTerm[idx]).map(f => math.parse(f));

  // For each factor, keep the minimum count present in all terms
  let commonFacs = [];
  facs.forEach(
    fac =>
    // Find how many factors like this there are in each term
    {
      // Keep the minimum number present
      let facFreq = Math.min(
        ...facCountsPerTerm.map(
          facCounts => fac in facCounts ? facCounts[fac] : 0)
      );
      for (let i=0; i < facFreq; i++) {
        commonFacs.push(fac);
      }
    }
  );
  return commonFacs;
}

// Given a list of terms (symbolic or not), returns the greatest common
// divisor as a mathjs node.
// e.g. [12x^2 * y^3, 3x * y^2] yields '3x*y^2'
// and ['18', '12'] yields '6'
Term.gcd = function(nodes) {
  const comFacs = Term.getCommonFactors(nodes);
  if (comFacs.length == 0) {
    comFacs.push(math.parse('1'));
  }
  return math.simplify(comFacs.map(fac => `(${fac.toString()})`).join('*'));
}

// Given two terms, returns whether the terms are equal
Term.areEqual = function(node1, node2) {
  let facs1 = Factor.getFactors(node1);
  let facs2 = Factor.getFactors(node2);
  return Util.haveSameNodes(facs1, facs2);
}

// Given two terms, returns whether the terms are opposite each
// other
Term.areOpposite = function(node1, node2) {
  // Check if the second term equals the first
  // after negate + expand + simplify
  let invNode2 = math.simplify(`-1 * ${node2}`);
  return Term.areEqual(node1, invNode2);
}

// Returns an object that contains the index of a term as property and an array 
// of indices describing the opposite terms as value.
// An index will only appear once in the dictionary; either as key or in the 
// list of indices that is the value of a certain key. The dict will be 
// optimized to contain as much indices in the value as possible.
// e.g. [-x, x, -x, 1, -1, 1] will return {1: [0, 2], 4: [3, 5]}
Term.getOpTerms = function(terms) {
  let opTerms = terms.map((t1, idx1) =>
    terms.map((t2, idx2) => idx2)
    .filter(idx2 => Term.areOpposite(t1, terms[idx2])));

  let opTermsObj = { ...opTerms };

  // Argsort by number of opposite terms
  let nArgSorted = opTerms.map((ts, idx) => [ts.length, idx])
    .sort(([len1], [len2]) => len2 - len1)
    .reverse()
    .map(([, idx]) => idx);

  // Remove redundant keys
  for (let i = 0; i < nArgSorted.length; i++) {
    let termIdxs = opTermsObj[nArgSorted[i]];
    if (typeof termIdxs !== 'undefined') {
      termIdxs.forEach(idx => delete opTermsObj[idx]);
    }
  }

  return opTermsObj;
}

// Returns the opposite of the given term
// E.g. -3x becomes 3x
Term.negate = function(term) {

}

module.exports = Term;
