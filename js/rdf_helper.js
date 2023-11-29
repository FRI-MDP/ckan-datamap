import {} from "../js/libs/rdflib.min.js";
import { settings } from "./settings.js";

/**
 * Prefixes
 */
const RDF = $rdf.Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#");
const RDFS = $rdf.Namespace("http://www.w3.org/2000/01/rdf-schema#");
const OWL = $rdf.Namespace("http://www.w3.org/2002/07/owl#");
const SKOS = $rdf.Namespace("http://www.w3.org/2004/02/skos/core#");
const DCT = $rdf.Namespace("http://purl.org/dc/terms/");
const FOAF = $rdf.Namespace("http://xmlns.com/foaf/0.1/");

/**
 * Load RDF data from Fuseki and return RDF store
 * @param {string} sparqlQuery SPARQL query
 * @returns RDF store
 */
const loadRDFFuseki = async (sparqlQuery) => {
  const requestUrl = `${
    settings.fusekiEndpoint[settings.fusekiEndpoint.selected]
  }/sparql?query=${encodeURIComponent(sparqlQuery)}`;
  let data = await (await fetch(requestUrl)).text();
  const store = $rdf.graph();
  $rdf.parse(
    data,
    store,
    "http://onto.mju.gov.si/podatkovni-zemljevid#",
    "text/turtle"
  );
  return store;
};

/**
 * Get label of a subject in a given language
 * @param {*} store RDF store
 * @param {*} subject RDF subject
 * @param {string} language language code (e.g. "en", "sl")
 * @param {*} property RDF property
 * @returns label of a subject in a given language
 */
const getLabel = (store, subject, language, property = RDFS("label")) => {
  let labels = store.statementsMatching(subject, property);
  let label;
  try {
    label = labels.find((l) => l.object.language == language).object.value;
    label = label.charAt(0).toUpperCase() + label.slice(1);
  } catch (error) {}
  return label;
};

/**
 * Get English and Slovenian labels of a subject
 * @param {*} store RDF store
 * @param {*} subject RDF subject
 * @param {*} property (multiple) RDF propert(y/ies)
 * @param {*} skipId if true, return undefined if no label is found
 * @returns labels of a subject in English and Slovenian language
 */
const getLabels = (
  store,
  subject,
  property = [DCT("title"), RDFS("label"), SKOS("prefLabel"), RDFS("comment")],
  skipId = false
) => {
  let result = {};
  let id = getIdFromURI(subject.value);
  let label_EN, label_SL;
  if (!property.length) property = [property];
  property.forEach((p) => {
    label_EN = getLabel(store, subject, "en", p);
    label_SL = getLabel(store, subject, "sl", p);
    if (!result.en && label_EN) result.en = label_EN;
    if (!result.sl && label_SL) result.sl = label_SL;
  });
  if (!skipId && !result.en) result.en = id;
  if (!skipId && !result.sl) result.sl = result.en;

  if (
    (!result.en && !result.sl) ||
    (result.en?.length == 0 && result.sl?.length == 0)
  )
    result = undefined;

  return result;
};

/**
 * Get last part of URI as ID (e.g. after last "/" or "#")
 * @param {string} uri URI
 * @returns ID from URI
 */
const getIdFromURI = (uri) => {
  let match = RegExp(/([/#])[^/#]*$/).exec(uri);
  uri = !match ? uri : uri.substring(match.index + 1, uri.length);
  return uri;
};

/**
 * Get English and Slovenian SKOS definitions of a subject
 * @param {*} store RDF store
 * @param {*} subject RDF subject
 * @returns definitions of a subject in English and Slovenian language
 */
const getDefinitions = (store, subject) => {
  let result = {};
  let definitions = store.statementsMatching(subject, SKOS("definition"));
  let definition_EN, definition_SL;
  try {
    definition_EN = definitions.find((d) => d.object.language == "en").object
      .value;
    if (definition_EN) result = { en: definition_EN };
  } catch (error) {}
  try {
    definition_SL = definitions.find((d) => d.object.language == "sl").object
      .value;
    if (!definition_EN) result = { sl: definition_SL };
    else result.sl = definition_SL;
  } catch (error) {}
  return result;
};

/**
 * Get all classes with labels, SKOS definitions and datatype properties
 * from RDF store and return them in a format suitable for Cytoscape.js.
 * @param {*} store RDF store
 * @returns array of objects with data for Cytoscape.js
 */
const schemaClassAsNodesToGraph = (store) => {
  let graphData = [];
  store
    // Get all classes
    .statementsMatching(undefined, RDF("type"), OWL("Class") || RDFS("Class"))
    .forEach((tripleClass) => {
      let dataProperties = [],
        objectProperties = [];
      store
        // Get all datatype properties of a class
        .statementsMatching(undefined, RDFS("domain"), tripleClass.subject)
        .forEach((tripleProperty) => {
          let property = {
            id: tripleProperty.subject.value,
            range: store
              .each(tripleProperty.subject, RDFS("range"))
              .map((t) => t.value)[0],
            label: getLabels(store, tripleProperty.subject),
          };
          // Check if property is a datatype property or object property
          let isDataProperty =
            store.statementsMatching(
              tripleProperty.subject,
              RDF("type"),
              OWL("DatatypeProperty")
            ).length > 0;
          if (isDataProperty) dataProperties.push(property);
          else objectProperties.push(property);
        });
      // Add all subClassesOf as object properties
      store
        .statementsMatching(tripleClass.subject, RDFS("subClassOf"), undefined)
        .forEach((tripleSubClass) => {
          objectProperties.push({
            id: `${tripleSubClass.predicate.value}_${tripleClass.subject.value}_${tripleSubClass.object.value}`,
            range: tripleSubClass.object.value,
            label: { en: "SubClassOf", sl: "Podrazred" },
          });
        });
      // Add id, label and definition
      let nodeData = {
        data: {
          type: "class",
          id: tripleClass.subject.value,
          label: getLabels(store, tripleClass.subject),
          definition: getDefinitions(store, tripleClass.subject),
        },
      };
      // Add properties if they exist
      if (dataProperties.length > 0)
        nodeData.data.dataProperties = dataProperties;
      if (objectProperties.length > 0)
        nodeData.data.objectProperties = objectProperties;
      graphData.push(nodeData);
    });
  return graphData;
};

/**
 * Get all object properties from RDF store and return them in a format suitable for Cytoscape.js
 * @param {*} store RDF store
 * @returns array of objects with data for Cytoscape.js
 */
const schemaPropertiesAsEdgesToGraph = (store) => {
  let graphData = [];
  store
    .statementsMatching(undefined, RDF("type"), undefined)
    // Get all object properties and datatype properties
    .filter(
      (t) =>
        t.object.value == OWL("ObjectProperty").value ||
        t.object.value == OWL("DatatypeProperty").value
    )
    .forEach((tripleObjectProperty) => {
      let range = store
        .each(tripleObjectProperty.subject, RDFS("range"))
        .map((r) => r.value)[0];
      // Check if range value is class
      let isRangeClass =
        range &&
        store.statementsMatching($rdf.sym(range), RDF("type"), OWL("Class"))
          .length > 0;
      if (isRangeClass) {
        store
          .statementsMatching(
            tripleObjectProperty.subject,
            RDFS("domain"),
            undefined
          )
          .forEach((tripleDomain) => {
            // Check if domain value is class
            let isDomainClass =
              store.statementsMatching(
                tripleDomain.object,
                RDF("type"),
                OWL("Class")
              ).length > 0;
            if (isDomainClass) {
              graphData.push({
                data: {
                  id: tripleObjectProperty.subject.value,
                  source: tripleDomain.object.value,
                  target: range,
                  label: getLabels(store, tripleObjectProperty.subject),
                },
              });
            }
          });
      }
    });
  return graphData;
};

/**
 * Convert schema data from RDF store to Cytoscape.js format
 * @param {*} store RDF store
 * @returns graph data in Cytoscape.js format
 */
const schemaConvertToCytoscapeFormat = (store) => {
  return schemaClassAsNodesToGraph(store).concat(
    schemaPropertiesAsEdgesToGraph(store)
  );
};

/**
 * Get all instances from RDF store and return them in a format suitable for
 * Cytoscape.js
 * @param {*} store RDF store
 * @returns arra of objects with data for Cytoscape.js
 */
const instanceAsNodesToGraph = (store) => {
  let graphData = [];

  store
    .statementsMatching(undefined, undefined, undefined)
    .filter((triple) => {
      return (
        triple.predicate.value == RDF("type").value ||
        triple.object.termType == "BlankNode" // Include connected blank nodes
      );
    })
    .map((triple) => triple.subject)
    .filter((v, i, a) => a.indexOf(v) === i) // Filter out distinct instances
    .forEach((element) => {
      let classes = [],
        dataProperties = [],
        objectProperties = [],
        labels =
          element.termType == "BlankNode"
            ? {
                sl: "",
                en: "",
              }
            : getLabels(store, element, DCT("title"));
      store
        .statementsMatching(element, undefined, undefined)
        .forEach((triple) => {
          if (triple.predicate.value == RDF("type").value) {
            classes.push({ id: triple.object.value });
          } else if (triple.object.termType == "Literal") {
            dataProperties.push({
              id: triple.predicate.value,
              value: triple.object.value,
              label: getLabels(store, triple.predicate),
            });
          } else if (
            ["NamedNode", "BlankNode"].includes(triple.object.termType)
          ) {
            let op = {
              id: triple.predicate.value,
              range: triple.object.value,
              label: getLabels(store, triple.predicate),
            };
            let rangeLabel = getLabels(
              store,
              triple.object,
              [
                DCT("title"),
                RDFS("label"),
                SKOS("prefLabel"),
                FOAF("name"),
                RDFS("comment"),
              ],
              true
            );
            if (rangeLabel) op.rangeLabel = rangeLabel;
            objectProperties.push(op);
          } else {
            // FIXME Upoštevaj še ostale vrste elementov, razen Literal,
            // NamedNode in BlankNode
          }
        });
      let nodeData = {
        data: {
          type: "instance",
          id: element.value,
        },
      };
      if (Object.keys(labels).length > 0) nodeData.data.label = labels;
      if (classes.length > 0) nodeData.data.classes = classes;
      if (dataProperties.length > 0)
        nodeData.data.dataProperties = dataProperties;
      if (objectProperties.length > 0)
        nodeData.data.objectProperties = objectProperties;
      graphData.push(nodeData);
    });

  return graphData;
};

/**
 * Get all properties between instances from RDF store and return them in
 * a format suitable for Cytoscape.js
 * @param {*} store  RDF store
 * @return graph data in Cytoscape.js format
 */
const instancePropertiesAsEdgesToGraph = (store) => {
  let graphData = [];

  // Get all instances
  let instances = store
    .statementsMatching(undefined, undefined, undefined)
    .filter((triple) => {
      return (
        triple.predicate.value == RDF("type").value ||
        triple.object.termType == "BlankNode" // Include connected blank nodes
      );
    })
    .map((triple) => triple.subject)
    .filter((v, i, a) => a.indexOf(v) === i)
    .map((instance) => instance.value);

  store
    .statementsMatching(undefined, undefined, undefined)
    .filter(
      (triple) =>
        triple.object.termType != "Literal" &&
        triple.predicate.value != RDF("type").value &&
        instances.includes(triple.subject.value) &&
        instances.includes(triple.object.value)
    )
    .forEach((triple) => {
      graphData.push({
        data: {
          id: `${triple.predicate.value}_${triple.subject.value}_${triple.object.value}`,
          source: triple.subject.value,
          target: triple.object.value,
          label: getLabels(store, triple.predicate),
        },
      });
    });

  return graphData;
};

/**
 * Convert instance data from RDF store to Cytoscape.js format
 * @param {string} graph Fuseki named graph (concept (e.g. dataset) being described)
 * @returns graph data in Cytoscape.js format
 */
const instanceConvertToCytoscapeFormat = (store) => {
  return instanceAsNodesToGraph(store).concat(
    instancePropertiesAsEdgesToGraph(store)
  );
};

/**
 * Get all graphs from Fuseki endpoint
 * @returns array of graph URIs
 */
const getAllGraphs = async () => {
  const requestUrl = `${
    settings.fusekiEndpoint[settings.fusekiEndpoint.selected]
  }/sparql?query=${encodeURIComponent(
    "SELECT DISTINCT ?graph WHERE { GRAPH ?graph { ?s ?p ?o } }"
  )}`;
  let graphs = JSON.parse(
    await (await fetch(requestUrl)).text()
  ).results.bindings.map((d) => d.graph.value);
  return graphs;
};

/**
 * Load RDF data from Fuseki server and convert to Cytoscape.js format
 * @param {string} focusClassUri URI of the focus class
 * @param {string} graph named graph in Fuseki server
 * @param {boolean} schema if true, load schema data, else load instance data
 * @param {number} upLevel number of levels up to which blank node is located
 * @returns graph data in Cytoscape.js format
 */
const graphData = async (focusClassUri, graph, schema = true, upLevel = 0) => {
  if (typeof schema === "string") schema = schema === "true";

  let fromGraph = "";
  if (graph) fromGraph = `FROM <${graph}>`;
  else if (!graph && !schema)
    (await getAllGraphs()).forEach((g) => (fromGraph += `FROM <${g}> `));

  let sparqlQuery = `CONSTRUCT { ?s ?p ?o } ${fromGraph} WHERE { ?s ?p ?o }`;
  sparqlQuery = sparqlQuery.replace(/\s{2,}/g, " ");
  if (focusClassUri) {
    /**
     * Podatki o konceptu, na katerem je fokus
     * (npr. oznaka, definicija, primerek katerega razreda je itd.)
     */
    let triplesClassDetailsWithFocusAsSubject = `{
      BIND(<${focusClassUri}> AS ?s) .
      ?s ?p ?o
    }`;
    /**
     * Podatki o objektnih lastnostih, ki kažejo na (rdfs:range) ali
     * imajo izvor (rdfs:domain) na fokusnem razredu
     * (npr. csv:column rdfs:domain csvw:Schema,
     *       csvw:tableSchema rdfs:range csvw:Schema)
     */
    let triplesPropertiesWithFocusAsObject = `{
      BIND(<${focusClassUri}> AS ?o) .
      ?s ?p ?o
    }`;
    let triplesInstanceDetailsWithFocusAsRange = `{
      ?s ?p1 <${focusClassUri}> .
      ?s ?p ?o
    }`;
    let triplesInstanceDetailsWithFocusAsDomain = `{
      <${focusClassUri}> ?p1 ?s .
      ?s ?p ?o
    }`;
    let triplesTemp = `{
      <${focusClassUri}> ?p1 ?s1 .
      ?s1 ?p2 ?s .
      ?s ?p ?o
    }`;
    /**
     * Podrobni podatki o objektnih lastnostih, ki imajo izvor (rdfs:domain)
     * na fokusnem razredu
     * (npr. oznake, definicije lastnosti in domene lastnosti)
     */
    let triplesPropertyDetailsWithFocusAsDomain = `{
      ?s rdfs:domain <${focusClassUri}> .
      ?s ?p ?o
    }`;
    /**
     * Podatki o konceptu, na katerega kaže objektna lastnosti, ki ima izvor
     * (rdfs:domain) na fokusnem razredu
     * (npr. oznake, definicija, primerek katerega razreda je itd.)
     */
    let triplesClassDetailsInRangeOfPropertyThatHasFocusForDomain = `{
      ?p1 rdfs:domain <${focusClassUri}> .
      ?p1 rdfs:range ?s .
      ?s ?p ?o
    }`;
    /**
     * Podrobni podatki o objektnih lastnostih, ki kažejo (rdfs:range) na
     * fokusni razred
     * (npr. oznake, definicije lastnosti in zaloge vrednosti)
     */
    let triplesPropertiesWithFocusAsRange = `{
      ?s rdfs:range <${focusClassUri}> .
      ?s ?p ?o
    }`;
    /**
     * Podatki o konceptu, na katerega kaže objektna lastnosti, ki kaže
     * (rdfs:range) na fokusni razred
     * (npr. oznake, definicija, primerek katerega razreda je itd.)
     */
    let triplesClassDetailsInDomainOfPropertyThatHasFocusForRange = `{
      ?p1 rdfs:range <${focusClassUri}> .
      ?p1 rdfs:domain ?s .
      ?s ?p ?o
    }`;
    if (schema) {
      sparqlQuery = `
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        CONSTRUCT { ?s ?p ?o }
        ${fromGraph}
        WHERE {
          ${triplesClassDetailsWithFocusAsSubject} UNION 
          ${triplesPropertyDetailsWithFocusAsDomain} UNION 
          ${triplesClassDetailsInRangeOfPropertyThatHasFocusForDomain} UNION 
          ${triplesPropertiesWithFocusAsRange} UNION 
          ${triplesClassDetailsInDomainOfPropertyThatHasFocusForRange} UNION 
          ${triplesPropertiesWithFocusAsObject}
        }`;
    } else {
      console.log("");
      console.log(
        `graphData(${focusClassUri}, ${graph}, ${schema}, ${upLevel})`
      );
      console.log(
        "--------------------------------------------------------------"
      );

      let union = false;
      sparqlQuery = `
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        CONSTRUCT { ?s ?p ?o } ${fromGraph} WHERE {`;
      sparqlQuery += `${triplesClassDetailsWithFocusAsSubject} `;
      union = true;
      sparqlQuery +=
        (union ? " UNION " : "") + `${triplesPropertiesWithFocusAsObject} `;
      sparqlQuery +=
        (union ? " UNION " : "") + `${triplesInstanceDetailsWithFocusAsRange} `;
      sparqlQuery +=
        (union ? " UNION " : "") +
        `${triplesInstanceDetailsWithFocusAsDomain} `;
      if (upLevel == 2)
        sparqlQuery += (union ? " UNION " : "") + `${triplesTemp} `;
      sparqlQuery += "}";
    }
  }
  sparqlQuery = sparqlQuery
    .replace(/[\n\t]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  let store = await loadRDFFuseki(sparqlQuery);

  let graphData = schema
    ? schemaConvertToCytoscapeFormat(store)
    : instanceConvertToCytoscapeFormat(store);
  if (settings.debug) {
    console.log(
      "SPARQL query      : " +
        sparqlQuery +
        "\nNumber of results : " +
        store.length
    );
  }

  return graphData;
};

export { graphData };
