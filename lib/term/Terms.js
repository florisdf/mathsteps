const math = require('mathjs');
const Terms = {};


// Given an expression (symbolic or not), returns a list of all terms by
// simply splitting the top-level additions (and subtractions).
// e.g. x + 2 becomes [x, 2]
//      x - 2 becomes [x, -2]
//      (x - 2) becomes [(x -2)] as it does not contain a top-level + or -
Terms.getTerms = function(node) {
  let terms = [];

  if (node.op === '+') {
    node.args.forEach(n =>
      terms.push(...Terms.getTerms(n)));
  } else if (node.op === '-' && node.args.length > 1) {
    terms.push(...Terms.getTerms(node.args[0]));

    let opposite = math.parse('-' + node.args[1].toString());
    terms.push(...Terms.getTerms(opposite));
  } else {
    terms.push(node);
  }
  return terms;
};

module.exports = Terms;
