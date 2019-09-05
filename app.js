import mu from 'mu';
const formDataParser = require('./repository/parse-form-data.js');
const csvParser = require('./repository/index.js');
const app = mu.app;

app.post('/import-users', async (req, res) => {
	const formData = await formDataParser.parseFormData(req);
	if(!formData || !formData.file)  {
		throw new Error('No file uploaded');
	}
	const file = formData.file;
	const result = await csvParser.processCsvUsersFileFromPath(file.path,null);
	res.send({status:200, body: {result}});
})