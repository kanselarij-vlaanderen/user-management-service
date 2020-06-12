import { uuid, sparqlEscapeUri, sparqlEscapeString, sparqlEscapeDateTime,  query, update } from 'mu';

const serviceHomepage = 'https://github.com/lblod/acmidm-login-service';
const resourceBaseUri = process.env.MU_APPLICATION_RESOURCE_BASE_URI ;
const personResourceBaseUri = `${resourceBaseUri}id/persoon/`;
const accountResourceBaseUri = `${resourceBaseUri}id/account/`;
const identifierResourceBaseUri = `${resourceBaseUri}id/identificator/`;

const getGroupsByLabel = async (label) => {
  const queryString = `
    PREFIX org: <http://www.w3.org/ns/org#>
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>

		SELECT ?group WHERE {
			?group a foaf:Group .
      ?group foaf:name "${label}" . 
		}
	`;
  const data = await query(queryString);
  return parseSparqlResults(data);
};

const ensureUserAndAccount = async function(claims) {
  const { personUri } = await ensureUser(claims);
  const { accountUri, accountId } = await ensureAccountForUser(personUri, claims);
  return { accountUri, accountId };
};

const ensureUser = async function(claims) {
  const queryResult = await query(`
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX adms: <http://www.w3.org/ns/adms#>
    PREFIX dcterms: <http://purl.org/dc/terms/>

    SELECT ?person ?personId WHERE {
      ?person a foaf:Person ;
            mu:uuid ?personId ;
            adms:identifier ?identifier .
      ?identifier skos:notation ${sparqlEscapeString(claims.userId || '')} .
    }`);

  if (queryResult.results.bindings.length) {
    const result = queryResult.results.bindings[0];
    const foundPersonUri = result.person.value;
    await updateGroupForUser(foundPersonUri, claims);
    return { personUri: foundPersonUri };
  } else {
    const { personUri } = await insertNewUser(claims);
    return { personUri };
  }
};

const insertNewUser = async function(claims) {
  const personId = uuid();
  const person = `${personResourceBaseUri}${personId}`;
  const identifierId = uuid();
  const identifier = `${identifierResourceBaseUri}${identifierId}`;

  let insertData = `
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX adms: <http://www.w3.org/ns/adms#>
    PREFIX skos: <http://www.w3.org/2004/02/skos/core#>

    INSERT DATA {
      ${sparqlEscapeUri(person)} a foaf:Person ;
                                mu:uuid ${sparqlEscapeString(personId)} ;
                                adms:identifier ${sparqlEscapeUri(identifier)} .

      <${claims.groupUri}> foaf:member ${sparqlEscapeUri(person)} .
      ${sparqlEscapeUri(identifier)} a adms:Identifier ;
                                      mu:uuid ${sparqlEscapeString(identifierId)} ;
                                      skos:notation ${sparqlEscapeString(claims.userId || '')} .
    `;

  if (claims.firstName)
    insertData += `${sparqlEscapeUri(person)} foaf:firstName ${sparqlEscapeString(
      claims.firstName
    )} . `;

  if (claims.lastName)
    insertData += `${sparqlEscapeUri(person)} foaf:familyName ${sparqlEscapeString(
      claims.lastName
    )} . `;

  insertData += `
    }
    
  `;
  
  await update(insertData);

  return { personUri: person};
};

const ensureAccountForUser = async function(personUri, claims) {
  const accountId = claims.userId || '';

  const queryResult = await query(`
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX dcterms: <http://purl.org/dc/terms/>

    SELECT ?account ?accountId WHERE {
      ${sparqlEscapeUri(personUri)} foaf:account ?account .
      ?account a foaf:OnlineAccount ;
               mu:uuid ?accountId ;
               dcterms:identifier ${sparqlEscapeString(accountId)} .
    }`);

  if (queryResult.results.bindings.length) {
    const result = queryResult.results.bindings[0];
    return { accountUri: result.account.value, accountId: result.accountId.value };
  } else {
    const { accountUri, accountId } = await insertNewAccountForUser(personUri, claims);
    return { accountUri, accountId };
  }
};

const insertNewAccountForUser = async function(person, claims) {
  const accountId = uuid();
  const account = `${accountResourceBaseUri}${accountId}`;
  const now = new Date();

  let insertData = `
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX dcterms: <http://purl.org/dc/terms/>
    PREFIX acmidm: <http://mu.semte.ch/vocabularies/ext/acmidm/>

    INSERT DATA {
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
    )} . `;

  if (claims.organisation)
    insertData += `${sparqlEscapeUri(account)} acmidm:doelgroepNaam ${sparqlEscapeString(
      claims.organisation
    )} . `;

  insertData += `
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

const updateGroupForUser = async function(personUri, claims) {

let updateData = `
  PREFIX foaf: <http://xmlns.com/foaf/0.1/>
  PREFIX mu: <http://mu.semte.ch/vocabularies/core/>

  DELETE {
    ?group foaf:member ${sparqlEscapeUri(personUri)} .       
  }
  INSERT {
    <${claims.groupUri}> foaf:member ${sparqlEscapeUri(personUri)} .  
  }
  WHERE {
    ?group a foaf:Group ;
          foaf:member ${sparqlEscapeUri(personUri)} .
  }
`;

await update(updateData);

}

module.exports = {
  getGroupsByLabel,
  ensureUserAndAccount,
};
