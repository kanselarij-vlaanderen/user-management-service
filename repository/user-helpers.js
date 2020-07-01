import { uuid, sparqlEscapeUri, sparqlEscapeString, sparqlEscapeDateTime,  query, update } from 'mu';

const serviceHomepage = 'https://github.com/lblod/acmidm-login-service';
const resourceBaseUri = process.env.MU_APPLICATION_RESOURCE_BASE_URI ;
const personResourceBaseUri = `${resourceBaseUri}id/persoon/`;
const accountResourceBaseUri = `${resourceBaseUri}id/account/`;
const identifierResourceBaseUri = `${resourceBaseUri}id/identificator/`;

const getGroupsByLabel = async (label) => {
  const queryString = `
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>

		SELECT ?group WHERE {
			?group a foaf:Group .
      ?group foaf:name "${label}" . 
		}
	`;
  const data = await query(queryString);
  return parseSparqlResults(data);
};

const ensureUserAndAccount = async function(user) {
  const { personUri } = await ensureUser(user);
  const { accountUri, accountId } = await ensureAccountForUser(personUri, user);
  return { accountUri, accountId };
};

const ensureUser = async function(user) {
  const queryResult = await query(`
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX adms: <http://www.w3.org/ns/adms#>
    PREFIX skos: <http://www.w3.org/2004/02/skos/core#>

    SELECT ?person ?personId WHERE {
      ?person a foaf:Person ;
            mu:uuid ?personId ;
            adms:identifier ?identifier .
      ?identifier skos:notation ${sparqlEscapeString(user.userId || '')} .
    }`);

  if (queryResult.results.bindings.length) {
    const result = queryResult.results.bindings[0];
    const foundPersonUri = result.person.value;
    await updateGroupForUser(foundPersonUri, user);
    return { personUri: foundPersonUri };
  } else {
    const { personUri } = await insertNewUser(user);
    return { personUri };
  }
};

const insertNewUser = async function(user) {
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

      <${user.groupUri}> foaf:member ${sparqlEscapeUri(person)} .
      ${sparqlEscapeUri(identifier)} a adms:Identifier ;
                                      mu:uuid ${sparqlEscapeString(identifierId)} ;
                                      skos:notation ${sparqlEscapeString(user.userId || '')} .
    `;

  if (user.firstName)
    insertData += `${sparqlEscapeUri(person)} foaf:firstName ${sparqlEscapeString(
      user.firstName
    )} . `;

  if (user.lastName)
    insertData += `${sparqlEscapeUri(person)} foaf:familyName ${sparqlEscapeString(
      user.lastName
    )} . `;

  insertData += `
    }
    
  `;
  
  await update(insertData);

  return { personUri: person};
};

const ensureAccountForUser = async function(personUri, user) {
  const accountId = user.userId || '';

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
    const { accountUri, accountId } = await insertNewAccountForUser(personUri, user);
    return { accountUri, accountId };
  }
};

const insertNewAccountForUser = async function(person, user) {
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
                                dcterms:identifier ${sparqlEscapeString(user.userId)} ;
                                dcterms:created ${sparqlEscapeDateTime(now)} .
    `;

  if (user.vo_doelgroepcode)
    insertData += `${sparqlEscapeUri(account)} acmidm:doelgroepCode ${sparqlEscapeString(
      user.vo_doelgroepcode
    )} . `;

  if (user.organisation)
    insertData += `${sparqlEscapeUri(account)} acmidm:doelgroepNaam ${sparqlEscapeString(
      user.organisation
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

const updateGroupForUser = async function(personUri, user) {

let updateData = `
  PREFIX foaf: <http://xmlns.com/foaf/0.1/>

  DELETE {
    ?group foaf:member ${sparqlEscapeUri(personUri)} .       
  }
  INSERT {
    <${user.groupUri}> foaf:member ${sparqlEscapeUri(personUri)} .  
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
