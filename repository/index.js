const csvparse = require('csv-parse');
const fs = require('fs');
const transform = require('stream-transform');

// Incoming csv structure: lastName,firstName,user-id,email,organisation,rights

const processCsvUsersFileFromPath = (path, language) => {
  let parser = csvparse({ delimiter: ',', from:2});
  let input = fs.createReadStream(path, 'utf8');
  let batch = [];
  let savedUserName;
	console.log(input);
  let toUsers = transform(function (record) {
    if(record[0] != "") {
      savedUserName = record[0];
		}
    batch.push({ lastName: savedUserName, firstName: record[1], userId: record[2], email: record[3], organisation: record[4], rights: record[5] })
  }, { parallel: 10 });

  input.pipe(parser).pipe(toUsers);

  return new Promise((resolve, reject) => {
    parser.on('end', async function () {
      resolve(batch);
    });
    parser.on('error', function (err) {
      reject(err);
    });
  });
};

module.exports = { processCsvUsersFileFromPath };
