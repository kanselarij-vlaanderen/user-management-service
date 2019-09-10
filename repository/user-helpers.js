import { uuid, sparqlEscapeUri, sparqlEscapeString, sparqlEscapeDateTime,  query, update } from 'mu';

const serviceHomepage = 'https://github.com/lblod/acmidm-login-service';
const resourceBaseUri = process.env.MU_APPLICATION_RESOURCE_BASE_URI || 'http://data.lblod.info/';
const personResourceBaseUri = `${resourceBaseUri}id/persoon/`;
const accountResourceBaseUri = `${resourceBaseUri}id/account/`;
const identifierResourceBaseUri = `${resourceBaseUri}id/identificator/`;

const getGroupsByLabel = async (label) => {
  const graph = `http://mu.semte.ch/graphs/public`;
  const queryString = `
		PREFIX org: <http://www.w3.org/ns/org#>

		SELECT ?group FROM <${graph}> WHERE {
			?group a foaf:Group .
      ?group foaf:name "${label}" . 
		}
	`;
  const data = await query(queryString);
  return parseSparqlResults(data);
};

const ensureUserAndAccount = async function(claims) {
  const graph = `http://mu.semte.ch/graphs/public`;
  const { personUri } = await ensureUser(claims, graph);
  const { accountUri, accountId } = await ensureAccountForUser(personUri, claims, graph);
  return { accountUri, accountId };
};

const ensureUser = async function(claims, graph) {
  // const queryResult = await query(`
  //   PREFIX foaf: <http://xmlns.com/foaf/0.1/>
  //   PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
  //   PREFIX adms: <http://www.w3.org/ns/adms#>
  //   PREFIX dcterms: <http://purl.org/dc/terms/>

  //   SELECT ?person ?personId
  //   FROM <${graph}> {
  //     ?person a foaf:Person ;
  //           mu:uuid ?personId ;
  //           adms:identifier ?identifier .
  //     ?identifier skos:notation ${sparqlEscapeString(claims.userId || '')} .
  //   }`);

  // if (queryResult.results.bindings.length) {
  //   const result = queryResult.results.bindings[0];
  //   return { personUri: result.person.value, personId: result.personId.value };
  // } else {
    const { personUri, personId } = await insertNewUser(claims, graph);
    return { personUri, personId };
  // }
};

const insertNewUser = async function(claims, graph) {
  const personId = uuid();
  const person = `${personResourceBaseUri}${personId}`;
  const identifierId = uuid();
  const identifier = `${identifierResourceBaseUri}${identifierId}`;

  let insertData = `
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX adms: <http://www.w3.org/ns/adms#>
    PREFIX dcterms: <http://purl.org/dc/terms/>
    PREFIX skos: <http://www.w3.org/2004/02/skos/core#>

    INSERT DATA {
      GRAPH <${graph}> {
        ${sparqlEscapeUri(person)} a foaf:Person ;
                                 mu:uuid ${sparqlEscapeString(personId)} ;
                                 dcterms:identifier ${sparqlEscapeUri(identifier)} .

        <${claims.groupUri}> foaf:member ${sparqlEscapeUri(person)} .
        ${sparqlEscapeUri(identifier)} a adms:Identifier ;
                                       mu:uuid ${sparqlEscapeString(identifierId)} ;
                                       skos:notation ${sparqlEscapeString(claims.userId || '')} .
    `;

  if (claims.firstName)
    insertData += `${sparqlEscapeUri(person)} foaf:firstName ${sparqlEscapeString(
      claims.firstName
    )} . \n`;

  if (claims.lastName)
    insertData += `${sparqlEscapeUri(person)} foaf:familyName ${sparqlEscapeString(
      claims.lastName
    )} . \n`;

  insertData += `
      }
    }
  `;

  await update(insertData);

  return { personUri: person, personId: personId };
};

const ensureAccountForUser = async function(personUri, claims, graph) {
  // const accountId = claims.accountIdClaim || '';

  // const queryResult = await query(`
  //   PREFIX foaf: <http://xmlns.com/foaf/0.1/>
  //   PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
  //   PREFIX dcterms: <http://purl.org/dc/terms/>

  //   SELECT ?account ?accountId
  //   FROM <${graph}> {
  //     ${sparqlEscapeUri(personUri)} foaf:account ?account .
  //     ?account a foaf:OnlineAccount ;
  //              mu:uuid ?accountId ;
  //              dcterms:identifier ${sparqlEscapeString(accountId)} .
  //   }`);

  // if (queryResult.results.bindings.length) {
  //   const result = queryResult.results.bindings[0];
  //   return { accountUri: result.account.value, accountId: result.accountId.value };
  // } else {
    const { accountUri, accountId } = await insertNewAccountForUser(personUri, claims, graph);
    return { accountUri, accountId };
  // }
};

const insertNewAccountForUser = async function(person, claims, graph) {
  const accountId = uuid();
  const account = `${accountResourceBaseUri}${accountId}`;
  const now = new Date();

  let insertData = `
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX dcterms: <http://purl.org/dc/terms/>
    PREFIX acmidm: <http://mu.semte.ch/vocabularies/ext/acmidm/>

    INSERT DATA {
      GRAPH <${graph}> {
        ${sparqlEscapeUri(person)} foaf:account ${sparqlEscapeUri(account)} .
        ${sparqlEscapeUri(account)} a foaf:OnlineAccount ;
                                 mu:uuid ${sparqlEscapeString(accountId)} ;
                                 foaf:accountServiceHomepage ${sparqlEscapeUri(serviceHomepage)} ;
                                 dcterms:identifier ${sparqlEscapeString(claims.userId)} ;
                                 dcterms:created ${sparqlEscapeDateTime(now)} .
    `;

  if (claims.vo_doelgroepcode)
    insertData += `${sparqlEscapeUri(account)} acmidm:doelgroepCode ${sparqlEscapeString(
      claims.vo_doelgroepcode
    )} . \n`;

  if (claims.organisation)
    insertData += `${sparqlEscapeUri(account)} acmidm:doelgroepNaam ${sparqlEscapeString(
      claims.organisation
    )} . \n`;

  insertData += `
      }
    }
  `;

  await update(insertData);

  return { accountUri: account, accountId: accountId };
};

const parseSparqlResults = (data) => {
  if (!data) return;
  const vars = data.head.vars;
  return data.results.bindings.map((binding) => {
    let obj = {};
    vars.forEach((varKey) => {
      if (binding[varKey]) {
        obj[varKey] = binding[varKey].value;
      }
    });
    return obj;
  });
};

module.exports = {
  getGroupsByLabel,
  ensureUserAndAccount,
};
