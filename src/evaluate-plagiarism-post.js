// Reads students' code submissions from ./student-code-entries.json
// (generated by collect-code-from-*.js from ./students/*.json)
// and POSTs them to Zino's plagiarism detection API.

const fs = require('fs');
const https = require('https');

const ENTRIES_FILE = './student-code-entries.json';
const SUBMIT_URL = 'https://plagiat.krugazor.eu/api/submit';

// test:
// $ curl -v -X POST --header "Content-Type: application/json" --header "P-Token: ${PLAGIAT_TOKEN}" --data "{\"files\":[]}" https://plagiat.krugazor.eu/api/submit
// $ curl -v -X POST --header "Content-Type: application/json" --header "P-Token: ${PLAGIAT_TOKEN}" --data '{"files":[{"name":"1.js","contents":"console.log(\"a\");"},{"name":"2.js","contents":"console.log(\"b\");"}]}' https://plagiat.krugazor.eu/api/submit

const post = (body) => new Promise((resolve, reject) => {
  const data = JSON.stringify(body);
  const options = {
    method: 'POST',
    hostname: 'plagiat.krugazor.eu',
    port: 443,
    path: '/api/submit',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length,
      'P-Token': process.env.PLAGIAT_TOKEN // secret
    }
  };
  const req = https.request(options, res => {
    console.log(`statusCode: ${res.statusCode}`);
    res.on('data', responseData => resolve(responseData.toString('utf8')));
  })
  req.on('error', reject);
  req.write(data);
  req.end();
});

async function submitEntries(entriesFile) {
  const files = await fs.promises.readFile(entriesFile, { encoding: 'utf8' });
  return await post({ files });
}

console.warn(`Sending code submissions from ${ENTRIES_FILE} to ${SUBMIT_URL}...`)
submitEntries(ENTRIES_FILE)
  .then(result => console.log(result))
  .catch(console.error);
