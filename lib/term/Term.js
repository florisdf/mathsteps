const math = require('mathjs');

const Factor = require('../factor/Factor');
const Negative = require('../Negative');
const Node = require('../node');
const NodeType = require('../node/Type');
const simplify = require('../simplifyExpression/simplify');
const Util = require('../util/Util');

const Term = {};

// Given an expression (symbolic or not), returns a list of all terms by
// simply splitting the top-level additions (and subtractions).
// e.g. x + 2 becomes [x, 2]
//      x - 2 becomes [x, -2]
//      (x - 2) becomes [(x -2)] as it does not contain a top-level + or -
Term.getTerms = function(node) {
  const terms = [];

  if (node.op === '+') {
    node.args.forEach(n =>
      terms.push(...Term.getTerms(n)));
  }
  else if (node.op === '-' && node.args.length > 1) {
    terms.push(...Term.getTerms(node.args[0]));
    terms.push(...Term.getTerms(Negative.negate(node.args[1])));
  }
  else {
    terms.push(node);
  }
  return terms;
};

// Convert a list of terms (nodes) to a single node
// e.g. ['-x', '1', '-3y'] becomes '-x + 1 - 3 y'
Term.termsToNode = function(terms) {
  return terms.reduce((termsAcc, term) => {
    if (NodeType.isUnaryMinus(term)) {
      return Node.Creator.operator('-', [termsAcc, term.args[0]]);
    }
    else if (term.args
      && ( term.op === '*' || term.op === '/' )
      && NodeType.isUnaryMinus(term.args[0])) {
      const absTerm = new math.expression.node.OperatorNode(
        term.op, term.fn,
        [term.args[0].args[0], term.args[1]]);

      absTerm.implicit = term.implicit;
      return Node.Creator.operator('-', [termsAcc, absTerm]);
    }
    else {
      return Node.Creator.operator('+', [termsAcc, term]);
    }
  });
};

// Given a term (symbolic or not), factorizes the expression and returns
// a dictionary with the factor as key and the number of times it occured as
// value.
// e.g. 12x^2 * y^3 becomes {'2': 2, '3': 1, 'x': 2, 'y': 3}
//
// NOTE that the keys of the returned object are string representations of the
// factors
Term.getFactorCounts = function(node) {
  const factors = Factor.getFactors(node);

  const factorCounts = {};
  factors.forEach(f => {
    f = math.simplify(simplify(f));
    const knownFacs = Object.keys(factorCounts);
    if (knownFacs.length === 0) {
      factorCounts[f] = 1;
    }
    else {
      const equalFacs = knownFacs.filter(k => Term.areEqual(k, f));
      if (equalFacs.length > 0) {
        factorCounts[equalFacs[0]] += 1;
      }
      else {
        factorCounts[f] = 1;
      }
    }
  });
  return factorCounts;
};

// Given a list of terms (symbolic or not), returns a list of common
// factors, factorizing all numbers into primes and expanding exponents into
// factors where possible.
// e.g. [12x^2 * y^3, 3x * y^2] becomes [3, x, y, y]
Term.getCommonFactors = function(nodes) {
  const facsPerTerm = nodes.map(n => Factor.getFactors(n));
  const nFacsPerTerm = facsPerTerm.map(facs => facs.length);

  const facCountsPerTerm = nodes.map(n => Term.getFactorCounts(n));

  // Get the factors of the term with the least amount of factors
  const idx = nFacsPerTerm.indexOf(Math.min(...nFacsPerTerm));
  const facs = Object.keys(facCountsPerTerm[idx]).map(f => math.parse(f));

  // For each factor, keep the minimum count present in all terms
  const commonFacs = [];
  facs.forEach(
    fac => { // Find how many factors like this there are in each term
      // Keep the minimum number present
      const facFreq = Math.min(
        ...facCountsPerTerm.map(
          facCounts => fac in facCounts ? facCounts[fac] : 0)
      );
      for (let i=0; i < facFreq; i++) {
        commonFacs.push(fac);
      }
    }
  );
  return commonFacs;
};

// Given a list of terms (symbolic or not), returns the greatest common
// divisor as a mathjs node.
// e.g. [12x^2 * y^3, 3x * y^2] yields '3x*y^2'
// and ['18', '12'] yields '6'
Term.gcd = function(nodes) {
  const comFacs = Term.getCommonFactors(nodes);
  if (comFacs.length === 0) {
    comFacs.push(math.parse('1'));
  }
  return math.simplify(comFacs.map(fac => `(${fac.toString()})`).join('*'));
};

// Given two terms, returns whether the terms are equal
Term.areEqual = function(node1, node2) {
  const facs1 = Factor.getFactors(math.simplify(simplify(node1)));
  const facs2 = Factor.getFactors(math.simplify(simplify(node2)));
  return Util.haveSameNodes(facs1, facs2);
};

// Given two terms, returns whether the terms are opposite each
// other
Term.areOpposite = function(node1, node2) {
  // Check if the second term equals the first
  // after negate + expand + simplify
  const invNode2 = math.simplify(`-1 * ${node2}`);
  return Term.areEqual(node1, invNode2);
};

module.exports = Term;
