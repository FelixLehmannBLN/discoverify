const inquirer = require('inquirer');

const prompt = [
  { type: 'input', message: 'Username', name: 'username' },
  { type: 'input', message: 'OAuth Token', name: 'token' }
]

exports.default = function() {
  return new Promise((resolve, reject) => {
    inquirer
      .prompt(prompt)
      .then(function (answers) {
        resolve(answers);
      }).catch(err => reject(err));
  })
}