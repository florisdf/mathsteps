const math = require('mathjs');
const Factor = require('../factor/Factor');

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

module.exports = Term;