const assert = require('assert');
const math = require('mathjs');
const Status = require('../../lib/node/Status');

function parseSteps(steps) {
  return steps.map(s => {
    s.oldNode = math.parse(s.oldNode);
    s.newNode = math.parse(s.newNode);
    s.substeps = parseSteps(s.substeps);
    return s;
  });
}

function stepsToString(steps) {
  return steps.map(s => {
    s.oldNode = s.oldNode.toString();
    s.newNode = s.newNode.toString();
    s.substeps = stepsToString(s.substeps);
    return s;
  });
}

function testPutStepsInNodePath(exprStr, path, inSteps, expectOutSteps) {
  it(`${path} in ${exprStr}`, function () {
    const expr = math.parse(exprStr);
    const steps = parseSteps(inSteps);
    const out = stepsToString(Status.putStepsInNodePath(expr, path, steps));
    assert.deepEqual(out, expectOutSteps);
  });
}

describe('put steps in node path', function() {
  const tests = [
    ['x + (x + 2 - 3)',
      'args[1].content',
      [{'oldNode': 'x + 2 - 3', 'newNode': 'x - 1',
        'substeps': [
          {'oldNode': 'x + 2 - 3',
            'newNode': 'x - 1',
            'substeps': []}]}],
      [{'oldNode': 'x + (x + 2 - 3)', 'newNode': 'x + (x - 1)',
        'substeps': [
          {'oldNode': 'x + (x + 2 - 3)',
            'newNode': 'x + (x - 1)',
            'substeps': []}]}],
    ]
  ];
  tests.forEach(t => testPutStepsInNodePath(t[0], t[1], t[2], t[3]));
});
