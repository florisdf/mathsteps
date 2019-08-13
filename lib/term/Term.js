const _ = require('lodash');
const math = require('mathjs');

const Factor = require('../factor/Factor');
const Node = require('../node');
const NodeType = require('../node/Type');
const simplify = require('../simplifyExpression/simplify');
const Util = require('../util/Util');

const Term = {};

// Given an expression (symbolic or not), returns a list of the JSON paths of
// all terms by simply splitting the top-level additions (and subtractions).
// Note that no information is given on the sign of the operation before the
// term. This, however, can be easily achieved by looking at the parent of the
// term.
// e.g. x + 2 becomes ['args[0]', 'args[1]']
//      x - 2 becomes ['args[0]', 'args[1]']
//      x - 2 + 3a becomes ['args[0].args[0]', 'args[0].args[1]', 'args[1]']
//      (x - 2) becomes [''] as it does not contain a top-level + or -
Term.getTermPaths = function(node) {
  const terms = [];

  if (NodeType.isOperator(node, '+') || NodeType.isOperator(node, '-')) {
    node.args.forEach((n, idx) =>
      terms.push(
        ...Term.getTermPaths(n)
          .map(path => {
            if (path) {
              return `args[${idx}].${path}`;
            }
            else {
              return `args[${idx}]`;
            }
          })
      )
    );
  }
  else {
    terms.push('');
  }
  return terms;
};

// Given an expression (symbolic or not), returns a list of all terms by
// simply splitting the top-level additions (and subtractions).
// e.g. x + 2 becomes [x, 2]
//      x - 2 becomes [x, -2]
//      (x - 2) becomes [(x -2)] as it does not contain a top-level + or -
Term.getTerms = function(node) {
  return Term.getTermPaths(node).map(p => {
    const parPath = Util.getParentPath(p);

    let parNode;
    if (!parPath) {
      parNode = node;
    }
    else {
      parNode = _.get(node, parPath);
    }

    if (NodeType.isOperator(parNode, '-')
      && _.last(_.split(p, '.')) === 'args[1]') {
      return Node.Creator.unaryMinus(_.get(node, p));
    }
    else if (!p) {
      return node;
    }
    else {
      return _.get(node, p);
    }
  });
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

// Given a term (symbolic or not), splits the term into factors and returns a
// dictionary with the factor as key and the number of times it occured as
// value.
// e.g. 2*2*3*x^2 * y^3 becomes {'2': 2, '3': 1, 'x^2': 1, 'y^3': 1}
//
// NOTE that the keys of the returned object are string representations of the
// factors
Term.getFactorCounts = function(node) {
  const factors = Factor.getFactors(node);

  const factorCounts = {};
  factors.forEach(f => {
    const knownFacs = Object.keys(factorCounts);
    if (knownFacs.length === 0) {
      factorCounts[f] = 1;
    }
    else {
      const equalFacs = knownFacs.filter(k => `${k}` === `${f}`);
      if (equalFacs.length > 0) {
        factorCounts[equalFacs[0]]++;
      }
      else {
        factorCounts[f] = 1;
      }
    }
  });
  return factorCounts;
};


// Given an expression, returns a list of lists with paths that contain the
// same factors
// e.g. 2 * 3 * x + 3 * x becomes [['args[0].args[0].args[1]', // The 3 in the 1st term
//                                  'args[0].args[1]'],        // The x in the 1st term
//                                 ['args[1].args[0]',         // The 3 in the 2nd term
//                                  'args[1].args[1]']]        // The x in the 2nd term
Term.getCommonFactorPaths = function(node) {
  const terms = Term.getTerms(node);
  const facsPerTerm = terms.map(n => Factor.getFactors(n));
  const nFacsPerTerm = facsPerTerm.map(facs => facs.length);

  const facCountsPerTerm = terms.map(n => Term.getFactorCounts(n));

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

      // Iterate through each term and push the paths of the factors that are
      // equal to this factor, until we have facFreq factors for this term
      Term.getTermPaths(node).forEach((termPath, tIdx) => {
        const term = termPath
          ? _.get(node, termPath)
          : node;

        if (tIdx >= commonFacs.length) {
          commonFacs.push([]);
        }
        let nFacsPushed = 0;

        Factor.getFactorPaths(term).forEach(facPath => {
          facPath = termPath
            ? facPath
              ? `${termPath}.${facPath}`
              : termPath
            : facPath;

          const termFac = facPath
            ? _.get(node, facPath)
            : node;

          if (termFac.toString() === fac.toString()
            && nFacsPushed < facFreq) {
            commonFacs[tIdx].push(facPath);
            nFacsPushed++;
          }
        });

      });
    }
  );
  return commonFacs;
}


// Given a list of terms (symbolic or not), returns a list of common
// factors, factorizing all numbers into primes and expanding exponents into
// factors where possible.
// e.g. [12x^2 * y^3, 3x * y^2] becomes [3, x, y, y]
Term.getCommonFactors = function(nodes) {
  const facsPerTerm = nodes.map(n => Factor.fullSplit(n));
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
