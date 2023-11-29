# CKAN Datamap

CKAN Datamap is a generic client-based component that connects to a Fuseki server and shows an ontology schema along with instances.

Current visualization is based on DCAT and other ontologies, applied to the Slovenian data map for open data portal. For more information about the project please see the main repository [https://github.com/FRI-MDP/Podatkovni-zemljevid-2023](https://github.com/FRI-MDP/Podatkovni-zemljevid-2023) or contact [Ministry of Digital Transformation of the Republic of Slovenia](https://www.gov.si/en/state-authorities/ministries/ministry-of-digital-transformation/), contact person Miha Jesenko. Project was designed and developed by Dejan Lavbič and Slavko Žitnik.

The project is loosely coupled with the CKAN project. The component is directly integrated into CKAN Web pages (CKAN landing page and CKAN resource _webview plugin_). Similarly could be integrated into an arbitrary Web page.

DEMO: [https://fri-mdp.github.io/ckan-datamap/](https://fri-mdp.github.io/ckan-datamap/)

Some examples of Datamap visualizations:

![](datamap1.png)
Figure 1: Main visualization of top-level classes.

![](datamap2.png)
Figure 2: Right-click functionality.

![](datamap3.png)
Figure 3: Instances visualization.

![](datamap4.png)
Figure 4: Instances with option to visualize specific resources or namespaces.

![](datamap5.png)
Figure 5: Checking attributes of a specific object.

## Integration guide

CKAN Datamap can be integrated into CKAN Web pages or any data portal by adding JavaScript and CSS files. The JavaScript files located in the `js` folder are responsible for the main functionality of the component. In contrast, the CSS files in the `css` folder are accountable for the component's styling.

### Parameters

By setting query parameters, users can customize the component. Available parameters are listed below.

| Parameter            | Type      | Description                                                                                                       |
| -------------------- | --------- | ----------------------------------------------------------------------------------------------------------------- |
| **`sparqlEndpoint`** | `string`  | URL address of SPARQL endpoint, containing RDF data, default value `https://triplestore.lavbic.net/pz`.           |
| **`schema`**         | `boolean` | `true` (display schema), `false` (display instances), default value `true`.                                       |
| **`instanceGraph`**  | `string`  | Graph name with instances (e.g. `http://onto.mju.gov.si/pz/dataset/vladna-gradiva-2`), default value `undefined`. |

### Examples

The following examples show how to integrate CKAN Datamap into CKAN Web pages or any data portal.

#### Given SPARQL endpoint

[https://fri-mdp.github.io/ckan-datamap/?**sparqlEndpoint**=https://triplestore.lavbic.net/pz](https://fri-mdp.github.io/ckan-datamap/?sparqlEndpoint=https://triplestore.lavbic.net/pz)

#### All instances

[https://fri-mdp.github.io/ckan-datamap/?**schema**=false](https://fri-mdp.github.io/ckan-datamap/?schema=false)

#### Instances in a given graph

[https://fri-mdp.github.io/ckan-datamap/?**schema**=false&**instanceGraph**=http://onto.mju.gov.si/pz/dataset/vladna-gradiva-2](https://fri-mdp.github.io/ckan-datamap/?schema=false&instanceGraph=http://onto.mju.gov.si/pz/dataset/vladna-gradiva-2)

[https://fri-mdp.github.io/ckan-datamap/?**schema**=false&**instanceGraph**=http://onto.mju.gov.si/pz/dataset/erar-evidenca-davcnih-dolznikov-in-nepredlagateljev-davcnih-obracunov](https://fri-mdp.github.io/ckan-datamap/?schema=false&instanceGraph=http://onto.mju.gov.si/pz/dataset/erar-evidenca-davcnih-dolznikov-in-nepredlagateljev-davcnih-obracunov)
