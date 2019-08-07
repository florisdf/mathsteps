const _ = require('lodash');
const assert = require('assert');
const mathjs = require('mathjs');
const Term = require('../../lib/term/Term');

function testGetTerms(exprString, expectOut) {
  it(exprString + ' -> ' + expectOut.join(', '), function () {
    const expression = mathjs.parse(exprString);
    const out = Term.getTerms(expression);
    assert.deepEqual(
      out.map(n => n.toString()),
      expectOut);
  });
}

describe('get terms', function() {
  const tests = [
    ['x + 2', ['x', '2']],
    ['x - 2', ['x', '-2']],
    ['x - 2 - b', ['x', '-2', '-b']],
    ['(x - 2)', ['(x - 2)']],
    ['2x - 6y^2', ['2 x', '-6 y ^ 2']],
    ['y + (3x - 1)', ['y', '(3 x - 1)']],
    ['y - (3x - 1)', ['y', '-(3 x - 1)']],
  ];
  tests.forEach(t => testGetTerms(t[0], t[1]));
});


function testTermsRefConsistence(expr, exprPath, termsPath) {
  it(expr + ' terms ref consistence', function () {
    const exprNode = mathjs.parse(expr);
    const terms = Term.getTerms(exprNode);
    assert.equal(_.get(exprNode, exprPath), _.get(terms, termsPath));
  });
}

describe('terms reference consistence', function() {
  const tests = [
    ['x + 2', 'args[0]', '[0]'],
    ['x - 2', 'args[1]', '[1].args[0]'],
    ['(x - 2)', 'contents', '[0].contents'],
    ['y + (3x - 1)', 'args[1]', '[1]'],
    ['y - (3x - 1)', 'args[1]', '[1].args[0]'],
  ];
  tests.forEach(t => testTermsRefConsistence(t[0], t[1], t[2]));
});

function testTermsToNode(terms, expectOut) {
  it(`[${terms.join(', ')}] -> ${expectOut}`, function() {
    const inTerms = terms.map(t => mathjs.parse(t));
    const out = Term.termsToNode(inTerms);
    assert.equal(out.toString(), expectOut);
  });
}

describe('terms to node', function() {
  const tests = [
    [['x'], 'x'],
    [['3', '2x'], '3 + 2 x'],
    [['-x', '1', '-3y'], '-x + 1 - 3 y'],
    [['-x', '1', '-3*y'], '-x + 1 - 3 * y'],
  ];
  tests.forEach(t => testTermsToNode(t[0], t[1]));
});


function testTermsWithCgrpToNode(terms, cgrp) {
  it(`[${terms.join(', ')}] with changegroup ${cgrp}`, function() {
    const inTerms = terms.map(t => {
      const node = mathjs.parse(t);
      node.changeGroup = cgrp;
      return node;
    });
    const out = Term.getTerms(Term.termsToNode(inTerms));
    assert.equal(out[0].changeGroup, cgrp);
  });
}

describe('terms with changeGroup to node', function() {
  const tests = [
    [['x'], 1],
    [['3', '2x'], 0, '3 + 2 x'],
    [['-x', '1', '-3y'], 2, '-x + 1 - 3 y'],
    [['-x', '1', '-3*y'], 3, '-x + 1 - 3 * y'],
  ];
  tests.forEach(t => testTermsWithCgrpToNode(t[0], t[1], t[2]));
});


function testFactorCounts(exprString, expectOut) {
  it(exprString + ' -> ' + expectOut, function () {
    const expression = mathjs.parse(exprString);
    const out = Term.getFactorCounts(expression);

    const outStr = {};
    Object.keys(out).forEach(function (key) {
      outStr[key.toString()] = out[key];
    });
    assert.deepEqual(outStr, expectOut);
  });
}

describe('factor counts', function() {
  const tests = [
    ['x', {'x': 1}],
    ['12x', {'2': 2, '3': 1, 'x': 1}],
    ['12x^2', {'2': 2, '3': 1, 'x': 2}],
    ['12x^2 * y^3', {'2': 2, '3': 1, 'x': 2, 'y': 3}],
    ['12x^2 * 3y^3', {'2': 2, '3': 2, 'x': 2, 'y': 3}],
    ['(x + 1)*(1 + x)', {'x + 1': 2}],
    ['(x + 1)*(3 + x - 2)', {'x + 1': 2}],
    ['(x^2 + 1 - x)*(-x + 1 + x^2)', {'x ^ 2 - x + 1': 2}],
  ];
  tests.forEach(t => testFactorCounts(t[0], t[1]));
});

function testCommonFactors(terms, expectOut) {
  it(terms.join(', ') + ' -> ' + expectOut.join(', '), function () {
    const nodeTerms = terms.map(t => mathjs.parse(t));
    const out = Term.getCommonFactors(nodeTerms);
    assert.deepEqual(out.map(n => n.toString()), expectOut);
  });
}

describe('common factors', function() {
  const tests = [
    [['4', '2'], ['2']],
    [['-4', '-2'], ['2', '-1']],
    [['12', '4'], ['2', '2']],
    [['12x^3', '4x^2'], ['2', '2', 'x', 'x']],
    [['6x * y^2', '9y * x^2'], ['3', 'x', 'y']],
    [['2x * 9y^2', '7x^2'], ['x']],
    [['x', 'y'], []],
    [['y^2/15', 'y/5'], ['y', '1 / 5']],
    [['(x + 1)*5', '15*(1 + x)'], ['5', 'x + 1']],
  ];
  tests.forEach(t => testCommonFactors(t[0], t[1]));
});

function testGcd(terms, expectOut) {
  it(terms.join(', ') + ' -> ' + expectOut, function () {
    const nodeTerms = terms.map(t => mathjs.parse(t));
    const out = Term.gcd(nodeTerms);
    assert.deepEqual(out.toString(), expectOut);
  });
}

describe('gcd', function() {
  const tests = [
    [['4', '2'], '2'],
    [['-4', '-2'], '-2'],
    [['12', '4'], '4'],
    [['12x^3', '4x^2'], '4 * x ^ 2'],
    [['6x * y^2', '9y * x^2'], '3 * x * y'],
    [['2x * 9y^2', '7x^2'], 'x'],
    [['x', 'y'], '1'],
    [['y^2/15', 'y/5'], 'y / 5'],
    [['(x + 1)*5', '15*(1 + x)'], '5 * (x + 1)'],
  ];
  tests.forEach(t => testGcd(t[0], t[1]));
});

function testAreOpposite(term1, term2, expectOut) {
  it(`${term1} and ${term2}` + ' -> ' + expectOut, function () {
    const termNode1 = mathjs.parse(term1);
    const termNode2 = mathjs.parse(term2);
    const out = Term.areOpposite(termNode1, termNode2);
    assert.equal(out, expectOut);
  });
}

describe('are terms opposite', function() {
  const tests = [
    ['3', '-3', true],
    ['-3', '3', true],
    ['3', '3', false],
    ['3', 'x', false],
    ['x', '-x', true],
    ['x * -y', 'x * y', true],
  ];
  tests.forEach(t => testAreOpposite(t[0], t[1], t[2]));
});


function testAreEqual(term1, term2, expectOut) {
  it(`${term1} and ${term2}` + ' -> ' + expectOut, function () {
    const termNode1 = mathjs.parse(term1);
    const termNode2 = mathjs.parse(term2);
    const out = Term.areEqual(termNode1, termNode2);
    assert.equal(out, expectOut);
  });
}

describe('are terms equal', function() {
  const tests = [
    ['3', '-3', false],
    ['3', '3', true],
    ['3', 'x', false],
    ['-x * 2 * y', 'y * x * -2', true],
    ['-x^2 * y', 'y * x * -1 * x', true],
  ];
  tests.forEach(t => testAreEqual(t[0], t[1], t[2]));
});
