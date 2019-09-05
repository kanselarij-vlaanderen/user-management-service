const multiparty = require('multiparty');

const parseFormData = (req) => new Promise((resolve, reject) => {
  const form = new multiparty.Form({
    autoFiles: true
  });
  form.parse(req, (err, fields, files) => {
    if (err) reject(err);
    const file = files['file'] && files['file'][0];
    if (!file) {
      reject({
        status: 400,
        code: "FILE_NOT_FOUND",
        message: 'No file found'
      });
    } else {
      let data = {
        file: file
      };
      Object.keys(fields).map((field) => {
        if (field != "file") {
          data[field] = fields[field][0];
        }
      });
      resolve(data);
    }
  });
});

module.exports = { parseFormData };
