const assert = require('assert');
const mathjs = require('mathjs');
const Terms = require('../../lib/term/Terms');

function testGetTerms(exprString, expectOut) {
  it(exprString + ' -> ' + expectOut.join(', '), function () {
    const expression = mathjs.parse(exprString);
    const out = Terms.getTerms(expression);
    assert.deepEqual(
      out.map(n => n.toString()),
      expectOut);
  });
}

describe('get terms', function() {
  const tests = [
    ['x + 2', ['x', '2']],
    ['x - 2', ['x', '-2']],
    ['(x - 2)', ['(x - 2)']],
    ['2x - 6y^2', ['2 x', '-6 y ^ 2']],
    ['y + (3x - 1)', ['y', '(3 x - 1)']],
  ];
  tests.forEach(t => testGetTerms(t[0], t[1]));
});

